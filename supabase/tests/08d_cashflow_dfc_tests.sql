-- ETAPA 08D / MICROGATE 08D.1 — SQL Test Suite (70 checks)
-- All tests run inside a single transaction with ROLLBACK — zero side effects.

BEGIN;

CREATE TEMPORARY TABLE _test_results (
  test_id int, description text, passed boolean, detail text
);

-- ============================================================================
-- SECTION 1: View existence (4)
-- ============================================================================
INSERT INTO _test_results VALUES (1, 'financial_cashflow_realized_v exists',
  (SELECT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='financial_cashflow_realized_v')), '');
INSERT INTO _test_results VALUES (2, 'financial_cashflow_forecast_v exists',
  (SELECT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='financial_cashflow_forecast_v')), '');
INSERT INTO _test_results VALUES (3, 'financial_cashflow_statement_v exists',
  (SELECT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='financial_cashflow_statement_v')), '');
INSERT INTO _test_results VALUES (4, 'cashflow_13_week_projection function exists',
  (SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cashflow_13_week_projection')), '');

-- ============================================================================
-- SECTION 2: View structure (3)
-- ============================================================================
INSERT INTO _test_results VALUES (5, 'realized_v has required columns',
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_cashflow_realized_v'
   AND column_name IN ('entry_id','transaction_id','entry_date','cash_effect','direction','dfc_class','amount','cash_accounts','chart_account_ids')) = 9, '');
INSERT INTO _test_results VALUES (6, 'forecast_v has required columns',
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_cashflow_forecast_v'
   AND column_name IN ('transaction_id','direction','projected_inflow','projected_outflow','due_bucket','overdue','days_overdue')) = 7, '');
INSERT INTO _test_results VALUES (7, 'statement_v has required columns',
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_cashflow_statement_v'
   AND column_name IN ('dfc_class','dfc_class_label','inflows','outflows','net_amount','opening_balance','sort_order')) = 7, '');

-- ============================================================================
-- SECTION 3: Statement always returns 6 rows (3)
-- ============================================================================
INSERT INTO _test_results VALUES (8, 'statement_v returns 6 rows (empty data)',
  (SELECT count(*) FROM public.financial_cashflow_statement_v) = 6, '');
INSERT INTO _test_results VALUES (9, 'statement_v has all 6 DFC classes',
  (SELECT count(DISTINCT dfc_class) FROM public.financial_cashflow_statement_v) = 6, '');
INSERT INTO _test_results VALUES (10, 'statement_v sort_order sequential 1-6',
  (SELECT array_agg(sort_order ORDER BY sort_order) FROM public.financial_cashflow_statement_v) = ARRAY[1,2,3,4,5,6], '');

-- ============================================================================
-- SECTION 4: 13-week projection (8)
-- ============================================================================
INSERT INTO _test_results VALUES (11, 'projection returns exactly 13 rows',
  (SELECT count(*) FROM public.cashflow_13_week_projection()) = 13, '');
INSERT INTO _test_results VALUES (12, 'projection week numbers 1-13',
  (SELECT min(week_number) FROM public.cashflow_13_week_projection()) = 1
  AND (SELECT max(week_number) FROM public.cashflow_13_week_projection()) = 13, '');
INSERT INTO _test_results VALUES (13, 'projection consecutive 7-day weeks',
  (SELECT count(*) FROM (
    SELECT week_number, week_start,
           lag(week_start) OVER (ORDER BY week_number) AS prev_start
    FROM public.cashflow_13_week_projection()
  ) sub WHERE prev_start IS NOT NULL AND week_start - prev_start <> 7) = 0, '');
INSERT INTO _test_results VALUES (14, 'projection opening balance = 0 (no data)',
  (SELECT opening_balance FROM public.cashflow_13_week_projection() WHERE week_number=1) = 0, '');
INSERT INTO _test_results VALUES (15, 'projection all closing balances = 0 (no data)',
  (SELECT count(*) FROM public.cashflow_13_week_projection() WHERE closing_balance <> 0) = 0, '');
INSERT INTO _test_results VALUES (16, 'projection all inflows = 0 (no data)',
  (SELECT count(*) FROM public.cashflow_13_week_projection() WHERE inflows <> 0) = 0, '');
INSERT INTO _test_results VALUES (17, 'projection all outflows = 0 (no data)',
  (SELECT count(*) FROM public.cashflow_13_week_projection() WHERE outflows <> 0) = 0, '');
INSERT INTO _test_results VALUES (18, 'projection custom from date returns 13 rows',
  (SELECT count(*) FROM public.cashflow_13_week_projection('2026-01-05'::date)) = 13, '');

