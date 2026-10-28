# FIN-IMPORT-7.3 — Importação controlada de Junho/2026

## Status
**COMPLETED_WITH_FINDINGS.** A importação foi gravada atomicamente no Supabase DEV. O gate final é **NO** por divergência na divisão nominal da DRE contra o ledger persistido por `account.dre_class`.

`READY_FOR_FIN_IMPORT_7_4 = NO`

## Ambiente e escrita
- Projeto confirmado: `bxviuzluxcijbqqbpyzb` (DEV).
- PROD: intocado.
- Batch: `a6a093f4-9128-414a-bbe3-857d7128f072`.
- Manifest hash: `c0448eccef1bd83d2b4011e2f8d7a9a042035d3c07481496d5d51a72dfa19e39`.
- `ATOMIC_IMPORT = PASS`.
- 1 batch concluído; nenhum lock de Junho criado.

## Cobertura
- Fatos importados: **94/94** — READY 84, READY_LEGACY_POLICY 10.
- Journals: **94**.
- Journal lines: **188**.
- Débitos: **R$ 159.497,73**.
- Créditos: **R$ 159.497,73**.
- Diferença: **R$ 0,00**.
- Desbalanceados: **0**.

## Caixa e DFC persistidos
- Entradas: **R$ 81.304,36**.
- Saídas totais Cora: **R$ 78.193,37**.
- Transferência interna Cora → NU: **R$ 12.000,00**.
- Saídas externas: **R$ 66.193,37**.
- Saldo final da conta Cora: **R$ 7.021,13**.
- DFC operacional: **R$ 17.780,12**.
- DFC investimento: **R$ 0,00**.
- DFC financiamento: **R$ -2.669,13**.
- Variação consolidada: **R$ 15.110,99**.
- Efeito consolidado da transferência: **R$ 0,00**.
- `CORA_POST_IMPORT_RECONCILIATION = PASS`.
- `DFC_RECONCILIATION = PASS`.

O saldo NU após a importação é R$ 12.000,00 no ledger DEV; isso representa a transferência importada, não um saldo inicial inventado. O saldo consolidado final não foi usado como critério de fechamento.

## DRE persistida
A receita e o resultado total conferem:
- Receita: **R$ 64.964,03** — PASS.
- Custos persistidos conforme `account.dre_class`: **R$ 22.675,82**.
- Despesas persistidas conforme `account.dre_class`: **R$ 22.499,10**.
- Resultado: **R$ 19.789,11** — PASS.

O contrato nominal do FIN-IMPORT-7.1 esperava custos de R$ 3.802,62 e despesas de R$ 41.372,30. A divisão persistida diverge em **R$ 18.873,20** entre as duas categorias, embora o resultado total permaneça igual. Como a regra contábil oficial exige `account.dre_class`, não foi feita reclassificação destrutiva ou correção não aprovada após a importação.

`DRE_RECONCILIATION = FAIL`

## Idempotência
A segunda execução foi bloqueada antes de qualquer insert por batch já existente. As contagens permaneceram 94 fatos, 94 journals e 188 linhas.

`IDEMPOTENCY_PRECHECK = PASS`  
`IDEMPOTENCY_SECOND_RUN = PASS`

## Imutabilidade
- Abril locked: **sim**.
- Maio locked: **sim**.
- Junho locked: **não**.
- Nenhum período anterior foi alterado.

`PRIOR_PERIOD_IMMUTABILITY = PASS`

## Findings e próximo passo
A importação em si está íntegra, balanceada, idempotente e reconciliada em caixa/DFC. O gate 7.4 permanece bloqueado exclusivamente pela divergência da divisão DRE entre a matriz aprovada e `account.dre_class`. É necessária decisão/matriz corretiva separada antes de qualquer reclassificação append-only; nenhum ajuste foi aplicado nesta execução.
