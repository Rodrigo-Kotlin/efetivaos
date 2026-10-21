# FIN-IMPORT-5.3E — Auditoria da correção dos totais DRE

## Status

**COMPLETED** — bucketização corrigida e aplicada somente no DEV. Abril real não
foi executado.

## Root cause

O executor anterior acumulava `v_expenses` por `dre_effect = 'DESPESA'`. A row
115 tem esse `dre_effect`, mas sua apresentação autoritativa é
`DEDUCAO_RECEITA`; por isso R$ 78,28 era indevidamente incluído nas despesas
operacionais.

- Valor antigo calculado: R$ 45.805,10
- Valor correto de despesas operacionais: R$ 45.726,82
- Diferença: R$ 78,28

## Row 115

- Source row: `115`
- Description: `ISS`
- Amount: R$ 78,28
- Account: `3.2.01.002 — (-) Tributos sobre Faturamento - Gerencial`
- Account `dre_class`: `DEDUCAO_RECEITA`
- Manifest `dre_presentation`: `DEDUCAO_RECEITA`
- Included in operating expenses: **NO**
- Included in revenue deductions: **YES**
- Classification changed: **NO**

## DRE bucket reconciliation

| Bucket | Rows | Amount |
|---|---:|---:|
| `RECEITA_BRUTA` | 35 | R$ 56.185,87 |
| `DEDUCAO_RECEITA` | 1 | R$ 78,28 |
| `CUSTO_SERVICO` | 7 | R$ 12.578,39 |
| `DESPESA_OPERACIONAL` | 46 | R$ 45.726,82 |
| `NONE` | 3 | R$ 4.350,00 |
| **Total** | **92** | — |

- Double-bucket rows: **0**
- Unbucketed rows: **0**
- Unknown presentation values: **0**
- `NONE` remains outside DRE even where it has cash movement.

## Correction

Migration:

`supabase/migrations/20261021170000_fix_april_2026_executor_dre_totals.sql`

Function preserved:

`execute_authoritative_financial_import_april_2026(text,text,text)`

The executor now uses mutually exclusive `dre_presentation` buckets:

- `RECEITA_BRUTA` → revenue;
- `DEDUCAO_RECEITA` → revenue deductions;
- `CUSTO_SERVICO` → costs;
- `DESPESA_OPERACIONAL` → operating expenses;
- `NONE` → no DRE bucket.

Manifest hash, cash totals, row coverage, atomicity, idempotency, journal
validation, closed-period checks, `SECURITY DEFINER`, hardened search path and
grants were preserved. No new alias or classification was introduced.

## Tests

Remote DEV tests:

- `fin_import_april_2026_executor_dre_totals.sql`: **PASS**
- `fin_import_april_2026_executor_contract_fix.sql`: **PASS**
- `fin_import_april_2026_executor.sql`: **PASS**
- Manifest read-only bucket validation: **92/92 PASS**
- Row 115 treatment: **PASS**
- Operating expense total: **R$ 45.726,82 / R$ 45.726,82**
- Revenue deductions total: **R$ 78,28 / R$ 78,28**
- Atomic rollback/idempotency/partial detection/journal/closed-period contract:
  **PASS**

The regression fixture explicitly verifies that R$ 10,00 of
`DEDUCAO_RECEITA` does not leak into R$ 100,00 of operating expenses.

## DEV post-migration check

- Project: `bxviuzluxcijbqqbpyzb`
- Function exists: **YES**
- `SECURITY DEFINER`: **YES**
- Corrective migration applied: **YES**
- April batches: **0**
- April transactions: **0**
- April journals: **0**
- April import rows: **0**
- January facts: 107 (unchanged)
- February facts: 80 (unchanged)
- March facts: 107 (unchanged)
- Real April manifest executed: **NO**

## Safety

- Financial writes: **0**
- Journal writes: **0**
- Real April writes: **0**
- Schema changes: **one corrective migration only**
- RLS changes: **0**
- Default privileges changes: **0**
- PROD: **NO**
- Commit: **NO**
- Push: **NO**

## Readiness

- `DRE_BUCKET_TOTALS_FIXED`: **YES**
- `ROW_115_VALIDATED`: **YES**
- `ALL_92_ROWS_BUCKET_VALID`: **YES**
- `TOTALS_CONTRACT_VALID`: **YES**
- `ATOMIC_EXECUTOR_STILL_VALID`: **YES**
- `APRIL_REAL_DATA_IMPORTED`: **NO**
- `READY_FOR_FIN_IMPORT_5_3F_RETRY`: **YES**

Este gate termina sem executar Abril, tocar PROD ou iniciar Maio.
