# CKBuilder Weekly Report - Week 1

**Publication date:** 29 September 2026

**Participant:** Trung Pham

## Covered this week

The goal of Week 1 was to understand the basic CKB Cell Model, set up a local development environment, transfer CKB, and store data in a Cell.

The completed exercises were:

- Exercise 00: Getting Started
- Exercise 01: Transfer CKB
- Exercise 02: Store Data on Cell

I also completed the CKB Academy basic theoretical knowledge course and wrote notes connecting Cells, Scripts, and transactions.

## 2. Development Environment

- OS: Windows
- Node.js: v20.20.2
- npm: 10.8.2
- OffCKB: 0.4.13
- Repository: `C:\Workspace\UTC\ckbuilder`
- Devnet RPC: `http://127.0.0.1:8114`
- Devnet RPC Proxy: `http://127.0.0.1:28114`

## 3. Evidence

| ID | Exercise | Evidence |
|---|---|---|
| 00 | Getting Started | [`setup/`](./setup/) |
| 01 | Transfer CKB | [`transfer/`](./transfer/) |
| 02 | Store Data on Cell | [`store-data-on-cell/`](./store-data-on-cell/) |
| Notes | CKB Basic Theoretical Knowledge | [`docs/ckb-basic-theoretical-knowledge.md`](./docs/ckb-basic-theoretical-knowledge.md) |

All screenshots are stored in their respective exercise directories.

## 4. CKB Fundamentals

### Cell Model

CKB stores value and data in Cells. All Live Cells together represent the current state of the blockchain. A spent Cell becomes a Dead Cell and cannot be used again.

### Capacity

Capacity is the amount of CKBytes held by a Cell and the limit on how much on-chain space it can occupy. `1 CKB = 100,000,000 shannons`, and one CKB provides one byte of storage capacity.

### Transaction

A transaction consumes existing Live Cells as inputs and creates new Live Cells as outputs. Input Cells become Dead Cells after the transaction is committed.

The total output capacity cannot exceed the total input capacity. The difference is paid as the transaction fee.

### Lock Script

A Lock Script checks who is allowed to consume a Cell. It usually verifies a signature provided in the transaction witness.

### Type Script

A Type Script is optional. It checks whether the change from input Cells to output Cells follows the application's rules.

### Cell Dependency

The `lock` and `type` fields identify a Script, but they do not contain its executable code. The code is stored in another Cell and loaded through `cell_deps` during transaction verification.

## 5. Exercise 00 - Getting Started

### Objective

Install OffCKB and start a local CKB Devnet.

### Procedure

- Verified the installed OffCKB version with `offckb --version`.
- Started the local Devnet with `offckb node`.
- Listed the pre-funded development accounts with `offckb accounts`.

### Result

- OffCKB `0.4.13` was available.
- The local CKB node became available at `http://127.0.0.1:8114`.
- The RPC proxy became available at `http://127.0.0.1:28114`.
- The pre-funded Devnet accounts were available for testing.

### What I Learned

I learned how to start a local CKB network and inspect the accounts provided by OffCKB for development.

### Evidence

See the [Exercise 00 evidence folder](./setup/).

## 6. Exercise 01 - Transfer CKB

### Objective

Run the official Simple Transfer example and transfer CKB between two local Devnet accounts.

### Procedure

- Ran the Simple Transfer dApp with CCC and Parcel.
- Connected the dApp to the local Devnet.
- Sent `62 CKB` from the first Devnet account to the second account.
- Checked the receiver balance with `offckb balance`.

### Result

- The transfer transaction was submitted and confirmed successfully.
- The receiver balance increased from `42,000,000 CKB` to `42,000,062 CKB`.
- Transaction hash: `0x80f6485e3ce19f075420c460604eb17ecb8b2e439c96b5bb761d22791d419e2f`

### What I Learned

I learned how a dApp builds and submits a CKB transaction. The exercise helped me connect input Cells, output Cells, Lock Scripts, receiver capacity, change, and transaction fees.

### Evidence

See the [Exercise 01 evidence folder](./transfer/).

## 7. Exercise 02 - Store Data on Cell

### Objective

Run the official Store Data on Cell example, write a message to a Cell, and read it back from the local Devnet.

### Procedure

- Ran the Store Data on Cell dApp with CCC and Parcel.
- Connected the dApp to the local Devnet.
- Wrote `hello common knowledge base!` to a Cell.
- Waited for the transaction to be confirmed.
- Read the stored message from the Cell.

### Result

- The write transaction was confirmed successfully.
- The dApp read back the exact message: `hello common knowledge base!`
- Transaction hash: `0x99707bb72ff7dd446d5a1b0ca050e36553909c53c9970a778f8fb7b1a472c128`

### What I Learned

I learned that a Cell can store data as bytes. Writing new data consumes existing input Cells and creates a new output Cell containing that data. After the transaction is confirmed, the dApp can find the Cell and read the message from it.

### Evidence

See the [Exercise 02 evidence folder](./store-data-on-cell/).

## Progress Summary

| Activity | Result | Evidence |
|---|---|---|
| OffCKB verification and local Devnet startup | Completed | [Exercise 00 evidence](./setup/) |
| CKB Academy theory notes | Completed | [Theory notes](./docs/ckb-basic-theoretical-knowledge.md) |
| Simple Transfer dApp and CKB transfer | Completed | [Exercise 01 evidence](./transfer/) |
| Store Data on Cell dApp, write and read | Completed | [Exercise 02 evidence](./store-data-on-cell/) |

## 8. Challenges

The main challenge was understanding how the Cell Model differs from an account-based balance model. At first, the relationship between Cells, Lock Scripts, Type Scripts, and witnesses was not clear.

Running the transfer example helped connect the theory with an actual transaction. I could see that the sender's Live Cells were used as inputs, while the receiver Cell and change Cell were created as outputs.

The tutorial command also used Unix environment variable syntax. On Windows Command Prompt, I ran the example with:

```cmd
set NETWORK=devnet&& npm start
```

## 9. Final Reflection

Week 1 gave me a basic understanding of how CKB stores state and processes transactions. I set up a local Devnet, worked with development accounts, transferred CKB, and stored a message in a Cell.

The practical exercises made the Cell Model easier to understand. I now have a clearer picture of how capacity, data, input Cells, output Cells, Lock Scripts, Type Scripts, and transaction fees work together.

## 10. Week 2 Goals

- Understand how CCC builds, signs, and sends a transaction.
- Complete the Create Fungible Token tutorial.
- Continue learning how Scripts validate CKB transactions.

## References

- [CKB Basic Theoretical Knowledge](https://academy.ckb.dev/courses/basic-theory)
- [How CKB Works](https://docs.nervos.org/docs/getting-started/how-ckb-works)
