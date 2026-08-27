-- ============================================================================
-- MICROGATE 08A.1 — SQL Test Suite (30+ assertions)
-- Executes against Supabase DEV via `supabase db query --linked --file`
-- All tests run inside a transaction with ROLLBACK — zero side effects.
-- ============================================================================

BEGIN;

-- Helper: count assertions
CREATE TEMPORARY TABLE _test_results (
  test_id int,
  description text,
  passed boolean,
  detail text
);

-- ============================================================================
-- SEED COUNT TESTS
-- ============================================================================

-- Test 1: chart_accounts count = 98
INSERT INTO _test_results VALUES (1, 'chart_accounts count = 98',
  (SELECT count(*) = 98 FROM public.financial_chart_accounts), '');

-- Test 2: cost_centers count = 8
INSERT INTO _test_results VALUES (2, 'cost_centers count = 8',
  (SELECT count(*) = 8 FROM public.financial_cost_centers), '');

-- Test 3: service_lines count = 7
INSERT INTO _test_results VALUES (3, 'service_lines count = 7',
  (SELECT count(*) = 7 FROM public.financial_service_lines), '');

-- Test 4: categories count = 42
INSERT INTO _test_results VALUES (4, 'categories count = 42',
  (SELECT count(*) = 42 FROM public.financial_categories), '');

-- Test 5: payment_methods count = 8
INSERT INTO _test_results VALUES (5, 'payment_methods count = 8',
  (SELECT count(*) = 8 FROM public.financial_payment_methods), '');

-- Test 6: accounts = 0 (no seed)
INSERT INTO _test_results VALUES (6, 'financial_accounts = 0 (no seed)',
  (SELECT count(*) = 0 FROM public.financial_accounts), '');

-- Test 7: parties = 0 (no seed)
INSERT INTO _test_results VALUES (7, 'financial_parties = 0 (no seed)',
  (SELECT count(*) = 0 FROM public.financial_parties), '');

-- Test 8: period_locks = 0 (no seed)
INSERT INTO _test_results VALUES (8, 'financial_period_locks = 0 (no seed)',
  (SELECT count(*) = 0 FROM public.financial_period_locks), '');

-- ============================================================================
-- CLASS DISTRIBUTION TESTS
-- ============================================================================

-- Test 9: ATIVO count = 22
INSERT INTO _test_results VALUES (9, 'ATIVO class count = 22',
  (SELECT count(*) = 22 FROM public.financial_chart_accounts WHERE class = 'ATIVO'), '');

-- Test 10: PASSIVO count = 20
INSERT INTO _test_results VALUES (10, 'PASSIVO class count = 20',
  (SELECT count(*) = 20 FROM public.financial_chart_accounts WHERE class = 'PASSIVO'), '');

-- Test 11: PL count = 7
INSERT INTO _test_results VALUES (11, 'PL class count = 7',
  (SELECT count(*) = 7 FROM public.financial_chart_accounts WHERE class = 'PL'), '');

-- Test 12: RECEITA count = 11
INSERT INTO _test_results VALUES (12, 'RECEITA class count = 11',
  (SELECT count(*) = 11 FROM public.financial_chart_accounts WHERE class = 'RECEITA'), '');

-- Test 13: CUSTO count = 12
INSERT INTO _test_results VALUES (13, 'CUSTO class count = 12',
  (SELECT count(*) = 12 FROM public.financial_chart_accounts WHERE class = 'CUSTO'), '');

-- Test 14: DESPESA count = 26
INSERT INTO _test_results VALUES (14, 'DESPESA class count = 26',
  (SELECT count(*) = 26 FROM public.financial_chart_accounts WHERE class = 'DESPESA'), '');

-- ============================================================================
-- CATEGORY DISTRIBUTION TESTS
-- ============================================================================

-- Test 15: RECEITA categories = 6
INSERT INTO _test_results VALUES (15, 'RECEITA categories = 6',
  (SELECT count(*) = 6 FROM public.financial_categories WHERE movement_type = 'RECEITA'), '');

