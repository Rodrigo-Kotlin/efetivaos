-- FIN-UI-BACKEND-2 — read-only reconciliation and authorization checks.
-- The transaction makes the test safe to run against DEV without persistence.

begin;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  (select id::text from public.profiles where active and role = 'admin' limit 1),
  true
);

create extension if not exists pgtap with schema extensions;
select plan(15);

select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_expense_composition'
  ),
  'expense composition RPC exists'
);

select ok(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_expense_composition'),
  'expense composition RPC is SECURITY DEFINER'
);

select ok(
  (select p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_expense_composition') @> array['search_path=""'],
  'expense composition RPC has an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.get_expense_composition(date,date,uuid,uuid)', 'execute'),
  'anon cannot execute expense composition RPC'
);

select ok(
  not has_function_privilege('public', 'public.get_expense_composition(date,date,uuid,uuid)', 'execute'),
  'public cannot execute expense composition RPC'
);

select ok(
  has_function_privilege('authenticated', 'public.get_expense_composition(date,date,uuid,uuid)', 'execute'),
  'authenticated can execute expense composition RPC'
);

select is(
  (select coalesce(sum(amount), 0) from public.get_expense_composition('2026-01-01', '2026-01-31', null, null)),
  34779.18::numeric,
  'January expenses reconcile to the official DRE'
);

select is(
  (select coalesce(sum(amount), 0) from public.get_expense_composition('2026-02-01', '2026-02-28', null, null)),
  18180.93::numeric,
  'February expenses reconcile to the official DRE'
);

select is(
  (select coalesce(sum(amount), 0) from public.get_expense_composition('2026-03-01', '2026-03-31', null, null)),
  29253.29::numeric,
  'March expenses reconcile to the official DRE'
);

select ok(
  not exists (
    select 1
    from public.get_expense_composition('2026-01-01', '2026-03-31', null, null) c
    join public.financial_chart_accounts ca on ca.code = c.account_code
    where ca.dre_class <> 'DESPESA_OPERACIONAL'
  ),
  'composition returns only DESPESA_OPERACIONAL accounts'
);

select is(
  (select amount from public.get_expense_composition('2026-03-01', '2026-03-31', null, null) where account_code = '5.2.01.001'),
  2750.00::numeric,
  'March rents remain in the official rent expense account'
);

select ok(
  not exists (
    select 1 from public.get_expense_composition('2026-03-01', '2026-03-31', null, null) c
    join public.financial_chart_accounts ca on ca.code = c.account_code
    where ca.dre_class in ('CUSTO_SERVICO', 'OUTRAS_RECEITAS', 'OUTRAS_DESPESAS')
  ),
  'costs and other results are excluded'
);

select ok(
  not exists (
    select 1 from public.get_expense_composition('2026-01-01', '2026-03-31', null, null) c
    join public.financial_chart_accounts ca on ca.code = c.account_code
    where ca.class not in ('RECEITA', 'CUSTO', 'DESPESA')
  ),
  'patrimonial accounts are excluded'
);

select is(
  (select count(*) from public.get_expense_composition('2099-01-01', '2099-01-31', null, null)),
  0::bigint,
  'no data returns an empty set'
);

select ok(
  not exists (
    select 1 from public.get_expense_composition('2026-01-01', '2026-03-31', null, null)
    where percentage is null
       or percentage <> percentage
  ),
  'percentages are finite and non-null'
);

select * from finish();
rollback;
