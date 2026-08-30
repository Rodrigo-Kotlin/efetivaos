-- FINANCE MICROGATE 01
-- Correct AR/AP movement classification and enforce caller RLS on both views.

begin;

create or replace view public.financial_receivables_v
with (security_invoker = true) as
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
        then current_date - t.due_date
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
  where t.movement_type = 'RECEITA'
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

create or replace view public.financial_payables_v
with (security_invoker = true) as
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
        then current_date - t.due_date
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
  where t.movement_type in ('DESPESA', 'IMOBILIZADO')
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

revoke all on public.financial_receivables_v from public, anon, authenticated;
revoke all on public.financial_payables_v from public, anon, authenticated;

grant select on public.financial_receivables_v to authenticated;
grant select on public.financial_payables_v to authenticated;

comment on view public.financial_receivables_v is
  'Contas a receber: transacoes RECEITA, com RLS das tabelas base aplicada ao caller.';

comment on view public.financial_payables_v is
  'Contas a pagar: transacoes DESPESA e IMOBILIZADO, com RLS das tabelas base aplicada ao caller.';

commit;
