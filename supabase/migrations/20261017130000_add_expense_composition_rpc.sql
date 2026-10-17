-- FIN-UI-BACKEND-2 — official operating expense composition source.
-- Uses the same competence, ledger, account nature, and DRE classification
-- rules as get_income_statement. It does not write financial data.

begin;

create or replace function public.get_expense_composition(
  p_date_from date default null,
  p_date_to date default null,
  p_cost_center_id uuid default null,
  p_service_line_id uuid default null
)
returns table (
  account_code text,
  account_name text,
  amount numeric,
  percentage numeric
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_total numeric;
begin
  if auth.uid() is null then
    raise exception 'Acesso negado: usuario nao autenticado.';
  end if;

  if not public.is_internal_user() then
    raise exception 'Acesso negado: usuario inativo ou sem permissao.';
  end if;

  with line_values as (
    select
      ca.id as chart_account_id,
      (case when ca.nature = 'DEBITO'
            then jl.debit - jl.credit
            else jl.credit - jl.debit
       end)::numeric as natural_value
    from public.financial_journal_entries je
    join public.financial_journal_lines jl on jl.entry_id = je.id
    join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
    join public.financial_transactions ft on ft.id = je.transaction_id
    where ca.class in ('RECEITA', 'CUSTO', 'DESPESA')
      and ca.dre_class = 'DESPESA_OPERACIONAL'
      and (p_date_from is null or je.competence_date >= p_date_from)
      and (p_date_to is null or je.competence_date <= p_date_to)
      and (p_cost_center_id is null or ft.cost_center_id = p_cost_center_id)
      and (p_service_line_id is null or ft.service_line_id = p_service_line_id)
  )
  select coalesce(sum(natural_value), 0)
    into v_total
  from line_values;

  return query
  with line_values as (
    select
      ca.id as chart_account_id,
      (case when ca.nature = 'DEBITO'
            then jl.debit - jl.credit
            else jl.credit - jl.debit
       end)::numeric as natural_value
    from public.financial_journal_entries je
    join public.financial_journal_lines jl on jl.entry_id = je.id
    join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
    join public.financial_transactions ft on ft.id = je.transaction_id
    where ca.class in ('RECEITA', 'CUSTO', 'DESPESA')
      and ca.dre_class = 'DESPESA_OPERACIONAL'
      and (p_date_from is null or je.competence_date >= p_date_from)
      and (p_date_to is null or je.competence_date <= p_date_to)
      and (p_cost_center_id is null or ft.cost_center_id = p_cost_center_id)
      and (p_service_line_id is null or ft.service_line_id = p_service_line_id)
  ), account_totals as (
    select chart_account_id, sum(natural_value)::numeric as account_amount
    from line_values
    group by chart_account_id
    having sum(natural_value) <> 0
  )
  select
    ca.code,
    ca.name,
    at.account_amount,
    case when v_total = 0 then 0
         else round(at.account_amount / v_total * 100, 2)
    end
  from account_totals at
  join public.financial_chart_accounts ca on ca.id = at.chart_account_id
  order by ca.code;
end;
$$;

revoke all on function public.get_expense_composition(date, date, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_expense_composition(date, date, uuid, uuid)
  to authenticated;

comment on function public.get_expense_composition(date, date, uuid, uuid) is
  'Composicao oficial de despesas operacionais por conta contabil, em regime de competencia, usando a mesma regra de get_income_statement.';

commit;
