-- ============================================================================
-- EFETIVA OS — ETAPA 08C — Contas a Receber e Contas a Pagar
-- Migration: financial_receivables_v e financial_payables_v
-- Purpose: Views derivadas do ledger existente — NÃO novo livro financeiro
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VIEW: financial_receivables_v
-- Contas a Receber derivadas de transacoes RECEITA (a prazo)
-- ----------------------------------------------------------------------------

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
    -- Lógica de settled/cancelled/open
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
    -- days_overdue apenas quando vencido
    case
      when t.status = 'pending' and t.due_date < current_date
        then (current_date - t.due_date)
      else 0
    end as days_overdue,
    t.party_id,
    t.cost_center_id,
    t.service_line_id,
    t.review_required,
    -- Resolve party name (fallback quando não houver client específico)
    p.name as party_name,
    -- category name via lookup
    (select ca.name from public.financial_categories ca where ca.id = t.category_id) as category_name,
    -- cost center name via lookup
    (select cc.name from public.financial_cost_centers cc where cc.id = t.cost_center_id) as cost_center_name,
    -- service line name via lookup
    (select sl.name from public.financial_service_lines sl where sl.id = t.service_line_id) as service_line_name,
    -- origin account ID (name resolvida via subquery ou na UI)
    t.origin_account_id,
    -- payment method ID (name resolvida via subquery ou na UI)
    t.payment_method_id,
    -- Resolve competency and settlement journal entries
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
  transaction_id,
  description,
  movement_type,
  status,
  original_amount,
  settled_amount,
  open_amount,
  transaction_date,
  competence_date,
  due_date,
  overdue,
  days_overdue,
  party_name,
  category_name,
  cost_center_id,
  cost_center_name,
  service_line_id,
  service_line_name,
  origin_account_id,
  payment_method_id,
  competency_entry_id,
  settlement_entry_id
from tx;

-- Grant
grant select on public.financial_receivables_v to authenticated;
grant select on public.financial_receivables_v to public;

-- Comentário
comment on view public.financial_receivables_v is
  'Visão operacional de contas a receber derivadas do ledger financeiro (financial_transactions + journal).';

-- ----------------------------------------------------------------------------
-- VIEW: financial_payables_v
-- Contas a Pagar derivadas de transacoes DESPESA (a prazo)
-- ----------------------------------------------------------------------------

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
    -- Lógica de settled/cancelled/open
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
    -- days_overdue apenas quando vencido
    case
      when t.status = 'pending' and t.due_date < current_date
        then (current_date - t.due_date)
      else 0
    end as days_overdue,
    t.party_id,
    t.cost_center_id,
    t.service_line_id,
    t.review_required,
    -- Resolve party name
    p.name as party_name,
    -- category name via lookup
    (select ca.name from public.financial_categories ca where ca.id = t.category_id) as category_name,
    -- cost center name via lookup
    (select cc.name from public.financial_cost_centers cc where cc.id = t.cost_center_id) as cost_center_name,
    -- service line name via lookup
    (select sl.name from public.financial_service_lines sl where sl.id = t.service_line_id) as service_line_name,
    -- origin account ID
    t.origin_account_id,
    -- payment method ID
    t.payment_method_id,
    -- Resolve competency and settlement journal entries
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
  transaction_id,
  description,
  movement_type,
  status,
  original_amount,
  settled_amount,
  open_amount,
  transaction_date,
  competence_date,
  due_date,
  overdue,
  days_overdue,
  party_name,
  category_name,
  cost_center_id,
  cost_center_name,
  service_line_id,
  service_line_name,
  origin_account_id,
  payment_method_id,
  competency_entry_id,
  settlement_entry_id
from tx;

-- Grant
grant select on public.financial_payables_v to authenticated;
grant select on public.financial_payables_v to public;

-- Comentário
comment on view public.financial_payables_v is
  'Visão operacional de contas a pagar derivadas do ledger financeiro (financial_transactions + journal).';