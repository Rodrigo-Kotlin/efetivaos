# FIN-IMPORT-8.5R1 — Post-import report

- Environment: DEV
- Batch: FIN-IMPORT-8.5-JULY-2026
- Batch ID: da6025fd-d747-4833-85c5-8ca9c6ef8670
- Manifest SHA-256: 843ca14b1a9bbe0eac27790ce25069823e3de58a89d43ef038d5d423a4f666e0
- PROD touched: NO

## Result

Structural import and ledger integrity passed: 1 batch, 115 facts, 115 journals, 230 lines, balanced at R$ 165.892,59. Technical-date metadata for FLX-2026-0659/0660/0661 persisted with transaction_date=2026-07-31 and technical_date=true. Cora reconciliation passed (opening R$ 7.021,13; closing R$ 13.657,76).

## Blocking divergences

1. The official persisted DFC reports OPERACIONAL = R$ 7.389,28 and CLASSIFICATION_PENDING = R$ 0,00. Expected values are OPERACIONAL = R$ -847,25 and CLASSIFICATION_PENDING = R$ 8.236,53. The total remains R$ 6.636,63, but classification is wrong.
2. The official DRE RPC rejected the linked CLI session as unauthenticated. Direct recomputation using account.dre_class matches the expected values.

Idempotency read-only verification passed with unchanged counts: 1/115/115/230. April, May, and June remain locked; July remains unlocked.

## Final gate

- FIN-IMPORT-8.5R1 = FAIL
- JULY_2026_IMPORTED = YES
- READY_FOR_FIN_IMPORT_8.6 = NO

No corrective UPDATE, lock, migration, commit, push, or PROD access was performed after import.
