-- ============================================================================
-- FASE 2H.2 â€” Testes de seguranÃ§a: EXECUTE de helpers de trigger (A3) e
-- default privileges (A6). Transacional; ROLLBACK remove fixtures/extension.
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
select plan(27);

-- ===========================================================================
-- 1. ACL do helper prevent_supplier_code_change (A3)
--    PadrÃ£o esperado: somente postgres + service_role (igual Ã s irmÃ£s)
-- ===========================================================================

insert into pg_temp.tap_results (result)
select ok(has_function_privilege('postgres', 'public.prevent_supplier_code_change()', 'EXECUTE'), 'helper: postgres com EXECUTE');

insert into pg_temp.tap_results (result)
select ok(has_function_privilege('service_role', 'public.prevent_supplier_code_change()', 'EXECUTE'), 'helper: service_role com EXECUTE');

insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('anon', 'public.prevent_supplier_code_change()', 'EXECUTE'), 'helper: anon sem EXECUTE');

insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('authenticated', 'public.prevent_supplier_code_change()', 'EXECUTE'), 'helper: authenticated sem EXECUTE');

insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('public', 'public.prevent_supplier_code_change()', 'EXECUTE'), 'helper: PUBLIC sem EXECUTE');

insert into pg_temp.tap_results (result)
select is((select coalesce(proacl::text, '') from pg_proc where proname = 'prevent_supplier_code_change' and pronamespace = 'public'::regnamespace), '{postgres=X/postgres,service_role=X/postgres}', 'helper: ACL exata = {postgres, service_role}');

-- ===========================================================================
-- 2. As 5 funÃ§Ãµes da 2H.1 permanecem protegidas (anon sem EXECUTE)
-- ===========================================================================

insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('anon', 'public.create_asset(text, text, text, text, date, numeric, numeric, integer, date, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid)', 'EXECUTE'), '2h1: anon sem EXECUTE create_asset');

insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('anon', 'public.update_asset(uuid, text, text, text, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid)', 'EXECUTE'), '2h1: anon sem EXECUTE update_asset');

insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('anon', 'public.dispose_asset(uuid, text)', 'EXECUTE'), '2h1: anon sem EXECUTE dispose_asset');

insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('anon', 'public.post_asset_depreciation(uuid, date, numeric)', 'EXECUTE'), '2h1: anon sem EXECUTE post_asset_depreciation');

insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('anon', 'public.get_balance_sheet(date)', 'EXECUTE'), '2h1: anon sem EXECUTE get_balance_sheet');

-- ===========================================================================
-- 3. Grants authenticated das funÃ§Ãµes legÃ­timas preservados
-- ===========================================================================

insert into pg_temp.tap_results (result)
select ok(has_function_privilege('authenticated', 'public.create_asset(text, text, text, text, date, numeric, numeric, integer, date, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid)', 'EXECUTE'), 'authenticated: create_asset mantido');

insert into pg_temp.tap_results (result)
select ok(has_function_privilege('authenticated', 'public.update_asset(uuid, text, text, text, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid)', 'EXECUTE'), 'authenticated: update_asset mantido');

insert into pg_temp.tap_results (result)
select ok(has_function_privilege('authenticated', 'public.dispose_asset(uuid, text)', 'EXECUTE'), 'authenticated: dispose_asset mantido');

insert into pg_temp.tap_results (result)
select ok(has_function_privilege('authenticated', 'public.post_asset_depreciation(uuid, date, numeric)', 'EXECUTE'), 'authenticated: post_asset_depreciation mantido');

insert into pg_temp.tap_results (result)
select ok(has_function_privilege('authenticated', 'public.get_balance_sheet(date)', 'EXECUTE'), 'authenticated: get_balance_sheet mantido');

-- ===========================================================================
-- 4. InventÃ¡rio: nenhuma funÃ§Ã£o SECURITY DEFINER executÃ¡vel por anon/PUBLIC
-- ===========================================================================

insert into pg_temp.tap_results (result)
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')), 0, 'invariante: nenhuma security definer no public executavel por anon');

insert into pg_temp.tap_results (result)
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and has_function_privilege('public', p.oid, 'EXECUTE')), 0, 'invariante: nenhuma security definer no public executavel por PUBLIC');

-- ===========================================================================
-- 5. Nenhum helper de trigger sensÃ­vel executÃ¡vel diretamente por PUBLIC
-- ===========================================================================

insert into pg_temp.tap_results (result)
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and has_function_privilege('public', p.oid, 'EXECUTE') and exists (select 1 from pg_trigger t where t.tgfoid = p.oid)), 0, 'invariante: nenhum helper de trigger executavel por PUBLIC');

-- ===========================================================================
-- 6. Default privileges (A6): sem EXECUTE automÃ¡tico de anon para novas funÃ§Ãµes
-- ===========================================================================

insert into pg_temp.tap_results (result)
select is((select coalesce(d.defaclacl::text, '') from pg_default_acl d join pg_roles r on r.oid = d.defaclrole join pg_namespace n on n.oid = d.defaclnamespace where r.rolname = 'postgres' and n.nspname = 'public' and d.defaclobjtype = 'f'), '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}', 'default privileges: functions do public sem anon');

-- CriaÃ§Ã£o de funÃ§Ã£o em transaÃ§Ã£o (A6): a pipeline (postgres) nÃ£o gera EXECUTE anon
create function public.fn_2h2_probe_new() returns void language sql as 'select 1';

insert into pg_temp.tap_results (result)
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join lateral aclexplode(p.proacl) a where n.nspname = 'public' and p.proname = 'fn_2h2_probe_new' and a.grantee = (select oid from pg_roles where rolname = 'anon')), 0, 'funcao nova (pipeline): ACL literal sem entrada anon (A6)');

insert into pg_temp.tap_results (result)
select ok(has_function_privilege('public', 'public.fn_2h2_probe_new()', 'EXECUTE'), 'funcao nova (pipeline): PUBLIC EXECUTE intrinseco do PostgreSQL (documentado; protegido por REVOKE explicito nas funcoes privilegiadas)');

insert into pg_temp.tap_results (result)
select is((select true from information_schema.routines where routine_schema = 'public' and routine_name = 'fn_2h2_probe_new'), true, 'funcao nova criada no schema public');

insert into pg_temp.tap_results (result)
select lives_ok($sql$drop function public.fn_2h2_probe_new()$sql$, 'funcao nova removida ao final (sem objeto persistente)');

-- ===========================================================================
-- 7. CenÃ¡rio funcional: trigger continua bloqueando ediÃ§Ã£o do cÃ³digo FOR-*
-- ===========================================================================

insert into pg_temp.tap_results (result)
select lives_ok($sql$insert into public.suppliers (name, active) values ('2H2-SUPPLIER', true)$sql$, 'supplier: insercao permitida');

insert into pg_temp.tap_results (result)
select throws_ok($sql$update public.suppliers set code = 'FOR-999999' where name = '2H2-SUPPLIER'$sql$, 'O codigo do fornecedor nao pode ser alterado.', 'supplier: edicao do codigo FOR-* bloqueada pelo trigger');

insert into pg_temp.tap_results (result)
select lives_ok($sql$update public.suppliers set name = '2H2-SUPPLIER-RENAMED' where name = '2H2-SUPPLIER'$sql$, 'supplier: edicao de outros campos permitida');

-- ---------------------------------------------------------------------------
select result as tap_line from pg_temp.tap_results order by seq;

rollback;