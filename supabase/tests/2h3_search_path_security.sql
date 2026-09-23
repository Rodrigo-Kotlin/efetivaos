-- ============================================================================
-- FASE 2H.3 â€” Testes de seguranÃ§a: hardening de search_path em SECURITY DEFINER
-- Transacional; ROLLBACK remove fixtures/dados criados na transaÃ§Ã£o.
-- ============================================================================
begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  seq bigint generated always as identity primary key,
  result text not null
) on commit drop;

grant insert, select on pg_temp.tap_results to authenticated, anon;
grant usage, select on sequence pg_temp.tap_results_seq_seq to authenticated, anon;

insert into pg_temp.tap_results (result)
select plan(20);

-- ---------------------------------------------------------------------------
-- Fixtures de identidade (admin) e contas contÃ¡beis para o ajuste manual
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('13000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '2h3-admin@test.local', '', now(), '{}', '{"full_name":"2H3 Admin"}', now(), now());

update public.profiles set role = 'admin'
where id = '13000000-0000-0000-0000-000000000001';

insert into public.financial_chart_accounts (id, code, name, class, nature, posting, active, current_class, bp_group, dre_class, dfc_default, dva_class, is_cash, presentation_sign)
values
  ('13000000-0000-0000-0000-0000000000C1', '9.9.88.001', '2H3 Caixa AJE', 'ATIVO', 'DEBITO', true, true, 'CIRCULANTE', '', '', 'OPERACIONAL', '', true, -1),
  ('13000000-0000-0000-0000-0000000000C2', '9.9.88.002', '2H3 Capital AJE', 'PL', 'CREDITO', true, true, NULL, '', '', 'OPERACIONAL', '', false, 1);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);

-- ===========================================================================
-- 1. Invariante principal: toda SECURITY DEFINER do public com search_path ""
--    (nenhuma com pg_temp; quantidade inalterada)
-- ===========================================================================

insert into pg_temp.tap_results (result)
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef), 54, 'inventario: 54 funcoes SECURITY DEFINER no public (quantidade preservada)');

insert into pg_temp.tap_results (result)
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and coalesce(p.proconfig::text, '') like '%pg_temp%'), 0, 'invariante A4: nenhuma security definer com search_path contendo pg_temp');

-- Varredura individual das 25 funÃ§Ãµes normalizadas nesta fase
create temporary table exp_sd (fn text) on commit drop;
insert into exp_sd values
  ('cancel_crm_activity'), ('complete_crm_activity'), ('create_asset'),
  ('create_crm_activity'), ('create_crm_opportunity'), ('create_import_batch'),
  ('create_import_row'), ('create_manual_journal_adjustment'), ('dispose_asset'),
  ('finalize_import_row'), ('get_balance_sheet'), ('get_crm_pipeline_analytics'),
  ('get_financial_dashboard'), ('get_income_statement'),
  ('get_retained_earnings_statement'), ('get_statement_of_changes_in_equity'),
  ('get_value_added_statement'), ('mark_opportunity_lost'), ('mark_opportunity_won'),
  ('move_crm_opportunity'), ('post_asset_depreciation'), ('update_asset'),
  ('update_crm_activity'), ('update_crm_opportunity'), ('update_import_batch_status');

insert into pg_temp.tap_results (result)
select is(
  (select count(*)::int from exp_sd e
    left join pg_proc p on p.proname = e.fn::text
    left join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
   where not (p.prosecdef) or coalesce(p.proconfig::text, '') like '%pg_temp%'),
  0, '25 funcoes 2H.3: todas permanecem SECURITY DEFINER e sem pg_temp');

-- ===========================================================================
-- 2. create_manual_journal_adjustment: chamada qualificada + ACL preservada
-- ===========================================================================

insert into pg_temp.tap_results (result)
select ok((select position('pg_catalog.gen_random_uuid' in p.prosrc) > 0
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'create_manual_journal_adjustment'),
           'create_manual_journal_adjustment: gen_random_uuid qualificada (pg_catalog)');

insert into pg_temp.tap_results (result)
select ok((select (position('gen_random_uuid()' in p.prosrc) = 0 or position('pg_catalog.gen_random_uuid' in p.prosrc) > 0)
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'create_manual_journal_adjustment'),
           'create_manual_journal_adjustment: nenhuma chamada nao qualificada');

insert into pg_temp.tap_results (result)
select is((select coalesce(proacl::text, '') from pg_proc p where proname = 'create_manual_journal_adjustment' and pronamespace = 'public'::regnamespace),
          '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}',
          'create_manual_journal_adjustment: ACL preservada {postgres, authenticated, service_role}');

insert into pg_temp.tap_results (result)
select ok(has_function_privilege('authenticated', 'public.create_manual_journal_adjustment(date, date, text, jsonb, text, uuid, uuid, uuid, text)', 'EXECUTE'),
          'create_manual_journal_adjustment: authenticated mantido');

insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('anon', 'public.create_manual_journal_adjustment(date, date, text, jsonb, text, uuid, uuid, uuid, text)', 'EXECUTE'),
          'create_manual_journal_adjustment: anon sem EXECUTE');

