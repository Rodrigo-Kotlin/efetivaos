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

do $$
declare
  v_bank_cora uuid;
  v_bank_nu uuid;
  v_revenue_category uuid;
  v_expense_category uuid;
  v_asset_category uuid;
  v_depreciation_expense uuid;
  v_accumulated_depreciation uuid;
  v_tx uuid;
  v_entry uuid;
begin
  select fa.id into v_bank_cora
  from public.financial_accounts fa
  join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
  where ca.code = '1.1.01.002' and fa.active
  limit 1;

  select fa.id into v_bank_nu
  from public.financial_accounts fa
  join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
  where ca.code = '1.1.01.003' and fa.active
  limit 1;

  select fc.id into v_revenue_category
  from public.financial_categories fc
  join public.financial_chart_accounts ca on ca.id = fc.counter_account_id
  where fc.movement_type = 'RECEITA'
    and ca.code = '3.1.01.001'
    and fc.active
  limit 1;

  select fc.id into v_expense_category
  from public.financial_categories fc
  join public.financial_chart_accounts ca on ca.id = fc.counter_account_id
  where fc.movement_type = 'DESPESA'
    and ca.code = '5.2.01.001'
    and fc.active
  limit 1;

  select fc.id into v_asset_category
  from public.financial_categories fc
  join public.financial_chart_accounts ca on ca.id = fc.counter_account_id
  where fc.movement_type = 'IMOBILIZADO'
    and ca.code = '1.2.02.003'
    and fc.active
  limit 1;

  select id into v_depreciation_expense
  from public.financial_chart_accounts
  where code = '5.8.01.001';

  select id into v_accumulated_depreciation
  from public.financial_chart_accounts
  where code = '1.2.02.099';

  if v_bank_cora is null or v_bank_nu is null
     or v_revenue_category is null or v_expense_category is null
     or v_asset_category is null or v_depreciation_expense is null
     or v_accumulated_depreciation is null then
    raise exception '08M prerequisites are missing';
  end if;

  insert into pg_temp.fixture_ids values
    ('bank_cora', v_bank_cora),
    ('bank_nu', v_bank_nu),
    ('revenue_category', v_revenue_category),
    ('expense_category', v_expense_category),
    ('asset_category', v_asset_category);

  v_tx := public.create_financial_transaction(
    p_description => '08M Cash revenue',
    p_transaction_date => '2099-08-31',
    p_competence_date => '2099-08-31',
    p_movement_type => 'RECEITA',
    p_amount => 100,
    p_category_id => v_revenue_category,
    p_origin_account_id => v_bank_cora,
    p_payment_date => '2099-08-31',
    p_idempotency_key => '08m-cash-revenue'
  );
  insert into pg_temp.fixture_ids values ('cash_revenue', v_tx);

  v_tx := public.create_financial_transaction(
    p_description => '08M Cash expense',
    p_transaction_date => '2099-08-31',
    p_competence_date => '2099-08-31',
    p_movement_type => 'DESPESA',
    p_amount => 40,
    p_category_id => v_expense_category,
    p_destination_account_id => v_bank_cora,
    p_payment_date => '2099-08-31',
    p_idempotency_key => '08m-cash-expense'
  );
  insert into pg_temp.fixture_ids values ('cash_expense', v_tx);

  v_tx := public.create_financial_transaction(
    p_description => '08M Credit revenue',
    p_transaction_date => '2099-09-01',
    p_competence_date => '2099-08-31',
    p_movement_type => 'RECEITA',
    p_amount => 200,
    p_category_id => v_revenue_category,
    p_origin_account_id => v_bank_cora,
    p_due_date => '2099-09-10',
    p_idempotency_key => '08m-credit-revenue'
  );
  insert into pg_temp.fixture_ids values ('credit_revenue', v_tx);
  perform public.settle_financial_transaction(v_tx, '2099-09-10', null);

  v_tx := public.create_financial_transaction(
    p_description => '08M Credit expense',
    p_transaction_date => '2099-09-01',
    p_competence_date => '2099-08-31',
    p_movement_type => 'DESPESA',
    p_amount => 70,
    p_category_id => v_expense_category,
    p_destination_account_id => v_bank_cora,
    p_due_date => '2099-09-10',
    p_idempotency_key => '08m-credit-expense'
  );
  insert into pg_temp.fixture_ids values ('credit_expense', v_tx);
  perform public.settle_financial_transaction(v_tx, '2099-09-10', null);

  v_tx := public.create_financial_transaction(
    p_description => '08M Transfer',
    p_transaction_date => '2099-08-31',
    p_competence_date => '2099-08-31',
    p_movement_type => 'TRANSFERENCIA',
    p_amount => 50,
    p_origin_account_id => v_bank_cora,
    p_destination_account_id => v_bank_nu,
    p_payment_date => '2099-08-31',
    p_idempotency_key => '08m-transfer'
  );
  insert into pg_temp.fixture_ids values ('transfer', v_tx);

  v_tx := public.create_financial_transaction(
    p_description => '08M Loan received',
    p_transaction_date => '2099-08-31',
    p_competence_date => '2099-08-31',
    p_movement_type => 'EMPRESTIMO_RECEBIDO',
    p_amount => 500,
    p_origin_account_id => v_bank_cora,
    p_payment_date => '2099-08-31',
    p_idempotency_key => '08m-loan-received'
  );
  insert into pg_temp.fixture_ids values ('loan_received', v_tx);

  v_tx := public.create_financial_transaction(
    p_description => '08M Loan paid',
    p_transaction_date => '2099-08-31',
    p_competence_date => '2099-08-31',
    p_movement_type => 'EMPRESTIMO_PAGO',
    p_amount => 110,
    p_destination_account_id => v_bank_cora,
    p_payment_date => '2099-08-31',
    p_principal_amount => 100,
    p_interest_amount => 10,
    p_idempotency_key => '08m-loan-paid'
  );
  insert into pg_temp.fixture_ids values ('loan_paid', v_tx);

  v_tx := public.create_financial_transaction(
    p_description => '08M Capital contribution',
    p_transaction_date => '2099-08-31',
    p_competence_date => '2099-08-31',
    p_movement_type => 'APORTE',
    p_amount => 1000,
    p_origin_account_id => v_bank_cora,
    p_payment_date => '2099-08-31',
    p_idempotency_key => '08m-capital'
  );
  insert into pg_temp.fixture_ids values ('capital', v_tx);

  v_tx := public.create_financial_transaction(
    p_description => '08M Withdrawal',
    p_transaction_date => '2099-08-31',
    p_competence_date => '2099-08-31',
    p_movement_type => 'RETIRADA',
    p_amount => 100,
    p_origin_account_id => v_bank_cora,
    p_payment_date => '2099-08-31',
    p_idempotency_key => '08m-withdrawal'
  );
  insert into pg_temp.fixture_ids values ('withdrawal', v_tx);

  v_tx := public.create_financial_transaction(
    p_description => '08M Cash asset acquisition',
    p_transaction_date => '2099-08-31',
    p_competence_date => '2099-08-31',
    p_movement_type => 'IMOBILIZADO',
    p_amount => 300,
    p_category_id => v_asset_category,
    p_destination_account_id => v_bank_cora,
    p_payment_date => '2099-08-31',
    p_idempotency_key => '08m-asset'
  );
  insert into pg_temp.fixture_ids values ('asset', v_tx);

  v_tx := public.create_financial_transaction(
    p_description => '08M Revenue reversal',
    p_transaction_date => '2099-08-31',
    p_competence_date => '2099-08-31',
    p_movement_type => 'RECEITA',
    p_amount => 30,
    p_category_id => v_revenue_category,
    p_origin_account_id => v_bank_cora,
    p_due_date => '2099-09-30',
    p_idempotency_key => '08m-revenue-reversal'
  );
  insert into pg_temp.fixture_ids values ('revenue_reversal', v_tx);
  perform public.cancel_financial_transaction(v_tx, '08M controlled reversal');

  v_tx := public.create_financial_transaction(
    p_description => '08M Expense reversal',
    p_transaction_date => '2099-08-31',
    p_competence_date => '2099-08-31',
    p_movement_type => 'DESPESA',
    p_amount => 20,
    p_category_id => v_expense_category,
    p_destination_account_id => v_bank_cora,
    p_due_date => '2099-09-30',
    p_idempotency_key => '08m-expense-reversal'
  );
  insert into pg_temp.fixture_ids values ('expense_reversal', v_tx);
  perform public.cancel_financial_transaction(v_tx, '08M controlled reversal');

  -- Depreciation is an economic, non-cash adjustment. This controlled posting
  -- isolates the DRE contract without creating a persistent asset fixture.
  insert into public.financial_transactions (
    id, description, transaction_date, competence_date, movement_type,
    amount, status, payment_date, idempotency_key
  ) values (
    '8c121000-0000-0000-0000-000000000013', '08M Depreciation',
    '2099-08-31', '2099-08-31', 'DEPRECIACAO', 15, 'settled',
    '2099-08-31', '08m-depreciation'
  ) returning id into v_tx;
  insert into pg_temp.fixture_ids values ('depreciation', v_tx);

  insert into public.financial_journal_entries (
    transaction_id, entry_type, entry_date, competence_date,
    description, status, review_required
  ) values (
    v_tx, 'ajuste', '2099-08-31', '2099-08-31',
    '08M Depreciation', 'settled', false
  ) returning id into v_entry;

  insert into public.financial_journal_lines (
    entry_id, chart_account_id, debit, credit, description
  ) values
    (v_entry, v_depreciation_expense, 15, 0, 'Depreciation expense'),
    (v_entry, v_accumulated_depreciation, 0, 15, 'Accumulated depreciation');
