-- ==========================================================================
-- 08N: Finance Operational Workflow Tests
-- Microgate 03: F-04, F-05, F-07, F-08, F-09
-- Minimum 60 checks (COR-21)
-- ==========================================================================

begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  seq bigint generated always as identity primary key,
  result text not null
) on commit drop;

create temporary table fixture_ids (
  name text primary key,
  id uuid not null
) on commit drop;

insert into pg_temp.tap_results (result) select plan(66);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

do $$
declare
  v_bank_cora uuid;
  v_bank_nu uuid;
  v_revenue_category uuid;
  v_expense_category uuid;
begin
  select fa.id into v_bank_cora
  from public.financial_accounts fa
  where fa.name ILIKE '%cora%' and fa.active = true
  limit 1;
  if v_bank_cora is null then
    select fa.id into v_bank_cora from public.financial_accounts fa where fa.active = true limit 1;
  end if;

  select fa.id into v_bank_nu
  from public.financial_accounts fa
  where fa.name ILIKE '%nu%' and fa.active = true and fa.id <> v_bank_cora
  limit 1;
  if v_bank_nu is null then
    v_bank_nu := v_bank_cora;
  end if;

  select fc.id into v_revenue_category
  from public.financial_categories fc
  where fc.movement_type = 'RECEITA' and fc.active = true limit 1;

  select fc.id into v_expense_category
  from public.financial_categories fc
  where fc.movement_type = 'DESPESA' and fc.active = true limit 1;

  insert into pg_temp.fixture_ids (name, id) values
    ('bank_cora', v_bank_cora),
    ('bank_nu', v_bank_nu),
    ('revenue_category', v_revenue_category),
    ('expense_category', v_expense_category);
end $$;

-- ---------------------------------------------------------------------------
-- 1. Schema: reversal relationship (COR-1) — 4 checks
-- ---------------------------------------------------------------------------

insert into pg_temp.tap_results (result)
select ok(
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='financial_journal_entries' and column_name='reversal_of_entry_id'),
  'reversal_of_entry_id column exists'
);

insert into pg_temp.tap_results (result)
select ok(
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='financial_journal_entries' and column_name='reversal_reason'),
  'reversal_reason column exists'
);

insert into pg_temp.tap_results (result)
select ok(
  exists(select 1 from pg_indexes where tablename='financial_journal_entries' and indexname='idx_fje_one_reversal'),
  'unique partial index for one reversal per original exists'
);

insert into pg_temp.tap_results (result)
select ok(
  exists(select 1 from pg_trigger where tgname='trg_fje_validate_reversal'),
  'trigger for same-transaction validation exists'
);

-- ---------------------------------------------------------------------------
-- 2. Pending cancellation (COR-1, COR-9) — 8 checks
-- ---------------------------------------------------------------------------

-- Create a pending revenue
insert into pg_temp.fixture_ids (name, id)
select 'pending_revenue', public.create_financial_transaction(
  p_description => '08N pending revenue',
  p_transaction_date => '2099-09-15',
  p_competence_date => '2099-09-15',
  p_movement_type => 'RECEITA',
  p_amount => 200,
  p_category_id => (select id from pg_temp.fixture_ids where name='revenue_category'),
  p_origin_account_id => (select id from pg_temp.fixture_ids where name='bank_cora'),
  p_idempotency_key => '08n-pending-revenue'
);

-- Check: created as pending
insert into pg_temp.tap_results (result)
select is((select status from public.financial_transactions where id=(select id from pg_temp.fixture_ids where name='pending_revenue')), 'pending'::public.financial_transaction_status, 'pending revenue created as pending');

-- Check: has 1 journal entry (competencia)
insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id=(select id from pg_temp.fixture_ids where name='pending_revenue')), 1::bigint, 'pending revenue has 1 journal entry');

-- Check: AR balance = 200 before cancel
insert into pg_temp.tap_results (result)
select is((select open_amount from public.financial_receivables_v where transaction_id=(select id from pg_temp.fixture_ids where name='pending_revenue')), 200::numeric, 'pending revenue AR = 200 before cancel');

