# FIN-IMPORT-7.0 — Inventário, reconciliação e readiness de Junho/2026

## Status
**COMPLETED_WITH_FINDINGS** — diagnóstico read-only concluído; Junho não foi importado.

## Fonte
- Arquivo/aba/range: FLUXO_CAIXA_2026.xlsx / JUNHO / A1:I192
- Linhas financeiras: **94**
- Linhas ignoradas: **98**

## Continuidade
- Fechamento Maio: **R$ 3.910,14**
- Abertura Junho na fonte: **R$ 3.910,14**
- Diferença: **R$ 0,00**
- Abril locked: **YES**; Maio locked: **YES**; Junho locked: **NO**

## Caixa da fonte
- Entradas: **R$ 81.304,36**
- Saídas: **R$ 78.193,37**
- Variação: **R$ 3.110,99**
- Fechamento calculado/fonte: **R$ 7.021,13 / R$ 7.021,13**
- Diferença: **R$ 0,00**

## Readiness
- READY: **63**
- DECISION_REQUIRED: **17**
- POTENTIAL_DUPLICATE: **4**
- PRIOR_PERIOD_REVIEW: **10**
- UNRESOLVED_ALLOCATION: **0**
- ACCOUNT_MAPPING_GAP: **0**
- PATRIMONIAL_REVIEW: **0**
- INVALID: **0**
- TOTAL: **94**

## Findings principais
- Empréstimo (E) R$ 15.000,00, Empréstimo (S) R$ 17.669,13 e Saída Caixa NU R$ 12.000,00 exigem decisão humana.
- Recupera Cobranças R$ 1.340,33 exige confirmação de natureza.
- Vales/pagamentos de Rodrigo, Janderson e Valdilene exigem confirmação individual.
- Há pagamentos referenciando Abril/Maio e um fato datado de 16/04 na aba Junho.
- Não foram encontrados cartões explícitos.

## DRE/DFC preliminares
- DRE determinística sobre READY: receita R$ 32.993,54, custos R$ 20.548,82, despesas R$ 11.897,93, resultado R$ 546,79.
- DFC determinística sobre READY: operacional R$ 140,67, sem investimento/financiamento definitivo; efeito não classificado R$ 2.970,32.

## Banco e segurança
- Junho no banco: **0 transações / 0 journals / 0 lock**.
- Maio batch/lock preservados; PROD não tocado.
- Writes, migrations, RPC/views/RLS: **0**.
- Manifesto autoritativo de Junho: não criado.
- Commit/push: não realizados.

## Perguntas humanas
- Row 181 [1_loans]: Junho, Saída Caixa NU (R$ 12.000,00): é transferência para conta distinta, retirada, empréstimo concedido ou outro movimento?
- Row 183 [1_loans]: Junho, Empréstimo (S) (R$ 17.669,13): confirmar amortização, juros, empréstimo concedido ou outra natureza; composição não informada.
- Row 184 [1_loans]: Junho, Empréstimo (E) (R$ 15.000,00): confirmar empréstimo recebido, aporte, transferência ou outra origem.
- Row 75 [2_people]: 03/06, Pagamento Valdilene (R$ 1.200,45): é pró-labore, adiantamento, saldo anterior ou prestação?
- Row 80 [2_people]: 05/06, Prestação de serviços Rodrigo (R$ 1.500,00): é salário, adiantamento ou serviço de terceiro?
- Row 89 [2_people]: 12/06, Vale Valdilene (R$ 1.000,00): é adiantamento de pró-labore ou outra natureza?
- Row 90 [2_people]: 12/06, Vale Rodrigo (R$ 100,00): confirmar se é adiantamento salarial.
- Row 94 [2_people]: 18/06, Vale Rodrigo (R$ 200,00): confirmar se é adiantamento salarial ou reembolso.
- Row 95 [2_people]: 19/06, Vale Janderson (R$ 200,00): confirmar se é adiantamento salarial.
- Row 98 [2_people]: 24/06, Pagamento prestação Rodrigo (R$ 1.200,00): é quitação salarial, prestação ou outro pagamento?
- Row 99 [2_people]: 24/06, Vale quinzena Janderson (R$ 1.200,00): confirmar adiantamento e relação com o saldo de Maio.
- Row 61 [4_other]: 06/11, Recupera Cobranças (R$ 1.340,33): é recebimento parcial de crédito antigo, receita de serviço ou outra origem?
- Row 88 [4_other]: 10/06, Pagamento Conecta (R$ 637,00): é o mesmo tipo de laudo técnico de Maio?
- Row 114 [4_other]: 30/06, Parcelamento DAS 3/42 (R$ 506,07): confirmar dívida, composição e se é obrigação histórica.
- Row 72 [5_general]: 02/06, Alimentação (R$ 563,92): é despesa administrativa, custo de serviço, viagem ou reembolso?
- Row 108 [5_general]: 26/06, Núcleo Inf. Coord. Ponto (R$ 40,00): identificar natureza e conta.
- Row 115 [5_general]: 30/06, Contabilidade (R$ 680,00): confirmar se é serviço administrativo corrente.

## Artefatos
- artifacts/finance/june_2026_source_inventory.csv
- artifacts/finance/june_2026_decision_matrix.csv
- artifacts/finance/june_2026_diagnostic.json
- artifacts/finance/june_2026_initial_review.md

**READY_FOR_FIN_IMPORT_7_1: YES** (revisão humana)
**READY_FOR_IMPORT: NO**