end;
$$;

-- Schema and canonical function posture.
insert into pg_temp.tap_results (result)
select ok(
  to_regprocedure('public.create_financial_transaction(text,date,date,financial_movement_type,numeric,uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date,text,numeric,numeric)') is null,
  'legacy create overload without idempotency is absent'
);

insert into pg_temp.tap_results (result)
select ok(
  not has_function_privilege(
    'authenticated',
    'public.post_direct_cash_transaction(uuid,financial_movement_type,numeric,uuid,uuid,uuid,date,date,text)',
    'EXECUTE'
  ),
  'direct cash posting helper is internal only'
);

insert into pg_temp.tap_results (result)
select ok(
  position('je.status = ''settled''' in lower(pg_get_functiondef('public.get_income_statement(date,date,uuid,uuid)'::regprocedure))) = 0,
  'DRE does not depend on settled journal status'
);

-- Cash revenue: D cash / C revenue, no AR title.
insert into pg_temp.tap_results (result)
select is((select status::text from public.financial_transactions where id = (select id from pg_temp.fixture_ids where name = 'cash_revenue')), 'settled', 'cash revenue is settled');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id = (select id from pg_temp.fixture_ids where name = 'cash_revenue')), 1::bigint, 'cash revenue has one direct entry');

insert into pg_temp.tap_results (result)
select is((select sum(jl.debit) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id = je.id join public.financial_chart_accounts ca on ca.id = jl.chart_account_id where je.transaction_id = (select id from pg_temp.fixture_ids where name = 'cash_revenue') and ca.is_cash), 100::numeric, 'cash revenue debits bank');

