# FIN-IMPORT-8.7 — Fechamento controlado de Julho/2026

## Resultado

`FIN-IMPORT-8.7 = PASS`
`JULY_2026_CLOSED = YES`
`READY_FOR_FIN_IMPORT_8.8 = YES`

Lock criado exatamente uma vez no DEV:
- Lock ID: d4cd2a1d-df5a-4c1d-ae36-5d9f4f6b2165
- Período: 2026-07-01 a 2026-07-31
- Locked at: 2026-10-29T10:45:23.296473+00:00
- Locked by: 3014c86d-d84e-416d-ac3a-bb7dabb098c5
- Batch: da6025fd-d747-4833-85c5-8ca9c6ef8670
- Manifest: 843ca14b1a9bbe0eac27790ce25069823e3de58a89d43ef038d5d423a4f666e0


## Validações

- Ledger: 115 fatos, 115 journals, 230 linhas; R$ 165.892,59 em débitos e créditos; imbalance zero.
- Caixa Cora: abertura R$ 7.021,13; fechamento R$ 13.657,76; diferença zero.
- DRE: resultado R$ 902,75, base account.dre_class.
- DFC: operacional R$ 7.389,28; investimento R$ 0,00; financiamento R$ -752,65; total R$ 6.636,63.
- Imutabilidade: operação financeira para Julho rejeitada por período bloqueado; nenhum registro de teste persistiu.
- Idempotência: segunda execução detectou o lock existente e não criou duplicata.
- Períodos: Abril, Maio, Junho e Julho locked; Agosto unlocked.
- Exceção documental FLX-2026-0628 preservada.
- PROD_TOUCHED = NO.

Nenhuma alteração em fatos, journals, journal lines, batch ou metadata foi executada.
