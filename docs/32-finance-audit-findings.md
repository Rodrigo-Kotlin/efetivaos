# Auditoria do Modulo Financeiro

## Identificacao

- Data: 2026-08-30
- Ambiente auditado: Supabase DEV
- SHA de entrada: `b626d4e`
- Status da auditoria: `COMPLETED_WITH_FINDINGS`
- Escopo desta microgate: persistir a auditoria e corrigir somente F-01 e F-06

## Resumo executivo

A auditoria identificou dez findings. F-01 permite que a mesma transacao seja
apresentada simultaneamente em Contas a Receber e Contas a Pagar. F-06 expoe
essas views ao contexto anonimo por grants amplos e por execucao com os
privilegios do owner. Esta microgate corrige somente esses dois findings.

F-02, F-03, F-04, F-05, F-07, F-08, F-09 e F-10 permanecem abertos. Nenhuma
alteracao foi feita nesta etapa no engine contabil, DRE, `payment_date`, edicao,
cancelamento/reversao, cache ou UX.

## Evidencia de entrada

No catalogo remoto anterior a correcao:

- `financial_receivables_v.reloptions`: `NULL`;
- `financial_payables_v.reloptions`: `NULL`;
- as duas ACLs continham privilegios diretos de `anon`, privilegios de
  `authenticated` e `SELECT` para `PUBLIC`;
- havia uma transacao `RECEITA` no DEV;
- a mesma transacao retornava `AR = 1` e `AP = 1`;
- o `INTERSECT` entre os `transaction_id` das duas views retornava `1`.

### Definicao BEFORE

As definicoes autoritativas anteriores estao em
`supabase/migrations/20260826000300_create_receivables_payables_views.sql`.
Ambas selecionavam todas as linhas de `financial_transactions`, sem qualquer
predicado de `movement_type`:

```sql
create or replace view public.financial_receivables_v as
with tx as (
  select
    t.id as transaction_id,
    t.description,
    t.movement_type,
    t.status,
    t.amount as original_amount,
    t.due_date,
    t.competence_date,
    t.transaction_date,
    t.created_at,
    case
      when t.status = 'settled' then 0
      when t.status = 'cancelled' then 0
      else t.amount
    end as open_amount,
    case
      when t.status = 'settled' then t.amount
      when t.status = 'cancelled' then t.amount
      else 0
    end as settled_amount,
    case
      when t.status = 'pending' and t.due_date < current_date then true
      else false
    end as overdue,
    case
      when t.status = 'pending' and t.due_date < current_date
        then (current_date - t.due_date)
      else 0
    end as days_overdue,
    t.party_id,
    t.cost_center_id,
    t.service_line_id,
    t.review_required,
    p.name as party_name,
    (select ca.name from public.financial_categories ca where ca.id = t.category_id) as category_name,
    (select cc.name from public.financial_cost_centers cc where cc.id = t.cost_center_id) as cost_center_name,
    (select sl.name from public.financial_service_lines sl where sl.id = t.service_line_id) as service_line_name,
    t.origin_account_id,
    t.payment_method_id,
    je_comp.id as competency_entry_id,
    je_liq.id as settlement_entry_id
  from public.financial_transactions t
  left join public.financial_parties p on t.party_id = p.id
  left join public.financial_journal_entries je_comp
    on je_comp.transaction_id = t.id
    and je_comp.entry_type = 'competencia'
  left join public.financial_journal_entries je_liq
    on je_liq.transaction_id = t.id
    and je_liq.entry_type = 'caixa'
)
select
  transaction_id, description, movement_type, status, original_amount,
  settled_amount, open_amount, transaction_date, competence_date, due_date,
  overdue, days_overdue, party_name, category_name, cost_center_id,
  cost_center_name, service_line_id, service_line_name, origin_account_id,
  payment_method_id, competency_entry_id, settlement_entry_id
from tx;

grant select on public.financial_receivables_v to authenticated;
grant select on public.financial_receivables_v to public;
```

