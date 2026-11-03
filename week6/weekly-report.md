# CKBuilder Weekly Report - Week 6

**Publication date:** 4 November 2026
**Participant:** Trung Pham

## 1. Covered this week

Week 6 focused on reviewing Fiber and improving the Week 5 lock script. I also read about Molecule and reusable ecosystem scripts.

- Review channel balances, routing, and hold invoices
- Reproduce and fix the lock's recipient-substitution weakness
- Test Molecule encoding and decoding with CCC
- Read about existing lock and type scripts

## 2. Fiber Review

I reviewed the [Week 4 results](../week4/weekly-report.md). The direct channel was `ChannelReady` with available balances of `401 / 0 CKB`. After the 100 CKB payment, the balances became `301 / 100 CKB`.

A ready channel still needs enough liquidity in the sending direction. In a multi-hop payment, each channel along the route needs enough balance for the payment and fees.

I also checked the hold-invoice flow again. `Received` meant the payment was waiting; revealing the preimage completed it, while cancellation released the held amount. This controls settlement, but does not prove that a service was delivered.

This was a review of existing evidence. I did not run a new reverse-payment experiment.

## 3. Lock-Script Review

The Week 5 lock checked the passphrase and `since`, but allowed any destination output. Once the passphrase appeared in the witness, someone else could use it in a transaction paying themselves.

I added two tests: replacing the recipient and adding an attacker output after a valid output. Both transactions passed the old script, confirming the missing check. [Before-fix log](./logs/01-before-fix.txt).

I then added a recipient lock hash to the custom args:

```text
passphrase hash (32 bytes) | minimum since (8 bytes) | recipient lock hash (32 bytes)
```

The updated script checks every output and returns error `6` if its lock hash differs. Checking the second output matters because checking only the first would still allow funds to go elsewhere.

All **12 local tests passed**, including the earlier passphrase and timelock cases. See the [test log](./logs/02-after-fix.txt), [contract](./project/contracts/time-hash-lock/src/index.ts), and [tests](./project/tests/time-hash-lock.mock.test.ts).

The fix has limits. All outputs must use the same recipient lock, so it cannot handle change to another address. It also does not limit fees, and the passphrase remains visible. The mock uses an always-success recipient only to test hash matching.

I kept this revision local. Its args format is incompatible with the old Cells, so it should not replace the Week 5 Testnet code without a migration plan.

## 4. Molecule

I ran a CCC example that encoded and decoded a `Script` and `WitnessArgs`. I also changed a field offset to an invalid value and confirmed that decoding rejected it. [Example](./project/scripts/molecule-demo.mjs) and [output](./logs/03-molecule.txt).

The Script had two args bytes and occupied 55 serialized bytes. Its header was `[55, 16, 48, 49]`: the total size, then the offsets of `codeHash`, `hashType`, and `args`.

This helped me understand how fields are located in binary data. Tables and dynamic-item vectors use offsets; fixed-item vectors use an item count. The header integers are little-endian. My lock's custom args still use their own packed layout and need separate checks. [Molecule specification](https://docs.nervos.org/docs/serialization/encoding-specs).

## 5. Ecosystem Scripts

I read the [script catalog](https://docs.nervos.org/docs/ecosystem-scripts/introduction), focusing on components related to previous exercises:

- **secp256k1 and Omnilock:** authorize spending through signature checks.
- **xUDT:** validates fungible-token operations; token amounts are separate from CKB capacity.
- **Spore:** handles digital-object ownership and operations.
- **Time Lock:** provides existing time-based spending rules to study before writing another custom lock.

Reusing these scripts still requires understanding their args, witnesses, cell deps, and security assumptions. This part was reading only; I did not deploy or integrate another script.

## 6. Challenges and Reflection

Jest initially failed when writing its cache in the restricted Windows environment. The tests later ran successfully with the native debugger.

The lock review showed why checking a secret is not enough: the script also needs to restrict where the funds can go. The Molecule example made the binary layout easier to follow than reading the specification alone.
