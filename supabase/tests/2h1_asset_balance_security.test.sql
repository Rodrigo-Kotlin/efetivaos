-- ============================================================================
-- FASE 2H.1 — Testes de segurança: ativos (A1) e Balanço Patrimonial (A2)
-- Transacional; ROLLBACK no final remove fixtures/extension/dados.
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
select plan(26);

-- ---------------------------------------------------------------------------
-- Fixtures de identidade (auth.users > profiles; admin + equipe)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '2h1-admin@test.local', '', now(), '{}', '{"full_name":"2H1 Admin"}', now(), now()),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '2h1-equipe@test.local', '', now(), '{}', '{"full_name":"2H1 Equipe"}', now(), now());

update public.profiles set role = 'admin'
where id = '90000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);

-- Fixtures de contas contábeis (para depreciação)
insert into public.financial_chart_accounts (id, code, name, class, nature, posting, active, current_class, bp_group, dre_class, dfc_default, dva_class, is_cash, presentation_sign)
values
  ('90000000-0000-0000-0000-0000000000C1', '9.9.77.001', '2H1 Deprec Acumulada', 'ATIVO', 'DEBITO', true, true, NULL, '', '', 'OPERACIONAL', '', false, 1),
  ('90000000-0000-0000-0000-0000000000C2', '9.9.77.002', '2H1 Despesa Deprec', 'DESPESA', 'DEBITO', true, true, NULL, '', '', 'OPERACIONAL', '', false, 1);

-- Fixtures de ativos
insert into public.financial_assets (id, asset_code, name, acquisition_date, acquisition_value, residual_value, useful_life_months, depreciation_start_date, status, active)
values
  ('90000000-0000-0000-0000-000000000010', '2H1-UPD', '2H1 Update', current_date, 1000, 100, 60, current_date, 'ACTIVE', true),
  ('90000000-0000-0000-0000-000000000011', '2H1-DIS', '2H1 Dispose', current_date, 1000, 100, 60, current_date, 'ACTIVE', true),
  ('90000000-0000-0000-0000-000000000012', '2H1-DPR', '2H1 Deprec', current_date, 12000, 0, 60, current_date, 'ACTIVE', true);

update public.financial_assets
set accumulated_depreciation_account_id = '90000000-0000-0000-0000-0000000000C1',
    depreciation_expense_account_id = '90000000-0000-0000-0000-0000000000C2'
where id = '90000000-0000-0000-0000-000000000012';

-- ---------------------------------------------------------------------------
-- 1. Permissões efetivas: anon SEM EXECUTE nas cinco funções
-- ---------------------------------------------------------------------------
insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('anon', 'public.create_asset(text, text, text, text, date, numeric, numeric, integer, date, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid)', 'EXECUTE'), 'anon sem EXECUTE create_asset');

insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('anon', 'public.update_asset(uuid, text, text, text, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid)', 'EXECUTE'), 'anon sem EXECUTE update_asset');

insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('anon', 'public.dispose_asset(uuid, text)', 'EXECUTE'), 'anon sem EXECUTE dispose_asset');

insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('anon', 'public.post_asset_depreciation(uuid, date, numeric)', 'EXECUTE'), 'anon sem EXECUTE post_asset_depreciation');

insert into pg_temp.tap_results (result)
select ok(not has_function_privilege('anon', 'public.get_balance_sheet(date)', 'EXECUTE'), 'anon sem EXECUTE get_balance_sheet');

-- ---------------------------------------------------------------------------
-- 2. Cenário anon (sem sessão): guards administrativos/litos bloqueiam
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

insert into pg_temp.tap_results (result)
select throws_ok($sql$select public.create_asset('ANON-PROBE', 'Probe', NULL, NULL, current_date, -1, 0, 60, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)$sql$, 'Apenas administradores podem cadastrar ativos', 'anon: create_asset bloqueado');

insert into pg_temp.tap_results (result)
select throws_ok($sql$select public.update_asset('90000000-0000-0000-0000-000000000010', 'Alterado')$sql$, 'Apenas administradores podem alterar ativos', 'anon: update_asset bloqueado');

insert into pg_temp.tap_results (result)
select throws_ok($sql$select public.dispose_asset('90000000-0000-0000-0000-000000000011')$sql$, 'Apenas administradores podem dar baixa em ativos', 'anon: dispose_asset bloqueado');

