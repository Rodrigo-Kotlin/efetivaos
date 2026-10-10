-- Gate 2.1: focused fail-closed authorization checks.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE TEMPORARY TABLE tap_results (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  result text NOT NULL
) ON COMMIT DROP;

GRANT INSERT, SELECT ON pg_temp.tap_results TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE pg_temp.tap_results_seq_seq TO authenticated, anon;

INSERT INTO pg_temp.tap_results (result) SELECT plan(16);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('a2100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gate21-admin@test.local', '', now(), '{}', '{}', now(), now()),
  ('a2100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gate21-equipe@test.local', '', now(), '{}', '{}', now(), now());

UPDATE public.profiles SET role = 'admin' WHERE id = 'a2100000-0000-0000-0000-000000000001';
UPDATE public.profiles SET role = 'equipe' WHERE id = 'a2100000-0000-0000-0000-000000000002';

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  (SELECT count(*) = 3 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef
     AND p.proname IN ('get_income_statement', 'get_financial_dashboard', 'create_manual_journal_adjustment')),
  'all three RPCs remain SECURITY DEFINER'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  (SELECT count(*) = 3 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('get_income_statement', 'get_financial_dashboard', 'create_manual_journal_adjustment')
      AND p.proconfig @> ARRAY['search_path=""']),
  'all three RPCs keep an empty search_path'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  not has_function_privilege('anon', 'public.get_income_statement(date,date,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_financial_dashboard(date,date,date,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.create_manual_journal_adjustment(date,date,text,jsonb,text,uuid,uuid,uuid,text)', 'EXECUTE'),
  'anon has no EXECUTE on the three RPCs'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  not has_function_privilege('public', 'public.get_income_statement(date,date,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('public', 'public.get_financial_dashboard(date,date,date,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('public', 'public.create_manual_journal_adjustment(date,date,text,jsonb,text,uuid,uuid,uuid,text)', 'EXECUTE'),
  'PUBLIC has no EXECUTE on the three RPCs'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  has_function_privilege('authenticated', 'public.get_income_statement(date,date,uuid,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_financial_dashboard(date,date,date,uuid,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.create_manual_journal_adjustment(date,date,text,jsonb,text,uuid,uuid,uuid,text)', 'EXECUTE'),
  'authenticated keeps EXECUTE on the three RPCs'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO pg_temp.tap_results (result)
SELECT throws_ok($$SELECT * FROM public.get_income_statement(NULL, NULL, NULL, NULL)$$, 'Acesso negado: usuario nao autenticado.', 'DRE rejects NULL auth.uid()');
INSERT INTO pg_temp.tap_results (result)
SELECT throws_ok($$SELECT public.get_financial_dashboard(NULL, NULL, NULL, NULL, NULL)$$, 'Acesso negado: usuario nao autenticado.', 'dashboard rejects NULL auth.uid()');
INSERT INTO pg_temp.tap_results (result)
SELECT throws_ok($$SELECT public.create_manual_journal_adjustment(current_date, current_date, 'gate21', '[]'::jsonb)$$, 'Apenas administradores podem criar ajustes contabeis', 'manual adjustment rejects NULL auth.uid()');

SELECT set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000099', true);

INSERT INTO pg_temp.tap_results (result)
SELECT throws_ok($$SELECT * FROM public.get_income_statement(NULL, NULL, NULL, NULL)$$, 'Acesso negado: usuario inativo ou sem permissao.', 'DRE rejects missing profile');
INSERT INTO pg_temp.tap_results (result)
SELECT throws_ok($$SELECT public.get_financial_dashboard(NULL, NULL, NULL, NULL, NULL)$$, 'Apenas usuarios internos podem acessar o dashboard financeiro', 'dashboard rejects missing profile');
INSERT INTO pg_temp.tap_results (result)
SELECT throws_ok($$SELECT public.create_manual_journal_adjustment(current_date, current_date, 'gate21', '[]'::jsonb)$$, 'Apenas administradores podem criar ajustes contabeis', 'manual adjustment rejects non-admin');

SELECT set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000001', true);

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT count(*) FROM public.get_income_statement(NULL, NULL, NULL, NULL)), 14::bigint, 'authorized admin reads the DRE');
INSERT INTO pg_temp.tap_results (result)
SELECT ok(public.get_financial_dashboard(NULL, NULL, NULL, NULL, NULL) IS NOT NULL, 'authorized admin reads the dashboard');
INSERT INTO pg_temp.tap_results (result)
SELECT throws_ok($$SELECT public.create_manual_journal_adjustment(current_date, current_date, 'gate21', '[]'::jsonb)$$, 'Ajuste deve ter pelo menos 2 linhas', 'authorized admin reaches manual adjustment validation');

SELECT set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000002', true);

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT count(*) FROM public.get_income_statement(NULL, NULL, NULL, NULL)), 14::bigint, 'authorized equipe reads the DRE');
INSERT INTO pg_temp.tap_results (result)
SELECT ok(public.get_financial_dashboard(NULL, NULL, NULL, NULL, NULL) IS NOT NULL, 'authorized equipe reads the dashboard');

SET LOCAL ROLE postgres;
SELECT result AS tap_line FROM pg_temp.tap_results ORDER BY seq;

ROLLBACK;
