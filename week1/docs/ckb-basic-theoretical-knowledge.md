# CKB Basic Theoretical Knowledge

## 1. What is CKB?

- A blockchain is a shared record of transactions that does not depend on one central authority.
- CKB stands for Common Knowledge Base and is the base layer of the Nervos Network.
- CKB uses Proof of Work, where miners validate transactions and secure the network.
- CKB stores value and data in Cells.
- All Live Cells together represent the current state of the blockchain.
- CKByte is the native token of CKB, representing both value and storage space.
- Cells cannot be edited directly.
- To update data, a transaction consumes the old Cell and creates a new Cell.
- Unspent Cells are Live Cells, while spent Cells are Dead Cells.
- This is similar to Bitcoin's UTXO model, but CKB Cells can also store data.

## 2. What Does a Cell Contain?

CKB stores its state in Cells, so each Cell needs fields for value, data, and rules.

Each Cell contains:

- `capacity`: the amount of CKB in the Cell and the limit on how much space it can occupy.
- `lock`: a Script that defines the conditions required to consume the Cell.
- `type`: an optional Script that validates how the Cell is created or changed.
- `data`: the data stored in the Cell.

`1 CKB = 100,000,000 shannons` and provides `1 byte` of on-chain storage.

The total space occupied by the Cell must not exceed its `capacity`.

- Standard Lock Script with empty data takes `61 bytes`, so the minimum is `61 CKB`.
- The Transfer example uses `62 CKB` to keep the output above this limit.
- The fee is taken from the sender's change.

## 3. How Do You Know You Own a Cell?

A Cell can hold value and data, but its `lock` decides who is allowed to consume it.

- A Cell is controlled by its `lock` Script.
- The lock defines the conditions required to use the Cell.
- To consume a Cell, you must provide valid proof, usually a digital signature.
- The Script checks the proof automatically.
- If the check passes, you are allowed to control and consume the Cell.
- A Script contains:
  - `code_hash`: identifies the Script code.
  - `hash_type`: tells CKB how to locate the code.
  - `args`: provides parameters for the Script.
- The `lock` Script is required, while the `type` Script is optional.

### Example

```ts
const cell = {
  capacity: "100 CKB",
  lock: {
    code_hash: "0x...script-code-hash",
    hash_type: "type",
    args: "0x...alice-public-key-hash"
  },
  data: "0x"
}

const witness = {
  signature: "0x...alice-signature"
}

if (verifySignature(witness.signature, cell.lock.args)) {
  return 0 // The Cell can be consumed
}

return 1 // The transaction is rejected
```

The lock expects Alice's key. Her signature is stored in the `witness`. A return value of `0` means the check passed, so the Cell can be spent.

## 4. Where Is Script Code Stored?

The `lock` and `type` fields describe which Script to use, but they do not contain the executable Script code.

- `code_hash` identifies the Script code.
- The real code is stored in the `data` field of another Cell.
- This Cell is called a dependency Cell, or `CellDep`.
- A transaction includes the required Cell in `cell_deps`.
- CKB uses `code_hash` and `hash_type` to find the correct code.
- When `hash_type` is `data`, `code_hash` matches the hash of the Cell's data.
- When `hash_type` is `type`, `code_hash` matches the hash of the Cell's Type Script.
- CKB VM loads the code from the dependency Cell and executes it.
- Many Cells can reuse the same Script code.

The basic flow is:

`Script -> code_hash -> CellDep -> code in data -> CKB VM`

## 5. How Is Script Code Kept Available?

Script code is stored in a dependency Cell, so that Cell must remain available when the Script is used.

- If the dependency Cell is consumed, it becomes a Dead Cell.
- CKB can no longer load code from that Cell.
- Cells using that code may become impossible to unlock.
- Built-in Script code is protected by a lock that can never be unlocked.
- This prevents anyone from consuming the Cells that store built-in code.
- Custom Script code can be deployed again in a new Cell.
- A transaction can then reference the new Cell in `cell_deps`.

The main idea is that Script code must always be available through a valid `CellDep`.

## 6. How Does a Transaction Change Cells?

A transaction consumes existing Live Cells as inputs and creates new Live Cells as outputs. During validation, CKB runs the required Scripts to check whether this change is allowed.

- Inputs must be Live Cells.
- Input Cells become Dead Cells after the transaction is committed.
- Output Cells become new Live Cells.
- A transaction cannot create capacity from nothing.
- Total output capacity cannot exceed total input capacity.
- The difference between input and output capacity is the transaction fee.
- An input uses an `OutPoint` to reference an existing Cell.
- An `OutPoint` contains the transaction hash and the Cell's output index.

```text
inputs -> transaction -> outputs

total input capacity - total output capacity = fee
```

## 7. How Do Lock and Type Scripts Validate a Transaction?

A transaction consumes input Cells and creates output Cells. Before accepting it, CKB checks permission with Lock Scripts and checks the state change with Type Scripts.

- Every Cell must have a Lock Script.
- A Type Script is optional.
- The Lock Script checks who is allowed to consume the input Cell.
- The Type Script checks whether the Cell follows application rules.
- Lock Scripts run for input Cells grouped by the same Script.
- Type Scripts run for both input and output Cells grouped by the same Script.
- CKB runs each Script group once instead of running it separately for every Cell.

Example: a token Type Script checks that no extra tokens are created. Other Type Scripts can limit how Cell data changes.

```text
Lock Script -> Who can use the Cell?
Type Script -> Is the state change valid?
```

## References

- [CKB Basic Theoretical Knowledge](https://academy.ckb.dev/courses/basic-theory)
- [How CKB Works](https://docs.nervos.org/docs/getting-started/how-ckb-works)
