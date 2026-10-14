-- FIN-RECON-3: transactional fixture tests. Execute in DEV and roll back.

begin;

do $$
declare
  v_cora uuid;
  v_revenue_category uuid;
  v_original_id uuid;
  v_failure_original_id uuid;
  v_replacement_id uuid;
  v_reversal_count integer;
  v_replacement_journal_count integer;
  v_original_status public.financial_transaction_status;
  v_replacement_movement public.financial_movement_type;
  v_replacement_amount numeric;
  v_replacement_category uuid;
  v_replacement_origin uuid;
  v_replacement_notes text;
  v_cora_chart uuid;
  v_opening_chart uuid;
  v_revenue_lines integer;
begin
  select id into v_cora from public.financial_accounts where name = 'Cora' and active limit 1;
  select fc.id into v_revenue_category
  from public.financial_categories fc
  join public.financial_chart_accounts ca on ca.id = fc.counter_account_id
  where fc.movement_type = 'RECEITA' and ca.class = 'RECEITA' and fc.active
  limit 1;

  if v_cora is null or v_revenue_category is null then
    raise exception 'Fixture prerequisites not found';
  end if;

  v_original_id := public.create_financial_transaction(
    'FIN-RECON-3 fixture original',
    date '2026-01-01', date '2026-01-01', 'RECEITA', 1000,
    v_revenue_category, v_cora, null, null, null, null, null,
    date '2026-01-01', date '2026-01-01', 'fixture', null, null,
    'FIN-RECON-3::fixture::original'
  );

  v_replacement_id := public.correct_financial_transaction_to_opening_balance(
    v_original_id, 'Fixture correction'
  );

  select status into v_original_status
  from public.financial_transactions where id = v_original_id;
  if v_original_status <> 'cancelled' then
    raise exception 'Original was not cancelled after reversal';
  end if;

  select count(*) into v_reversal_count
  from public.financial_journal_entries
  where transaction_id = v_original_id and entry_type = 'estorno';
  if v_reversal_count = 0 then
    raise exception 'No append-only reversal was created';
  end if;

  select movement_type, amount, category_id, origin_account_id, notes
  into v_replacement_movement, v_replacement_amount, v_replacement_category,
       v_replacement_origin, v_replacement_notes
  from public.financial_transactions where id = v_replacement_id;
  if v_replacement_movement <> 'SALDO_INICIAL'
     or v_replacement_amount <> 1000
     or v_replacement_category is not null
     or v_replacement_origin <> v_cora
     or position(v_original_id::text in v_replacement_notes) = 0 then
    raise exception 'Replacement header is incorrect';
  end if;

  select count(*) into v_replacement_journal_count
  from public.financial_journal_entries where transaction_id = v_replacement_id;
  if v_replacement_journal_count <> 1 then
    raise exception 'Replacement journal entry count is incorrect';
  end if;

  select chart_account_id into v_cora_chart
  from public.financial_accounts where id = v_cora;
  v_opening_chart := public.get_chart_account_id_by_code('2.3.99.001');

  if not exists (
    select 1
    from public.financial_journal_entries je
    join public.financial_journal_lines debit_line on debit_line.entry_id = je.id
    join public.financial_journal_lines credit_line on credit_line.entry_id = je.id
    where je.transaction_id = v_replacement_id
      and debit_line.chart_account_id = v_cora_chart and debit_line.debit = 1000 and debit_line.credit = 0
      and credit_line.chart_account_id = v_opening_chart and credit_line.credit = 1000 and credit_line.debit = 0
  ) then
    raise exception 'Replacement journal is not Cora debit / opening equity credit';
  end if;

  select count(*) into v_revenue_lines
  from public.financial_journal_entries je
  join public.financial_journal_lines jl on jl.entry_id = je.id
  join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
  where je.transaction_id = v_replacement_id and ca.class = 'RECEITA';
  if v_revenue_lines <> 0 then
    raise exception 'Replacement still contains revenue lines';
  end if;

  -- Force the replacement phase to fail after the original is locked and
  -- reversed. The subtransaction must leave the second original untouched.
  v_failure_original_id := public.create_financial_transaction(
    'FIN-RECON-3 fixture rollback',
    date '2026-01-01', date '2026-01-01', 'RECEITA', 1100,
    v_revenue_category, v_cora, null, null, null, null, null,
    date '2026-01-01', date '2026-01-01', 'fixture', null, null,
    'FIN-RECON-3::fixture::rollback'
  );
  update public.financial_accounts set active = false where id = v_cora;
  begin
    perform public.correct_financial_transaction_to_opening_balance(
      v_failure_original_id, 'This must fail because Cora is inactive'
    );
    raise exception 'Atomic failure fixture unexpectedly succeeded';
  exception when others then
    null;
  end;
  update public.financial_accounts set active = true where id = v_cora;

  if not exists (
    select 1 from public.financial_transactions
    where id = v_failure_original_id and status = 'settled'
  ) then
    raise exception 'Atomic failure rollback changed original state unexpectedly';
  end if;
  if exists (
    select 1 from public.financial_journal_entries
    where transaction_id = v_failure_original_id and entry_type = 'estorno'
  ) then
    raise exception 'Atomic failure rollback left a reversal behind';
  end if;
  if exists (
    select 1 from public.financial_transactions
    where notes like '%' || v_failure_original_id::text || '%'
      and movement_type = 'SALDO_INICIAL'
  ) then
    raise exception 'Atomic failure rollback left a replacement behind';
  end if;
end;
$$;

do $$
declare
  v_acl text[];
  v_search_path text[];
  v_is_definer boolean;
  v_has_guard boolean;
begin
  select p.proacl, p.proconfig, p.prosecdef,
         position('is_admin()' in pg_get_functiondef(p.oid)) > 0
  into v_acl, v_search_path, v_is_definer, v_has_guard
  from pg_proc p
  where p.oid = 'public.correct_financial_transaction_to_opening_balance(uuid,text)'::regprocedure;

  if v_is_definer is not true or v_has_guard is not true then
    raise exception 'RPC security definer/admin guard missing';
  end if;
  if coalesce(array_to_string(v_search_path, ','), '') not like '%search_path%' then
    raise exception 'RPC search_path hardening missing';
  end if;
  if has_function_privilege('authenticated', 'public.correct_financial_transaction_to_opening_balance(uuid,text)', 'EXECUTE') is not true
     or has_function_privilege('anon', 'public.correct_financial_transaction_to_opening_balance(uuid,text)', 'EXECUTE') is true
     or has_function_privilege('public', 'public.correct_financial_transaction_to_opening_balance(uuid,text)', 'EXECUTE') is true then
    raise exception 'RPC grants are not restricted';
  end if;
end;
$$;

rollback;