insert into pg_temp.tap_results (result)
select is((select sum(jl.credit) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id = je.id join public.financial_chart_accounts ca on ca.id = jl.chart_account_id where je.transaction_id = (select id from pg_temp.fixture_ids where name = 'cash_revenue') and ca.class = 'RECEITA'), 100::numeric, 'cash revenue credits revenue');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_receivables_v where transaction_id = (select id from pg_temp.fixture_ids where name = 'cash_revenue')), 0::bigint, 'cash revenue creates no AR title');

insert into pg_temp.tap_results (result)
select is((select sum(jl.credit - jl.debit) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id = je.id join public.financial_chart_accounts ca on ca.id = jl.chart_account_id where je.transaction_id = (select id from pg_temp.fixture_ids where name = 'cash_revenue') and ca.class = 'RECEITA'), 100::numeric, 'cash revenue is economically recognized');

insert into pg_temp.tap_results (result)
select is((select amount from public.financial_cashflow_realized_v where transaction_id = (select id from pg_temp.fixture_ids where name = 'cash_revenue')), 100::numeric, 'cash revenue creates realized inflow');

-- Cash expense: D expense / C cash, no AP title.
insert into pg_temp.tap_results (result)
select is((select status::text from public.financial_transactions where id = (select id from pg_temp.fixture_ids where name = 'cash_expense')), 'settled', 'cash expense is settled');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id = (select id from pg_temp.fixture_ids where name = 'cash_expense')), 1::bigint, 'cash expense has one direct entry');

insert into pg_temp.tap_results (result)
select is((select sum(jl.debit) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id = je.id join public.financial_chart_accounts ca on ca.id = jl.chart_account_id where je.transaction_id = (select id from pg_temp.fixture_ids where name = 'cash_expense') and ca.class in ('CUSTO','DESPESA')), 40::numeric, 'cash expense debits expense');

