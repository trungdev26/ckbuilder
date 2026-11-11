# CKBuilder Weekly Report - Week 7

**Publication date:** 11 November 2026

**Participant:** Trung Pham

## 1. Overview

This week I researched project ideas and tested **CKB Reorg Lab**, a local tool for checking how applications handle chain reorganizations.

The problem is that an application may record a payment as paid, then keep that state after the block containing the payment leaves the canonical chain. I wanted to reproduce this with real CKB nodes and check the application's database afterward.

I compared the idea with existing development tools and core tests. CKB already has fork tests, so creating a fork alone is not the contribution. The proposed tool connects that chain event to checks on an application's saved state. I have not found an equivalent CKB tool in the sources reviewed so far.

The work is still a technical prototype. There is no UI or public release yet.

## 2. Approach

```text
Two local CKB nodes → disconnect → mine competing branches → reconnect
                                                               ↓
                                         Observe canonical chain through RPC
                                                               ↓
                                         Check application DB and report result
```

I used CKB 0.208.0, Node.js 22 and CCC. The payment example stores its state in SQLite; the external indexer test uses Cellora with PostgreSQL.

## 3. Practical Progress

**Real chain reorg.** I ran two nodes with the same genesis, separated them and mined competing branches. After reconnecting, I observed the chain switch through RPC. In these trials, the payment moved from committed to pending and was later committed in a different block. I also checked the affected input and output Cells.

**Payment rollback.** I ran a separate payment service with its own database. The deliberately faulty version kept the order as `PAID` after the payment lost canonical commitment. The corrected version changed it to `UNCONFIRMED` and restored `PAID` after recommit. Restarting against the same database also repaired the stale record.

**External indexer.** I then tested Cellora's indexer without calling its rollback function from the harness. Its own poller detected the reorg and updated PostgreSQL. All three trials passed rollback, recommit and restart checks. This confirmed correct behavior in the tested scenario; it did not reveal a Cellora bug.

| Check | Evidence |
|---|---|
| Two-node fork and transaction/Cell observations | [Chain results](./evidence/chain-reorg.json) |
| Persisted payment state before and after rollback | [Payment-service results](./evidence/payment-rollback.json) |
| Three Cellora trials and two failure controls | [Indexer results](./evidence/cellora-validation.json), [run log](./evidence/cellora-validation.log) |
| Exited worker with an old database checkpoint | [Regression log](./evidence/no-worker-regression.log) |

## 4. Key Learnings

- A committed transaction can lose its place in the canonical chain. Application state needs to account for that possibility.
- Cell state must be queried again after a reorg. An input does not automatically become live if the new branch also spends it.
- A database checkpoint needs both a block height and a canonical block hash.
- Reading old database rows does not prove a restarted worker is functioning. I checked that it indexed a new block after restart.

## 5. Challenges

The first checker read the checkpoint and Cell rows in separate queries. The indexer could update the database between those reads, producing a mixed observation. I changed this to one SQL statement so the fields share the same snapshot.

I also tightened the result checks. An unavailable RPC now produces `ERROR`, while a stopped indexer produces `INCONCLUSIVE`. Both recovered on the same database after the service was restored. Six evaluator tests passed, including cases that previously could have been mistaken for success.

Cellora needed a Redis startup timeout for this local setup. I kept that patch separate from its existing reorg and polling logic.

## 6. Next Steps

Keep the first version focused on payment rollback: accept an application adapter, run one repeatable scenario and save a readable report. The current scripts still depend on local paths, so packaging and setup need work before adding a UI.

## 7. Reflection

The useful result was checking what stayed in the database after the chain changed. The payment example showed a stale-state failure, while Cellora showed a service handling the same kind of event correctly. Both are useful outcomes for a reorg test tool.
