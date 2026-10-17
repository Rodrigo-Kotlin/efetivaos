# FIN-IMPORT-4.6 - March 2026 Import Acceptance

**Status:** FECHADA

**Data:** 2026-10-17

**Ambiente:** Supabase DEV `bxviuzluxcijbqqbpyzb`

**PROD:** nao acessado

## Escopo e fonte

- Workbook: `FLUXO_CAIXA_2026.xlsx`
- Sheet: `MARÇO`
- Range: `A1:D188`
- Periodo: marco/2026
- Batch ID: `811d30d7-2b2a-4f0c-9424-50f0dc1df75b`
- Manifest hash: `a35fb5d177d8424c77373a0ef29eb12a2ad4c0ee0912f826d4b5960fb2f067fb`
- Base Git: `8e8d05786b7d95f44f595ee88d22501df35be05f`

Este documento formaliza a aceitacao do batch autoritativo FIN-IMPORT-4. Nenhuma
RPC de importacao foi chamada neste gate. Nenhum transaction, journal, conta ou
categoria foi alterado.

## Integridade da importacao

- Import rows: 106
- Transactions: 106
- Journals: 106
- Journal lines: 212
- Manifest matched: 106/106
- Missing: 0
- Extra: 0
- Duplicates: 0
- Unbalanced journals: 0
- Orphan journals: 0
- Orphan journal lines: 0

## Decisoes de classificacao relevantes

As decisoes row-level do manifesto foram preservadas, incluindo:

- row 74: energia como despesa operacional;
- row 81: equipamento como imobilizado;
- rows 91 e 128: adiantamentos a socio/administrador;
- row 106: custo clinico;
- row 107: entrada de acordo como despesa direta, conforme decisao do gate;
- rows 108 e 109: despesas operacionais;
- rows 118 e 119: liquidacao do passivo Criffer;
- row 124: pro-labore.

As rows 122 e 126 permaneceram no ledger com a conta debitada
`5.2.01.001 - Alugueis e Condominio`. A matriz as marcou como
`INVENTORY_PROPOSAL`, sem evidencia de decisao humana inequivoca para
reclassificacao contabil.

## Criffer e FIN-FIX-6

- FIN-FIX-6 preservado.
- Rows 118/119: 2 rows.
- Settlement: R$ 557,15.
- Conta do passivo `2.1.09.001`: R$ 0,00.
- Ativo historico `1.2.99.001`: R$ 1.123,99 devedor.
- Efeito DRE: R$ 0,00.
- Efeito DFC: INVESTIMENTO, -R$ 557,15.

## Caixa oficial

- Opening: R$ 2.070,12
- Inflows: R$ 75.591,68
- Outflows: R$ 59.474,22
- Transfers: R$ 0,00
- Net change: R$ 16.117,46
- Closing / Banco Cora: R$ 18.187,58
- Difference: R$ 0,00

## DRE oficial de marco

A apresentacao oficial segue `financial_chart_accounts.dre_class`.

- Receita Bruta: R$ 75.591,68
- Outros Resultados: R$ 0,00
- Total Income: R$ 75.591,68
- Custos: R$ 24.213,78
- Despesas: R$ 29.253,29
- Resultado Liquido: R$ 22.124,61

Conferencia: `75.591,68 - 24.213,78 - 29.253,29 = 22.124,61`.

Os valores analiticos anteriores de custos de R$ 26.963,78 e despesas de
R$ 26.503,29 nao sao os valores oficiais da DRE.

### Auditoria da diferenca de R$ 2.750,00

| source_row | descricao | valor | conta debitada | DRE oficial |
|---|---|---:|---|---|
| 122 | Aluguel Clinica | R$ 2.500,00 | `5.2.01.001 - Alugueis e Condominio` | DESPESAS |
| 126 | Pagamento Aluguel Placa Shopping | R$ 250,00 | `5.2.01.001 - Alugueis e Condominio` | DESPESAS |

Total realocado de Custos para Despesas: R$ 2.750,00. O credito das duas
rows e `1.1.01.002 - Banco Cora`; valores, datas, caixa, DFC e partidas
dobradas estao corretos.

## DFC oficial

- Opening: R$ 2.070,12
- Operating: R$ 16.924,61
- Investing: -R$ 807,15
- Financing: R$ 0,00
- Net: R$ 16.117,46
- Closing: R$ 18.187,58
- Difference: R$ 0,00

## BP em 31/03/2026

- Assets: R$ 34.426,27
- Liabilities: R$ 10.000,00
- Equity: R$ 24.426,27
- Difference: R$ 0,00
- Resultado do Exercicio acumulado: R$ 20.039,82

Reconciliação do resultado acumulado:

```text
Jan: +R$ 11.185,79
Feb: -R$ 13.270,58
Mar: +R$ 22.124,61
YTD:  R$ 20.039,82
```

O BP calcula resultado acumulado do exercicio ate a data. O resultado mensal
de marco nao substitui o resultado acumulado do BP.

## AR/AP

- March received: 46, R$ 75.591,68
- March paid: 51, R$ 53.467,07
- Artificial open AR: 0
- Artificial open AP: 0
- Misclassified patrimonial: 0
- Criffer artificial AP: 0

## Relatorios gerenciais

- DMPL: PASS; resultado de marco R$ 22.124,61.
- DVA: PASS; total a distribuir igual ao total distribuido.
- DLPA: PASS; resultado de marco R$ 22.124,61.
- Net income consistency: PASS.

## Janeiro e fevereiro preservados

Nenhuma intervencao do FIN-IMPORT-4 modificou fatos de janeiro ou fevereiro.

- January result: R$ 11.185,79.
- February FIN-IMPORT-3 rows: 79.
- February received: 28, R$ 19.137,68.
- February paid: 40, R$ 32.408,26.
- February result: -R$ 13.270,58.
- February preserved: YES.

## Ledger global

- Total debits: R$ 508.232,10
- Total credits: R$ 508.232,10
- Difference: R$ 0,00
- Unbalanced journals: 0
- Orphan journals: 0
- Orphan journal lines: 0
- Invalid reversal chains: 0

## Classificacao final

`FIN_IMPORT_4_5_FINAL_CLASSIFICATION: MIXED_FINDINGS`

Composicao:

- `GATE_EXPECTATION_ERROR_ONLY`: BP.
- `REPORT_PRESENTATION_FINDING_ONLY`: DRE.
- `TRUE_ACCOUNTING_FAILURE`: NO.
- `DATA_CORRUPTION`: NO.
- `ACCOUNTING_CORRECTION_REQUIRED`: NO.
- `ROLLBACK_REQUIRED`: NO.
- `REIMPORT_REQUIRED`: NO.

O BP esta correto e o finding foi causado pela expectativa de resultado mensal
contra resultado acumulado. A DRE oficial esta correta conforme o plano de
contas; a diferenca de R$ 2.750,00 e de apresentacao contra a expectativa
analitica preliminar. Nao existe erro contabil a corrigir neste gate.

## Aceitacao formal

- March formally accepted: YES.
- Import data integrity: YES.
- Cash reconciled: YES.
- Official DRE reconciled: YES.
- DFC reconciled: YES.
- BP reconciled: YES.
- AR/AP reconciled: YES.
- Criffer reconciled: YES.
- Ledger integrity: YES.
- March 2026 formally closed: YES.

Nao executar abril automaticamente.
