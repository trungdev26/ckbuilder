# CKBuilder Weekly Report - Week 5

**Publication date:** 28 October 2026

**Participant:** Trung Pham

## 1. Covered this week

Week 5 focused on writing a TypeScript lock script and testing it on CKB Testnet.

- Build a passphrase lock with a `since` timelock
- Test valid and invalid unlocks with `ckb-testtool`
- Replay transactions with `ckb-debugger` and compare `.bc` with `.js`
- Deploy, lock, and unlock Cells on Testnet
- Upgrade the script while keeping the same Type ID

## 2. Evidence

| Activity | Evidence |
|---|---|
| Mock tests and format comparison | [format-comparison-tests.png](./assets/format-comparison-tests.png) |
| Debugger results | [debugger-cycles.png](./assets/debugger-cycles.png) |
| Testnet deployment | [deploy-testnet.png](./assets/deploy-testnet.png) |
| Lock and unlock | [testnet-lock-unlock.png](./assets/testnet-lock-unlock.png) |
| Unlock on Explorer | [explorer-unlock-tx.png](./assets/explorer-unlock-tx.png) |
| Before upgrade | [type-id-before-upgrade.png](./assets/type-id-before-upgrade.png) |
| Type ID upgrade | [type-id-upgrade.png](./assets/type-id-upgrade.png) |
| Upgrade on Explorer | [explorer-upgrade-tx.png](./assets/explorer-upgrade-tx.png) |

## 3. TypeScript Lock Script

I created `time-hash-lock` with `offckb` and built it using `ckb-js-vm`. The custom args contain the passphrase hash and a minimum absolute timestamp encoded as `since`. The unlock supplies the passphrase in its witness.

The script checks the args, passphrase, and `since` of every input in the lock group. It returns `0` for a valid unlock and a specific error code when a check fails.

I learned that the script checks the declared `since`, while the CKB node checks whether the chain has reached it. Both checks are needed for the timelock.

## 4. Tests and Debugger

The final suite passed all **10 tests**. It covers valid unlocks, a later timestamp, a wrong passphrase, low or missing `since`, a wrong metric, a missing witness, invalid args, multiple inputs, and the format comparison.

I also replayed the v1 transactions with `ckb-debugger`. The valid unlock returned `0` and used `13,832,312` cycles. The wrong passphrase returned `3`.

For v2, I compared both formats using the same mock unlock:

| Format | Size | Cycles |
|---|---:|---:|
| Bytecode `.bc` | 29,426 bytes | 13,848,472 |
| Bundled `.js` | 22,717 bytes | 43,595,913 |

The bytecode was larger but used about 68% fewer cycles in this test. This helped me see the trade-off between stored code size and execution cost.

## 5. Deploy and Unlock on Testnet

I funded a separate Testnet account and deployed the bytecode with `--type-id`.

- Type ID code hash: `0x564069a5ff58adc043064b7d7c6015787a0ef4879333152d7da390a1d12b3f82`
- [Deployment transaction](https://testnet.explorer.nervos.org/transaction/0x2e4d964165523e5d98074a353900bfc3ab83d131baf8a3a58b7b3a1c09032574)

I locked two Cells of `200 CKB`: one with a timestamp already reached and another set 30 minutes later. Before the valid unlock, I checked three rejected attempts:

- Wrong passphrase: script error `3`
- Declared `since` below the minimum: script error `4`
- Correct passphrase with a future `since`: node error `Immature`

The first Cell then unlocked successfully, returning `199.9999 CKB` after the fee. Explorer showed `13,829,980` cycles, close to the offline v1 result.

- [Lock transaction](https://testnet.explorer.nervos.org/transaction/0x04c1027eb6b1a10d7153147f543aa0b010429de69880fadf10858376e6cf6aa7)
- [Unlock transaction](https://testnet.explorer.nervos.org/transaction/0xd4a2f93da5a0cca022962d6ddb74a83b706d02317330549b9f5a2bd8f3ea8083)

## 6. Type ID Upgrade

I changed v2 to return error `5` for a wrong `since` metric, then redeployed it with the same Type ID. I tested the remaining Cell, which had been locked before the upgrade, using the same invalid unlock before and after.

The result changed from error `4` to error `5` while the lock and Type ID code hash stayed the same. The code Cell capacity changed from `29,548` to `29,552 CKB`.

[Upgrade transaction](https://testnet.explorer.nervos.org/transaction/0x6b2ce24d8387f03d26393a3ff7747580f11c26405efd5250c5b88f3c5bcc6f5a)

I learned that updating a code Cell can change validation for existing Cells that reference its Type ID. Control of that code Cell therefore matters.

## 7. Challenges

The WASM debugger could not open the Windows transaction path, so I switched the mock tests to the native debugger. Deployment also needed more Testnet CKB because the code Cell required around `29,548 CKB` of capacity.

This lock is an educational example: the passphrase is visible in the witness, and the script does not restrict the destination outputs. A practical version would need additional protection.

## 8. Final Reflection

Week 5 helped me follow a script from source code to on-chain validation. Testing rejected unlocks made `since` clearer, and the upgrade showed how Type ID affects Cells that already exist.