insert into pg_temp.tap_results (result)
select is((select sum(jl.credit) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id = je.id join public.financial_chart_accounts ca on ca.id = jl.chart_account_id where je.transaction_id = (select id from pg_temp.fixture_ids where name = 'cash_expense') and ca.is_cash), 40::numeric, 'cash expense credits bank');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_payables_v where transaction_id = (select id from pg_temp.fixture_ids where name = 'cash_expense')), 0::bigint, 'cash expense creates no AP title');

insert into pg_temp.tap_results (result)
select is((select amount from public.financial_cashflow_realized_v where transaction_id = (select id from pg_temp.fixture_ids where name = 'cash_expense')), 40::numeric, 'cash expense creates realized outflow');

-- Credit revenue and receipt on a later cash date.
insert into pg_temp.tap_results (result)
select is((select sum(jl.debit) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue') and je.entry_type='competencia' and ca.code='1.1.02.001'), 200::numeric, 'credit revenue recognizes AR');

insert into pg_temp.tap_results (result)
select is((select sum(jl.credit) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue') and je.entry_type='competencia' and ca.class='RECEITA'), 200::numeric, 'credit revenue recognizes revenue');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue')), 2::bigint, 'credit revenue plus receipt has two append-only entries');

insert into pg_temp.tap_results (result)
select ok((select sum(jl.debit) filter (where ca.is_cash)=200 and sum(jl.credit) filter (where ca.code='1.1.02.001')=200 from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue') and je.entry_type='caixa'), 'receipt posts D cash / C AR');

insert into pg_temp.tap_results (result)
select is((select open_amount from public.financial_receivables_v where transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue')), 0::numeric, 'receipt closes AR open amount');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_cashflow_realized_v where transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue') and entry_date between '2099-08-01' and '2099-08-31'), 0::bigint, 'credit revenue has no August cashflow');

insert into pg_temp.tap_results (result)
select is((select amount from public.financial_cashflow_realized_v where transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue') and entry_date='2099-09-10'), 200::numeric, 'receipt creates September inflow');

insert into pg_temp.tap_results (result)
select is((select amount from public.get_income_statement('2099-08-01','2099-08-31',null,null) where row_code='RECEITA_BRUTA'), 300::numeric, 'August DRE includes cash and credit revenue');

insert into pg_temp.tap_results (result)
select is((select amount from public.get_income_statement('2099-09-01','2099-09-30',null,null) where row_code='RECEITA_BRUTA'), 0::numeric, 'DRE ignores September transaction and receipt dates for August competence');

insert into pg_temp.tap_results (result)
select is((select sum(case when ca.nature='CREDITO' then jl.credit-jl.debit else jl.debit-jl.credit end) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='credit_revenue') and ca.class='RECEITA'), 200::numeric, 'receipt leaves one economic revenue recognition');

-- Credit expense and payment on a later cash date.
insert into pg_temp.tap_results (result)
select is((select sum(jl.debit) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='credit_expense') and je.entry_type='competencia' and ca.class in ('CUSTO','DESPESA')), 70::numeric, 'credit expense recognizes expense');

insert into pg_temp.tap_results (result)
select is((select sum(jl.credit) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='credit_expense') and je.entry_type='competencia' and ca.code='2.1.01.001'), 70::numeric, 'credit expense recognizes AP');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id=(select id from pg_temp.fixture_ids where name='credit_expense')), 2::bigint, 'credit expense plus payment has two append-only entries');

insert into pg_temp.tap_results (result)
select ok((select sum(jl.debit) filter (where ca.code='2.1.01.001')=70 and sum(jl.credit) filter (where ca.is_cash)=70 from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='credit_expense') and je.entry_type='caixa'), 'payment posts D AP / C cash');

insert into pg_temp.tap_results (result)
select is((select open_amount from public.financial_payables_v where transaction_id=(select id from pg_temp.fixture_ids where name='credit_expense')), 0::numeric, 'payment closes AP open amount');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_cashflow_realized_v where transaction_id=(select id from pg_temp.fixture_ids where name='credit_expense') and entry_date between '2099-08-01' and '2099-08-31'), 0::bigint, 'credit expense has no August cashflow');

insert into pg_temp.tap_results (result)
select is((select amount from public.financial_cashflow_realized_v where transaction_id=(select id from pg_temp.fixture_ids where name='credit_expense') and entry_date='2099-09-10'), 70::numeric, 'payment creates September outflow');

