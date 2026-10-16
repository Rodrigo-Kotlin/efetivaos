-- FIN-ARAP-1.1
-- Expose settled operational transactions in AR/AP without creating ledger rows.
-- Settled historical rows use payment_date/transaction_date as their displayed
-- date while open rows retain their original due_date.

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
    case when t.status = 'settled' then t.amount else 0 end as settled_amount,
    case when t.status in ('settled', 'cancelled') then 0 else t.amount end as open_amount,
    t.transaction_date,
    t.competence_date,
    case when t.status = 'settled' then coalesce(t.payment_date, t.transaction_date) else t.due_date end as due_date,
    case when t.status = 'pending' and t.due_date < current_date then true else false end as overdue,
    case when t.status = 'pending' and t.due_date < current_date then current_date - t.due_date else 0 end as days_overdue,
    t.party_id,
    t.cost_center_id,
    t.service_line_id,
    t.review_required,
    p.name as party_name,
    (select c.name from public.financial_categories c where c.id = t.category_id) as category_name,
    (select cc.name from public.financial_cost_centers cc where cc.id = t.cost_center_id) as cost_center_name,
    (select sl.name from public.financial_service_lines sl where sl.id = t.service_line_id) as service_line_name,
    t.origin_account_id,
    t.payment_method_id,
    je_comp.id as competency_entry_id,
    je_liq.id as settlement_entry_id
  from public.financial_transactions t
  left join public.financial_parties p on p.id = t.party_id
  left join public.financial_journal_entries je_comp
    on je_comp.transaction_id = t.id and je_comp.entry_type = 'competencia'
  left join public.financial_journal_entries je_liq
    on je_liq.transaction_id = t.id and je_liq.entry_type = 'caixa'
  where t.movement_type = 'RECEITA'
)
select
  transaction_id, description, movement_type, status, original_amount,
  settled_amount, open_amount, transaction_date, competence_date, due_date,
  overdue, days_overdue, party_name, category_name,
  cost_center_id, cost_center_name, service_line_id, service_line_name,
  origin_account_id, payment_method_id, competency_entry_id, settlement_entry_id
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
    case when t.status = 'settled' then t.amount else 0 end as settled_amount,
    case when t.status in ('settled', 'cancelled') then 0 else t.amount end as open_amount,
    t.transaction_date,
    t.competence_date,
    case when t.status = 'settled' then coalesce(t.payment_date, t.transaction_date) else t.due_date end as due_date,
    case when t.status = 'pending' and t.due_date < current_date then true else false end as overdue,
    case when t.status = 'pending' and t.due_date < current_date then current_date - t.due_date else 0 end as days_overdue,
    t.party_id,
    t.cost_center_id,
    t.service_line_id,
    t.review_required,
    p.name as party_name,
    (select c.name from public.financial_categories c where c.id = t.category_id) as category_name,
    (select cc.name from public.financial_cost_centers cc where cc.id = t.cost_center_id) as cost_center_name,
    (select sl.name from public.financial_service_lines sl where sl.id = t.service_line_id) as service_line_name,
    t.origin_account_id,
    t.payment_method_id,
    je_comp.id as competency_entry_id,
    je_liq.id as settlement_entry_id
  from public.financial_transactions t
  left join public.financial_parties p on p.id = t.party_id
  left join public.financial_journal_entries je_comp
    on je_comp.transaction_id = t.id and je_comp.entry_type = 'competencia'
  left join public.financial_journal_entries je_liq
    on je_liq.transaction_id = t.id and je_liq.entry_type = 'caixa'
  where t.movement_type = 'DESPESA'
    and coalesce(t.notes, '') !~ '(^|[[:space:]])dre=NONE([[:space:]]|$)'
)
select
  transaction_id, description, movement_type, status, original_amount,
  settled_amount, open_amount, transaction_date, competence_date, due_date,
  overdue, days_overdue, party_name, category_name,
  cost_center_id, cost_center_name, service_line_id, service_line_name,
  origin_account_id, payment_method_id, competency_entry_id, settlement_entry_id
from tx;

revoke all on public.financial_receivables_v from public, anon, authenticated;
revoke all on public.financial_payables_v from public, anon, authenticated;
grant select on public.financial_receivables_v to authenticated;
grant select on public.financial_payables_v to authenticated;

create or replace function public.finance_receivables_filtered_total(
  p_search text default null,
  p_due_date_from date default null,
  p_due_date_to date default null,
  p_overdue boolean default null,
  p_status public.financial_transaction_status default null,
  p_person_id uuid default null,
  p_category_name text default null,
  p_account_id uuid default null
)
returns numeric language sql stable security invoker set search_path = '' as $$
  with input as (select btrim(coalesce(p_search, '')) as search_term)
  select coalesce(sum(v.open_amount), 0)::numeric
  from public.financial_receivables_v v cross join input
  where (input.search_term = '' or v.description ilike '%' || input.search_term || '%' or v.party_name ilike '%' || input.search_term || '%' or v.category_name ilike '%' || input.search_term || '%')
    and (p_due_date_from is null or v.due_date >= p_due_date_from)
    and (p_due_date_to is null or v.due_date <= p_due_date_to)
    and (p_overdue is null or v.overdue = p_overdue)
    and (p_status is null or v.status = p_status)
    and (p_person_id is null or v.transaction_id in (select t.id from public.financial_transactions t where t.party_id = p_person_id and t.movement_type = 'RECEITA'))
    and (p_category_name is null or v.category_name = p_category_name)
    and (p_account_id is null or v.origin_account_id = p_account_id);
$$;

create or replace function public.finance_payables_filtered_total(
  p_search text default null,
  p_due_date_from date default null,
  p_due_date_to date default null,
  p_overdue boolean default null,
  p_status public.financial_transaction_status default null,
  p_person_id uuid default null,
  p_category_name text default null,
  p_account_id uuid default null
)
returns numeric language sql stable security invoker set search_path = '' as $$
  with input as (select btrim(coalesce(p_search, '')) as search_term)
  select coalesce(sum(v.open_amount), 0)::numeric
  from public.financial_payables_v v cross join input
  where (input.search_term = '' or v.description ilike '%' || input.search_term || '%' or v.party_name ilike '%' || input.search_term || '%' or v.category_name ilike '%' || input.search_term || '%')
    and (p_due_date_from is null or v.due_date >= p_due_date_from)
    and (p_due_date_to is null or v.due_date <= p_due_date_to)
    and (p_overdue is null or v.overdue = p_overdue)
    and (p_status is null or v.status = p_status)
    and (p_person_id is null or v.transaction_id in (select t.id from public.financial_transactions t where t.party_id = p_person_id and t.movement_type = 'DESPESA' and coalesce(t.notes, '') !~ '(^|[[:space:]])dre=NONE([[:space:]]|$)'))
    and (p_category_name is null or v.category_name = p_category_name)
    and (p_account_id is null or v.origin_account_id = p_account_id);
$$;

revoke all on function public.finance_receivables_filtered_total(text, date, date, boolean, public.financial_transaction_status, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.finance_payables_filtered_total(text, date, date, boolean, public.financial_transaction_status, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.finance_receivables_filtered_total(text, date, date, boolean, public.financial_transaction_status, uuid, text, uuid) to authenticated;
grant execute on function public.finance_payables_filtered_total(text, date, date, boolean, public.financial_transaction_status, uuid, text, uuid) to authenticated;

commit;
