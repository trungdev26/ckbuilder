# CKB Reorg Lab — Week 8 CLI prototype

Run a real two-node CKB reorg and check a separately running Cellora indexer's PostgreSQL state. This packages the Week 7 scenario; it is not yet a general adapter framework.

## Prerequisites

- Node.js 22.13+ (tested: 22.23.2); npm.
- CKB **0.208.0** executable and the `always_success` script fixture from your local OffCKB installation. Other versions are rejected until verified.
- A separately built Cellora indexer, source pin `a534c38f248c0406eeafee94adadb8c2c9072f8a`. Week 7 used a Redis startup timeout patch; no rollback/poller changes. This repo does not distribute that binary or upstream source.
- A dedicated local PostgreSQL cluster, `psql`, and a role with CREATEDB. The indexer performs its own migrations. Stop unrelated users of the configured test ports.

Node/CKB/PostgreSQL/Cellora installation is not automated. The example is for Windows, the environment tested here. Fresh-machine and Linux reproduction remain unverified.

## Setup and run

```powershell
npm ci --ignore-scripts
Copy-Item config.example.json config.local.json
# Edit config.local.json: point to your own binaries and fixture.
npm run doctor -- --config config.local.json
npm run demo -- --config config.local.json
```

All relative paths resolve beside the config file. `outputDir` can be outside this package. No source-code editing is required. Use a local-only database URL; put credentials in the ignored local config if needed, never in the example or reports.

Doctor checks Node, file paths, supported CKB version, distinct/available test ports, database connection and CREATEDB permission. It does not start the DB, build Cellora, validate every binary's provenance, or prove the scenario will succeed.

The demo runs the configured number of fresh trials followed by RPC-down and stopped-indexer recovery controls. There is no option to suppress controls. Port selection, executable paths, output directory, poll interval, deadline and trial count come from config.

## What it checks

1. Mine and commit a fixture payment on node A.
2. Keep Cellora and its database, mine a competing branch on B and reconnect.
3. Verify old commitment is no longer canonical; observe indexer rollback through atomic read-only SQL snapshots.
4. Recommit the payment, check exact affected outpoints and absence of duplicate output rows.
5. Restart the indexer with the same DB and require ingestion of a new block.
6. Stop RPC/indexer in controls; require ERROR/INCONCLUSIVE observations rather than accepting stale state, then verify recovery.

Chain selection is performed by CKB. This fixed-difficulty devnet setup does not imply a general “longest chain” rule. RPC Cell states are observations, not hard-coded consequences of reorg.

## Artifacts and interpretation

Each invocation creates a fresh `run-*` directory containing:

- `console.log`: full scenario output.
- `service-journal-*.jsonl`: append-only observations, including partial failures.
- `evidence-service-*.json`: terminal trial/control results, atomic DB snapshots, runtime/source/binary hashes and cleanup events.
- `result.json`: scenario exit code and evidence filename.
- Child node/indexer logs and node databases in their trial subdirectories.

Normal success exits 0; failed setup/scenario/control exits nonzero. If the child exits before producing a report, `interrupted.json` records ERROR and points to the journal. Preflight failures print ERROR and do not start a scenario.

A control's PASS means it correctly detected an intentionally unavailable dependency and later recovered. It is not proof that a stopped application processed reorgs. Read `observed.verdict` in the corresponding control journal entry.

Fresh PostgreSQL databases use random `cellora_*` names and are retained as evidence, including failures. No existing application DB is reused or dropped. Normal cleanup stops only child processes launched by that run. Forced terminal termination/machine crashes are not covered by a process supervisor; inspect saved PIDs before restarting. The lab does not stop an externally managed PostgreSQL cluster.

## Offline checks

```powershell
npm test
```

These check config and result evaluation. The full demo is the integration test and requires the prerequisites. No private wallet keys, public-network transactions, UI, or production deployment are involved.
