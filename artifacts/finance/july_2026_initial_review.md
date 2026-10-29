# Julho/2026 — Diagnóstico inicial FIN-IMPORT-8.0

## Status

`ENVIRONMENT_PRECHECK = PASS`  
`READY_FOR_FIN_IMPORT_8_1 = YES`  
`READY_FOR_IMPORT = NO`

Diagnóstico exclusivamente read-only. PROD não foi acessado; não houve importação, batch, journal, lock, migration, commit ou push.

## Fonte

- Arquivo: `FLUXO_CAIXA_2026.xlsx`
- Aba/range: `JULHO` / `A1:I194`
- Linhas da fonte: **194**
- Fatos financeiros: **115** (45 entradas detalhadas, 67 saídas detalhadas, 3 registros de resumo)
- Linhas ignoradas: **79** (cabeçalhos, subtotais, vazios e saldos/resumos não movimentáveis)
- Arquivo `ROTEIRO_LANCAMENTOS_EFETIVASO_JAN_JUL_2026.xlsx`: não localizado no repositório.

## Continuidade e caixa

- Junho closing Cora: **R$ 7.021,13**
- Julho opening: **R$ 7.021,13**
- Diferença: **R$ 0,00** — `OPENING_CONTINUITY = PASS`
- Entradas totais incluindo resumo: **R$ 86.264,61**
- Saídas totais incluindo resumo: **R$ 79.627,98**
- Variação líquida: **R$ 6.636,63**
- Closing calculado: **R$ 13.657,76**
- Closing informado: **R$ 13.657,76**
- Diferença de fechamento: **R$ 0,00**

A reconciliação fecha quando os registros de financiamento e a entrada NU do resumo são preservados. O saldo NU não deve ser tratado como caixa consolidado sem decisão sobre a conta de origem.

## Readiness

| Status | Quantidade |
|---|---:|
| READY | 78 |
| DECISION_REQUIRED | 27 |
| POTENTIAL_DUPLICATE | 8 |
| PRIOR_PERIOD_REVIEW | 1 |
| UNRESOLVED_ALLOCATION | 1 |
| ACCOUNT_MAPPING_GAP | 0 |
| PATRIMONIAL_REVIEW | 0 |
| INVALID | 0 |
| **Total** | **115** |

## DEV read-only

- Transações de Julho: **0**
- Journals de Julho: **0**
- Locks de Julho: **0**
- Batches Julho: **0**
- Locks anteriores: Abril, Maio e Junho = **1 cada**; lock de Junho preservado: `c0ad6dad-5289-4564-bd76-6cf99b204051`.

## Pendências humanas consolidadas