```sql
create or replace view public.financial_payables_v as
with tx as (
  select
    t.id as transaction_id,
    t.description,
    t.movement_type,
    t.status,
    t.amount as original_amount,
    t.due_date,
    t.competence_date,
    t.transaction_date,
    t.created_at,
    case
      when t.status = 'settled' then 0
      when t.status = 'cancelled' then 0
      else t.amount
    end as open_amount,
    case
      when t.status = 'settled' then t.amount
      when t.status = 'cancelled' then t.amount
      else 0
    end as settled_amount,
    case
      when t.status = 'pending' and t.due_date < current_date then true
      else false
    end as overdue,
    case
      when t.status = 'pending' and t.due_date < current_date
        then (current_date - t.due_date)
      else 0
    end as days_overdue,
    t.party_id,
    t.cost_center_id,
    t.service_line_id,
    t.review_required,
    p.name as party_name,
    (select ca.name from public.financial_categories ca where ca.id = t.category_id) as category_name,
    (select cc.name from public.financial_cost_centers cc where cc.id = t.cost_center_id) as cost_center_name,
    (select sl.name from public.financial_service_lines sl where sl.id = t.service_line_id) as service_line_name,
    t.origin_account_id,
    t.payment_method_id,
    je_comp.id as competency_entry_id,
    je_liq.id as settlement_entry_id
  from public.financial_transactions t
  left join public.financial_parties p on t.party_id = p.id
  left join public.financial_journal_entries je_comp
    on je_comp.transaction_id = t.id
    and je_comp.entry_type = 'competencia'
  left join public.financial_journal_entries je_liq
    on je_liq.transaction_id = t.id
    and je_liq.entry_type = 'caixa'
)
select
  transaction_id, description, movement_type, status, original_amount,
  settled_amount, open_amount, transaction_date, competence_date, due_date,
  overdue, days_overdue, party_name, category_name, cost_center_id,
  cost_center_name, service_line_id, service_line_name, origin_account_id,
  payment_method_id, competency_entry_id, settlement_entry_id
from tx;

grant select on public.financial_payables_v to authenticated;
grant select on public.financial_payables_v to public;
```

## F-01 - AR/AP sem filtro de movement_type

- Severidade: `CRITICAL`
- Sintoma: uma unica transacao aparece simultaneamente em Contas a Receber e
  Contas a Pagar.
- Evidencia: no DEV, uma transacao `RECEITA` retornava uma linha em cada view e
  o overlap por `transaction_id` era `1`. As definicoes BEFORE nao continham
  `WHERE` por `movement_type`.
- Causa raiz: as duas views partiam do conjunto integral de
  `financial_transactions`; seus nomes e comentarios declaravam a classificacao,
  mas a consulta nao a implementava.
- Impacto: AR, AP, previsao de caixa e dashboard podem duplicar obrigacoes,
  inverter sua natureza e apresentar totais materialmente incorretos.
- Regra canonica validada: AR recebe somente `RECEITA`. AP recebe `DESPESA` e
  `IMOBILIZADO`. O enum real tambem possui `TRANSFERENCIA`,
  `EMPRESTIMO_RECEBIDO`, `EMPRESTIMO_PAGO`, `APORTE`, `RETIRADA`,
  `SALDO_INICIAL`, `AJUSTE` e `DEPRECIACAO`, que ficam fora de AR/AP.
- Justificativa de `IMOBILIZADO`: o engine contabil trata
  `DESPESA`/`IMOBILIZADO` no mesmo fluxo de Fornecedores a Pagar e a view de
  forecast ja classifica ambos como saida projetada.
- Correcao proposta: aplicar predicados exatos por tipo, preservar o contrato de
  colunas e tornar permanente o teste de overlap igual a zero.
- Status nesta microgate: `RESOLVED`, condicionado a migration e testes
  remotos aprovados.

## F-02 - DRE incompatível com ledger append-only

- Severidade: `CRITICAL`
- Sintoma: a DRE retorna suas linhas com valores zerados para transacoes normais,
  inclusive depois da liquidacao.
- Evidencia: `get_income_statement` filtra `je.status = 'settled'`, enquanto a
  competencia com contas de resultado permanece `pending`; a liquidacao append-only
  cria uma nova entry `settled` apenas entre caixa e AR/AP.