-- Test 16: DESPESA categories = 32
INSERT INTO _test_results VALUES (16, 'DESPESA categories = 32',
  (SELECT count(*) = 32 FROM public.financial_categories WHERE movement_type = 'DESPESA'), '');

-- Test 17: IMOBILIZADO categories = 4
INSERT INTO _test_results VALUES (17, 'IMOBILIZADO categories = 4',
  (SELECT count(*) = 4 FROM public.financial_categories WHERE movement_type = 'IMOBILIZADO'), '');

-- ============================================================================
-- CRITICAL ACCOUNTS PRESENCE
-- ============================================================================

-- Test 18: Cash accounts exist (is_cash = true)
INSERT INTO _test_results VALUES (18, 'Cash accounts (is_cash=true) >= 3',
  (SELECT count(*) >= 3 FROM public.financial_chart_accounts WHERE is_cash = true), '');

-- Test 19: Caixa Geral present
INSERT INTO _test_results VALUES (19, 'Caixa Geral (1.1.01.001) present',
  (SELECT count(*) = 1 FROM public.financial_chart_accounts WHERE code = '1.1.01.001'), '');

-- Test 20: Banco Cora present
INSERT INTO _test_results VALUES (20, 'Banco Cora (1.1.01.002) present',
  (SELECT count(*) = 1 FROM public.financial_chart_accounts WHERE code = '1.1.01.002'), '');

-- Test 21: Distribuicoes de Lucros present with presentation_sign = -1
INSERT INTO _test_results VALUES (21, 'Distribuicoes de Lucros (2.3.04.001) sign = -1',
  (SELECT count(*) = 1 FROM public.financial_chart_accounts WHERE code = '2.3.04.001' AND presentation_sign = -1), '');

-- Test 22: Receita de Assessoria present with dre_class = RECEITA_BRUTA
INSERT INTO _test_results VALUES (22, 'Receita Assessoria (3.1.01.001) dre_class = RECEITA_BRUTA',
  (SELECT count(*) = 1 FROM public.financial_chart_accounts WHERE code = '3.1.01.001' AND dre_class = 'RECEITA_BRUTA'), '');

-- Test 23: Depreciacao present with dfc_default = NAO_CAIXA
INSERT INTO _test_results VALUES (23, 'Depreciacao (5.8.01.001) dfc = NAO_CAIXA',
  (SELECT count(*) = 1 FROM public.financial_chart_accounts WHERE code = '5.8.01.001' AND dfc_default = 'NAO_CAIXA'), '');

-- Test 24: IRPJ/CSLL present with dre_class = IMPOSTO_RESULTADO
INSERT INTO _test_results VALUES (24, 'IRPJ/CSLL (7.1.01.001) dre_class = IMPOSTO_RESULTADO',
  (SELECT count(*) = 1 FROM public.financial_chart_accounts WHERE code = '7.1.01.001' AND dre_class = 'IMPOSTO_RESULTADO'), '');

-- ============================================================================
-- RLS TESTS
-- ============================================================================

-- Test 25: RLS enabled on all 8 financial tables
INSERT INTO _test_results VALUES (25, 'RLS enabled on all 8 financial tables',
  (SELECT count(*) = 8 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname LIKE 'financial_%' AND c.relkind = 'r'
   AND c.relrowsecurity = true), '');

-- Test 26: RLS forced on all 8 financial tables
INSERT INTO _test_results VALUES (26, 'RLS forced on all 8 financial tables',
  (SELECT count(*) = 8 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname LIKE 'financial_%' AND c.relkind = 'r'
   AND c.relrowsecurity = true AND c.relforcerowsecurity = true), '');

-- Test 27: No DELETE policies exist (soft delete via active flag)
INSERT INTO _test_results VALUES (27, 'No DELETE policies on financial tables',
  (SELECT count(*) = 0 FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'financial_%' AND cmd = 'DELETE'), '');

-- Test 28: period_locks INSERT policy requires admin
INSERT INTO _test_results VALUES (28, 'period_locks INSERT policy uses is_admin()',
  (SELECT count(*) = 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'financial_period_locks' AND cmd = 'INSERT' AND (with_check::text LIKE '%is_admin%')), '');