| Item | Data | Descrição | Valor | Status | Dúvida objetiva | Recomendação preliminar |
|---|---|---|---:|---|---|---|
| FLX-2026-0589 | 2026-07-07 | Alimentação | R$ 2.052,34 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0595 | 2026-07-06 | Salário Luciana | R$ 1.499,43 | POTENTIAL_DUPLICATE | Confirmar se o pagamento/fatos repetidos representam eventos distintos ou duplicidade | Não excluir; validar comprovantes e compras componentes |
| FLX-2026-0596 | 2026-07-06 | Salário Randrea | R$ 1.499,43 | POTENTIAL_DUPLICATE | Confirmar se o pagamento/fatos repetidos representam eventos distintos ou duplicidade | Não excluir; validar comprovantes e compras componentes |
| FLX-2026-0597 | 2026-07-06 | Prestação de serviço Rodrigo | R$ 1.500,00 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0598 | 2026-07-06 | Pagamento BC Danillo | R$ 3.000,00 | POTENTIAL_DUPLICATE | Confirmar se o pagamento/fatos repetidos representam eventos distintos ou duplicidade | Não excluir; validar comprovantes e compras componentes |
| FLX-2026-0599 | 2026-07-06 | Pagamento BC Allan | R$ 3.000,00 | POTENTIAL_DUPLICATE | Confirmar se o pagamento/fatos repetidos representam eventos distintos ou duplicidade | Não excluir; validar comprovantes e compras componentes |
| FLX-2026-0600 | 2026-07-06 | Pagamento BC Souza | R$ 3.000,00 | POTENTIAL_DUPLICATE | Confirmar se o pagamento/fatos repetidos representam eventos distintos ou duplicidade | Não excluir; validar comprovantes e compras componentes |
| FLX-2026-0601 | 2026-07-06 | Pagamento David | R$ 3.000,00 | POTENTIAL_DUPLICATE | Confirmar se o pagamento/fatos repetidos representam eventos distintos ou duplicidade | Não excluir; validar comprovantes e compras componentes |
| FLX-2026-0603 | 2026-07-07 | Ajuda de combustível Janderson | R$ 500,00 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0604 | 2026-07-07 | Materiais de limpeza | R$ 197,44 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0610 | 2026-07-07 | Vale Rodrigo | R$ 500,00 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0612 | 2026-07-07 | Vale Valdilene | R$ 2.500,00 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0613 | 2026-07-11 | Insumos de Limpeza clínica | R$ 497,74 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0614 | 2026-07-13 | B L B de Oliveira | R$ 250,00 | UNRESOLVED_ALLOCATION | Identificar natureza, contraparte e centro de custo de B L B de Oliveira | Resolver manualmente antes da carga |
| FLX-2026-0616 | 2026-07-13 | Internet Vivo | R$ 101,22 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0617 | 2026-07-13 | Conta vivo | R$ 64,00 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0618 | 2026-07-13 | Insumos de escritório | R$ 156,64 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0619 | 2026-07-14 | AIBR Instituição  - curso | R$ 54,79 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0620 | 2026-07-14 | GINEAD Curso | R$ 49,70 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0621 | 2026-07-15 | Fatura Cartao Cora | R$ 173,34 | POTENTIAL_DUPLICATE | Confirmar se o pagamento/fatos repetidos representam eventos distintos ou duplicidade | Não excluir; validar comprovantes e compras componentes |
| FLX-2026-0623 | 2026-07-15 | Pagamento restante Rodrigo | R$ 1.000,00 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0624 | 2026-07-15 | Vale Janderson | R$ 1.250,00 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0627 | 2026-07-17 | Cópia de Chaves | R$ 30,00 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0628 | 2026-09-17 | Material de cozinha | R$ 503,41 | PRIOR_PERIOD_REVIEW | Confirmar data/competência real de Material de cozinha | Não carregar em Julho até confirmar |
| FLX-2026-0630 | 2026-07-21 | Uniunica Edeucação cursos | R$ 295,39 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0631 | 2026-07-22 | Vale Rodrigo | R$ 80,00 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0634 | 2026-07-27 | Internet Vivo | R$ 102,24 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0638 | 2026-07-27 | Equatorial | R$ 1.008,90 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0639 | 2026-07-27 | Negociação Equatorial | R$ 841,63 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0640 | 2026-07-28 | Carregador Celular e capa | R$ 60,00 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0650 | 2026-07-30 | Vale Valdilene | R$ 1.000,00 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0651 | 2026-07-31 | Fatura Vivo | R$ 87,36 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0652 | 2026-07-31 | Fatura Cartão Caixa | R$ 490,13 | POTENTIAL_DUPLICATE | Confirmar se o pagamento/fatos repetidos representam eventos distintos ou duplicidade | Não excluir; validar comprovantes e compras componentes |
| FLX-2026-0653 | 2026-07-31 | Pagamento prestação de serviços Valdilene 2025 | R$ 3.100,00 | DECISION_REQUIRED | Confirmar a pendência indicada na base de migração | Resolver antes da importação definitiva |
| FLX-2026-0661 | sem data | Entrada NU | R$ 12.000,00 | DECISION_REQUIRED | Identificar credor, data e contrato do empréstimo recebido | Não tratar como receita operacional |
| FLX-2026-0661 | sem data | Empréstimo (S) | R$ 9.752,65 | DECISION_REQUIRED | Identificar credor, data e contrato do empréstimo recebido | Não tratar como receita operacional |
| FLX-2026-0661 | sem data | Empréstimo (E) | R$ 9.000,00 | DECISION_REQUIRED | Identificar credor, data e contrato do empréstimo recebido | Não tratar como receita operacional |

## Pontos específicos

- Empréstimo recebido (E), R$ 9.000,00: não é receita operacional; faltam credor, data e contrato.
- Empréstimo/saída (S), R$ 9.752,65: não assumir amortização, empréstimo concedido ou composição principal/juros.
- Entrada NU, R$ 12.000,00: falta data e confirmação da origem; tratar como transferência interna somente após evidência.
- Cartões: pagamentos Cora R$ 173,34 e Caixa R$ 490,13 permanecem como potenciais duplicidades até confirmar as compras componentes.
- Pessoal, prestação de serviços, vales, ajuda de combustível e pagamento Valdilene 2025 exigem confirmação de natureza/centro conforme pendências da base.
- Tributos, negociações e parcelas foram inventariados sem inferir composição ou competência anterior.
- A classificação auxiliar `dre_effect` não é a DRE oficial. A apresentação futura deverá usar `account.dre_class`; nenhum `official_dre_class` foi inventado neste diagnóstico.

## Artefatos

- `artifacts/finance/july_2026_source_inventory.csv`
- `artifacts/finance/july_2026_decision_matrix.csv`
- `artifacts/finance/july_2026_diagnostic.json`
- `artifacts/finance/july_2026_potential_duplicates.csv`
- `artifacts/finance/july_2026_prior_period_review.csv`

## Próximo status

`READY_FOR_FIN_IMPORT_8_1 = YES` porque a fonte foi inventariada, a continuidade/caixa foram reconciliadas e as pendências foram consolidadas.  
`READY_FOR_IMPORT = NO` porque ainda existem decisões, potenciais duplicidades, revisão de competência anterior e lacunas de alocação.
