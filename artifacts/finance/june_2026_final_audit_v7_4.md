# FIN-IMPORT-7.4 — Auditoria final pós-importação de Junho/2026

## Status

`FIN-IMPORT-7.4 = PASS`  
`READY_FOR_JUNE_CLOSE = YES`

Execução exclusivamente **read-only** no Supabase DEV. Nenhum lock de Junho foi criado.

## Ambiente e governança

- Projeto: `bxviuzluxcijbqqbpyzb` (DEV).
- PROD: intocado.
- Batch: `a6a093f4-9128-414a-bbe3-857d7128f072`.
- Batch key: `FIN-IMPORT-7.3-JUNE-2026`.
- Manifest hash: `c0448eccef1bd83d2b4011e2f8d7a9a042035d3c07481496d5d51a72dfa19e39`.
- `BATCH_INTEGRITY = PASS`.
- `IDEMPOTENCY = PASS`.
- `PRIOR_PERIOD_IMMUTABILITY = PASS`.
- Abril locked: sim; Maio locked: sim; Junho locked: não.

## Integridade da importação

- Fatos: **94**; external IDs únicos: **94**; duplicatas: **0**.
- Journals: **94**; journal lines: **188**.
- Débitos: **R$ 159.497,73**.
- Créditos: **R$ 159.497,73**.
- Diferença: **R$ 0,00**.
- Journals desbalanceados: **0**.

`FACT_INTEGRITY = PASS`  
`LEDGER_INTEGRITY = PASS`

## Caixa Cora

`R$ 3.910,14 + R$ 81.304,36 - R$ 78.193,37 = R$ 7.021,13`

- Entradas: R$ 81.304,36.
- Saídas totais: R$ 78.193,37.
- Transferência interna: R$ 12.000,00.
- Saídas externas: R$ 66.193,37.
- Saldo final da conta Cora: R$ 7.021,13.
- Variação Cora: R$ 3.110,99.

`CORA_RECONCILIATION = PASS`

## NU

- Conta: `1.1.01.003 — Banco Nubank`.
- Saldo inicial histórico: **UNKNOWN**.
- Entrada documentada: R$ 12.000,00.
- Outros movimentos de Junho: nenhum evidenciado.
- Saldo derivado dos movimentos importados/ledger: R$ 12.000,00.
- Saldo histórico absoluto: **UNKNOWN**.

`NU_OPENING_BALANCE = UNKNOWN`  
`NU_RECONCILIATION = PASS`

## DRE oficial

A apresentação usa exclusivamente `account.dre_class`; `dre_effect` não substitui essa classificação.

- Receita: R$ 64.964,03.
- Custos (`CUSTO_SERVICO`): R$ 22.675,82.
- Despesas (`DESPESA_OPERACIONAL`): R$ 22.499,10.
- Resultado: R$ 19.789,11.
- Fórmula: `64.964,03 - 22.675,82 - 22.499,10 = 19.789,11`.

`DRE_PRESENTATION_BASIS = account.dre_class`  
`OFFICIAL_DRE_INTEGRITY = PASS`

## DFC oficial

- Operacional: R$ 17.780,12.
- Investimento: R$ 0,00.
- Financiamento: R$ -2.669,13.
- Variação consolidada: R$ 15.110,99.
- Transferência interna bruta: R$ 12.000,00.
- Efeito consolidado da transferência: R$ 0,00.
- Diferença: R$ 0,00.

`DFC_INTEGRITY = PASS`

## Lançamentos especiais

- Transferência Cora → NU: débito `1.1.01.003`, crédito `1.1.01.002`, R$ 12.000,00, sem DRE e sem efeito DFC consolidado. `PASS`
- Empréstimo recebido: 05/06/2026, R$ 15.000,00, débito Cora, crédito `2.1.06.001`, DRE NONE, DFC FINANCIAMENTO. `PASS`
- Amortização: 30/06/2026, R$ 17.669,13, agregado, sem split principal/juros inventado, DFC FINANCIAMENTO. `PASS`

## Políticas legado e AR/AP

- READY: 84.
- READY_LEGACY_POLICY: 10.
- Competências anteriores e amortização agregada permanecem identificáveis.
- Linhas importadas em contas a receber/pagar (`1.1.02.001`/`2.1.01.001`): 0.

`LEGACY_POLICY_INTEGRITY = PASS`  
`HISTORICAL_AR_AP_INTEGRITY = PASS`

## Readiness

Todos os gates obrigatórios passaram: **BATCH_INTEGRITY=PASS, FACT_INTEGRITY=PASS, LEDGER_INTEGRITY=PASS, INTERNAL_TRANSFER_INTEGRITY=PASS, LOAN_RECEIPT_INTEGRITY=PASS, LOAN_REPAYMENT_INTEGRITY=PASS, OFFICIAL_DRE_INTEGRITY=PASS, DFC_INTEGRITY=PASS, CORA_RECONCILIATION=PASS, NU_RECONCILIATION=PASS, IDEMPOTENCY=PASS, PRIOR_PERIOD_IMMUTABILITY=PASS, LEGACY_POLICY_INTEGRITY=PASS, HISTORICAL_AR_AP_INTEGRITY=PASS, PROD_UNTOUCHED=PASS**.

`READY_FOR_JUNE_CLOSE = YES`

O fechamento de Junho **não foi executado** e deve ocorrer somente em gate posterior específico.

## Artefatos

- `june_2026_final_audit_v7_4.json`
- `june_2026_final_audit_v7_4.md`
- `june_2026_final_ledger_reconciliation_v7_4.csv`
- `june_2026_final_dre_v7_4.csv`
- `june_2026_final_dfc_v7_4.csv`
- `june_2026_closure_precheck_v7_4.json`
