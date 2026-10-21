# FIN-IMPORT-5.2A — Fechamento contábil Abril/2026

## Status
**COMPLETED_WITH_FINDINGS**

A política contábil legada foi aplicada exclusivamente às rows 87, 99 e 116. Não houve rateio artificial, passivo retroativo ou conta de suspense.

## Policy
- Legacy mixed-settlement policy applied: **YES**
- No artificial allocation: **YES**
- Retroactive months changed: **NO**

## Readiness
- READY: **92**
- UNRESOLVED_ALLOCATION: **0**
- DECISION_REQUIRED: **0**
- ACCOUNT_MAPPING_GAP: **0**
- POTENTIAL_DUPLICATE: **0**
- PRIOR_PERIOD_REVIEW: **0**
- TOTAL: **92**

## Resolved rows
| Row | Amount | Account | DRE | DFC | Status |
|---:|---:|---|---|---|---|
| 87 | R$ 1.000,00 | 5.7.01.001 — Taxas, Licenças e Anuidades | DESPESA_OPERACIONAL | OPERACIONAL | READY |
| 99 | R$ 495,81 | 5.7.01.001 — Taxas, Licenças e Anuidades | DESPESA_OPERACIONAL | OPERACIONAL | READY |
| 116 | R$ 1.949,24 | 5.1.01.004 — FGTS, INSS e Encargos Trabalhistas | DESPESA_OPERACIONAL | OPERACIONAL | READY |

Each row retains explicit disclosure that principal, interest and penalty were not segregated and the amount was recognized integrally in April.

## DRE final
- Receita Bruta: **R$ 56.185,87**
- Deduções: **R$ 78,28**
- Receita Líquida: **R$ 56.107,59**
- Custos: **R$ 12.578,39**
- Despesas Operacionais: **R$ 45.726,82**
- Resultado Financeiro: **R$ 0,00**
- Outros Resultados: **R$ 0,00**
- Tributos sobre resultado: **R$ 0,00**
- Resultado Líquido: **R$ -2.197,62**

Recalculada row-level: **YES**. Referência: R$ 1.247,43 − R$ 3.445,05 = **-R$ 2.197,62**. DRE official ready: **YES**.

## DFC final
- Opening: **R$ 18.187,58**
- Operating: **R$ -6.547,62**
- Investing: **R$ 0,00**
- Financing: **R$ 0,00**
- Net: **R$ -6.547,62**
- Closing: **R$ 11.639,96**
- Difference: **R$ 0,00**
- DFC official ready: **YES**

All 92 facts are operational for DFC; therefore Operating equals Net after row-level verification.

## BP final
- Base: movement of April, because opening absolute BP balances are not present in the source package.
- Assets period delta: **R$ -2.197,62** (cash R$ -6.547,62 + advances R$ 4.350,00)
- Liabilities period delta: **R$ 0,00**
- Equity period delta: **R$ -2.197,62**
- Difference: **R$ 0,00**
- Suspense account: **NO**
- BP official ready: **YES for deterministic April movement**; absolute closing balances require opening BP balances.

## Manifest
- Authoritative manifest: **YES**
- Rows: **92**
- Missing source rows: **0**
- Duplicate source rows: **0**
- Unknown accounts: **0**
- Unbalanced journals: **0**
- Balanced journals: **100%**
- Executed: **NO**

## Safety
- Financial writes: **0**
- Journal writes: **0**
- Ledger writes: **0**
- Database changes: **0**
- Migrations/RPC/views/RLS: **0**
- PROD: **NO**
- January/February/March changed: **NO**

## Readiness
- APRIL_ACCOUNTING_CLOSED: **YES**
- DRE_READY: **YES**
- DFC_READY: **YES**
- BP_READY: **YES** (movement basis)
- AUTHORITATIVE_MANIFEST_READY: **YES**
- READY_FOR_FIN_IMPORT_5_3_EXECUTION: **YES**
- READY_FOR_IMPORT: **NO**

## Artifacts
- `artifacts/finance/april_2026_final_decision_matrix.csv`
- `artifacts/finance/april_2026_consolidated_inventory.csv`
- `artifacts/finance/april_2026_accounting_final.json`
- `artifacts/finance/april_2026_closing_report.md`
- `artifacts/finance/april_2026_authoritative_manifest.json`

**NÃO executar manifesto. NÃO importar Abril. NÃO tocar PROD. PARAR.**
