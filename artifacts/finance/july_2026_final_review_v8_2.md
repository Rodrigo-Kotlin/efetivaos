# Julho/2026 — FIN-IMPORT-8.2

## Status

`FIN-IMPORT-8.2 = COMPLETE_WITH_PENDING_DECISIONS`  
`READY_FOR_FIN_IMPORT_8_3 = NO`  
`READY_FOR_IMPORT = NO`

Execução 100% read-only em DEV. Não houve importação, batch, journal real, lock, migration, commit, push ou acesso a PROD.

## Recontagem

| Status | Quantidade |
|---|---:|
| READY | 105 |
| READY_LEGACY_POLICY | 0 |
| DECISION_REQUIRED | 9 |
| POTENTIAL_DUPLICATE | 0 |
| PRIOR_PERIOD_REVIEW | 1 |
| UNRESOLVED_ALLOCATION | 0 |
| INVALID | 0 |
| **Total** | **115** |

Os oito alertas de potencial duplicidade foram encerrados como fatos distintos confirmados. A soma permanece 115 fatos.

## Caixa preservado

- Opening Cora: **R$ 7.021,13**
- Inflows: **R$ 86.264,61**
- Outflows: **R$ 79.627,98**
- Net change: **R$ 6.636,63**
- Closing: **R$ 13.657,76**
- Diferença: **R$ 0,00**

## Projeção

- Fatos classificados/resolvidos: **105**
- Fatos plenamente projetáveis: **104**
- Fatos classificados mas com data pendente: **1** (FLX-2026-0661)
- Fatos bloqueados por decisão: **10**
- Journals projetados conceitualmente: **105**
- Journals plenamente projetáveis: **104**
- Journals bloqueados: **11**
- Lines projetáveis plenamente: **208**
- Débitos/créditos da projeção plenamente projetável: **R$ 130.518,24 / R$ 130.518,24**

A projeção não cria journals no banco. Papéis de débito/crédito são apenas projeção técnica; a apresentação oficial seguirá `account.dre_class`.

## Bloqueadores restantes

### JUL-DEC-002 — DECISION_REQUIRED

- Fatos: FLX-2026-0660
- Total: **R$ 9.752,65**
- Descrições: Empréstimo (S)
- Resposta: **E**
- Bloqueio: Composição desconhecida; não aprovado split de principal/juros/encargos. Política legado agregada não aprovada para Julho.
- Informação necessária: Contraparte, data e composição; decisão sobre política agregada

### JUL-DEC-003 — DECISION_REQUIRED

- Fatos: FLX-2026-0659
- Total: **R$ 12.000,00**
- Descrições: Entrada NU
- Resposta: **C**
- Bloqueio: Confirmado que não é transferência própria; natureza econômica ainda não identificada.
- Informação necessária: Natureza econômica e data

### JUL-DEC-004 — DECISION_REQUIRED

- Fatos: FLX-2026-0621, FLX-2026-0652
- Total: **R$ 663,47**
- Descrições: Fatura Cartao Cora; Fatura Cartão Caixa
- Resposta: **E**
- Bloqueio: Composição das faturas desconhecida; não assumir compras lançadas ou não lançadas.
- Informação necessária: Composição das faturas e compras componentes

### JUL-DEC-010 — PRIOR_PERIOD_REVIEW

- Fatos: FLX-2026-0653
- Total: **R$ 3.100,00**
- Descrições: Pagamento prestação de serviços Valdilene 2025
- Resposta: **E**
- Bloqueio: Origem, natureza e competência de 2025 desconhecidas; não inventar passivo ou despesa de Julho.
- Informação necessária: Origem, natureza, competência e evidência de 2025

### JUL-DEC-013 — DECISION_REQUIRED

- Fatos: FLX-2026-0616, FLX-2026-0617, FLX-2026-0634, FLX-2026-0651
- Total: **R$ 354,82**
- Descrições: Internet Vivo; Conta vivo; Internet Vivo; Fatura Vivo
- Resposta: **PENDING**
- Bloqueio: Centro de custo/linha não informado.
- Informação necessária: Centro de custo e linha/unidade da telefonia

### JUL-DEC-019 — DECISION_REQUIRED

- Fatos: FLX-2026-0628
- Total: **R$ 503,41**
- Descrições: Material de cozinha
- Resposta: **A**
- Bloqueio: Competência Julho confirmada, mas data exata não informada. Não usar 17/09/2026 nem inventar data de Julho.
- Informação necessária: Centro/linha e data exata de Julho

### Data de Material de cozinha

`JUL-DEC-019` foi confirmado como competência Julho, mas permanece dentro de `DECISION_REQUIRED` porque a fonte informa 17/09/2026 e nenhuma data exata de Julho foi fornecida. Foi registrado `source_date_error = 2026-09-17`; essa data não será usada na futura importação de Julho.

## Aplicações relevantes

- Rodrigo foi consolidado como salário/remuneração, sem prestação de serviço.
- Janderson foi tratado como adiantamento a empregados `1.1.02.003`, sem nova despesa salarial.
- Valdilene foi tratada como pró-labore/remuneração, não como adiantamento.
- B L B de Oliveira foi classificado como despesa administrativa.
- Equatorial foi tratado como fatura corrente de Julho.
- `dre_effect` é auxiliar; DRE oficial = `account.dre_class`.
- Política legado agregada para o empréstimo de R$ 9.752,65 não foi aprovada.
