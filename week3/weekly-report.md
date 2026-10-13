# CKBuilder Weekly Report - Week 3

**Publication date:** 13 October 2026

**Participant:** Trung Pham

## 1. Covered this week

Week 3 focused on using CCC in a browser dApp and following the main transaction workflows on CKB Testnet.

The completed work included:

- Connect a JoyID wallet to a CCC application
- Compose a CKB transaction step by step
- Sign and verify messages
- Mint and transfer an xUDT token
- Create, query, and transfer a Spore
- Run a Node.js backend flow in the CCC Playground
- Review CCC code examples, AI resources, packages, and Connector 2.0 migration notes

## 2. Evidence

| Activity | Evidence |
|---|---|
| Connect Wallet | [`wallet-connected.png`](./assets/wallet-connected.png) |
| Compose Transaction | [`compose-transaction.png`](./assets/compose-transaction.png) |
| Sign Message | [`sign-message.png`](./assets/sign-message.png) |
| Mint xUDT | [`xudt-mint.png`](./assets/xudt-mint.png) |
| Transfer xUDT | [`xudt-transfer.png`](./assets/xudt-transfer.png) |
| Create Spore | [`spore-created.png`](./assets/spore-created.png) |
| Transfer Spore | [`spore-transfer.png`](./assets/spore-transfer.png) |
| Node.js Backend | [`nodejs-backend.png`](./assets/nodejs-backend.png) |

## 3. Connect Wallet

I created a Next.js application with `create-ccc-app`, connected a JoyID Passkey wallet on Testnet, and funded it with `10,000 CKB` from the faucet.

This showed how a CCC application gets a `Signer` from the connected wallet and uses it to read the address and balance.

## 4. Compose Transaction

I built a transaction that sends `100 CKB` back to my connected wallet. CCC selected a `10,000 CKB` input, created the receiver output and returned the remaining capacity as change.

- Receiver output: `100 CKB`
- Change: `9,899.99998449 CKB`
- Fee: `0.00001551 CKB`

I learned that `render()` only displays a transaction. It is not submitted until `signer.sendTransaction()` is called.

## 5. Sign Message

I signed the message `Hello world` with JoyID and verified the returned signature.

- Sign type: `JoyId`
- Original message verification: `true`
- Different message verification: `false`

This exercise showed that message signing proves wallet ownership without creating an on-chain transaction or paying a fee.

## 6. xUDT Token

I used my wallet's Lock Script hash as the xUDT args and minted `1,000` token units. I then transferred `1` token unit and returned the remaining `999` units as token change.

- xUDT args: `0xfeae23d867c984fc505f44b05ff3d1d11ddeea12279e79e82091188165fc44ed`
- Mint transaction: `0x420cfeca3d7f738f5e8e594ad34b8fa6bc45a4b860d30e1acfe6920e69aebe1b`
- Transfer transaction: `0xf77a4567764c15939919f8403c2cf48da6fb895481a3f8b186bb85a4fd7cde49`

I learned that an xUDT amount is stored in Cell data and that `udt.completeBy()` adds the required token inputs and token change before capacity and fees are completed.

## 7. Spore Protocol

I created a text Spore containing a short Week 3 message, queried it with `findSporesBySigner()`, and transferred it back to my own wallet.

- Content type: `text/plain`
- Spore Cell: `209 CKB`, `81 bytes`
- Spore ID: `0xebb1e57b0fe286e8b5fbf0af465145028c3bc01f15b60dd05b482bd854316fd2`
- Create transaction: `0x4f1fa527f43ea8157ec795c0d53dfdb905596287a59a5754bfed4c31b08a7037`
- Transfer transaction: `0x3f3706a0906f788d1d365afe4e07aacc9c8ca9f5abedee47b05f8c0c7ea2efec`

I learned that a Spore stores its content directly in a Cell. Its ID identifies the object, while its Lock Script controls ownership.

## 8. Node.js Backend

I ran the backend transaction flow in the CCC Playground using the connected signer as a safe substitute for a private-key signer. The script read the balance, built a `100 CKB` transfer to the same address, submitted it, and waited for confirmation.

- Starting balance: `9,502.99740104 CKB`
- Transaction structure: `1 input`, `2 outputs`
- Transaction: `0x1cfd7cd16374e2321a6cf59478fd7c940cc2b06c066b2be30c280e68bd5679b4`

For a real Node.js backend, CCC provides `@ckb-ccc/shell` and `SignerCkbPrivateKey`. The private key should be loaded from an environment variable instead of being placed in source code.

## 9. CCC Resources

- **Code Examples:** provides runnable examples that can be opened in the CCC Playground.
- **AI Resources:** explains how to give current CCC documentation to coding assistants and verify generated code.
- **Packages:** `connector-react` is for React wallet integration, `ccc` is for browser applications, and `shell` is for Node.js scripts and backends.
- **Connector 2.0:** introduces owned clients so the Provider can manage and dispose network connections correctly.

## 10. Final Reflection

Week 3 connected the CCC concepts from the previous week to complete Testnet workflows. I can now connect a wallet, build and send transactions, sign messages, work with xUDT tokens and Spores, and understand how the same CCC APIs can be used in a Node.js backend.
