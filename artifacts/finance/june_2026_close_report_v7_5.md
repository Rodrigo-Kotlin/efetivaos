# FIN-IMPORT-7.5 — Fechamento controlado de Junho/2026

## Resultado

`FIN-IMPORT-7.5 = PASS`  
`JUNE_2026_CLOSED = YES`  
`READY_FOR_FIN_IMPORT_7_6 = YES`

## Ambiente

- Supabase DEV: `bxviuzluxcijbqqbpyzb`.
- PROD tocado: **não**.
- Nenhuma migration, alteração de fato/journal, reclassificação, commit ou push foi executado.

## Lock criado

- Lock ID: `c0ad6dad-5289-4564-bd76-6cf99b204051`.
- Período: `2026-06-01` até `2026-06-30`.
- Locked at: `2026-10-28 19:24:19.522051+00`.
- Locked by: `3014c86d-d84e-416d-ac3a-bb7dabb098c5`.
- Razão: `Fechamento financeiro Junho/2026 — FIN-IMPORT-7.5`.
- Locks de Junho após fechamento: **1**.

`JUNE_CLOSE_PRECHECK = PASS`  
`JUNE_LOCK_INTEGRITY = PASS`

## Snapshot e integridade

- Batch: `a6a093f4-9128-414a-bbe3-857d7128f072`.
- Batch key: `FIN-IMPORT-7.3-JUNE-2026`.
- Manifest hash: `c0448eccef1bd83d2b4011e2f8d7a9a042035d3c07481496d5d51a72dfa19e39`.
- Snapshot SHA-256: `62bdf4f5963e60f932f4929a332b933f53bf5b9cbefe84a8a74ffbde72ddd964`.
- Fatos/journals/lines: **94 / 94 / 188**.
- Débitos/créditos: **R$ 159.497,73 / R$ 159.497,73**.
- Imbalance: **R$ 0,00**.

`POST_CLOSE_RECONCILIATION = PASS`

## Caixa e DRE

- Cora: `R$ 3.910,14 + R$ 81.304,36 - R$ 78.193,37 = R$ 7.021,13`.
- Saldo final Cora: **R$ 7.021,13**.
- DRE oficial (`account.dre_class`): Receita **R$ 64.964,03**; Custos **R$ 22.675,82**; Despesas **R$ 22.499,10**; Resultado **R$ 19.789,11**.
- DFC: Operacional **R$ 17.780,12**; Investimento **R$ 0,00**; Financiamento **R$ -2.669,13**; variação consolidada **R$ 15.110,99**.
- Transferência interna: **R$ 12.000,00**, efeito consolidado **R$ 0,00**.

`OPENING_CONTINUITY = PASS`  
`JUNE_IMMUTABILITY_TEST = PASS`

A tentativa de desbloqueio via `assert_period_unlocked()` foi rejeitada para Junho, Abril e Maio; Julho permaneceu desbloqueado. A transação de teste foi revertida e não deixou dados.

## Idempotência e períodos

- Segunda execução do precheck detectou o lock existente antes de qualquer novo insert.
- Locks: Abril **1**, Maio **1**, Junho **1**, Julho **0**.

`CLOSE_IDEMPOTENCY = PASS`  
`PRIOR_PERIOD_LOCK_INTEGRITY = PASS`

NU permanece com opening histórico **UNKNOWN**; o saldo derivado dos movimentos importados é **R$ 12.000,00**.

## Artefatos

- `june_2026_close_result_v7_5.json`
- `june_2026_close_report_v7_5.md`
- `june_2026_close_snapshot_v7_5.json`
- `june_2026_post_close_reconciliation_v7_5.csv`
- `june_2026_lock_idempotency_v7_5.json`