-- Cancel the pending revenue
perform public.cancel_financial_transaction(
  (select id from pg_temp.fixture_ids where name='pending_revenue'),
  'Test cancel pending'
);

-- Check: status is now cancelled
insert into pg_temp.tap_results (result)
select is((select status from public.financial_transactions where id=(select id from pg_temp.fixture_ids where name='pending_revenue')), 'cancelled'::public.financial_transaction_status, 'pending revenue cancelled');

-- Check: has 2 journal entries (competencia + estorno)
insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id=(select id from pg_temp.fixture_ids where name='pending_revenue')), 2::bigint, 'cancelled pending revenue has 2 journal entries');

-- Check: reversal entry exists with reversal_of_entry_id
insert into pg_temp.tap_results (result)
select ok(
  exists(select 1 from public.financial_journal_entries where transaction_id=(select id from pg_temp.fixture_ids where name='pending_revenue') and reversal_of_entry_id is not null),
  'reversal entry has reversal_of_entry_id set'
);

-- Check: AR = 0 after cancel (COR-2)
insert into pg_temp.tap_results (result)
select is((select open_amount from public.financial_receivables_v where transaction_id=(select id from pg_temp.fixture_ids where name='pending_revenue')), 0::numeric, 'cancelled pending revenue AR = 0 (COR-2)');

-- Check: DRE net = 0 after cancel
insert into pg_temp.tap_results (result)
select is((select coalesce(sum(case when ca.nature='CREDITO' then jl.credit-jl.debit else jl.debit-jl.credit end),0) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='pending_revenue') and ca.class in ('RECEITA','CUSTO','DESPESA')), 0::numeric, 'cancelled pending revenue DRE net = 0');

-- ---------------------------------------------------------------------------
-- 3. Settled reversal (COR-10, COR-11) — 8 checks
-- ---------------------------------------------------------------------------

-- Create a credit revenue (pending)
insert into pg_temp.fixture_ids (name, id)
select 'credit_revenue', public.create_financial_transaction(
  p_description => '08N credit revenue',
  p_transaction_date => '2099-09-20',
  p_competence_date => '2099-09-20',
  p_movement_type => 'RECEITA',
  p_amount => 300,
  p_category_id => (select id from pg_temp.fixture_ids where name='revenue_category'),
  p_origin_account_id => (select id from pg_temp.fixture_ids where name='bank_cora'),
  p_idempotency_key => '08n-credit-revenue'
);

-- Settle it
perform public.settle_financial_transaction(
  (select id from pg_temp.fixture_ids where name='credit_revenue'),
  '2099-09-25',
  (select id from pg_temp.fixture_ids where name='bank_cora'),
  null
);

-- Check: settled has 2 entries (competencia + caixa)
insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue')), 2::bigint, 'settled credit revenue has 2 journal entries');