insert into pg_temp.tap_results (result)
select is((select amount from public.get_income_statement('2099-08-01','2099-08-31',null,null) where row_code='DESPESAS_OPERACIONAIS'), (-110)::numeric, 'August DRE includes cash and credit expense');

insert into pg_temp.tap_results (result)
select is((select amount from public.get_income_statement('2099-09-01','2099-09-30',null,null) where row_code='DESPESAS_OPERACIONAIS'), 0::numeric, 'September payment does not duplicate expense');

insert into pg_temp.tap_results (result)
select is((select sum(case when ca.nature='DEBITO' then jl.debit-jl.credit else jl.credit-jl.debit end) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='credit_expense') and ca.class in ('CUSTO','DESPESA')), 70::numeric, 'payment leaves one economic expense recognition');

-- Patrimonial and financing movements.
insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='transfer') and ca.class in ('RECEITA','CUSTO','DESPESA')), 0::bigint, 'transfer has zero DRE lines');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_cashflow_realized_v where transaction_id=(select id from pg_temp.fixture_ids where name='transfer')), 0::bigint, 'internal transfer is cash-neutral when consolidated');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='loan_received') and ca.class in ('RECEITA','CUSTO','DESPESA')), 0::bigint, 'loan receipt has zero DRE lines');

insert into pg_temp.tap_results (result)
select ok((select direction='INFLOW' and dfc_class='FINANCIAMENTO' and amount=500 from public.financial_cashflow_realized_v where transaction_id=(select id from pg_temp.fixture_ids where name='loan_received')), 'loan receipt is financing inflow');

insert into pg_temp.tap_results (result)
select is((select sum(jl.debit) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='loan_paid') and ca.code='2.1.06.001'), 100::numeric, 'loan principal reduces liability');

insert into pg_temp.tap_results (result)
select is((select sum(jl.debit-jl.credit) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='loan_paid') and ca.dre_class='DESPESA_FINANCEIRA'), 10::numeric, 'loan interest enters DRE');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='capital') and ca.class in ('RECEITA','CUSTO','DESPESA')), 0::bigint, 'capital contribution has zero DRE lines');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='withdrawal') and ca.class in ('RECEITA','CUSTO','DESPESA')), 0::bigint, 'withdrawal has zero DRE lines');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='asset') and ca.class in ('RECEITA','CUSTO','DESPESA')), 0::bigint, 'asset acquisition has zero immediate DRE');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_payables_v where transaction_id=(select id from pg_temp.fixture_ids where name='asset')), 0::bigint, 'cash asset acquisition creates no AP title');

insert into pg_temp.tap_results (result)
select ok((select direction='OUTFLOW' and dfc_class='INVESTIMENTO' and amount=300 from public.financial_cashflow_realized_v where transaction_id=(select id from pg_temp.fixture_ids where name='asset')), 'cash asset acquisition is an investment outflow');

insert into pg_temp.tap_results (result)
select is((select amount from public.get_income_statement('2099-08-01','2099-08-31',null,null) where row_code='DEPRECIACAO'), (-15)::numeric, 'depreciation enters DRE once');

-- Reversals by competence and the explicit F-07 boundary.
insert into pg_temp.tap_results (result)
select is((select coalesce(sum(case when ca.nature='CREDITO' then jl.credit-jl.debit else jl.debit-jl.credit end),0) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='revenue_reversal') and ca.class in ('RECEITA','CUSTO','DESPESA')), 0::numeric, 'revenue reversal nets DRE to zero');

insert into pg_temp.tap_results (result)
select is((select coalesce(sum(case when ca.nature='CREDITO' then jl.credit-jl.debit else jl.debit-jl.credit end),0) from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id=(select id from pg_temp.fixture_ids where name='expense_reversal') and ca.class in ('RECEITA','CUSTO','DESPESA')), 0::numeric, 'expense reversal nets DRE to zero');

insert into pg_temp.tap_results (result)
select is((select open_amount from public.financial_receivables_v where transaction_id=(select id from pg_temp.fixture_ids where name='revenue_reversal')), 0::numeric, 'cancelled pending revenue has no open title');

insert into pg_temp.tap_results (result)
select throws_ok(
  format('select public.cancel_financial_transaction(%L::uuid, %L)', (select id from pg_temp.fixture_ids where name='cash_revenue'), 'blocked until F-07'),
  'P0001', 'Cancelamento de transacao liquidada requer estorno integral (F-07)',
  'settled cancellation is blocked until full reversal is implemented'
);

