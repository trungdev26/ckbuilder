import * as bindings from '@ckb-js-std/bindings';
import { hashCkb, HighLevel, log, numFromBytes } from '@ckb-js-std/core';

const FLAGS_MASK = 0xff00000000000000n;
const ABSOLUTE_TIMESTAMP = 0x4000000000000000n;

function main(): number {
  log.setLevel(log.LogLevel.Debug);
  // The first 35 bytes belong to the JS VM loader.
  const args = HighLevel.loadScript().args.slice(35);
  if (args.byteLength !== 72) return 1;
  const minimumSince = numFromBytes(args.slice(32, 40));
  if ((minimumSince & FLAGS_MASK) !== ABSOLUTE_TIMESTAMP) return 1;

  let passphrase: ArrayBuffer | undefined;
  try {
    passphrase = HighLevel.loadWitnessArgs(0, bindings.SOURCE_GROUP_INPUT).lock;
  } catch {
    return 2;
  }
  if (!passphrase || passphrase.byteLength === 0) return 2;
  const expectedHash = new Uint8Array(args.slice(0, 32));
  const actualHash = new Uint8Array(hashCkb(passphrase));
  if (!actualHash.every((value, index) => value === expectedHash[index])) return 3;

  // The script checks the declaration; CKB consensus checks maturity.
  for (const since of new HighLevel.QueryIter(HighLevel.loadInputSince, bindings.SOURCE_GROUP_INPUT)) {
    if ((since & FLAGS_MASK) !== ABSOLUTE_TIMESTAMP) return 5;
    if (since < minimumSince) return 4;
  }
  const recipient = new Uint8Array(args.slice(40, 72));
  let outputs = 0;
  for (const hash of new HighLevel.QueryIter(HighLevel.loadCellLockHash, bindings.SOURCE_OUTPUT)) {
    outputs++;
    if (!new Uint8Array(hash).every((value, index) => value === recipient[index])) {
      log.debug('output lock hash does not match the committed recipient');
      return 6;
    }
  }
  if (outputs === 0) return 6;
  // shortcut: all outputs must use one recipient; shared-input transactions need a richer policy.
  log.debug('time-hash-lock v3: passphrase and since accepted');
  return 0;
}

bindings.exit(main());
