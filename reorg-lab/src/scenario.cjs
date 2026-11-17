// Reorg thật với Cellora indexer nguyên bản: DB và poller của Cellora sống xuyên suốt reorg.
// Chain setup lấy từ spike.cjs. Harness chỉ gửi tx và quan sát; không gọi rollback của Cellora.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { ccc } = require('@ckb-ccc/core');
const adapter = require('./service-adapter.cjs');

const { evaluate } = require('./service-verdict.cjs');
const root = process.env.REORG_RUN_DIR;
const ports = JSON.parse(process.env.REORG_PORTS);
const journal = path.join(root, `service-journal-${Date.now()}.jsonl`);
const binary = process.env.CKB_BIN;
const alwaysSuccess = process.env.ALWAYS_SUCCESS;
const lock = { code_hash: ccc.hashCkb(fs.readFileSync(alwaysSuccess)), hash_type: 'data', args: '0x' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const POLL_MS = Number(process.env.POLL_MS || 1000);
const DEADLINE_MS = Number(process.env.DEADLINE_MS || 30000);
const evidence = [];

function log(event, value) {
  const row = { time: new Date().toISOString(), event, ...value };
  evidence.push(row);
  fs.appendFileSync(journal, JSON.stringify(row) + "\n");
  console.log(JSON.stringify(row));
  return row;
}

async function rpc(port, method, params = []) {
  const response = await fetch(`http://127.0.0.1:${port}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

async function until(label, check, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { const result = await check(); if (result) return result; } catch (error) { last = error.message; }
    await sleep(POLL_MS);
  }
  throw new Error(`Timeout: ${label}${last ? ` (${last})` : ''}`);
}

async function mine(port, count) {
  for (let i = 0; i < count; i++) {
    const before = await rpc(port, 'get_tip_header');
    await rpc(port, 'generate_block');
    await until('new block', async () => BigInt((await rpc(port, 'get_tip_header')).number) > BigInt(before.number));
    await sleep(120);
  }
}

async function startNode(dir, rpcPort, p2pPort) {
  const init = spawnSync(binary, ['init', '-C', dir, '--chain', 'dev', '--genesis-message', 'reorg-spike-fixed',
    '--rpc-port', String(rpcPort), '--p2p-port', String(p2pPort), '--ba-arg', '0x' + '11'.repeat(20)], { encoding: 'utf8', windowsHide: true });
  if (init.status !== 0) throw new Error(`init failed: ${init.stdout} ${init.stderr}`);
  fs.copyFileSync(alwaysSuccess, path.join(dir, 'specs/always_success'));
  const extras = `\n[[genesis.system_cells]]\nfile = { file = "always_success" }\ncreate_type_id = false\n\n[[genesis.issued_cells]]\ncapacity = 100000000000\nlock.code_hash = "${lock.code_hash}"\nlock.args = "0x"\nlock.hash_type = "data"\n\n`;
  const specPath = path.join(dir, 'specs/dev.toml');
  fs.writeFileSync(specPath, fs.readFileSync(specPath, 'utf8').replace('[params]', extras + '[params]'));
  const configPath = path.join(dir, 'ckb.toml');
  fs.writeFileSync(configPath, fs.readFileSync(configPath, 'utf8')
    .replace(/modules = \[[^\]]*\]/, 'modules = ["Net", "Pool", "Miner", "Chain", "Stats", "IntegrationTest"]')
    .replace('connect_outbound_interval_secs = 15', 'connect_outbound_interval_secs = 100000')
    .replace('"Discovery", ', '')
    .replace(`/ip4/0.0.0.0/tcp/${p2pPort}`, `/ip4/127.0.0.1/tcp/${p2pPort}`)
    .replace('discovery_local_address = true', 'discovery_local_address = false')
    .replace('cache_size = 268435456', 'cache_size = 16777216'));
  const out = fs.openSync(path.join(dir, 'stdout.log'), 'a');
  const err = fs.openSync(path.join(dir, 'stderr.log'), 'a');
  const child = spawn(binary, ['run', '-C', dir], { windowsHide: true, stdio: ['ignore', out, err] });
  fs.closeSync(out); fs.closeSync(err);
  child.on('error', error=>{ child.launchError=error; });
  await until('node RPC startup', async () => {
    if (child.launchError) throw child.launchError;
    if (child.exitCode !== null) throw new Error(`node exit ${child.exitCode}: ${fs.readFileSync(path.join(dir, 'stderr.log'), 'utf8')}`);
    return await rpc(rpcPort, 'get_tip_header');
  }).catch(async error=>{await stopNode(child);throw error;});
  return child;
}

async function resumeNode(dir, port) {
  const fd = fs.openSync(path.join(dir,'resumed.log'),'a');
  const child = spawn(binary,['run','-C',dir],{windowsHide:true,stdio:['ignore',fd,fd]});
  fs.closeSync(fd);
  await until('resumed node RPC',()=>rpc(port,'get_tip_header'));
  return child;
}
async function cleanup(service,...children) {
  const outcomes=await Promise.allSettled([adapter.stopService(service),...children.map(stopNode)]);
  const failures=outcomes.filter(x=>x.status==='rejected').map(x=>x.reason.message);
  log('cleanup',{servicePid:service?.pid,nodePids:children.filter(Boolean).map(c=>c.pid),failures,verdict:failures.length?'ERROR':'PASS'});
  if(failures.length)throw new Error('Cleanup failed: '+failures.join('; '));
}
async function stopNode(child) {
  if (!child || child.launchError || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  await until('node stopped', () => child.exitCode !== null || child.signalCode !== null, 10000);
  log('node_stopped', { pid: child.pid, exitCode: child.exitCode, signal: child.signalCode });
}

function cellState(snapshot, which) {
  const row = snapshot.records?.[which];
  return row ? row.split('|')[0] : null;
}

// Chờ checkpoint của Cellora khớp hash canonical tại một height, không chỉ bằng height.
async function waitCanonical(port, current, currentPoints, predicate, timeout) {
  return await until('cellora canonical', async () => {
    const snap = adapter.readState(current, currentPoints);
    if (snap.error || !snap.checkpoint) return false;
    const canonical = await rpc(port, 'get_header_by_number', ['0x' + snap.checkpoint.height.toString(16)]);
    const outcome = evaluate(snap, canonical?.hash, 0, predicate(snap));
    if (outcome.verdict !== 'PASS') return false;
    log('snapshot', { snapshot: snap, outcome });
    return snap;
  }, timeout);
}

async function trial(run) {
  const dir = path.join(root, `service-run-${run}-${Date.now()}`);
  fs.mkdirSync(dir);
  const a = ports.rpcA, b = ports.rpcB;
  let childA, childB, service;
  const stages = {};
  try {
    childA = await startNode(path.join(dir, 'a'), a, ports.p2pA);
    childB = await startNode(path.join(dir, 'b'), b, ports.p2pB);
    assert.equal((await rpc(a, 'get_block_by_number', ['0x0'])).header.hash, (await rpc(b, 'get_header_by_number', ['0x0'])).hash);
    await mine(a, 4);
    for (let height = 1; height <= 4; height++) {
      const block = await rpc(a, 'get_block_by_number', ['0x' + height.toString(16)]);
      delete block.header.hash;
      for (const transaction of block.transactions) delete transaction.hash;
      await rpc(b, 'submit_block', ['', block]);
    }
    const peerB = await rpc(b, 'local_node_info');
    const connect = () => rpc(a, 'add_node', [peerB.node_id, `/ip4/127.0.0.1/tcp/${ports.p2pB}`]);
    await connect();
    await until('common tip', async () => (await rpc(a, 'get_tip_header')).hash === (await rpc(b, 'get_tip_header')).hash);
    const common = await rpc(a, 'get_tip_header');
    await rpc(a, 'remove_node', [peerB.node_id]);
    await until('partition', async () => (await rpc(a, 'get_peers')).length === 0 && (await rpc(b, 'get_peers')).length === 0);

    const genesis = await rpc(a, 'get_block_by_number', ['0x0']);
    const sourceTx = genesis.transactions.find(tx => tx.outputs.some(o => o.lock.code_hash === lock.code_hash && o.capacity === '0x174876e800'));
    const input = { tx_hash: sourceTx.hash, index: '0x' + sourceTx.outputs.findIndex(o => o.lock.code_hash === lock.code_hash && o.capacity === '0x174876e800').toString(16) };
    const codeTx = genesis.transactions.find(tx => tx.outputs_data.some(data => ccc.hashCkb(data) === lock.code_hash));
    const codeIndex = codeTx.outputs_data.findIndex(data => ccc.hashCkb(data) === lock.code_hash);
    const tx = { version: '0x0', cell_deps: [{ out_point: { tx_hash: codeTx.hash, index: '0x' + codeIndex.toString(16) }, dep_type: 'code' }],
      header_deps: [], inputs: [{ previous_output: input, since: '0x0' }],
      outputs: [{ capacity: '0x' + (100000000000n - 100000n).toString(16), lock }], outputs_data: ['0x'], witnesses: ['0x'] };
    const txHash = await rpc(a, 'send_transaction', [tx, 'passthrough']);
    const output = { tx_hash: txHash, index: '0x0' };
    const points = { txHash, input, output };

    service = adapter.startService({ runDir: path.join(dir, 'cellora'), rpcUrl: `http://127.0.0.1:${a}` });
    for (let i = 0; i < 16; i++) {
      await mine(a, 1);
      if ((await rpc(a, 'get_transaction', [txHash]))?.tx_status.status === 'committed') break;
    }
    const committed = await rpc(a, 'get_transaction', [txHash]);
    assert.equal(committed.tx_status.status, 'committed');
    const oldBlockHash = committed.tx_status.block_hash;
    const oldHeader = await rpc(a, 'get_header', [oldBlockHash]);

    const committedHeight = Number(BigInt(oldHeader.number));
    const before = await waitCanonical(a, service, points, snap => snap.checkpoint.height >= committedHeight && cellState(snap, 'output') === 'live' && cellState(snap, 'input') === 'consumed', DEADLINE_MS);
    const dbOid = before.databaseIdentity.oid;
    stages.committed = { checkpoint: before.checkpoint, input: cellState(before, 'input'), output: cellState(before, 'output'), dbOid, oldBlockHash, oldHeight: oldHeader.number };
    log('committed', { run, ...stages.committed });

    const ahead = Number(BigInt((await rpc(a, 'get_tip_header')).number) - BigInt(common.number)) + 4;
    await mine(b, ahead);
    await connect();
    await until('chain switch', async () => (await rpc(a, 'get_tip_header')).hash === (await rpc(b, 'get_tip_header')).hash, 45000);
    const canonicalAtOld = await rpc(a, 'get_header_by_number', [oldHeader.number]);
    assert.notEqual(canonicalAtOld.hash, oldBlockHash, 'block cũ không còn canonical');
    // Một block mới sau điểm phân nhánh để Cellora thấy parent_hash lệch và tự rollback.
    await mine(a, 1);

    const after = await waitCanonical(a, service, points, snap =>
      snap.databaseIdentity.oid === dbOid && cellState(snap, 'output') === null && cellState(snap, 'input') === 'live'
      && snap.applicationState.reorgLogRows > 0, DEADLINE_MS);
    stages.reorg = { checkpoint: after.checkpoint, input: cellState(after, 'input'), output: cellState(after, 'output'), reorgLogRows: after.applicationState.reorgLogRows, canonicalAtOldHeight: canonicalAtOld.hash };
    log('reorg', { run, ...stages.reorg });

    for (let i = 0; i < 16; i++) {
      await mine(a, 1);
      if ((await rpc(a, 'get_transaction', [txHash]))?.tx_status.status === 'committed') break;
    }
    const recommitted = await rpc(a, 'get_transaction', [txHash]);
    assert.equal(recommitted.tx_status.status, 'committed');
    assert.notEqual(recommitted.tx_status.block_hash, oldBlockHash);
    const recommitHeader = await rpc(a, 'get_header', [recommitted.tx_status.block_hash]);
    const restored = await waitCanonical(a, service, points, snap => snap.checkpoint.height >= Number(BigInt(recommitHeader.number)) && cellState(snap, 'output') === 'live' && cellState(snap, 'input') === 'consumed', DEADLINE_MS);
    const dupes = adapter.psql(service.databaseUrl, `select count(*) from cells where tx_hash = decode('${txHash.slice(2)}', 'hex') and output_index = 0;`);
    assert.equal(dupes, '1', 'không có bản ghi cell trùng');
    stages.recommit = { blockHash: recommitted.tx_status.block_hash, outputRows: Number(dupes), checkpoint: restored.checkpoint };
    log('recommit', { run, ...stages.recommit });

    const pidBefore = service.pid;
    const keptUrl = service.databaseUrl;
    service.child.kill();
    await until('indexer stopped', () => service.exitCode !== undefined, 10000);
    service.created = false;
    await adapter.stopService(service);
    service = adapter.startService({ runDir: path.join(dir, 'cellora-restart'), rpcUrl: `http://127.0.0.1:${a}`, databaseUrl: keptUrl });
    await mine(a, 1);
    const restartTip = await rpc(a, 'get_tip_header');
    const resumed = await waitCanonical(a, service, points, snap =>
      snap.databaseIdentity.oid === dbOid && snap.checkpoint.hash === restartTip.hash && snap.checkpoint.height > restored.checkpoint.height && cellState(snap, 'output') === 'live' && snap.servicePid !== pidBefore, DEADLINE_MS);
    const rowsAfterRestart = adapter.psql(keptUrl, `select count(*) from cells where tx_hash = decode('${txHash.slice(2)}', 'hex') and output_index = 0;`);
    assert.equal(rowsAfterRestart, '1', 'restart không thêm bản ghi');
    stages.restart = { pidBefore, pidAfter: resumed.servicePid, sameDatabase: resumed.databaseIdentity.oid === dbOid, snapshot: resumed, newBlock: restartTip.hash, outputRows: Number(rowsAfterRestart) };
    log('trial_passed', { run, txHash, stages, directory: dir });
    return { run, txHash, stages, verdict: 'PASS', directory: dir };
  } catch (error) {
    log('trial_failed', { run, error: error.stack, stages });
    return { run, stages, verdict: 'ERROR', error: error.message };
  } finally {
    await cleanup(service, childA, childB);
  }
}

// Negative control 1: node A dừng sau khi Cellora đã index. Checkpoint phải đứng yên;
// một snapshot cũ không được tính là đã theo kịp canonical chain.
async function controlRpcDown() {
  const dir = path.join(root, `service-control-rpc-${Date.now()}`);
  fs.mkdirSync(dir);
  const a = ports.rpcA;
  let childA, service;
  try {
    childA = await startNode(path.join(dir, 'a'), a, ports.p2pA);
    await mine(a, 3);
    service = adapter.startService({ runDir: path.join(dir, 'cellora'), rpcUrl: `http://127.0.0.1:${a}` });
    const tip = await rpc(a, 'get_tip_header');
    await until('indexed', async () => { const s = adapter.readState(service, {}); return s.checkpoint && s.checkpoint.hash === tip.hash ? s : false; }, DEADLINE_MS);
    const before = adapter.readState(service, {});
    await stopNode(childA); childA = null;
    await sleep(POLL_MS * 4);
    const after = adapter.readState(service, {});
    const stalled = Boolean(after.checkpoint) && after.checkpoint.hash === before.checkpoint.hash && !after.error;
    let canonicalHash = null;
    try { canonicalHash = (await rpc(a, 'get_tip_header')).hash; } catch {}
    const observed = evaluate(after, canonicalHash, before.checkpoint.height, true);
    assert.notEqual(observed.verdict, 'PASS');
    childA = await resumeNode(path.join(dir, 'a'), a);
    await mine(a, 1);
    const recoveryTip = await rpc(a, 'get_tip_header');
    const recovered = await waitCanonical(a, service, {}, s => s.checkpoint.hash === recoveryTip.hash && s.databaseIdentity.oid === before.databaseIdentity.oid, DEADLINE_MS);
    log('control_rpc_recovery', { observed, before, after, recovered });
    const verdict = stalled ? 'PASS' : 'FAIL';
    log('control_rpc_down', { stalled, checkpoint: after.checkpoint, verdict, directory: dir });
    return verdict;
  } catch (error) {
    log('control_rpc_down', { verdict: 'ERROR', error: error.message });
    return 'ERROR';
  } finally { await cleanup(service, childA); }
}

// Negative control 2: dừng indexer, reorg chain trong lúc DB đứng yên, rồi restart cùng DB.
// Dữ liệu đọc lúc indexer chết không được tính là đã xử lý reorg; sau restart mới được.
async function controlServiceStopped() {
  const dir = path.join(root, `service-control-stopped-${Date.now()}`);
  fs.mkdirSync(dir);
  const a = ports.rpcA, b = ports.rpcB;
  let childA, childB, service;
  try {
    childA = await startNode(path.join(dir, 'a'), a, ports.p2pA);
    childB = await startNode(path.join(dir, 'b'), b, ports.p2pB);
    await mine(a, 4);
    for (let h = 1; h <= 4; h++) {
      const block = await rpc(a, 'get_block_by_number', ['0x' + h.toString(16)]);
      delete block.header.hash;
      for (const t of block.transactions) delete t.hash;
      await rpc(b, 'submit_block', ['', block]);
    }
    const peerB = await rpc(b, 'local_node_info');
    const connect = () => rpc(a, 'add_node', [peerB.node_id, `/ip4/127.0.0.1/tcp/${ports.p2pB}`]);
    await connect();
    await until('synced', async () => (await rpc(a, 'get_tip_header')).hash === (await rpc(b, 'get_tip_header')).hash);
    const common = await rpc(a, 'get_tip_header');
    await rpc(a, 'remove_node', [peerB.node_id]);
    await until('split', async () => (await rpc(a, 'get_peers')).length === 0 && (await rpc(b, 'get_peers')).length === 0);

    service = adapter.startService({ runDir: path.join(dir, 'cellora'), rpcUrl: `http://127.0.0.1:${a}` });
    await mine(a, 3);
    const tipA = await rpc(a, 'get_tip_header');
    await until('caught up', async () => { const s = adapter.readState(service, {}); return s.checkpoint && s.checkpoint.hash === tipA.hash ? s : false; }, DEADLINE_MS);
    const stale = adapter.readState(service, {});
    const orphanHeight = tipA.number;
    const orphanHash = tipA.hash;

    service.child.kill();
    await until('indexer down', () => service.exitCode !== undefined, 10000);
    service.created = false;
    const keptUrl = service.databaseUrl;

    await mine(b, Number(BigInt(tipA.number) - BigInt(common.number)) + 4);
    await connect();
    await until('switched', async () => (await rpc(a, 'get_tip_header')).hash === (await rpc(b, 'get_tip_header')).hash, 45000);
    const canonical = await rpc(a, 'get_header_by_number', [orphanHeight]);
    assert.notEqual(canonical.hash, orphanHash, 'chưa có reorg thật');
    await mine(a, 1);

    const duringStop = adapter.readState(service, {});
    const frozen = Boolean(duringStop.checkpoint) && duringStop.checkpoint.hash === stale.checkpoint.hash;
    assert.equal(frozen, true, 'DB đổi trong lúc indexer tắt');
    const observed = evaluate(duringStop, (await rpc(a, 'get_header_by_number', ['0x'+duringStop.checkpoint.height.toString(16)])).hash, Number(BigInt((await rpc(a,'get_tip_header')).number)), true);
    assert.notEqual(observed.verdict, 'PASS');
    log('control_stopped_observation', { observed, stale, duringStop });

    const restarted = adapter.startService({ runDir: path.join(dir, 'cellora-resumed'), rpcUrl: `http://127.0.0.1:${a}`, databaseUrl: keptUrl });
    service = restarted;
    const newTip = await rpc(a, 'get_tip_header');
    const recovered = await waitCanonical(a, restarted, {}, s => {
      return s.checkpoint.hash === newTip.hash && s.applicationState.reorgLogRows > 0 && s.databaseIdentity.oid === stale.databaseIdentity.oid;
    }, DEADLINE_MS);
    log('control_service_stopped', {
      verdict: 'PASS', frozen, recovered: true, reorgLogRows: recovered.applicationState.reorgLogRows,
      orphanHash, canonicalHash: canonical.hash, sameDatabase: recovered.databaseIdentity.oid === stale.databaseIdentity.oid, directory: dir,
    });
    return 'PASS';
  } catch (error) {
    log('control_service_stopped', { verdict: 'ERROR', error: error.message });
    return 'ERROR';
  } finally { await cleanup(service, childA, childB); }
}

(async () => {
  const crypto = require('node:crypto');
  const files = { runner: __filename, adapter: require.resolve('./service-adapter.cjs'), evaluator: require.resolve('./service-verdict.cjs'), celloraBinary: process.env.CELLORA_BIN, ckbBinary: binary };
  const hashes = Object.fromEntries(Object.entries(files).map(([name,file])=>[name,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  const provenance = { upstreamCommit: 'a534c38f248c0406eeafee94adadb8c2c9072f8a', hashes };
  log('provenance', provenance);
  log('environment', { ckb: spawnSync(binary, ['--version'], { encoding: 'utf8', windowsHide: true }).stdout.trim(), node: process.version, target: 'cellora a534c38', pollMs: POLL_MS, deadlineMs: DEADLINE_MS });
  const results = [];
  for (let run = 1; run <= Number(process.env.TRIALS || 1); run++) results.push(await trial(run));
  const controls = {};
  if (process.env.CONTROLS !== '0') {
    controls.rpcDown = await controlRpcDown();
    controls.serviceStopped = await controlServiceStopped();
  }
  const out = path.join(root, `evidence-service-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify({ schemaVersion: 3, journal, provenance, evidence, results, controls }, null, 2));
  log('done', { evidence: out, verdicts: results.map(r => r.verdict), controls });
  const failed = results.some(r => r.verdict !== 'PASS') || Object.values(controls).some(v => v === 'FAIL' || v === 'ERROR');
  if (failed) process.exitCode = 1;
})().catch(error => { log('spike_failed', { error: error.stack }); process.exitCode = 1; });