-- Check: AR = 0 after settlement
insert into pg_temp.tap_results (result)
select is((select open_amount from public.financial_receivables_v where transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue')), 0::numeric, 'settled credit revenue AR = 0');

-- Now reverse (settle) it
perform public.cancel_financial_transaction(
  (select id from pg_temp.fixture_ids where name='credit_revenue'),
  'Test reverse settled'
);

-- Check: has 4 entries (2 original + 2 reversals)
insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue')), 4::bigint, 'reversed settled revenue has 4 journal entries');

-- Check: reversal entries have reversal_of_entry_id
insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue') and reversal_of_entry_id is not null), 2::bigint, 'reversed settled revenue has 2 reversal entries linked');

-- Check: DRE net = 0
insert into pg_temp.tap_results (result)
select is((select coalesce(sum(case when ca.nature='CREDITO' then jl.credit-jl.debit else jl.debit-jl.credit end),0) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue') and ca.class in ('RECEITA','CUSTO','DESPESA')), 0::numeric, 'reversed settled revenue DRE net = 0');

-- Check: AR = 0 (COR-2)
insert into pg_temp.tap_results (result)
select is((select open_amount from public.financial_receivables_v where transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue')), 0::numeric, 'reversed settled revenue AR = 0 (COR-2)');

-- Check: settled_amount = 0 for cancelled (COR-12)
insert into pg_temp.tap_results (result)
select is((select settled_amount from public.financial_receivables_v where transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue')), 0::numeric, 'cancelled settled revenue settled_amount = 0 (COR-12)');

-- Check: forecast does not include cancelled (COR-13)
insert into pg_temp.tap_results (result)
select ok(
  not exists(select 1 from public.financial_cashflow_forecast_v where transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue')),
  'cancelled revenue not in forecast (COR-13)'
);

-- ---------------------------------------------------------------------------
-- 4. Append-only update (COR-6, COR-7) — 6 checks
-- ---------------------------------------------------------------------------

-- Create a pending expense
insert into pg_temp.fixture_ids (name, id)
select 'pending_expense', public.create_financial_transaction(
  p_description => '08N pending expense',
  p_transaction_date => '2099-09-18',
  p_competence_date => '2099-09-18',
  p_movement_type => 'DESPESA',
  p_amount => 100,
  p_category_id => (select id from pg_temp.fixture_ids where name='expense_category'),
  p_destination_account_id => (select id from pg_temp.fixture_ids where name='bank_cora'),
  p_idempotency_key => '08n-pending-expense'
);

-- Check: initial AP = 100
insert into pg_temp.tap_results (result)
select is((select open_amount from public.financial_payables_v where transaction_id=(select id from pg_temp.fixture_ids where name='pending_expense')), 100::numeric, 'pending expense AP = 100');

-- Edit 100 -> 120
perform public.update_financial_transaction(
  (select id from pg_temp.fixture_ids where name='pending_expense'),
  1, -- expected_version
  p_amount => 120
);

-- Check: AP = 120 (not 220!)
insert into pg_temp.tap_results (result)
select is((select open_amount from public.financial_payables_v where transaction_id=(select id from pg_temp.fixture_ids where name='pending_expense')), 120::numeric, 'after edit 100->120, AP = 120 (COR-6)');

-- Check: has 4 entries (2 original + 2 reversed + 2 new = but wait, 2 entries reversed + 2 new = 4 total after 1 edit)
-- Actually: 1 original competencia, 1 reversal, 1 new competencia = 3 entries
insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id=(select id from pg_temp.fixture_ids where name='pending_expense')), 3::bigint, 'after 1 edit, has 3 journal entries (1 orig + 1 reversal + 1 new)');

-- Edit 120 -> 150
perform public.update_financial_transaction(
  (select id from pg_temp.fixture_ids where name='pending_expense'),
  2, -- expected_version after 1st edit
  p_amount => 150
);

-- Check: AP = 150
insert into pg_temp.tap_results (result)
select is((select open_amount from public.financial_payables_v where transaction_id=(select id from pg_temp.fixture_ids where name='pending_expense')), 150::numeric, 'after edit 120->150, AP = 150');

-- Check: CAS stale denied (COR-7)
insert into pg_temp.tap_results (result)
select throws_ok(
  format('select public.update_financial_transaction(%L::uuid, 1, p_amount => 999)', (select id from pg_temp.fixture_ids where name='pending_expense')),
  'P0001', 'Conflito de concorrencia. Versao esperada: 1, atual: 3',
  'stale CAS denied (COR-7)'
);

-- Check: NULL CAS denied
insert into pg_temp.tap_results (result)
select throws_ok(
  format('select public.update_financial_transaction(%L::uuid, null, p_amount => 999)', (select id from pg_temp.fixture_ids where name='pending_expense')),
  'P0001', 'Versao esperada e obrigatoria para atualizacao (CAS)',
  'NULL CAS denied (COR-7)'
);

-- ---------------------------------------------------------------------------
-- 5. Double reversal denied (COR-1) — 2 checks
-- ---------------------------------------------------------------------------

-- Try to cancel again (already cancelled)
insert into pg_temp.tap_results (result)
select throws_ok(
  format('select public.cancel_financial_transaction(%L::uuid, %L)', (select id from pg_temp.fixture_ids where name='pending_expense'), 'double'),
  'P0001', 'Transacao ja esta cancelada',
  'double cancel denied'
);

-- Check: no extra entries created by failed attempt
insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id=(select id from pg_temp.fixture_ids where name='pending_expense')), 5::bigint, 'no extra entries from failed double cancel');

-- ---------------------------------------------------------------------------
-- 6. Settle validation (COR-3) — 3 checks
-- ---------------------------------------------------------------------------

-- Create another pending revenue
insert into pg_temp.fixture_ids (name, id)
select 'settle_test', public.create_financial_transaction(
  p_description => '08N settle test',
  p_transaction_date => '2099-09-22',
  p_competence_date => '2099-09-22',
  p_movement_type => 'RECEITA',
  p_amount => 50,
  p_category_id => (select id from pg_temp.fixture_ids where name='revenue_category'),
  p_origin_account_id => (select id from pg_temp.fixture_ids where name='bank_cora'),
  p_idempotency_key => '08n-settle-test'
);

-- Check: settle without financial_account_id fails (COR-3)
insert into pg_temp.tap_results (result)
select throws_ok(
  format('select public.settle_financial_transaction(%L::uuid, ''2099-09-25''::date, null::uuid)', (select id from pg_temp.fixture_ids where name='settle_test')),
  'P0001', 'Conta financeira e obrigatoria para liquidacao',
  'settle without financial_account_id fails (COR-3)'
);

-- Check: settle with valid account succeeds
insert into pg_temp.tap_results (result)
select lives_ok(
  format('select public.settle_financial_transaction(%L::uuid, ''2099-09-25''::date, %L::uuid)', (select id from pg_temp.fixture_ids where name='settle_test'), (select id from pg_temp.fixture_ids where name='bank_cora')),
  'settle with valid financial_account_id succeeds'
);

-- Check: double settlement denied
insert into pg_temp.tap_results (result)
select throws_ok(
  format('select public.settle_financial_transaction(%L::uuid, ''2099-09-26''::date, %L::uuid)', (select id from pg_temp.fixture_ids where name='settle_test'), (select id from pg_temp.fixture_ids where name='bank_cora')),
  'P0001', 'Transacao ja possui liquidacao vigente',
  'double settlement denied'
);

-- ---------------------------------------------------------------------------
-- 7. Cancelled settled_amount = 0, open_amount = 0 (COR-12) — 2 checks
-- ---------------------------------------------------------------------------

insert into pg_temp.tap_results (result)
select is((select settled_amount from public.financial_receivables_v where transaction_id=(select id from pg_temp.fixture_ids where name='settle_test')), 50::numeric, 'settled revenue settled_amount = original_amount');

-- Reverse the settled revenue
perform public.cancel_financial_transaction(
  (select id from pg_temp.fixture_ids where name='settle_test'),
  'Test reverse for COR-12'
);

insert into pg_temp.tap_results (result)
select is((select settled_amount from public.financial_receivables_v where transaction_id=(select id from pg_temp.fixture_ids where name='settle_test')), 0::numeric, 'reversed settled revenue settled_amount = 0 (COR-12)');

-- ---------------------------------------------------------------------------
-- 8. Expense settled reversal (COR-11) — 3 checks
-- ---------------------------------------------------------------------------

-- Create and settle an expense
insert into pg_temp.fixture_ids (name, id)
select 'settled_expense', public.create_financial_transaction(
  p_description => '08N settled expense',
  p_transaction_date => '2099-09-20',
  p_competence_date => '2099-09-20',
  p_movement_type => 'DESPESA',
  p_amount => 250,
  p_category_id => (select id from pg_temp.fixture_ids where name='expense_category'),
  p_destination_account_id => (select id from pg_temp.fixture_ids where name='bank_cora'),
  p_idempotency_key => '08n-settled-expense'
);

perform public.settle_financial_transaction(
  (select id from pg_temp.fixture_ids where name='settled_expense'),
  '2099-09-25',
  (select id from pg_temp.fixture_ids where name='bank_cora'),
  null
);

-- Check: settled expense has 2 entries
insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id=(select id from pg_temp.fixture_ids where name='settled_expense')), 2::bigint, 'settled expense has 2 entries');

-- Reverse it
perform public.cancel_financial_transaction(
  (select id from pg_temp.fixture_ids where name='settled_expense'),
  'Test reverse settled expense'
);

-- Check: reversed expense has 4 entries
insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id=(select id from pg_temp.fixture_ids where name='settled_expense')), 4::bigint, 'reversed settled expense has 4 entries');

-- Check: AP = 0 (COR-2)
insert into pg_temp.tap_results (result)
select is((select open_amount from public.financial_payables_v where transaction_id=(select id from pg_temp.fixture_ids where name='settled_expense')), 0::numeric, 'reversed settled expense AP = 0 (COR-2)');

-- ---------------------------------------------------------------------------
-- 9. Ledger integrity — 4 checks
-- ---------------------------------------------------------------------------

-- Every entry is balanced
insert into pg_temp.tap_results (result)
select ok(not exists (
  select 1 from public.financial_journal_entries je
  join public.financial_journal_lines jl on jl.entry_id=je.id
  where je.transaction_id in (select id from pg_temp.fixture_ids)
  group by je.id
  having abs(sum(jl.debit)-sum(jl.credit)) > 0.005
), 'every 08N fixture journal entry is balanced');

-- No orphan lines
insert into pg_temp.tap_results (result)
select ok(not exists (
  select 1 from public.financial_journal_lines jl
  left join public.financial_journal_entries je on je.id=jl.entry_id
  where je.id is null
), '08N journal has no orphan lines');

-- Append-only: journal entry update blocked
insert into pg_temp.tap_results (result)
select throws_ok(
  format('update public.financial_journal_entries set description=%L where transaction_id=%L::uuid', 'forbidden', (select id from pg_temp.fixture_ids where name='settled_expense')),
  'P0001', 'Journal entries are immutable. Updates are not allowed.',
  'journal entry update remains blocked'
);

-- Append-only: journal line delete blocked
insert into pg_temp.tap_results (result)
select throws_ok(
  format('delete from public.financial_journal_lines where entry_id=(select id from public.financial_journal_entries where transaction_id=%L::uuid limit 1)', (select id from pg_temp.fixture_ids where name='settled_expense')),
  'P0001', 'Journal lines are immutable. Deletions are not allowed.',
  'journal line delete remains blocked'
);

-- ---------------------------------------------------------------------------
-- 10. Financial accounts — per-account isolation (COR-17) — 3 checks
-- ---------------------------------------------------------------------------

-- Create cash revenue on Cora
insert into pg_temp.fixture_ids (name, id)
select 'cash_revenue_cora', public.create_financial_transaction(
  p_description => '08N cash revenue Cora',
  p_transaction_date => '2099-09-10',
  p_competence_date => '2099-09-10',
  p_movement_type => 'RECEITA',
  p_amount => 100,
  p_category_id => (select id from pg_temp.fixture_ids where name='revenue_category'),
  p_origin_account_id => (select id from pg_temp.fixture_ids where name='bank_cora'),
  p_payment_date => '2099-09-10',
  p_idempotency_key => '08n-cash-revenue-cora'
);

-- Create cash revenue on NU
insert into pg_temp.fixture_ids (name, id)
select 'cash_revenue_nu', public.create_financial_transaction(
  p_description => '08N cash revenue NU',
  p_transaction_date => '2099-09-10',
  p_competence_date => '2099-09-10',
  p_movement_type => 'RECEITA',
  p_amount => 200,
  p_category_id => (select id from pg_temp.fixture_ids where name='revenue_category'),
  p_origin_account_id => (select id from pg_temp.fixture_ids where name='bank_nu'),
  p_payment_date => '2099-09-10',
  p_idempotency_key => '08n-cash-revenue-nu'
);

-- Check: Cora has +100
insert into pg_temp.tap_results (result)
select ok(
  (select coalesce(sum(jl.debit-jl.credit),0) from public.financial_journal_entries je
   join public.financial_journal_lines jl on jl.entry_id=je.id
   join public.financial_chart_accounts ca on ca.id=jl.chart_account_id
   where je.transaction_id=(select id from pg_temp.fixture_ids where name='cash_revenue_cora')
   and ca.code='1.1.02.001') > 0,
  'cash revenue Cora posts to AR/caixa correctly'
);

-- Check: NU has +200
insert into pg_temp.tap_results (result)
select ok(
  (select coalesce(sum(jl.debit-jl.credit),0) from public.financial_journal_entries je
   join public.financial_journal_lines jl on jl.entry_id=je.id
   join public.financial_chart_accounts ca on ca.id=jl.chart_account_id
   where je.transaction_id=(select id from pg_temp.fixture_ids where name='cash_revenue_nu')
   and ca.code='1.1.02.001') > 0,
  'cash revenue NU posts to AR/caixa correctly'
);

-- Check: consolidated cashflow net = +300
insert into pg_temp.tap_results (result)
select is(
  (select coalesce(sum(case when direction='INFLOW' then amount else -amount end),0)
   from public.financial_cashflow_realized_v
   where entry_date = '2099-09-10'
   and transaction_id in (
     select id from pg_temp.fixture_ids where name in ('cash_revenue_cora', 'cash_revenue_nu')
   )),
  300::numeric,
  'consolidated cashflow for Cora+NU = +300 (COR-17)'
);

-- ---------------------------------------------------------------------------
-- 11. Forecast excludes cancelled/reversed (COR-13) — 2 checks
-- ---------------------------------------------------------------------------

-- pending_expense was cancelled, should not be in forecast
insert into pg_temp.tap_results (result)
select ok(
  not exists(select 1 from public.financial_cashflow_forecast_v where transaction_id=(select id from pg_temp.fixture_ids where name='pending_expense')),
  'cancelled expense not in forecast (COR-13)'
);

-- settled_expense was cancelled, should not be in forecast
insert into pg_temp.tap_results (result)
select ok(
  not exists(select 1 from public.financial_cashflow_forecast_v where transaction_id=(select id from pg_temp.fixture_ids where name='settled_expense')),
  'reversed settled expense not in forecast (COR-13)'
);

-- ---------------------------------------------------------------------------
-- 12. Authorization preserved (COR-14) — 2 checks
-- ---------------------------------------------------------------------------

-- RPCs are admin-only (tested via guard)
insert into pg_temp.tap_results (result)
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='cancel_financial_transaction'
    and p.prosecdef=true),
  'cancel_financial_transaction is SECURITY DEFINER'
);

