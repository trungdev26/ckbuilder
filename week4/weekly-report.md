# CKBuilder Weekly Report - Week 4

**Publication date:** 21 October 2026

**Participant:** Trung Pham

## 1. Covered this week

Week 4 focused on Fiber Network and using payment channels on CKB Testnet.

The completed work included:

- Install and run two local Fiber nodes on Windows
- Fund both nodes with Testnet CKB
- Open a channel and make a direct payment
- Create, settle, and cancel hold invoices
- Send a multi-hop payment through the public bottle relay
- Close all channels cooperatively

## 2. Evidence

| Activity | Evidence |
|---|---|
| Node 1 running | [node1-running.png](./assets/node1-running.png) |
| Node 2 running | [node2-running.png](./assets/node2-running.png) |
| Direct channel ready | [channel-ready.png](./assets/channel-ready.png) |
| Basic transfer | [basic-transfer.png](./assets/basic-transfer.png) |
| Hold invoice received | [hold-invoice-received.png](./assets/hold-invoice-received.png) |
| Hold invoice settled | [hold-invoice-settled.png](./assets/hold-invoice-settled.png) |
| Hold invoice cancelled | [hold-invoice-cancelled.png](./assets/hold-invoice-cancelled.png) |
| Multi-hop route | [multi-hop-route.png](./assets/multi-hop-route.png) |
| Multi-hop payment | [multi-hop-success.png](./assets/multi-hop-success.png) |
| Channels closed | [channels-closed.png](./assets/channels-closed.png) |

## 3. Fiber Network

Fiber uses payment channels to make repeated payments off-chain. Opening and closing a channel use CKB transactions, while payments inside the channel update the balances between the nodes.

I learned how this builds on the Cell Model: channel funds are locked on CKB, and the channel scripts enforce settlement.

## 4. Run Two Nodes

I used the official Windows installer to install Fiber `v0.9.1` and `ckb-cli v1.12.0`. I created separate Testnet accounts and received `10,000 CKB` from the faucet for each node.

- Node 1: RPC `8227`, P2P `8228`
- Node 2: RPC `8237`, P2P `8238`

Both nodes started successfully, encrypted their CKB keys, and created backups. I checked the nodes through `fnn-cli` and JSON-RPC, then connected them locally.

I learned that each node needs its own key, data directory, and listening ports.

## 5. Basic Transfer

I opened a channel from Node 1 to Node 2 with `500 CKB` and waited for `ChannelReady`. Node 2 created an invoice for `100 CKB`, which Node 1 paid successfully.

- Available balances before payment: `401 / 0 CKB`
- Available balances after payment: `301 / 100 CKB`
- Routing fee: `0 CKB`
- Payment status: `Success`
- Payment hash: `0xa236c193592939e242aadbfeada535aa95325771bafe78a59d705c291dfafe23`

I learned that channel funding and spendable balance are different because capacity is reserved for settlement. I also learned to check `get_payment` after sending, since the initial response can still be `Created`.

## 6. Hold Invoices

### Settle a 50 CKB invoice

I generated a random preimage, calculated its SHA-256 hash, and created a hold invoice using only the hash. After payment, Node 1 showed `Inflight` and Node 2 showed `Received`.

I then called `settle_invoice` with the matching preimage. The payment became `Success`, the invoice became `Paid`, and the channel balances changed to `251 / 150 CKB`.

### Cancel a 20 CKB invoice

I created another hold invoice for `20 CKB`, paid it, and confirmed it reached `Received`. I then cancelled it on Node 2.

- Invoice status: `Cancelled`
- Payment status: `Failed`, with `InvoiceCancelled`
- Channel balances returned to `251 / 150 CKB`
- Offered TLC balance returned to `0`

I learned that a hold invoice keeps payment pending until the receiver reveals the preimage or cancels it. Cancelling releases the held amount back to the sender.

## 7. Multi-hop Payment

I connected both nodes to the public bottle relay and opened a `499 CKB` channel from each node. I used `build_router` to specify the route `Node 1 -> bottle -> Node 2`, then checked it with a dry-run before sending.

- Amount received by Node 2: `1 CKB`
- Routing fee: `0.001 CKB`
- Payment status: `Success`
- Payment hash: `0xf16c3df1d21d6e996baea85dc0763390b38d06efeec9e0b96ee988fa0cff2471`
- Node 1's available balance in its bottle channel: `398.999 CKB`
- Node 2's available balance in its bottle channel: `401 CKB`

I learned how a relay forwards payments between channels and earns a routing fee. Specifying the route also confirmed that this payment used bottle rather than the existing direct channel.

## 8. Close Channels

I requested cooperative closure of both bottle channels and the direct channel between the local nodes. Afterwards, `list_channels` returned `channels: []` on both nodes.

This completed the channel lifecycle from funding and payments to cooperative closure. Stablecoin transfers were not attempted this week.

## 9. Challenges

The account setup needed a retry after the password confirmation did not match. The installer backed up the incomplete directory before restarting setup.

Connecting to bottle over WSS did not work. Switching to the TCP address advertised in the network graph resolved the issue.

## 10. Final Reflection

Week 4 helped me understand the difference between on-chain funding and off-chain payments. Running two nodes made channel balances, hold invoices, routing fees, and cooperative closure easier to follow.