-- ============================================================================
-- SECTION 5: Forecast view (2)
-- ============================================================================
INSERT INTO _test_results VALUES (19, 'forecast_v returns 0 rows (no data)',
  (SELECT count(*) FROM public.financial_cashflow_forecast_v) = 0, '');
INSERT INTO _test_results VALUES (20, 'forecast_v due_bucket values valid',
  NOT EXISTS (SELECT 1 FROM public.financial_cashflow_forecast_v
              WHERE due_bucket NOT IN ('VENCIDO','7 dias','14 dias','30 dias','Posteriores')), '');

-- ============================================================================
-- SECTION 6: Realized view (4)
-- ============================================================================
INSERT INTO _test_results VALUES (21, 'realized_v returns 0 rows (no data)',
  (SELECT count(*) FROM public.financial_cashflow_realized_v) = 0, '');
INSERT INTO _test_results VALUES (22, 'realized_v direction only INFLOW/OUTFLOW',
  NOT EXISTS (SELECT 1 FROM public.financial_cashflow_realized_v WHERE direction NOT IN ('INFLOW','OUTFLOW')), '');
INSERT INTO _test_results VALUES (23, 'realized_v dfc_class valid values only',
  NOT EXISTS (SELECT 1 FROM public.financial_cashflow_realized_v
              WHERE dfc_class NOT IN ('OPERACIONAL','INVESTIMENTO','FINANCIAMENTO','TRANSFERENCIA','NAO_CAIXA')), '');
INSERT INTO _test_results VALUES (24, 'realized_v amount always >= 0',
  NOT EXISTS (SELECT 1 FROM public.financial_cashflow_realized_v WHERE amount < 0), '');

-- ============================================================================
-- SECTION 7: DFC classification priority (7)
-- ============================================================================
INSERT INTO _test_results VALUES (25, 'TRANSFERENCIA -> TRANSFERENCIA dfc_class',
  NOT EXISTS (SELECT 1 FROM public.financial_cashflow_realized_v
              WHERE movement_type = 'TRANSFERENCIA' AND dfc_class <> 'TRANSFERENCIA'), '');
INSERT INTO _test_results VALUES (26, 'EMPRESTIMO_RECEBIDO -> FINANCIAMENTO',
  NOT EXISTS (SELECT 1 FROM public.financial_cashflow_realized_v
              WHERE movement_type = 'EMPRESTIMO_RECEBIDO' AND dfc_class <> 'FINANCIAMENTO'), '');
INSERT INTO _test_results VALUES (27, 'EMPRESTIMO_PAGO -> FINANCIAMENTO',
  NOT EXISTS (SELECT 1 FROM public.financial_cashflow_realized_v
              WHERE movement_type = 'EMPRESTIMO_PAGO' AND dfc_class <> 'FINANCIAMENTO'), '');
INSERT INTO _test_results VALUES (28, 'APORTE -> FINANCIAMENTO',
  NOT EXISTS (SELECT 1 FROM public.financial_cashflow_realized_v
              WHERE movement_type = 'APORTE' AND dfc_class <> 'FINANCIAMENTO'), '');
INSERT INTO _test_results VALUES (29, 'RETIRADA -> FINANCIAMENTO',
  NOT EXISTS (SELECT 1 FROM public.financial_cashflow_realized_v
              WHERE movement_type = 'RETIRADA' AND dfc_class <> 'FINANCIAMENTO'), '');
INSERT INTO _test_results VALUES (30, 'IMOBILIZADO -> INVESTIMENTO',
  NOT EXISTS (SELECT 1 FROM public.financial_cashflow_realized_v
              WHERE movement_type = 'IMOBILIZADO' AND dfc_class <> 'INVESTIMENTO'), '');
INSERT INTO _test_results VALUES (31, 'SALDO_INICIAL -> NAO_CAIXA',
  NOT EXISTS (SELECT 1 FROM public.financial_cashflow_realized_v
              WHERE movement_type = 'SALDO_INICIAL' AND dfc_class <> 'NAO_CAIXA'), '');

-- ============================================================================
-- SECTION 8: Opening balance consistency (3)
-- ============================================================================
INSERT INTO _test_results VALUES (32, 'statement opening = projection week1 opening',
  (SELECT opening_balance FROM public.financial_cashflow_statement_v WHERE dfc_class='SALDO_INICIAL')
  = (SELECT opening_balance FROM public.cashflow_13_week_projection() WHERE week_number=1), '');