- Causa raiz: o filtro usa status de liquidacao como se fosse status de posting
  contabil, mas os dois conceitos divergem no modelo append-only atual.
- Impacto: receita, custos, EBITDA e resultado liquido ficam zerados ou
  subavaliados; BP e dashboard podem divergir.
- Correcao proposta: definir entries contabilmente validas no modelo append-only,
  incluindo estornos que devem neutralizar o original, e testar o ciclo
  pending -> settled -> cancelled.
- Status: `OPEN`. Nao corrigido nesta microgate.

## F-03 - Criacao com payment_date pode contabilizar incorretamente

- Severidade: `HIGH`
- Sintoma: criar receita/despesa ja liquidada pode gerar apenas a leg de caixa,
  sem reconhecimento de receita/despesa, e usar a data errada para o caixa.
- Evidencia: `payment_date` nao nulo define a transacao como `settled`, mas o
  generator recebe `transaction_date`; o branch settled presume que a
  competencia pending ja existe.
- Causa raiz: `payment_date` foi tratado como atalho de status para uma rotina
  desenhada para a segunda etapa de um fluxo append-only.
- Impacto: AR/AP negativos ou orfaos, DRE incompleta, caixa no periodo errado e
  reconciliacoes incorretas.
- Correcao proposta: criar atomicamente competencia e caixa para lancamentos a
  vista, usando `competence_date` para reconhecimento e `payment_date` para caixa.
- Status: `OPEN`. Nao corrigido nesta microgate.

## F-04 - Fluxo de Caixa realizado vazio/incompleto pela UX atual

- Severidade: `HIGH`
- Sintoma: o fluxo Realizado permanece vazio ou incompleto no uso normal.
- Evidencia: o schema aceita `payment_date`, mas o formulario de criacao nao o
  oferece; AR/AP sao telas de leitura. Existe liquidacao limitada no detalhe da
  transacao, usando a data atual.
- Causa raiz: o caminho principal cria titulos pending e nao oferece uma decisao
  explicita de pago/recebido nem liquidacao completa em AR/AP.
- Impacto: forecast e aging podem ter dados enquanto o realizado exibe zero,
  produzindo uma visao enganosa da liquidez.
- Correcao proposta: depois de F-03, oferecer fluxo explicito de liquidacao com
  data e forma de pagamento, e invalidar todas as consultas afetadas.
- Status: `OPEN`. Nao corrigido nesta microgate.

## F-05 - Edicao de pending nao exposta na UI

- Severidade: `HIGH`
- Sintoma: Admin nao consegue corrigir transacao pending pela aplicacao.
- Evidencia: RPC, tipo e wrapper de API de update existem, com version/CAS, mas
  nao ha mutation hook nem acao/formulario de edicao na pagina de transacoes.
- Causa raiz: o backend de update foi entregue sem completar o consumidor de UI.
- Impacto: correcoes exigem cancelamento e recriacao ou intervencao direta,
  aumentando risco operacional e duplicidade.
- Correcao proposta: antes da UI, revisar a semantica append-only do update, que
  hoje adiciona novas entries sem estornar as anteriores; depois expor edicao
  pending com CAS e invalidacao de cache.
- Status: `OPEN`. Nao corrigido nesta microgate.

## F-06 - Views AR/AP acessiveis por anon/PUBLIC

- Severidade: `MEDIUM`
- Sintoma: cliente anonimo consegue consultar dados financeiros pelas views.
- Evidencia: as ACLs remotas BEFORE continham grants diretos para `anon` e
  `SELECT` para `PUBLIC`; `reloptions` era `NULL`, sem `security_invoker=true`.
- Causa raiz: os grants amplos foram preservados e as views executavam com os
  privilegios do owner, permitindo bypass das policies RLS das tabelas base.
- Impacto: exposicao nao autenticada de transacoes, valores, vencimentos,
  contrapartes e classificacoes financeiras.
