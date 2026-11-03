# Time Hash Lock - Week 6

Local security revision of the Week 5 exercise. Requires the passphrase, an absolute timestamp since on every grouped input, and the committed recipient on every output.

Custom args: passphrase hash (32 bytes), minimum since (8 bytes, little-endian), recipient lock hash (32 bytes). The JS VM loader prefix adds another 35 bytes.

Exit codes: 0 accepted; 1 invalid args; 2 missing/malformed witness; 3 wrong passphrase; 4 timestamp below minimum; 5 wrong since metric; 6 wrong output recipient or no outputs.

Run npm test from the project root. The 12 mock tests include recipient substitution and an attacker second output. Native debugger fixtures are saved under txs/.

All outputs must use the same recipient. There is no fee ceiling, and the witness exposes the passphrase. Tests use an always-success recipient to isolate hash matching. Mock verification does not establish on-chain maturity or production safety.

This 72-byte custom args format is incompatible with Week 5's 40-byte format. Do not redeploy it over the old Testnet Type ID while old Cells remain.