-- Test 29: period_locks UPDATE policy requires admin
INSERT INTO _test_results VALUES (29, 'period_locks UPDATE policy uses is_admin()',
  (SELECT count(*) = 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'financial_period_locks' AND cmd = 'UPDATE' AND qual::text LIKE '%is_admin%'), '');

-- Test 30: All other tables use is_internal_user() for SELECT
INSERT INTO _test_results VALUES (30, 'All non-lock tables use is_internal_user() for SELECT',
  (SELECT count(*) = 7 FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'financial_%' AND tablename != 'financial_period_locks' AND cmd = 'SELECT' AND qual::text LIKE '%is_internal_user%'), '');

-- ============================================================================
-- GRANTS TESTS
-- ============================================================================

-- Test 31: authenticated has SELECT, INSERT, UPDATE on all 8 tables (24 grants)
INSERT INTO _test_results VALUES (31, 'authenticated has SELECT/INSERT/UPDATE on 8 tables = 24 grants',
  (SELECT count(*) = 24 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name LIKE 'financial_%' AND grantee = 'authenticated'
   AND table_name NOT LIKE '%_v'), '');

-- Test 32: No grants to anon on financial tables
INSERT INTO _test_results VALUES (32, 'No grants to anon on financial tables',
  (SELECT count(*) = 0 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name LIKE 'financial_%' AND grantee = 'anon'), '');

-- Test 33: No grants to public on financial tables
INSERT INTO _test_results VALUES (33, 'No grants to public on financial tables',
  (SELECT count(*) = 0 FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name LIKE 'financial_%' AND grantee = 'public'), '');

-- ============================================================================
-- TRIGGERS TESTS
-- ============================================================================

-- Test 34: Audit trigger on all 8 tables
INSERT INTO _test_results VALUES (34, 'Audit trigger exists on all 8 financial tables',
  (SELECT count(DISTINCT event_object_table) = 8 FROM information_schema.triggers
   WHERE trigger_schema = 'public' AND event_object_table LIKE 'financial_%'
   AND trigger_name LIKE '%_audit'), '');

-- Test 35: Normalize trigger on chart_accounts
INSERT INTO _test_results VALUES (35, 'Normalize trigger on chart_accounts',
  (SELECT count(*) >= 1 FROM information_schema.triggers
   WHERE trigger_schema = 'public' AND event_object_table = 'financial_chart_accounts'
   AND trigger_name LIKE '%normalize%'), '');

-- Test 36: Protect trigger on chart_accounts (prevent delete if linked)
INSERT INTO _test_results VALUES (36, 'Protect trigger on chart_accounts',
  (SELECT count(*) >= 1 FROM information_schema.triggers
   WHERE trigger_schema = 'public' AND event_object_table = 'financial_chart_accounts'
   AND trigger_name LIKE '%protect%'), '');

-- Test 37: Validate cash trigger on financial_accounts
INSERT INTO _test_results VALUES (37, 'Validate cash trigger on financial_accounts',
  (SELECT count(*) >= 1 FROM information_schema.triggers
   WHERE trigger_schema = 'public' AND event_object_table = 'financial_accounts'
   AND trigger_name LIKE '%validate_cash%'), '');

-- ============================================================================
-- VIEWS TESTS
-- ============================================================================

-- Test 38: 3 views exist
INSERT INTO _test_results VALUES (38, '3 financial views exist',
  (SELECT count(*) = 3 FROM information_schema.views
   WHERE table_schema = 'public' AND table_name LIKE 'financial_%_v'), '');

-- Test 39: Views have security_invoker
INSERT INTO _test_results VALUES (39, 'Views have security_invoker = true',
  (SELECT count(*) = 3 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname LIKE 'financial_%_v'
   AND c.reloptions @> ARRAY['security_invoker=true']), '');

-- ============================================================================
-- UNIQUE CONSTRAINTS TESTS
-- ============================================================================

-- Test 40: chart_accounts code is unique
INSERT INTO _test_results VALUES (40, 'chart_accounts code is unique',
  (SELECT count(*) = 0 FROM (
    SELECT count(*) as cnt FROM public.financial_chart_accounts GROUP BY code HAVING count(*) > 1
  ) t), '');

