import { hashCkb, hexFrom, Transaction, hashTypeToBytes, numToBytes, WitnessArgs } from '@ckb-ccc/core';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { Resource, Verifier, DEFAULT_SCRIPT_ALWAYS_SUCCESS, DEFAULT_SCRIPT_CKB_JS_VM } from 'ckb-testtool';

const PASSPHRASE = hexFrom(Buffer.from('Week 5 practice'));
const MIN_SINCE = 0x4000000000000000n | 1700000000n;
const ARGS = hashCkb(PASSPHRASE) + hexFrom(numToBytes(MIN_SINCE, 8)).slice(2);

function mockUnlock({ args, witness = PASSPHRASE, since = MIN_SINCE, extraSince, format = 'bc', attacker = false, secondAttacker = false }:
  { args?: string; witness?: string | null; since?: bigint; extraSince?: bigint; format?: 'bc' | 'js'; attacker?: boolean; secondAttacker?: boolean } = {}) {
    const resource = Resource.default();
    const tx = Transaction.default();

    const mainScript = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_CKB_JS_VM)), tx, false);
    const alwaysSuccessScript = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)), tx, false);
    const contractScript = resource.deployCell(hexFrom(readFileSync(`dist/time-hash-lock.${format}`)), tx, false);

    mainScript.args = hexFrom(
      '0x0000' +
        contractScript.codeHash.slice(2) +
        hexFrom(hashTypeToBytes(contractScript.hashType)).slice(2) +
        (args ?? ARGS + alwaysSuccessScript.hash().slice(2)).slice(2),
    );

    const inputCell = resource.mockCell(mainScript);
    tx.inputs.push(Resource.createCellInput(inputCell));
    tx.inputs[0].since = since;
    if (extraSince !== undefined) {
      tx.inputs.push(Resource.createCellInput(resource.mockCell(mainScript)));
      tx.inputs[1].since = extraSince;
    }
    const attackerScript = alwaysSuccessScript.clone();
    attackerScript.args = '0x01';
    tx.outputs.push(Resource.createCellOutput(attacker ? attackerScript : alwaysSuccessScript));
    if (secondAttacker) {
      tx.outputs.push(Resource.createCellOutput(attackerScript));
      tx.outputsData.push('0x');
    }
    tx.outputsData.push('0x');
    if (witness !== null) tx.witnesses.push(hexFrom(WitnessArgs.from({ lock: hexFrom(witness) }).toBytes()));

    const verifier = Verifier.from(resource, tx);
    verifier.setWasmDebuggerEnabled(false);
    return verifier;
}

describe('time-hash-lock mock unlock', () => {
  test('rejects recipient substitution (error 6)', async () => {
    await mockUnlock({ attacker: true }).verifyFailure(6);
  });
  test('checks the second output too (error 6)', async () => {
    await mockUnlock({ secondAttacker: true }).verifyFailure(6);
  });
  test('compares bytecode and bundled JavaScript', async () => {
    const results = [];
    for (const format of ['bc', 'js'] as const) {
      const cycles = await mockUnlock({ format }).verifySuccess();
      results.push({ format, bytes: readFileSync(`dist/time-hash-lock.${format}`).length, cycles: Number(cycles) });
    }
    console.table(results);
    mkdirSync('txs', { recursive: true });
    writeFileSync('txs/format-comparison.json', JSON.stringify(results, null, 2) + '\n');
  });
  test('unlocks with the correct passphrase and since', async () => {
    const verifier = mockUnlock();
    mkdirSync('txs', { recursive: true });
    verifier.dump('txs/unlock.json');
    console.log('Unlock cycles:', await verifier.verifySuccess(true));
  });
  test('accepts a later timestamp', async () => {
    await mockUnlock({ since: MIN_SINCE + 60n }).verifySuccess();
  });
  test('rejects a wrong passphrase (error 3)', async () => {
    const verifier = mockUnlock({ witness: hexFrom(Buffer.from('Wrong passphrase')) });
    mkdirSync('txs', { recursive: true });
    verifier.dump('txs/wrong-passphrase.json');
    await verifier.verifyFailure(3);
  });
  test('rejects a timestamp below the minimum (error 4)', async () => {
    await mockUnlock({ since: MIN_SINCE - 1n }).verifyFailure(4);
  });
  test('rejects missing since (error 5)', async () => {
    await mockUnlock({ since: 0n }).verifyFailure(5);
  });
  test('rejects the wrong since metric (error 5 in v2)', async () => {
    await mockUnlock({ since: 1n }).verifyFailure(5);
  });
  test('rejects a missing witness (error 2)', async () => {
    await mockUnlock({ witness: null }).verifyFailure(2);
  });
  test('rejects invalid args (error 1)', async () => {
    await mockUnlock({ args: '0x1234' }).verifyFailure(1);
  });
  test('checks every input in the lock group (error 4)', async () => {
    await mockUnlock({ extraSince: MIN_SINCE - 1n }).verifyFailure(4);
  });
});