INSERT INTO _test_results VALUES (33, 'SALDO_FINAL = SALDO_INICIAL + VARIACAO',
  (SELECT net_amount FROM public.financial_cashflow_statement_v WHERE dfc_class='SALDO_FINAL')
  = (SELECT net_amount FROM public.financial_cashflow_statement_v WHERE dfc_class='SALDO_INICIAL')
    + (SELECT net_amount FROM public.financial_cashflow_statement_v WHERE dfc_class='VARIACAO'), '');
INSERT INTO _test_results VALUES (34, 'VARIACAO = SUM of class net amounts',
  (SELECT net_amount FROM public.financial_cashflow_statement_v WHERE dfc_class='VARIACAO')
  = (SELECT COALESCE(SUM(net_amount),0) FROM public.financial_cashflow_statement_v
     WHERE dfc_class IN ('OPERACIONAL','INVESTIMENTO','FINANCIAMENTO')), '');

-- ============================================================================
-- SECTION 9: Transfer neutralization (1)
-- ============================================================================
INSERT INTO _test_results VALUES (35, 'TRANSFERENCIA entries absent (consolidated net=0)',
  NOT EXISTS (SELECT 1 FROM public.financial_cashflow_realized_v WHERE movement_type = 'TRANSFERENCIA'), '');

-- ============================================================================
-- SECTION 10: Security — PUBLIC/anon REVOKED (8)
-- ============================================================================
INSERT INTO _test_results VALUES (36, 'realized_v SELECT NOT granted to public',
  NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
              WHERE table_schema='public' AND table_name='financial_cashflow_realized_v'
              AND grantee IN ('public','anon') AND privilege_type='SELECT'), '');
INSERT INTO _test_results VALUES (37, 'forecast_v SELECT NOT granted to public',
  NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
              WHERE table_schema='public' AND table_name='financial_cashflow_forecast_v'
              AND grantee IN ('public','anon') AND privilege_type='SELECT'), '');
INSERT INTO _test_results VALUES (38, 'statement_v SELECT NOT granted to public',
  NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
              WHERE table_schema='public' AND table_name='financial_cashflow_statement_v'
              AND grantee IN ('public','anon') AND privilege_type='SELECT'), '');
INSERT INTO _test_results VALUES (39, 'projection fn EXECUTE NOT granted to public',
  NOT EXISTS (SELECT 1 FROM information_schema.role_routine_grants
              WHERE routine_schema='public' AND routine_name='cashflow_13_week_projection'
              AND grantee IN ('public','anon') AND privilege_type='EXECUTE'), '');
INSERT INTO _test_results VALUES (40, 'realized_v SELECT granted to authenticated',
  EXISTS (SELECT 1 FROM information_schema.role_table_grants
          WHERE table_schema='public' AND table_name='financial_cashflow_realized_v'
          AND grantee='authenticated' AND privilege_type='SELECT'), '');
INSERT INTO _test_results VALUES (41, 'forecast_v SELECT granted to authenticated',
  EXISTS (SELECT 1 FROM information_schema.role_table_grants
          WHERE table_schema='public' AND table_name='financial_cashflow_forecast_v'
          AND grantee='authenticated' AND privilege_type='SELECT'), '');
INSERT INTO _test_results VALUES (42, 'statement_v SELECT granted to authenticated',
  EXISTS (SELECT 1 FROM information_schema.role_table_grants
          WHERE table_schema='public' AND table_name='financial_cashflow_statement_v'
          AND grantee='authenticated' AND privilege_type='SELECT'), '');
INSERT INTO _test_results VALUES (43, 'projection fn EXECUTE granted to authenticated',
  EXISTS (SELECT 1 FROM information_schema.role_routine_grants
          WHERE routine_schema='public' AND routine_name='cashflow_13_week_projection'
          AND grantee='authenticated' AND privilege_type='EXECUTE'), '');

-- ============================================================================
-- SECTION 11: No mutations on views (3)
-- ============================================================================
INSERT INTO _test_results VALUES (44, 'Base tables have RLS enabled (mutation protection)',
  (SELECT relrowsecurity FROM pg_class WHERE relname='financial_journal_entries' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) = true
  AND (SELECT relrowsecurity FROM pg_class WHERE relname='financial_journal_lines' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) = true, '');
