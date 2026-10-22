# FIN-IMPORT-6.0 — Inventário e reconciliação inicial de Maio/2026

## Status
**COMPLETED_WITH_FINDINGS** — fonte inventariada e caixa reconciliado; decisões humanas permanecem necessárias. Nenhum dado de Maio foi importado.

## Source
- File: FLUXO_CAIXA_2026.xlsx; sheet/range: MAIO!A1:I191
- Facts: **83**; inflows: **35**; outflows: **48** (including withdrawal row 182); ignored non-fact rows: **108**

## Opening and cash reconciliation
- April official closing: **R$ 11.639,96**
- May source opening: **R$ 11.639,96**; difference: **R$ 0,00**
- Inflows: **R$ 63.015,98**
- Outflows: **R$ 70.745,80** = detail R$ 54.800,15 + withdrawal R$ 15.945,65
- Closing: **R$ 3.910,14**; difference: **R$ 0,00**

## Readiness
- READY: **59**
- DECISION_REQUIRED: **11**
- ACCOUNT_MAPPING_GAP: **0**
- POTENTIAL_DUPLICATE: **6**
- PRIOR_PERIOD_REVIEW: **4**
- PATRIMONIAL_REVIEW: **0**
- UNRESOLVED_ALLOCATION: **3**
- TOTAL: **83**

## Preliminary statements
- DRE non-official: revenue R$ 23.315,13, costs R$ 17.583,00, operating expenses R$ 22.177,86, deterministic result R$ -16.445,73, unresolved R$ 8.715,91.
- DFC preliminary: operating R$ -16.445,73, investing R$ 0,00, financing R$ 0,00, unclassified R$ 8.715,91, closing R$ -4.805,77.

## Reviews
- Prior period rows: 90, 101, 102, 103
- Potential duplicates: 15, 17, 89, 106, 109, 114
- Patrimonial review: none explicitly identifiable. Mapping gaps: none.

## Human decisions
- Rows 15 e 17: são duas cobranças distintas de Rio Tapajós Shopping Center?
- Rows 89 e 106: são parcelas Criffer distintas ou possível duplicidade?
- Rows 109 e 114: ART TUV e ART TUV oriximiná são serviços distintos?
- Row 61: Emprestimo Cora tem contrato e não é receita/transferência?
- Row 62: Recupera é recuperação, receita ou outra origem?
- Row 111: a fatura do Cartão Caixa já teve itens lançados individualmente?
- Rows 72, 77, 94, 95, 105 e 115: qual pessoa, natureza e competência?
- Rows 99 e 100: qual parcelamento/tributo e composição principal, juros e multa?
- Rows 101, 102 e 103: pagamentos de Abril já foram reconhecidos no período fechado?
- Row 84: qual parcela é principal FGTS e qual parcela é multa/encargo?
- Row 86: restante de rescisão é parcela distinta e qual competência?
- Row 90: Raio X UDI março já foi reconhecido em Março?
- Row 182: retirada é principal/juros do empréstimo Cora ou transferência?

## Controls
April locked: **YES**; May locked: **NO**. Financial/database writes: **0**. Transactions, journals, locks, migrations, RPC/views/RLS changes: **0**. PROD untouched. May authoritative manifest not created. Commit/push not performed.

## Artifacts
- artifacts/finance/may_2026_source_inventory.csv
- artifacts/finance/may_2026_decision_matrix.csv
- artifacts/finance/may_2026_diagnostic.json
- artifacts/finance/may_2026_initial_review.md

**READY_FOR_FIN_IMPORT_6_1: YES** (human review only); **READY_FOR_IMPORT: NO**.