-- Ledger integrity, F-01/F-06 regression, and report totals.
insert into pg_temp.tap_results (result)
select ok(not exists (select 1 from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id where je.transaction_id in (select id from pg_temp.fixture_ids where name not like 'bank_%' and name not like '%category') group by je.id having abs(sum(jl.debit)-sum(jl.credit)) > 0.005), 'every fixture journal entry is balanced');

insert into pg_temp.tap_results (result)
select ok(not exists (select 1 from public.financial_journal_lines jl left join public.financial_journal_entries je on je.id=jl.entry_id where je.id is null), 'journal has no orphan lines');

insert into pg_temp.tap_results (result)
select is((select count(*) from (select transaction_id from public.financial_receivables_v intersect select transaction_id from public.financial_payables_v) overlap), 0::bigint, 'AR/AP overlap remains zero');

insert into pg_temp.tap_results (result)
select ok((select coalesce(sum(jl.debit-jl.credit),0) >= 0 from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id in (select id from pg_temp.fixture_ids) and ca.code='1.1.02.001'), 'fixture AR has no unintended negative balance');

insert into pg_temp.tap_results (result)
select ok((select coalesce(sum(jl.credit-jl.debit),0) >= 0 from public.financial_journal_entries je join public.financial_journal_lines jl on jl.entry_id=je.id join public.financial_chart_accounts ca on ca.id=jl.chart_account_id where je.transaction_id in (select id from pg_temp.fixture_ids) and ca.code='2.1.01.001'), 'fixture AP has no unintended negative balance');

insert into pg_temp.tap_results (result)
select is((select amount from public.get_income_statement('2099-08-01','2099-08-31',null,null) where row_code='RESULTADO_LIQUIDO'), 165::numeric, 'August DRE net result is 165');

insert into pg_temp.tap_results (result)
select is(((public.get_financial_dashboard('2099-08-01','2099-08-31','2099-08-31',null,null)->'income_statement'->>'revenue')::numeric), 300::numeric, 'dashboard revenue delegates to corrected DRE');

insert into pg_temp.tap_results (result)
select is(((public.get_financial_dashboard('2099-08-01','2099-08-31','2099-08-31',null,null)->'income_statement'->>'net_result')::numeric), 165::numeric, 'dashboard net result delegates to corrected DRE');

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
), 'fixture ledger satisfies Assets = Liabilities + Equity + Result');

-- Append-only and idempotency protections remain active.
insert into pg_temp.tap_results (result)
select throws_ok(
  format('update public.financial_journal_entries set description=%L where transaction_id=%L::uuid', 'forbidden', (select id from pg_temp.fixture_ids where name='cash_revenue')),
  'P0001', 'Journal entries are immutable. Updates are not allowed.',
  'journal entry update remains blocked'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  format('delete from public.financial_journal_lines where entry_id=(select id from public.financial_journal_entries where transaction_id=%L::uuid limit 1)', (select id from pg_temp.fixture_ids where name='cash_revenue')),
  'P0001', 'Journal lines are immutable. Deletions are not allowed.',
  'journal line delete remains blocked'
);

insert into pg_temp.tap_results (result)
select is(
  public.create_financial_transaction(
    p_description => '08M ignored replay', p_transaction_date => '2099-08-31',
    p_competence_date => '2099-08-31', p_movement_type => 'RECEITA',
    p_amount => 999, p_category_id => (select id from pg_temp.fixture_ids where name='revenue_category'),
    p_origin_account_id => (select id from pg_temp.fixture_ids where name='bank_cora'),
    p_payment_date => '2099-08-31', p_idempotency_key => '08m-cash-revenue'
  ),
  (select id from pg_temp.fixture_ids where name='cash_revenue'),
  'idempotent create returns original transaction'
);

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_journal_entries where transaction_id=(select id from pg_temp.fixture_ids where name='cash_revenue')), 1::bigint, 'idempotent replay creates no journal duplicate');

insert into pg_temp.tap_results (result)
select is((select coalesce(sum(case when direction='INFLOW' then amount else -amount end),0) from public.financial_cashflow_realized_v where entry_date between '2099-09-01' and '2099-09-30' and transaction_id in (select id from pg_temp.fixture_ids)), 130::numeric, 'September realized net cash is receipt minus payment');

do $$
declare
  tap text;
begin
  select string_agg(result, E'\n' order by seq) into tap from pg_temp.tap_results;
  raise notice '%', tap;
end $$;

select result as tap_line from pg_temp.tap_results order by seq;

rollback;
