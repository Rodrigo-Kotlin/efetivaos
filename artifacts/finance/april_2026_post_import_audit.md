# FIN-IMPORT-5.3H — Auditoria pós-importação Abril/2026

## Status

**COMPLETED** — importação única concluída e reconciliada no DEV.

## Execution

- Target: `DEV`
- Project: `bxviuzluxcijbqqbpyzb`
- Executor: `execute_authoritative_financial_import_april_2026`
- Call count: **1**
- Atomic: **YES**
- Committed: **YES**
- Batch ID: `e9a91c8c-c4dd-4f90-8486-72aa0b96c638`
- Imported source rows: **92**
- Missing/duplicates/extra: **0 / 0 / 0**

## Hash and manifest

- File SHA-256: `6605a548fdb031d83e95e84945cb5853bbd816485eab17ed2b7bdc42749af662`
- Canonical payload SHA-256: `adf6e94c52bfe00a6c997127377f8ed4a8edc4db0ab501e3536fe84ebc5039f9`
- Canonical client/database match: **YES**
- Rows: 92
- Inflows/outflows: 35 / 57
- Inflows/outflows: R$ 56.185,87 / R$ 62.733,49
- Net: -R$ 6.547,62
- Opening/closing: R$ 18.187,58 / R$ 11.639,96
- Taxonomy and buckets: **92/92 PASS**
- Duplicate source rows, unknown accounts, unbalanced definitions: **0 / 0 / 0**

## Journals

- Created: **92**
- Balanced: **92**
- Unbalanced: **0**
- Total debits/credits: R$ 118.919,36 / R$ 118.919,36
- Difference: **R$ 0,00**

Transaction and journal references are recorded by the authoritative idempotency
prefix `FIN-IMPORT-5.2A::2026-04::%`; critical-row IDs are in the successful
snapshot artifact.

## Official cash

Source: `cashflow_summary(2026-04-01, 2026-04-30, ...)`.

- Opening: R$ 18.187,58
- Inflows: R$ 56.185,87
- Outflows: R$ 62.733,49
- Net: -R$ 6.547,62
- Closing: R$ 11.639,96
- Difference: **R$ 0,00**

## Official DRE

Source: `get_income_statement(2026-04-01, 2026-04-30, ...)`.

- Revenue: R$ 56.185,87
- Deductions: -R$ 78,28
- Net revenue: R$ 56.107,59
- Costs: -R$ 12.578,39
- Operating expenses: -R$ 45.726,82
- Financial result: R$ 0,00
- Other results: R$ 0,00
- Net result: **-R$ 2.197,62**
- Difference from expected result: **R$ 0,00**
- Row 115: **PASS** — `DEDUCAO_RECEITA`, not operating expense.

## Official DFC

Source: `get_cash_flow_statement(2026-04-01, 2026-04-30, ...)`.

- Operating: -R$ 6.547,62
- Investing: R$ 0,00
- Financing: R$ 0,00
- Net: **-R$ 6.547,62**
- Closing: R$ 11.639,96
- Difference: **R$ 0,00**

## BP

Absolute BP baseline was available. `get_balance_sheet` comparison:

- March assets/liabilities/equity: R$ 34.426,27 / R$ 10.000,00 / R$ 24.426,27
- April assets/liabilities/equity: R$ 32.228,65 / R$ 10.000,00 / R$ 22.228,65
- April movement: assets -R$ 2.197,62; liabilities R$ 0,00; equity -R$ 2.197,62
- Movement difference: **R$ 0,00**
- Suspense: **NO**

## AR/AP

- Direct AR writes: **0**
- Direct AP writes: **0**
- Receivables projection: 35 records, open R$ 0,00
- Payables projection: 54 records, open R$ 0,00
- Settled projection: **PASS**
- Artificial open: **0**

## Critical rows

All 17 critical rows (`70, 115, 87, 99, 116, 81, 82, 83, 84, 89, 104, 106,
108, 110, 118, 122, 126`) matched the manifest exactly in persisted
`mapped_data`, including account, classification, presentation, amount,
debit/credit, DFC/AR-AP, evidence and journal definition. Result: **17/17
PASS**, with zero mismatches. All 92 persisted manifest rows matched exactly.

## Idempotency and closed months

- Post-import state: **COMPLETE**
- Batch count: **1**
- Source coverage: **92/92**
- `ALREADY_IMPORTED` guard present: **YES**
- `PARTIAL_IMPORT_DETECTED` guard present: **YES**
- January: 107 before / 107 after — **NO change**
- February: 80 before / 80 after — **NO change**
- March: 107 before / 107 after — **NO change**

## Safety

- Destructive updates: 0
- Deletes: 0
- New migrations during this gate: 0
- Function/RPC/RLS/schema changes during this gate: 0
- PROD: **NO**
- Commit: **NO**
- Push: **NO**
- May started: **NO**

## Formal closing mechanism

The approved `public.financial_period_locks` table was repaired by the scoped
FIN-IMPORT-5.5 migration. Its shared audit trigger now handles
`financial_period_locks` with `locked_at`, `locked_by`, and `created_at`, while
preserving the established behavior for other tables.

April lock persisted successfully:

- Period: `2026-04-01` to `2026-04-30`
- Lock ID: `1c7a5ea8-db31-47db-9a41-c1070205ef00`
- `locked_by`: `51000000-0000-0000-0000-000000000001`
- Duplicate locks: 0
- `APRIL_DATABASE_CLOSING_FLAG`: **YES**
- Enforcement: **PASS** — April rejected by `assert_period_unlocked`; May remained open.

## Test findings

The April-specific tests and direct post-import financial checks passed. Legacy
global suites reported unrelated assertions: `08e` test 009 (deduction sign
formula), `08m` tests 8 and 15 (cash AR/AP fixture expectations), and `08l`
test 14 (fixed-asset AP fixture). These were not modified or bypassed.

## Readiness

- `APRIL_IMPORTED_DEV`: **YES**
- `APRIL_92_92`: **YES**
- `APRIL_JOURNALS_BALANCED`: **YES**
- `APRIL_CASH_RECONCILED`: **YES**
- `APRIL_DRE_RECONCILED`: **YES**
- `APRIL_DFC_RECONCILED`: **YES**
- `APRIL_BP_MOVEMENT_RECONCILED`: **YES**
- `APRIL_ARAP_VALIDATED`: **YES**
- `READY_FOR_FIN_IMPORT_5_4_CLOSING_AND_VERSIONING`: **YES**
- `READY_FOR_PROD`: **NO**

No executor retry was performed. Do not touch PROD, start May, or commit/push in
this gate.