-- Test 41: cost_centers name unique (active)
INSERT INTO _test_results VALUES (41, 'cost_centers active name is unique',
  (SELECT count(*) = 0 FROM (
    SELECT lower(name), count(*) as cnt FROM public.financial_cost_centers WHERE active = true GROUP BY lower(name) HAVING count(*) > 1
  ) t), '');

-- Test 42: payment_methods name unique (active)
INSERT INTO _test_results VALUES (42, 'payment_methods active name is unique',
  (SELECT count(*) = 0 FROM (
    SELECT lower(name), count(*) as cnt FROM public.financial_payment_methods WHERE active = true GROUP BY lower(name) HAVING count(*) > 1
  ) t), '');

-- Test 43: categories name unique (active)
INSERT INTO _test_results VALUES (43, 'categories active name is unique',
  (SELECT count(*) = 0 FROM (
    SELECT lower(name), count(*) as cnt FROM public.financial_categories WHERE active = true GROUP BY lower(name) HAVING count(*) > 1
  ) t), '');

-- ============================================================================
-- REFERENTIAL INTEGRITY TESTS
-- ============================================================================

-- Test 44: All categories have valid counter_account_id
INSERT INTO _test_results VALUES (44, 'All categories have valid counter_account_id',
  (SELECT count(*) = 0 FROM public.financial_categories c
   LEFT JOIN public.financial_chart_accounts ca ON ca.id = c.counter_account_id
   WHERE ca.id IS NULL), '');

-- Test 45: All categories have valid cost_center_id
INSERT INTO _test_results VALUES (45, 'All categories have valid cost_center_id',
  (SELECT count(*) = 0 FROM public.financial_categories c
   LEFT JOIN public.financial_cost_centers cc ON cc.id = c.cost_center_id
   WHERE c.cost_center_id IS NOT NULL AND cc.id IS NULL), '');

-- Test 46: All categories have valid service_line_id
INSERT INTO _test_results VALUES (46, 'All categories have valid service_line_id',
  (SELECT count(*) = 0 FROM public.financial_categories c
   LEFT JOIN public.financial_service_lines sl ON sl.id = c.service_line_id
   WHERE c.service_line_id IS NOT NULL AND sl.id IS NULL), '');

-- ============================================================================
-- ENUM VALIDATION TESTS
-- ============================================================================

-- Test 47: All presentation_sign values are -1 or 1
INSERT INTO _test_results VALUES (47, 'All presentation_sign values are -1 or 1',
  (SELECT count(*) = 0 FROM public.financial_chart_accounts
   WHERE presentation_sign NOT IN (-1, 1)), '');

-- Test 48: No chart_accounts with empty code
INSERT INTO _test_results VALUES (48, 'No chart_accounts with empty code',
  (SELECT count(*) = 0 FROM public.financial_chart_accounts
   WHERE code IS NULL OR trim(code) = ''), '');

-- Test 49: No chart_accounts with empty name
INSERT INTO _test_results VALUES (49, 'No chart_accounts with empty name',
  (SELECT count(*) = 0 FROM public.financial_chart_accounts
   WHERE name IS NULL OR length(trim(name)) < 2), '');

-- ============================================================================
-- NO FORBIDDEN OBJECTS TEST
-- ============================================================================

-- Test 50: No journal_entries / financial_transactions tables
INSERT INTO _test_results VALUES (50, 'No journal_entries/financial_transactions tables',
  (SELECT count(*) = 0 FROM information_schema.tables
   WHERE table_schema = 'public'
   AND (table_name LIKE '%journal%' OR table_name LIKE '%financial_transaction%')), '');

-- ============================================================================
-- RESULTS
-- ============================================================================

SELECT test_id, description, passed,
  CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END as result
FROM _test_results ORDER BY test_id;

-- Summary + failures combined
SELECT 'SUMMARY' as section, test_id, description, passed,
  CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END as result
FROM _test_results
UNION ALL
SELECT 'FAILED', test_id, description, passed, 'FAIL'
FROM _test_results WHERE NOT passed
ORDER BY section, test_id;

ROLLBACK;
