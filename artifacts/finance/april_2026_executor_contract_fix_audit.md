# FIN-IMPORT-5.3C — Auditoria da correção do contrato DRE presentation

## Status

**COMPLETED** — contrato corrigido e aplicado somente no DEV. Abril real não foi
executado.

## Ambiente e integridade

- Target: `DEV`
- Project ref: `bxviuzluxcijbqqbpyzb`
- PROD touched: **NO**
- Manifest SHA-256 autorizado:
  `6605a548fdb031d83e95e84945cb5853bbd816485eab17ed2b7bdc42749af662`
- Manifesto alterado: **NO**

## Problema original

- Rejected source row: `70`
- Description: `Alimentação`
- Account: `5.9.01.001 — Outras Despesas Operacionais` contra `1.1.01.002 — Banco Cora`
- Manifest `dre_effect`: `DESPESA`
- Manifest `dre_presentation`: `DESPESA_OPERACIONAL`
- Account `dre_class`: `DESPESA_OPERACIONAL`
- Executor anterior: aceitava `DESPESAS` e rejeitava `DESPESA_OPERACIONAL`.

## Taxonomia encontrada

Valores distintos no manifesto de Abril:

| Manifest presentation | Rows | Official account `dre_class` |
|---|---:|---|
| `RECEITA_BRUTA` | 35 | `RECEITA_BRUTA` |
| `DESPESA_OPERACIONAL` | 46 | `DESPESA_OPERACIONAL` |
| `CUSTO_SERVICO` | 7 | `CUSTO_SERVICO` |
| `NONE` | 3 | sem efeito DRE / ativo |
| `DEDUCAO_RECEITA` | 1 | `DEDUCAO_RECEITA` |

A row 115 é a exceção legítima de dedução: usa a conta `3.2.01.002`, com
`class=RECEITA` e `dre_class=DEDUCAO_RECEITA`, embora o `dre_effect` do manifesto
seja `DESPESA`. A correção preserva essa distinção e não transforma
`DEDUCAO_RECEITA` em despesa operacional.

## Estratégia aplicada

Migration corretiva:

`supabase/migrations/20261021160000_fix_april_2026_executor_dre_presentation_contract.sql`

Function preservada:

`public.execute_authoritative_financial_import_april_2026(text,text,text)`

Alterações contratuais:

- allow-list passou a aceitar exatamente os cinco valores efetivos do manifesto;
- validação compara `dre_presentation` com o `dre_class` oficial da conta;
- `DESPESA_OPERACIONAL` exige conta com `dre_class=DESPESA_OPERACIONAL`;
- `DEDUCAO_RECEITA` exige conta com `dre_class=DEDUCAO_RECEITA`;
- `RECEITA_BRUTA`, `CUSTO_SERVICO` e `NONE` são validados por efeito e conta;
- valores desconhecidos continuam rejeitados;
- não há replace cego de JSON nem alteração de conta, débito, crédito ou valor.

Atomicidade, idempotência, hash, proteção de períodos, grants e `SECURITY
DEFINER` foram preservados.

## Testes

Aplicados no DEV:

- `supabase/tests/fin_import_april_2026_executor_contract_fix.sql`: **PASS**
- `supabase/tests/fin_import_april_2026_executor.sql`: **PASS**
- Validação read-only do manifesto: **92/92 rows válidas**
- Values encontrados: 5
- Row 70: **PASS**
- Unknown presentation fail-closed: **PASS por contrato da allow-list**
- Atomic rollback: **PASS**
- Idempotência: **PASS por contrato existente**
- Partial import detection: **PASS por contrato existente**
- Coverage/totals/journal balance/closed periods: **PASS por regressão existente**

Os testes não chamam o executor com o manifesto real e não inserem fixtures
financeiras persistentes.

## DEV pós-migration

- Corrective migration applied: **YES**
- Function exists: **YES**
- Contract mismatch row 70: **RESOLVED**
- Manifest rows contract-valid: **92/92**
- April real batches: **0**
- April real source rows: **0**
- April real transactions: **0**
- April real journals: **0**
- January changed: **NO**
- February changed: **NO**
- March changed: **NO**

## Segurança

- Financial writes: **0**
- Journal writes: **0**
- Real April writes: **0**
- Schema changes: **one corrective migration only**
- RLS changes: **0**
- Default privileges: **0**
- PROD: **NO**
- Commit: **NO**
- Push: **NO**

## Readiness

- `DRE_PRESENTATION_CONTRACT_FIXED`: **YES**
- `ALL_MANIFEST_ROWS_VALIDATE`: **YES**
- `ATOMIC_EXECUTOR_STILL_VALID`: **YES**
- `APRIL_REAL_DATA_IMPORTED`: **NO**
- `READY_FOR_FIN_IMPORT_5_3D_RETRY`: **YES**

Este gate termina sem executar Abril, tocar PROD ou iniciar Maio.