insert into pg_temp.tap_results (result)
select throws_ok($sql$select public.post_asset_depreciation('90000000-0000-0000-0000-000000000012', date '2026-09-01')$sql$, 'Apenas administradores podem contabilizar depreciacao', 'anon: post_asset_depreciation bloqueado');

insert into pg_temp.tap_results (result)
select throws_ok($sql$select * from public.get_balance_sheet(current_date)$sql$, 'Apenas usuarios internos podem consultar o balanco patrimonial', 'anon: get_balance_sheet bloqueado');

-- ---------------------------------------------------------------------------
-- 3. Authenticated sem autorização (Equipe): não executa operações admin
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select throws_ok($sql$select public.create_asset('EQ-PROBE', 'Probe', NULL, NULL, current_date, -1, 0, 60, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)$sql$, 'Apenas administradores podem cadastrar ativos', 'equipe: create_asset bloqueado');

insert into pg_temp.tap_results (result)
select throws_ok($sql$select public.update_asset('90000000-0000-0000-0000-000000000010', 'Alterado EQ')$sql$, 'Apenas administradores podem alterar ativos', 'equipe: update_asset bloqueado');

insert into pg_temp.tap_results (result)
select throws_ok($sql$select public.dispose_asset('90000000-0000-0000-0000-000000000011')$sql$, 'Apenas administradores podem dar baixa em ativos', 'equipe: dispose_asset bloqueado');

insert into pg_temp.tap_results (result)
select throws_ok($sql$select public.post_asset_depreciation('90000000-0000-0000-0000-000000000012', date '2026-09-01')$sql$, 'Apenas administradores podem contabilizar depreciacao', 'equipe: post_asset_depreciation bloqueado');

-- ---------------------------------------------------------------------------
-- 4. Operações administrativas legítimas (Admin)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select lives_ok($sql$select public.create_asset('2H1-ADMIN', 'Ativo Admin', NULL, 'TESTE', current_date, 1000, 100, 60, current_date, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)$sql$, 'admin: create_asset executa');

insert into pg_temp.tap_results (result)
select ok(exists(select 1 from public.financial_assets where asset_code = '2H1-ADMIN'), 'admin: ativo efetivamente criado');

insert into pg_temp.tap_results (result)
select lives_ok($sql$select public.update_asset('90000000-0000-0000-0000-000000000010', 'Nome Atualizado')$sql$, 'admin: update_asset executa');

insert into pg_temp.tap_results (result)
select ok(exists(select 1 from public.financial_assets where id = '90000000-0000-0000-0000-000000000010' and name = 'Nome Atualizado'), 'admin: update_asset persistido');

insert into pg_temp.tap_results (result)
select lives_ok($sql$select public.dispose_asset('90000000-0000-0000-0000-000000000011')$sql$, 'admin: dispose_asset executa');

insert into pg_temp.tap_results (result)
select ok((select status = 'DISPOSED' from public.financial_assets where id = '90000000-0000-0000-0000-000000000011'), 'admin: dispose_asset refletido');

insert into pg_temp.tap_results (result)
select lives_ok($sql$select public.post_asset_depreciation('90000000-0000-0000-0000-000000000012', date '2026-09-01')$sql$, 'admin: post_asset_depreciation executa');

insert into pg_temp.tap_results (result)
select ok(exists(select 1 from public.financial_asset_depreciation_postings where asset_id = '90000000-0000-0000-0000-000000000012' and status = 'POSTED'), 'admin: depreciacao registrada');

-- ---------------------------------------------------------------------------
-- 5. Consulta interna do Balanço (Admin e Equipe são usuários internos)
-- ---------------------------------------------------------------------------
insert into pg_temp.tap_results (result)
select lives_ok($sql$select * from public.get_balance_sheet(current_date)$sql$, 'admin: get_balance_sheet consulta');

select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select lives_ok($sql$select * from public.get_balance_sheet(current_date)$sql$, 'equipe (interno): get_balance_sheet consulta');

-- ---------------------------------------------------------------------------
-- 6. Caso-base: sem sessão, helpers negam (guard NULL-safe)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

insert into pg_temp.tap_results (result)
select is(public.is_admin(), false, 'sem sessao: is_admin() = false');

insert into pg_temp.tap_results (result)
select is(public.is_internal_user(), false, 'sem sessao: is_internal_user() = false');

-- ---------------------------------------------------------------------------
select result as tap_line from pg_temp.tap_results order by seq;

rollback;