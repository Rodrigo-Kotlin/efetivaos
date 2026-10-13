-- UX-FIN-ARAP-4: server-side totals for filtered receivables and payables.
-- PostgREST aggregate functions are disabled in the DEV project, so these
-- read-only RPCs preserve the list filters without fetching a page of rows.

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
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  with input as (
    select btrim(coalesce(p_search, '')) as search_term
  )
  select coalesce(sum(view_row.open_amount), 0)::numeric
  from public.financial_receivables_v as view_row
  cross join input
  where (
    input.search_term = ''
    or view_row.description ilike '%' || replace(replace(replace(input.search_term, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\'
    or view_row.party_name ilike '%' || replace(replace(replace(input.search_term, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\'
    or view_row.category_name ilike '%' || replace(replace(replace(input.search_term, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\'
  )
  and (p_due_date_from is null or view_row.due_date >= p_due_date_from)
  and (p_due_date_to is null or view_row.due_date <= p_due_date_to)
  and (p_overdue is null or view_row.overdue = p_overdue)
  and (p_status is null or view_row.status = p_status)
  and (
    p_person_id is null
    or view_row.transaction_id in (
      select transaction_row.id
      from public.financial_transactions as transaction_row
      where transaction_row.party_id = p_person_id
        and transaction_row.movement_type = 'RECEITA'
    )
  )
  and (p_category_name is null or view_row.category_name = p_category_name)
  and (p_account_id is null or view_row.origin_account_id = p_account_id);
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
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  with input as (
    select btrim(coalesce(p_search, '')) as search_term
  )
  select coalesce(sum(view_row.open_amount), 0)::numeric
  from public.financial_payables_v as view_row
  cross join input
  where (
    input.search_term = ''
    or view_row.description ilike '%' || replace(replace(replace(input.search_term, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\'
    or view_row.party_name ilike '%' || replace(replace(replace(input.search_term, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\'
    or view_row.category_name ilike '%' || replace(replace(replace(input.search_term, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\'
  )
  and (p_due_date_from is null or view_row.due_date >= p_due_date_from)
  and (p_due_date_to is null or view_row.due_date <= p_due_date_to)
  and (p_overdue is null or view_row.overdue = p_overdue)
  and (p_status is null or view_row.status = p_status)
  and (
    p_person_id is null
    or view_row.transaction_id in (
      select transaction_row.id
      from public.financial_transactions as transaction_row
      where transaction_row.party_id = p_person_id
        and transaction_row.movement_type in ('DESPESA', 'IMOBILIZADO')
    )
  )
  and (p_category_name is null or view_row.category_name = p_category_name)
  and (p_account_id is null or view_row.origin_account_id = p_account_id);
$$;

revoke all on function public.finance_receivables_filtered_total(text, date, date, boolean, public.financial_transaction_status, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.finance_payables_filtered_total(text, date, date, boolean, public.financial_transaction_status, uuid, text, uuid)
  from public, anon, authenticated;

grant execute on function public.finance_receivables_filtered_total(text, date, date, boolean, public.financial_transaction_status, uuid, text, uuid)
  to authenticated;
grant execute on function public.finance_payables_filtered_total(text, date, date, boolean, public.financial_transaction_status, uuid, text, uuid)
  to authenticated;

comment on function public.finance_receivables_filtered_total(text, date, date, boolean, public.financial_transaction_status, uuid, text, uuid)
  is 'Filtered SUM(open_amount) for receivables, using the same criteria as the list.';
comment on function public.finance_payables_filtered_total(text, date, date, boolean, public.financial_transaction_status, uuid, text, uuid)
  is 'Filtered SUM(open_amount) for payables, using the same criteria as the list.';