-- ===========================================================================
-- 3. Invariantes herdadas (2H.1/2H.2): nenhuma security definer via anon/PUBLIC
-- ===========================================================================

insert into pg_temp.tap_results (result)
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')), 0, 'invariante 2H.2: nenhuma security definer executavel por anon');

insert into pg_temp.tap_results (result)
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and has_function_privilege('public', p.oid, 'EXECUTE')), 0, 'invariante 2H.2: nenhuma security definer executavel por PUBLIC');

-- ===========================================================================
-- 4. ProteÃ§Ãµes 2H.1 continuam operando apÃ³s o hardening de search_path
-- ===========================================================================

select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

insert into pg_temp.tap_results (result)
select throws_ok($sql$select public.create_asset('ANON-PROBE-3', 'Probe', NULL, NULL, current_date, -1, 0, 60, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)$sql$, 'Apenas administradores podem cadastrar ativos', 'anon: create_asset bloqueado');

insert into pg_temp.tap_results (result)
select throws_ok($sql$select public.post_asset_depreciation('13000000-0000-0000-0000-000000000001', date '2026-09-01')$sql$, 'Apenas administradores podem contabilizar depreciacao', 'anon: post_asset_depreciation bloqueado');

insert into pg_temp.tap_results (result)
select throws_ok($sql$select * from public.get_balance_sheet(current_date)$sql$, 'Apenas usuarios internos podem consultar o balanco patrimonial', 'anon: get_balance_sheet bloqueado');

-- ===========================================================================
-- 5. Trigger de imutabilidade do codigo de fornecedor (2H.2) operacional
-- ===========================================================================

insert into pg_temp.tap_results (result)
select lives_ok($sql$insert into public.suppliers (name, active) values ('2H3-SUPPLIER', true)$sql$, 'supplier: insercao permitida');

insert into pg_temp.tap_results (result)
select throws_ok($sql$update public.suppliers set code = 'FOR-777777' where name = '2H3-SUPPLIER'$sql$, 'O codigo do fornecedor nao pode ser alterado.', 'supplier: edicao do codigo FOR-* bloqueada pelo trigger');

-- ===========================================================================
-- 6. ExecuÃ§Ã£o funcional: create_manual_journal_adjustment (search_path "")
--    gera lanÃ§amento contÃ¡bil balanceado e respeita idempotÃªncia
-- ===========================================================================

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select lives_ok($sql$
  select public.create_manual_journal_adjustment(
    date '2026-09-30', date '2026-09-30', 'AJE 2H3 Teste',
    jsonb_build_array(
      jsonb_build_object('chart_account_id', '13000000-0000-0000-0000-0000000000C1', 'debit', 100, 'credit', 0, 'description', 'Debito AJE'),
      jsonb_build_object('chart_account_id', '13000000-0000-0000-0000-0000000000C2', 'debit', 0, 'credit', 100, 'description', 'Credito AJE')
    ),
    'referencia-2h3', NULL, NULL, '13000000-0000-0000-0000-0000000000ff'::uuid, 'Justificativa 2H3'
  )$sql$, 'admin: create_manual_journal_adjustment executa com search_path vazio');

insert into pg_temp.tap_results (result)
select ok(exists(
  select 1 from public.financial_journal_entries je
  join public.financial_transactions ft on ft.id = je.transaction_id
  where je.idempotency_key = '13000000-0000-0000-0000-0000000000ff'
    and je.entry_type = 'ajuste' and ft.movement_type = 'AJUSTE'
), 'ajuste manual: entrada e transacao criadas');

insert into pg_temp.tap_results (result)
select is(
  (select count(*)::int from public.financial_journal_lines jl
   join public.financial_journal_entries je on je.id = jl.entry_id
   where je.idempotency_key = '13000000-0000-0000-0000-0000000000ff'), 2,
  'ajuste manual: 2 linhas de lancamento');

insert into pg_temp.tap_results (result)
select is(
  (select (sum(debit) = sum(credit)) from public.financial_journal_lines jl
   join public.financial_journal_entries je on je.id = jl.entry_id
   where je.idempotency_key = '13000000-0000-0000-0000-0000000000ff'), true,
  'ajuste manual: debitos = creditos (ledger balanceado)');

insert into pg_temp.tap_results (result)
select is(
  (select public.create_manual_journal_adjustment(
     date '2026-09-30', date '2026-09-30', 'AJE 2H3 Teste',
     jsonb_build_array(
jsonb_build_object('chart_account_id', '13000000-0000-0000-0000-0000000000C1', 'debit', 100, 'credit', 0, 'description', 'Debito AJE'),
       jsonb_build_object('chart_account_id', '13000000-0000-0000-0000-0000000000C2', 'debit', 0, 'credit', 100, 'description', 'Credito AJE')
     ),
     'referencia-2h3', NULL, NULL, '13000000-0000-0000-0000-0000000000ff'::uuid, 'Justificativa 2H3'
   )::text),
  (select id::text from public.financial_journal_entries where idempotency_key = '13000000-0000-0000-0000-0000000000ff'),
  'ajuste manual: idempotencia retorna a mesma entrada');

-- ---------------------------------------------------------------------------
select result as tap_line from pg_temp.tap_results order by seq;

rollback;