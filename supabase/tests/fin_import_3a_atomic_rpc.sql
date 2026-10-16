-- FIN-IMPORT-3C acceptance assertions.
-- The authoritative batch is already persisted in DEV. This file is read-only
-- and never calls the import RPC.

begin;

do $$
declare
  v_definition text;
  v_count integer;
  v_balance numeric(15,2);
begin
  select pg_get_functiondef(p.oid)
    into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'execute_authoritative_financial_import'
    and pg_get_function_identity_arguments(p.oid) = 'p_manifest_hash text, p_batch_key text, p_manifest_json text';
  if v_definition is null then raise exception 'FAIL: RPC signature missing'; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'execute_authoritative_financial_import' and p.prosecdef) then raise exception 'FAIL: RPC is not SECURITY DEFINER'; end if;
  if v_definition not like '%79aeef88bf7c1561c230d1aa9bdcda383ee8b351be6a8bf1fe795d682ea280e9%' then raise exception 'FAIL: authorized hash is not embedded'; end if;
  if v_definition not like '%v_row_count <> 79%' then raise exception 'FAIL: fixed row count is not enforced'; end if;
  if v_definition not like '%set search_path = pg_catalog, public, extensions%' then raise exception 'FAIL: search_path is not protected'; end if;

  if has_function_privilege('anon', 'public.execute_authoritative_financial_import(text,text,text)', 'EXECUTE') then raise exception 'FAIL: anon has EXECUTE'; end if;
  if exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.execute_authoritative_financial_import(text,text,text)'::regprocedure
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ) then raise exception 'FAIL: PUBLIC has EXECUTE'; end if;
  if not has_function_privilege('authenticated', 'public.execute_authoritative_financial_import(text,text,text)', 'EXECUTE') then raise exception 'FAIL: authenticated lacks EXECUTE'; end if;

  select count(*) into v_count from public.financial_import_batches where file_name = 'FIN-IMPORT-3::2026-02::79aeef88bf7c1561c230d1aa9bdcda383ee8b351be6a8bf1fe795d682ea280e9' and status = 'completed' and total_rows = 79 and valid_rows = 79 and imported_rows = 79 and column_mapping->>'manifest_hash' = '79aeef88bf7c1561c230d1aa9bdcda383ee8b351be6a8bf1fe795d682ea280e9';
  if v_count <> 1 then raise exception 'FAIL: accepted FIN-IMPORT-3 batch metadata mismatch'; end if;
  select count(*) into v_count from public.financial_import_rows r join public.financial_import_batches b on b.id = r.batch_id where b.file_name = 'FIN-IMPORT-3::2026-02::79aeef88bf7c1561c230d1aa9bdcda383ee8b351be6a8bf1fe795d682ea280e9' and r.status = 'imported' and r.transaction_id is not null;
  if v_count <> 79 then raise exception 'FAIL: accepted FIN-IMPORT-3 row count mismatch'; end if;
  select count(*) into v_count from public.financial_transactions where idempotency_key like 'FIN-IMPORT-3::2026-02::%';
  if v_count <> 79 then raise exception 'FAIL: accepted FIN-IMPORT-3 transaction count mismatch'; end if;
  select count(*) into v_count from public.financial_journal_entries where idempotency_key like 'FIN-IMPORT-3::2026-02::%::JOURNAL';
  if v_count <> 79 then raise exception 'FAIL: accepted FIN-IMPORT-3 journal count mismatch'; end if;

  select count(*) into v_count from public.financial_chart_accounts where code in ('4.4.01.002', '4.1.01.007') and active;
  if v_count <> 2 then raise exception 'FAIL: approved cost accounts are not active'; end if;
  select count(*) into v_count from public.financial_chart_accounts where code = '2.1.09.001' and active;
  if v_count <> 1 then raise exception 'FAIL: Criffer liability account missing'; end if;
  select count(*) into v_count from public.financial_chart_accounts where code = '1.2.99.001' and active;
  if v_count <> 1 then raise exception 'FAIL: Criffer historical asset missing'; end if;

  select coalesce(sum(jl.debit - jl.credit), 0)::numeric(15,2) into v_balance
  from public.financial_journal_lines jl join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
  where ca.code = '1.1.01.002';
  if v_balance <> 2070.12 then raise exception 'FAIL: Banco Cora balance is %', v_balance; end if;
  select coalesce(sum(jl.debit - jl.credit), 0)::numeric(15,2) into v_balance
  from public.financial_journal_lines jl join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
  where ca.code = '2.1.09.001';
  if v_balance <> 0 then raise exception 'FAIL: Criffer liability balance is %', v_balance; end if;
  select coalesce(sum(jl.debit - jl.credit), 0)::numeric(15,2) into v_balance
  from public.financial_journal_lines jl join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
  where ca.code = '1.2.99.001';
  if v_balance <> 566.84 then raise exception 'FAIL: Criffer asset balance is %', v_balance; end if;

  -- dre_effect=RECEITA means positive effect in the income statement. The
  -- detailed report still follows the chart account: row 38 is Other Results.
  if not exists (
    select 1 from public.financial_import_rows r
    join public.financial_import_batches b on b.id = r.batch_id
    where b.file_name = 'FIN-IMPORT-3::2026-02::79aeef88bf7c1561c230d1aa9bdcda383ee8b351be6a8bf1fe795d682ea280e9'
      and r.mapped_data->>'source_row' = '38'
      and r.mapped_data->>'dre_effect' = 'RECEITA'
      and r.mapped_data->>'credit_account_code' = '3.4.01.001'
  ) then raise exception 'FAIL: row 38 detailed DRE classification mismatch'; end if;

  begin
    perform public.execute_authoritative_financial_import('bad', 'bad', '{}');
    raise exception 'FAIL: unauthenticated call was accepted';
  exception when others then
    if sqlerrm not like '%autenticado Admin%' then raise; end if;
  end;

  if exists (select 1 from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a where n.nspname = 'public' and a.grantee = (select oid from pg_roles where rolname = 'anon') and a.privilege_type = 'CREATE') then raise exception 'FAIL: anon has CREATE on public'; end if;
  if exists (select 1 from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a where n.nspname = 'public' and a.grantee = (select oid from pg_roles where rolname = 'authenticated') and a.privilege_type = 'CREATE') then raise exception 'FAIL: authenticated has CREATE on public'; end if;
  if exists (select 1 from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a where n.nspname = 'public' and a.grantee = 0 and a.privilege_type = 'CREATE') then raise exception 'FAIL: PUBLIC has CREATE on public'; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'extensions' and p.proname = 'digest') then raise exception 'FAIL: pgcrypto digest is not in extensions'; end if;

  raise notice 'PASS: native FIN-IMPORT-3C acceptance assertions';
end
$$;

rollback;
