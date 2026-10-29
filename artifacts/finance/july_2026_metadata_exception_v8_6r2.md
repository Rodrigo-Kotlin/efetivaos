# FIN-IMPORT-8.6R2 — Exceção documental e readiness de fechamento

## Decisão

`FIN-IMPORT-8.6R2 = PASS`
`DOCUMENTED_METADATA_EXCEPTION_ACCEPTED = YES`
`DOCUMENTATION_FOLLOWUP_BLOCKS_CLOSE = NO`
`READY_FOR_JULY_CLOSE = YES`

## Exceção aceita

Fato: FLX-2026-0628 — Material de cozinha. A metadata física permanece `technical_date=false`; a interpretação efetiva de governança é `technical_date=true`, com base em transaction_date=2026-07-31, original_source_date=2026-09-17, competência Julho/2026, artefatos de aprovação e o gap arquitetural R1.

A exceção é `DOCUMENTARY_ONLY`. Não houve UPDATE, INSERT, reversal, replacement ou qualquer alteração no banco. O relatório de gap R1 foi preservado.

## Materialidade

- FINANCIAL_MATERIALITY = NONE
- ACCOUNTING_MATERIALITY = NONE
- AUDIT_MATERIALITY = DOCUMENTARY_ONLY
- O fato possui valor R$ 503,41, conta 5.6.01.001, competência Julho/2026 e journal balanceado em R$ 503,41/R$ 503,41.

## Revalidação

- Ledger: 115 fatos, 115 journals, 230 linhas; débitos/créditos R$ 165.892,59; imbalance zero.
- Caixa Cora: abertura R$ 7.021,13; fechamento R$ 13.657,76; diferença zero.
- DRE por account.dre_class: resultado R$ 902,75.
- DFC oficial: operacional R$ 7.389,28; investimento R$ 0,00; financiamento R$ -752,65; total R$ 6.636,63. Bucket auxiliar: R$ 8.236,53.
- Batch íntegro; Junho locked; Julho unlocked; PROD não tocado.

Julho está tecnicamente pronto para o próximo gate de lock. O lock não foi criado nesta execução.