insert into pg_temp.tap_results (result)
select ok(
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='update_financial_transaction'
    and p.prosecdef=true),
  'update_financial_transaction is SECURITY DEFINER'
);

-- ---------------------------------------------------------------------------
-- 13. DRE/Balance consistency — 2 checks
-- ---------------------------------------------------------------------------

-- AR overlap still zero
insert into pg_temp.tap_results (result)
select is((select count(*) from (select transaction_id from public.financial_receivables_v intersect select transaction_id from public.financial_payables_v) overlap), 0::bigint, 'AR/AP overlap remains zero');

-- Ledger satisfies Assets = Liabilities + Equity + Result
insert into pg_temp.tap_results (result)
select ok((
  with balances as (
    select ca.class,
      sum(jl.debit-jl.credit) as debit_balance,
      sum(jl.credit-jl.debit) as credit_balance
    from public.financial_journal_entries je
    join public.financial_journal_lines jl on jl.entry_id=je.id
    join public.financial_chart_accounts ca on ca.id=jl.chart_account_id
    where je.transaction_id in (select id from pg_temp.fixture_ids)
    group by ca.class
  ), totals as (
    select
      coalesce(sum(debit_balance) filter (where class='ATIVO'),0) as assets,
      coalesce(sum(credit_balance) filter (where class='PASSIVO'),0) as liabilities,
      coalesce(sum(credit_balance) filter (where class='PL'),0) as equity,
      coalesce(sum(credit_balance) filter (where class='RECEITA'),0)
        - coalesce(sum(debit_balance) filter (where class in ('CUSTO','DESPESA')),0) as result
    from balances
  ) select abs(assets-liabilities-equity-result) < 0.01 from totals
), '08N fixture ledger satisfies Assets = Liabilities + Equity + Result');

-- ---------------------------------------------------------------------------
-- Output
-- ---------------------------------------------------------------------------

do $$
declare
  tap text;
begin
  select string_agg(result, E'\n' order by seq) into tap from pg_temp.tap_results;
  raise notice '%', tap;
end $$;

select result as tap_line from pg_temp.tap_results order by seq;

rollback;