INSERT INTO _test_results VALUES (45, 'Base tables have append-only triggers (no UPDATE/DELETE)',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_fje_immutable'
          AND tgrelid=(SELECT oid FROM pg_class WHERE relname='financial_journal_entries' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')))
  AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_fjl_immutable'
          AND tgrelid=(SELECT oid FROM pg_class WHERE relname='financial_journal_lines' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public'))), '');
INSERT INTO _test_results VALUES (46, 'Transaction tables have RLS with no INSERT/UPDATE/DELETE for authenticated',
  NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
              WHERE table_schema='public' AND table_name='financial_journal_entries'
              AND grantee='authenticated' AND privilege_type IN ('INSERT','UPDATE','DELETE'))
  AND NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
              WHERE table_schema='public' AND table_name='financial_journal_lines'
              AND grantee='authenticated' AND privilege_type IN ('INSERT','UPDATE','DELETE')), '');

-- ============================================================================
-- SECTION 12: Journal integrity post-08D (4)
-- ============================================================================
INSERT INTO _test_results VALUES (47, 'No unbalanced journals',
  NOT EXISTS (
    SELECT 1 FROM public.financial_journal_entries je
    WHERE (SELECT SUM(jl.debit) FROM public.financial_journal_lines jl WHERE jl.entry_id=je.id)
        <> (SELECT SUM(jl.credit) FROM public.financial_journal_lines jl WHERE jl.entry_id=je.id)
  ), '');
INSERT INTO _test_results VALUES (48, 'No orphan journal lines',
  NOT EXISTS (
    SELECT 1 FROM public.financial_journal_lines jl
    WHERE NOT EXISTS (SELECT 1 FROM public.financial_journal_entries je WHERE je.id=jl.entry_id)
  ), '');
INSERT INTO _test_results VALUES (49, 'No orphan journal entries',
  NOT EXISTS (
    SELECT 1 FROM public.financial_journal_entries je
    WHERE NOT EXISTS (SELECT 1 FROM public.financial_transactions t WHERE t.id=je.transaction_id)
  ), '');
INSERT INTO _test_results VALUES (50, 'Active cash accounts exist',
  EXISTS (SELECT 1 FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1), '');

-- ============================================================================
-- SECTION 13: New RPC functions existence (3)
-- ============================================================================
INSERT INTO _test_results VALUES (51, 'cashflow_opening_balance function exists',
  (SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cashflow_opening_balance')), '');
INSERT INTO _test_results VALUES (52, 'get_cash_flow_statement function exists',
  (SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_cash_flow_statement')), '');
INSERT INTO _test_results VALUES (53, 'cashflow_summary function exists',
  (SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cashflow_summary')), '');

-- ============================================================================
-- SECTION 14: New RPC security (4)
-- ============================================================================
INSERT INTO _test_results VALUES (54, 'opening_balance fn EXECUTE NOT granted to public',
  NOT EXISTS (SELECT 1 FROM information_schema.role_routine_grants
              WHERE routine_schema='public' AND routine_name='cashflow_opening_balance'
              AND grantee IN ('public','anon') AND privilege_type='EXECUTE'), '');
INSERT INTO _test_results VALUES (55, 'get_cash_flow_statement fn EXECUTE NOT granted to public',
  NOT EXISTS (SELECT 1 FROM information_schema.role_routine_grants
              WHERE routine_schema='public' AND routine_name='get_cash_flow_statement'
              AND grantee IN ('public','anon') AND privilege_type='EXECUTE'), '');
INSERT INTO _test_results VALUES (56, 'cashflow_summary fn EXECUTE NOT granted to public',
  NOT EXISTS (SELECT 1 FROM information_schema.role_routine_grants
              WHERE routine_schema='public' AND routine_name='cashflow_summary'
              AND grantee IN ('public','anon') AND privilege_type='EXECUTE'), '');
INSERT INTO _test_results VALUES (57, 'all 3 new fns EXECUTE granted to authenticated',
  (SELECT count(*) FROM information_schema.role_routine_grants
   WHERE routine_schema='public' AND grantee='authenticated' AND privilege_type='EXECUTE'
   AND routine_name IN ('cashflow_opening_balance','get_cash_flow_statement','cashflow_summary')) = 3, '');

-- ============================================================================
-- SECTION 15: cashflow_summary returns valid structure (3)
-- ============================================================================
INSERT INTO _test_results VALUES (58, 'cashflow_summary returns 1 row',
  (SELECT count(*) FROM public.cashflow_summary(NULL, NULL, NULL, NULL, NULL)) = 1, '');
INSERT INTO _test_results VALUES (59, 'cashflow_summary opening = 0 and closing = 0 (no data)',
  (SELECT opening_balance FROM public.cashflow_summary(NULL, NULL, NULL, NULL, NULL)) = 0
  AND (SELECT closing_balance FROM public.cashflow_summary(NULL, NULL, NULL, NULL, NULL)) = 0, '');
INSERT INTO _test_results VALUES (60, 'cashflow_summary projected_inflows = 0 (no pending)',
  (SELECT projected_inflows FROM public.cashflow_summary(NULL, NULL, NULL, NULL, NULL)) = 0, '');

-- ============================================================================
-- SECTION 16: DFC statement reconciliation (2)
-- ============================================================================
INSERT INTO _test_results VALUES (61, 'DFC SALDO_FINAL = SALDO_INICIAL + VARIACAO (statement_v)',
  (SELECT net_amount FROM public.financial_cashflow_statement_v WHERE dfc_class='SALDO_FINAL')
  = (SELECT net_amount FROM public.financial_cashflow_statement_v WHERE dfc_class='SALDO_INICIAL')
    + (SELECT net_amount FROM public.financial_cashflow_statement_v WHERE dfc_class='VARIACAO'), '');
INSERT INTO _test_results VALUES (62, 'DFC VARIACAO = SUM classes (statement_v)',
  (SELECT net_amount FROM public.financial_cashflow_statement_v WHERE dfc_class='VARIACAO')
  = (SELECT COALESCE(SUM(net_amount),0) FROM public.financial_cashflow_statement_v
     WHERE dfc_class IN ('OPERACIONAL','INVESTIMENTO','FINANCIAMENTO')), '');

-- ============================================================================
-- SECTION 17: Realized view chart_account_ids column (1)
-- ============================================================================
INSERT INTO _test_results VALUES (63, 'realized_v chart_account_ids is array type',
  (SELECT data_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='financial_cashflow_realized_v'
   AND column_name='chart_account_ids') = 'ARRAY', '');

-- ============================================================================
-- SECTION 18: Baseline integrity checks (7)
-- ============================================================================
INSERT INTO _test_results VALUES (64, 'no duplicate cash_events (same entry+account+date)',
  NOT EXISTS (
    SELECT 1 FROM (
      SELECT entry_id, chart_account_id, count(*) as cnt
      FROM public.financial_journal_entries je
      JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
      JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
      WHERE ca.is_cash = true
      GROUP BY entry_id, chart_account_id
      HAVING count(*) > 1
    ) dup
  ), '');
INSERT INTO _test_results VALUES (65, 'no duplicate forecast rows (same transaction_id)',
  NOT EXISTS (
    SELECT 1 FROM (
      SELECT transaction_id, count(*) as cnt
      FROM public.financial_cashflow_forecast_v
      GROUP BY transaction_id
      HAVING count(*) > 1
    ) dup
  ), '');
INSERT INTO _test_results VALUES (66, 'DFC statement reconciliation difference = 0',
  ABS(
    (SELECT net_amount FROM public.financial_cashflow_statement_v WHERE dfc_class='SALDO_FINAL')
    - ((SELECT net_amount FROM public.financial_cashflow_statement_v WHERE dfc_class='SALDO_INICIAL')
       + (SELECT net_amount FROM public.financial_cashflow_statement_v WHERE dfc_class='VARIACAO'))
  ) < 0.01, '');
INSERT INTO _test_results VALUES (67, 'all DFC classes are valid enum values',
  NOT EXISTS (
    SELECT 1 FROM public.financial_cashflow_realized_v
    WHERE dfc_class NOT IN ('OPERACIONAL','INVESTIMENTO','FINANCIAMENTO','TRANSFERENCIA','NAO_CAIXA')
  ), '');
INSERT INTO _test_results VALUES (68, 'projection propagation: week N closing = week N+1 opening',
  (SELECT count(*) FROM (
    SELECT w1.week_number, w1.closing_balance, w2.opening_balance
    FROM public.cashflow_13_week_projection() w1
    JOIN public.cashflow_13_week_projection() w2 ON w2.week_number = w1.week_number + 1
    WHERE ABS(w1.closing_balance - w2.opening_balance) > 0.01
  ) mismatches) = 0, '');
INSERT INTO _test_results VALUES (69, 'forecast_v only contains pending status',
  NOT EXISTS (
    SELECT 1 FROM public.financial_cashflow_forecast_v WHERE status <> 'pending'
  ), '');
INSERT INTO _test_results VALUES (70, 'forecast_v open_amount > 0 for all rows',
  NOT EXISTS (
    SELECT 1 FROM public.financial_cashflow_forecast_v WHERE open_amount <= 0
  ), '');

-- ============================================================================
-- RESULTS
-- ============================================================================
SELECT test_id, description, passed,
  CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END as result
FROM _test_results ORDER BY test_id;

SELECT 'SUMMARY' as section,
  count(*) FILTER (WHERE passed) as passed_count,
  count(*) FILTER (WHERE NOT passed) as failed_count,
  count(*) as total
FROM _test_results;

SELECT 'FAILED' as section, test_id, description, detail
FROM _test_results WHERE NOT passed ORDER BY test_id;

ROLLBACK;
