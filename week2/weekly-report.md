# CKBuilder Weekly Report - Week 2

**Publication date:** 6 October 2026

**Participant:** Trung Pham

## Covered this week

The goal of Week 2 was to move from the basic Cell Model to practical CKB assets, custom Lock Scripts, and the CCC SDK.

The completed work included:

- Create a Fungible Token with xUDT
- Create an on-chain digital object (DOB)
- Build and test a Simple Hash Lock
- Read the CCC Introduction, Quick Start, and Installation guides
- Study the CCC Cell Model, Signer, Transaction, Client, and Address concepts
- Complete CCC Playground examples 1–3

## 2. Evidence

| Activity | Evidence |
|---|---|
| Create Fungible Token | [`create-fungible-token/`](./create-fungible-token/) |
| Create DOB | [`create-dob/`](./create-dob/) |
| Build Simple Lock | [`simple-lock/`](./simple-lock/) |
| CCC Playground examples 1–3 | [`ccc-playground/`](./ccc-playground/) |

All screenshots are stored in their respective activity directories.

## 3. Create Fungible Token (xUDT)

### Objective

Issue a custom fungible token on the local Devnet, query its Cells, and transfer part of its balance.

### Procedure

- Ran the xUDT Scripts dApp locally.
- Issued a custom token with an amount of `42`.
- Queried the token using its xUDT args.
- Transferred `1` token unit to another Devnet address.

### Result

- The token was issued and queried successfully.
- The transfer created token Cells under different Lock Scripts while keeping the same xUDT args.

### What I learned

I learned how xUDT represents fungible tokens with CKB Cells, how its args identify a token, and how token amounts are associated with Cells and Lock Scripts.

### Evidence

See the [Create Fungible Token evidence folder](./create-fungible-token/).

## 4. Create DOB

### Objective

Create an on-chain Digital Object from an image and verify its stored content.

### Procedure

- Ran the Create DOB dApp on the local Devnet.
- Uploaded `avatar.png`, with a size of `5,017 bytes`.
- Created the DOB and checked its content from the dApp.

### Result

- The DOB was created successfully.
- The uploaded image was read from the Cell data and rendered correctly.
- Transaction hash: `0x30af21864a3d9f4e5bfdd61a0c95044aa7fde624a997c16eef3ceb95d315fa96`

### What I learned

I learned that a DOB can store its content directly in Cell data and that the required capacity depends on the size of that content.

### Evidence

See the [Create DOB evidence folder](./create-dob/).

## 5. Simple Lock

### Objective

Build and deploy a hash-lock contract, fund its address, and unlock its Cells with the correct preimage.

### Procedure

- Installed and verified `ckb-debugger 1.1.1`.
- Built `hash-lock.bc` and deployed it to Devnet.
- Started the frontend at `http://localhost:3000`.
- Generated a hash-lock address from the preimage `Hello World`.
- Deposited `300 CKB` into the generated address.
- Tested the wrong preimage `Hello Worldx`, then transferred `99 CKB` with the correct preimage.

### Result

- The deployment health indicator showed `DEVNET · READY`.
- The wrong preimage was rejected with script error `11`.
- The correct preimage unlocked the Cells and the transfer was committed successfully.
- Contract deployment transaction: `0xef8578782f8add2083becd0fb29d0201e860871620a5514a2c2486493f748acf`
- Successful transfer transaction: `0x7905a858a7f0e8d4905274864720cbca2e23c214bbb517541d5f66b913214c62`

### What I learned

I learned how to build and deploy a custom Script and unlock a Cell by revealing the correct preimage. I also learned that this example is not suitable for valuable assets because the preimage becomes public after it is used.

### Evidence

See the [Simple Lock evidence folder](./simple-lock/).

## 6. CCC SDK

CCC is a TypeScript SDK for building applications on CKB. The main concepts I studied were:

- **Cell Model:** The current state of CKB is represented by Live Cells. A transaction consumes existing Cells and creates new ones.
- **Client:** Connects the application to a CKB network and reads on-chain data through RPC.
- **Address:** A human-readable representation of a Lock Script. CCC can convert an address back into the Script needed in a transaction.
- **Signer:** Works with the Cells controlled by an address, signs transactions, and submits them to the network.
- **Transaction:** Defines which Cells are consumed and which new Cells are created, together with the dependencies and witnesses required for validation.

The common CCC transaction flow is:

1. Declare the desired outputs.
2. Use `completeInputsByCapacity()` to select suitable input Cells.
3. Use `completeFeeBy()` to calculate the fee and produce valid change.
4. Use `signer.sendTransaction()` when the transaction should be signed and broadcast.

## 7. CCC Playground

### Example 1 - Transfer CKB

Built a basic CKB transfer and observed how CCC added input Cells, change, and the transaction fee step by step.

### Example 2 - Create a Spore

Built a transaction that creates a Spore Cell containing a short text message.

### Example 3 - Query on-chain data

Used `Client` and `Signer` to read the current Testnet block, signer address, and CKB balance without creating a transaction.

### Evidence

See the [CCC Playground evidence folder](./ccc-playground/).

## 8. Challenges

The most time-consuming part was preparing the Windows toolchain for the Simple Lock example. Building the contract required Rust, `ckb-debugger`, the Visual C++ linker, and the Windows SDK. The example scripts also needed small Windows compatibility fixes for executable paths and Node.js entry-point detection.

The token exercise also showed why local Devnet state needs to be checked carefully. Old token Cells remained visible after earlier attempts, so I repeated the flow with a fresh account and confirmed the result by comparing token args, Lock Script args, and token amounts instead of relying only on Cell numbering.

## 9. Final Reflection

Week 2 helped me understand how xUDT, DOBs, and custom Scripts use the Cell Model. The CCC Playground also made transaction inputs, outputs, change, and fees easier to follow.