- Correcao proposta: recriar as views com `security_invoker=true`, revogar todos
  os privilegios de `PUBLIC`, `anon` e `authenticated`, e conceder de volta
  somente `SELECT` a `authenticated`. A RLS base continua usando
  `is_internal_user()`, sem `USING (true)` e sem ampliar privilegios.
- Status nesta microgate: `RESOLVED`, condicionado a migration e testes
  remotos aprovados.

## F-07 - Cancelamento de settled pode nao estornar as duas legs

- Severidade: `MEDIUM`
- Sintoma: cancelar uma transacao liquidada pode deixar saldo residual em caixa
  e AR/AP.
- Evidencia: settle preserva competencia e adiciona caixa; cancel adiciona um
  unico estorno de competencia, embora aceite qualquer status diferente de
  cancelled.
- Causa raiz: o cancelamento reconstrui uma leg pelo tipo de movimento em vez de
  inverter todas as entries efetivamente postadas.
- Impacto: caixa e contas de controle podem ficar residuais ou negativos.
- Correcao proposta: estornar line-by-line todas as entries ainda nao revertidas,
  com vinculo e idempotencia explicitos.
- Status: `OPEN`. Nao corrigido nesta microgate.

## F-08 - Cache AR/AP nao invalidado apos mutations

- Severidade: `MEDIUM`
- Sintoma: AR/AP pode continuar mostrando estado pending/open depois de create,
  settle ou cancel.
- Evidencia: as mutations invalidam transacoes, cashflow, DRE, ativos, BP e
  dashboard, mas nao as query keys de receivables/payables; o stale time e 30s.
- Causa raiz: as query keys de AR/AP ficaram fora da matriz de invalidacao.
- Impacto: totais, overdue e status podem permanecer obsoletos e o defeito parece
  intermitente apos refetch posterior.
- Correcao proposta: centralizar keys e invalidar AR/AP em create, settle, cancel
  e update, com testes do QueryClient.
- Status: `OPEN`. Nao corrigido nesta microgate.

## F-09 - Cancelled contado como settled e forecast confiando no header

- Severidade: `LOW`
- Sintoma: transacao cancelled recebe `settled_amount = original_amount`, embora
  possa nunca ter sido paga/recebida.
- Evidencia: os CASEs das duas views tratam settled e cancelled igualmente em
  `settled_amount`; o forecast elimina cancelled apenas pelo status/open_amount.
- Causa raiz: cancelamento e liquidacao foram colapsados na mesma decomposicao de
  valores, sem reconciliar eventual saldo residual do ledger.
- Impacto: APIs/exports podem superestimar liquidado e esconder residuos gerados
  por F-07.
- Correcao proposta: cancelled deve ter open e settled iguais a zero, com campo
  separado se um total cancelado for necessario; forecast deve reconciliar com
  contas de controle.
- Status: `OPEN`. Nao corrigido nesta microgate.

## F-10 - Dashboard DRE herda F-02

- Severidade: `INFO`
- Sintoma: KPIs de receita, EBITDA, resultado e margens podem ficar zerados ou
  subavaliados no dashboard.
- Evidencia: o dashboard agrega diretamente `get_income_statement`, que possui o
  filtro incompatível descrito em F-02.
- Causa raiz: dependencia da fonte autoritativa afetada, nao um calculo paralelo
  independente.
- Impacto: indicadores gerenciais e alertas de resultado ficam incorretos.
- Correcao proposta: corrigir F-02 na fonte e manter o dashboard delegado a ela,
  adicionando teste ponta a ponta de consistencia DRE/dashboard.
- Status: `OPEN`, herdado de F-02. Nao corrigido nesta microgate.

## Sequencia de correcao

Microgate 01:
F-01 + F-06

Microgate 02:
F-03 + F-02

Microgate 03:
F-04 + F-05 + F-07 + F-08 + F-09

F-10 deve ser revalidado quando F-02 for corrigido.

## Findings ainda nao corrigidos

- F-02: `OPEN`
- F-03: `OPEN`
- F-04: `OPEN`
- F-05: `OPEN`
- F-07: `OPEN`
- F-08: `OPEN`
- F-09: `OPEN`
- F-10: `OPEN`, herdado de F-02
