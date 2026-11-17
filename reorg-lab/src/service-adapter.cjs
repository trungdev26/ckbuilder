// Lifecycle cho Cellora indexer (commit a534c38), poller tự chạy.
// SQL ở đây chỉ SELECT. Mọi ghi do migration và poller của Cellora thực hiện.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const PSQL = process.env.PSQL;
const INDEXER = process.env.CELLORA_BIN;
const ADMIN_URL = process.env.CELLORA_ADMIN_URL;

function psql(databaseUrl, sql) {
  const result = spawnSync(PSQL, ['-d', databaseUrl, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql],
    { encoding: 'utf8', windowsHide: true, timeout: 5000, env: { ...process.env, PGCONNECT_TIMEOUT: '3', PGOPTIONS: '-c statement_timeout=3000' } });
  if (result.status !== 0) throw new Error(`psql: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function databaseIdentity(databaseUrl) {
  const [oid, name] = psql(databaseUrl, 'select oid::text || \'|\' || datname from pg_database where datname = current_database();').split('|');
  return { oid, name, url: databaseUrl.replace(/:[^:@/]*@/, ':***@') };
}

function startService({ runDir, rpcUrl, databaseUrl }) {
  fs.mkdirSync(runDir, { recursive: true });
  let ownedUrl = databaseUrl;
  let dbName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : null;
  let created = false;
  if (!ownedUrl) {
    dbName = `cellora_${Date.now().toString(36)}_${Math.floor(Math.random() * 1296).toString(36)}`;
    psql(ADMIN_URL, `create database ${dbName};`);
    const url = new URL(ADMIN_URL);
    url.pathname = '/' + dbName;
    ownedUrl = url.toString();
    created = true;
  }
  const logPath = path.join(runDir, 'cellora.log');
  const out = fs.openSync(logPath, 'a');
  const env = {
    ...process.env,
    PATH: path.dirname(PSQL) + path.delimiter + process.env.PATH,
    CELLORA_DATABASE_URL: ownedUrl,
    CELLORA_CKB_RPC_URL: rpcUrl,
    CELLORA_POLL_INTERVAL_MS: process.env.CELLORA_POLL_INTERVAL_MS || '1000',
    CELLORA_INDEXER_START_BLOCK: '0',
    CELLORA_LOG_FORMAT: 'json',
    CELLORA_LOG_LEVEL: 'info',
    CELLORA_INDEXER_METRICS_BIND_ADDR: process.env.CELLORA_METRICS_ADDR || '127.0.0.1:19100',
  };
  const child = spawn(INDEXER, [], { env, windowsHide: true, stdio: ['ignore', out, out] });
  fs.closeSync(out);
  const handle = { pid: child.pid, child, databaseUrl: ownedUrl, dbName, created, logPath };
  child.on('error', error => { handle.spawnError = error.message; });
  child.on('exit', (code, signal) => { handle.exitCode = code; handle.exitSignal = signal; });
  return handle;
}

function readState(handle, { txHash, input, output }) {
  const observedAt = new Date().toISOString();
  try {
    const cell = point => {
      if (!point) return 'NULL';
      if (!/^0x[0-9a-f]{64}$/i.test(point.tx_hash) || !Number.isSafeInteger(Number(point.index))) throw new Error('Invalid outpoint');
      return `(select json_build_object('state', case when consumed_by_tx_hash is null then 'live' else 'consumed' end, 'createdHeight', block_number, 'consumedHeight', consumed_at_block_number) from cells where tx_hash=decode('${point.tx_hash.slice(2)}','hex') and output_index=${Number(point.index)})`;
    };
    // One statement: all subqueries share the same PostgreSQL MVCC snapshot.
    const data = JSON.parse(psql(handle.databaseUrl, `select json_build_object(
      'databaseIdentity', (select json_build_object('oid',oid::text,'name',datname) from pg_database where datname=current_database()),
      'checkpoint', (select json_build_object('height',last_indexed_block,'hash','0x'||encode(last_indexed_hash,'hex')) from indexer_state where id=1),
      'applicationState', json_build_object('reorgLogRows',(select count(*) from reorg_log)),
      'cells', json_build_object('input',${cell(input)},'output',${cell(output)}));`));
    const record = c => c ? c.state + '|' + (c.consumedHeight ?? '') : null;
    return { observedAt, servicePid: handle.pid, serviceAlive: !handle.spawnError && handle.child.exitCode === null && handle.child.signalCode === null,
      serviceExitCode: handle.exitCode ?? null, spawnError: handle.spawnError ?? null,
      ...data, records: { input: record(data.cells.input), output: record(data.cells.output) }, error: null };

  } catch (error) {
    return { observedAt, servicePid: handle.pid, databaseIdentity: null, checkpoint: null, applicationState: null, records: null, error: error.message };
  }
}

async function stopService(handle) {
  if (!handle) return;
  if (handle.child && handle.child.exitCode === null && handle.child.signalCode === null) {
    handle.child.kill();
    await new Promise(resolve => { const t = setTimeout(resolve, 8000); handle.child.on('exit', () => { clearTimeout(t); resolve(); }); });
  }
  if (handle.child.exitCode === null && handle.child.signalCode === null) throw new Error('Indexer did not stop within 8 seconds');
  // Retain databases as evidence, including failed trials and negative controls.
}

module.exports = { startService, readState, stopService, psql, ADMIN_URL };
