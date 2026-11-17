# CKBuilder Weekly Report - Week 8

**Publication date:** 18 November 2026

**Participant:** Trung Pham

## 1. Covered this week

I continued CKB Reorg Lab by turning the Week 7 scripts into a small local CLI. The goal was to run the existing test without editing source paths and keep the results from each run separate.

The scope is still application recovery after a reorg. The current integration checks Cellora's indexer and PostgreSQL database; it is not a general testing framework yet.

## 2. CLI and Setup

I added two commands:

```powershell
npm run doctor -- --config config.local.json
npm run demo -- --config config.local.json
```

The config supplies executable paths, the AlwaysSuccess fixture, local database connection, test ports, output directory and trial count. CCC is now a pinned dependency of the package instead of being loaded from the Week 5 project.

`doctor` checks file paths, the supported CKB version, database access and available ports before starting the scenario. Each run gets a new directory containing logs, a JSON report and a journal of observations. Databases are retained for inspection.

## 3. Practical Results

I ran the packaged CLI with a different set of ports from Week 7. It used CKB 0.208.0, Node.js 22.23.2 and the same pinned Cellora binary.

| Check | Result |
|---|---|
| Commit payment, create a real reorg and observe indexer rollback | Passed |
| Recommit and check the affected output is not duplicated | Passed |
| Restart on the same DB and index a newly mined block | Passed |
| Stop RPC, detect unavailable evidence, then recover | Passed |
| Stop indexer during reorg, reject stale state, then recover | Passed |
| Config and verdict tests | 12 passed |

This week added **one full integration trial and two controls** through the new CLI. These are separate from Week 7's three trials.

The controls returned `ERROR` while RPC was unavailable and `INCONCLUSIVE` while the worker was stopped. A control passes when those conditions are detected correctly and recovery is verified; stale database rows alone are not accepted as success.

Evidence: [integration results](./evidence/cli-integration.json), [run log](./evidence/cli-console.log), and [offline tests](./evidence/offline-tests.txt).

## 4. Challenges and Learnings

The dedicated PostgreSQL cluster was stopped at the start. Preflight rejected the run instead of starting the nodes. PostgreSQL then needed crash recovery before it accepted connections, so the initial startup timeout did not mean the database had permanently failed.

Packaging also exposed assumptions hidden in the prototype: fixed ports, paths into another project and output files written beside the scripts. Moving those into config made the same scenario easier to run again without changing its checks.

I kept the atomic database snapshot and canonical block-hash checks from Week 7. Cleanup now records its outcome in the journal, so it can be checked separately from the application result.

## 5. Limits and Next Steps

The CLI was tested on this Windows machine with existing binaries. Another person has not reproduced it on a fresh machine yet. Cellora and PostgreSQL still need separate setup, and there is no UI or generic application adapter.

Next I will rehearse setup from a clean directory, improve the readable report and make the configuration instructions easier to follow. The priority is a repeatable test with clear evidence before adding more scenarios.
