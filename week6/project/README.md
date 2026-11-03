# Week 6 local practice

Run from this directory after installing the dependencies with `npm ci`:

```powershell
npm test
node scripts/molecule-demo.mjs
```

Requires the native `ckb-debugger` on PATH. Based on the Week 5 local project; no private keys, environment files, or deployment credentials are included. This project includes only the offline mock suite, not the old deployment/Testnet callers, which use a different args format.

The contract commits to one recipient and requires all output locks to match it. See the weekly report for limitations and migration risks. Do not upgrade the old Testnet Type ID with this incompatible args format.
