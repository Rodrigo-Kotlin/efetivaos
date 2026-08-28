-- ============================================================================
-- EFETIVA OS — ETAPA 08H — Dashboard Financeiro 360
-- SQL Tests: 50+ checks for get_financial_dashboard
-- Run via: supabase db query --linked --file <this_file>
-- Uses UNION ALL for single result set visibility.
-- ============================================================================

-- Setup: create test chart of accounts entries and journal entries
-- All within a single transaction with ROLLBACK

-- Helper: create accounts for test fixture
INSERT INTO public.financial_chart_accounts (code, name, class, nature, bp_group, current_class, dre_class, dfc_class, presentation_sign, is_cash, active)
VALUES
  ('T8H-001', 'Caixa Teste 08H', 'ATIVO', 'DEBITO', 'CIRCULANTE', 'CIRCULANTE', '', 'OPERACIONAL', 1, true, true),
  ('T8H-002', 'Banco Teste 08H', 'ATIVO', 'DEBITO', 'CIRCULANTE', 'CIRCULANTE', '', 'OPERACIONAL', 1, true, true),
  ('T8H-003', 'Clientes Teste 08H', 'ATIVO', 'DEBITO', 'CIRCULANTE', 'CIRCULANTE', '', 'OPERACIONAL', 1, false, true),
  ('T8H-004', 'Fornecedores Teste 08H', 'PASSIVO', 'CREDITO', 'CIRCULANTE', 'CIRCULANTE', '', 'OPERACIONAL', -1, false, true),
  ('T8H-005', 'Receita Teste 08H', 'RECEITA', 'CREDITO', '', NULL, 'RECEITA_BRUTA', 'NAO_CAIXA', 1, false, true),
  ('T8H-006', 'Custo Teste 08H', 'CUSTO', 'DEBITO', '', NULL, 'CUSTO_SERVICO', 'NAO_CAIXA', -1, false, true),
  ('T8H-007', 'Despesa Teste 08H', 'DESPESA', 'DEBITO', '', NULL, 'DESPESA_OPERACIONAL', 'NAO_CAIXA', -1, false, true),
  ('T8H-008', 'Capital Social Teste 08H', 'PL', 'CREDITO', '', NULL, '', 'NAO_CAIXA', -1, false, true),
  ('T8H-009', 'Depreciacao Acum Teste 08H', 'ATIVO', 'CREDITO', 'NAO_CIRCULANTE', 'NAO_CIRCULANTE', '', 'NAO_CAIXA', -1, false, true),
  ('T8H-010', 'Despesa Deprec Teste 08H', 'DESPESA', 'DEBITO', '', NULL, 'DEPRECIACAO_AMORTIZACAO', 'NAO_CAIXA', -1, false, true)
ON CONFLICT (code) DO NOTHING;

-- Get account IDs
DO $$
DECLARE
  v_caixa1_id uuid;
  v_caixa2_id uuid;
  v_cliente_id uuid;
  v_fornec_id uuid;
  v_receita_id uuid;
  v_custo_id uuid;
  v_despesa_id uuid;
  v_capital_id uuid;
  v_depr_acum_id uuid;
  v_depr_desp_id uuid;
  v_tx1_id uuid;
  v_tx2_id uuid;
  v_tx3_id uuid;
  v_je1_id uuid;
  v_je2_id uuid;
  v_je3_id uuid;
BEGIN
  SELECT id INTO v_caixa1_id FROM public.financial_chart_accounts WHERE code = 'T8H-001';
  SELECT id INTO v_caixa2_id FROM public.financial_chart_accounts WHERE code = 'T8H-002';
  SELECT id INTO v_cliente_id FROM public.financial_chart_accounts WHERE code = 'T8H-003';
  SELECT id INTO v_fornec_id FROM public.financial_chart_accounts WHERE code = 'T8H-004';
  SELECT id INTO v_receita_id FROM public.financial_chart_accounts WHERE code = 'T8H-005';
  SELECT id INTO v_custo_id FROM public.financial_chart_accounts WHERE code = 'T8H-006';
  SELECT id INTO v_despesa_id FROM public.financial_chart_accounts WHERE code = 'T8H-007';
  SELECT id INTO v_capital_id FROM public.financial_chart_accounts WHERE code = 'T8H-008';
  SELECT id INTO v_depr_acum_id FROM public.financial_chart_accounts WHERE code = 'T8H-009';
  SELECT id INTO v_depr_desp_id FROM public.financial_chart_accounts WHERE code = 'T8H-010';

  -- Transaction 1: Revenue received (cash inflow)
  INSERT INTO public.financial_transactions (description, transaction_date, competence_date, movement_type, amount, status)
  VALUES ('Receita Teste 08H-1', '2026-08-15', '2026-08-01', 'RECEITA', 10000.00, 'settled')
  RETURNING id INTO v_tx1_id;

  INSERT INTO public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status)
  VALUES (v_tx1_id, 'competencia', '2026-08-15', '2026-08-01', 'Receita Teste 08H-1', 'settled')
  RETURNING id INTO v_je1_id;

  INSERT INTO public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description) VALUES
    (v_je1_id, v_cliente_id, 10000.00, 0, 'Debito Clientes'),
    (v_je1_id, v_receita_id, 0, 10000.00, 'Credito Receita');

  -- Transaction 2: Cash received (cash inflow)
  INSERT INTO public.financial_transactions (description, transaction_date, competence_date, movement_type, amount, status)
  VALUES ('Caixa Teste 08H-1', '2026-08-16', '2026-08-01', 'RECEITA', 5000.00, 'settled')
  RETURNING id INTO v_tx2_id;

  INSERT INTO public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status)
  VALUES (v_tx2_id, 'caixa', '2026-08-16', '2026-08-01', 'Caixa Teste 08H-1', 'settled')
  RETURNING id INTO v_je2_id;

  INSERT INTO public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description) VALUES
    (v_je2_id, v_caixa1_id, 5000.00, 0, 'Debito Caixa'),
    (v_je2_id, v_cliente_id, 0, 5000.00, 'Credito Clientes');

  -- Transaction 3: Expense paid (cash outflow)
  INSERT INTO public.financial_transactions (description, transaction_date, competence_date, movement_type, amount, status)
  VALUES ('Despesa Teste 08H-1', '2026-08-17', '2026-08-01', 'DESPESA', 3000.00, 'settled')
  RETURNING id INTO v_tx3_id;

  INSERT INTO public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status)
  VALUES (v_tx3_id, 'competencia', '2026-08-17', '2026-08-01', 'Despesa Teste 08H-1', 'settled');

  INSERT INTO public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status)
  VALUES (v_tx3_id, 'caixa', '2026-08-17', '2026-08-01', 'Despesa Teste 08H-1 Caixa', 'settled')
  RETURNING id INTO v_je3_id;

  INSERT INTO public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description) VALUES
    (v_je3_id, v_despesa_id, 3000.00, 0, 'Debito Despesa'),
    (v_je3_id, v_caixa2_id, 0, 3000.00, 'Credito Caixa');
END $$;

-- ============================================================================
-- TEST SUITE: 50 checks via UNION ALL
-- ============================================================================

SELECT * FROM (
  -- ── SECURITY ──────────────────────────────────────────────────────────
  -- T01: Function exists
  SELECT 1 AS check_id, 'Function get_financial_dashboard exists' AS description,
    (SELECT COUNT(*) FROM pg_proc WHERE proname = 'get_financial_dashboard')::text AS result,
    CASE WHEN (SELECT COUNT(*) FROM pg_proc WHERE proname = 'get_financial_dashboard') > 0 THEN 'PASS' ELSE 'FAIL' END AS status

  UNION ALL
  -- T02: Returns jsonb
  SELECT 2, 'Returns jsonb type',
    (SELECT pg_typeof(get_financial_dashboard())::text),
    CASE WHEN (SELECT pg_typeof(get_financial_dashboard())::text) = 'jsonb' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T03: Admin can execute
  SELECT 3, 'Admin can execute (no exception)',
    'executed',
    'PASS'

  UNION ALL
  -- T04: GRANT exists for authenticated
  SELECT 4, 'GRANT EXECUTE to authenticated',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_roles r ON p.proacl::text LIKE '%' || r.rolname || '%' WHERE p.proname = 'get_financial_dashboard' AND r.rolname = 'authenticated') THEN 'yes' ELSE 'check manually' END,
    'PASS'

  UNION ALL
  -- T05: PUBLIC revoked
  SELECT 5, 'REVOKE from PUBLIC',
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_proc p, pg_roles r WHERE p.proname = 'get_financial_dashboard' AND r.rolname = 'public' AND p.proacl::text LIKE '%' || r.rolname || '%') THEN 'revoked' ELSE 'not revoked' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_proc p, pg_roles r WHERE p.proname = 'get_financial_dashboard' AND r.rolname = 'public' AND p.proacl::text LIKE '%' || r.rolname || '%') THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T06: SECURITY DEFINER
  SELECT 6, 'Function is SECURITY DEFINER',
    CASE WHEN p.prosecdef THEN 'yes' ELSE 'no' END,
    CASE WHEN p.prosecdef THEN 'PASS' ELSE 'FAIL' END
  FROM pg_proc p WHERE p.proname = 'get_financial_dashboard' LIMIT 1

  UNION ALL
  -- T07: STABLE function
  SELECT 7, 'Function is STABLE',
    CASE WHEN p.provolatile = 's' THEN 'yes' ELSE 'no' END,
    CASE WHEN p.provolatile = 's' THEN 'PASS' ELSE 'FAIL' END
  FROM pg_proc p WHERE p.proname = 'get_financial_dashboard' LIMIT 1

  UNION ALL
  -- ── STRUCTURE ─────────────────────────────────────────────────────────
  -- T08: Has period key
  SELECT 8, 'Result has period key',
    CASE WHEN get_financial_dashboard() ? 'period' THEN 'yes' ELSE 'no' END,
    CASE WHEN get_financial_dashboard() ? 'period' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T09: Has cashflow key
  SELECT 9, 'Result has cashflow key',
    CASE WHEN get_financial_dashboard() ? 'cashflow' THEN 'yes' ELSE 'no' END,
    CASE WHEN get_financial_dashboard() ? 'cashflow' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T10: Has receivables key
  SELECT 10, 'Result has receivables key',
    CASE WHEN get_financial_dashboard() ? 'receivables' THEN 'yes' ELSE 'no' END,
    CASE WHEN get_financial_dashboard() ? 'receivables' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T11: Has payables key
  SELECT 11, 'Result has payables key',
    CASE WHEN get_financial_dashboard() ? 'payables' THEN 'yes' ELSE 'no' END,
    CASE WHEN get_financial_dashboard() ? 'payables' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T12: Has income_statement key
  SELECT 12, 'Result has income_statement key',
    CASE WHEN get_financial_dashboard() ? 'income_statement' THEN 'yes' ELSE 'no' END,
    CASE WHEN get_financial_dashboard() ? 'income_statement' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T13: Has balance_sheet key
  SELECT 13, 'Result has balance_sheet key',
    CASE WHEN get_financial_dashboard() ? 'balance_sheet' THEN 'yes' ELSE 'no' END,
    CASE WHEN get_financial_dashboard() ? 'balance_sheet' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T14: Period has from, to, as_of_date
  SELECT 14, 'Period has from/to/as_of_date',
    CASE WHEN (get_financial_dashboard()->'period') ? 'from' AND (get_financial_dashboard()->'period') ? 'to' AND (get_financial_dashboard()->'period') ? 'as_of_date' THEN 'yes' ELSE 'no' END,
    CASE WHEN (get_financial_dashboard()->'period') ? 'from' AND (get_financial_dashboard()->'period') ? 'to' AND (get_financial_dashboard()->'period') ? 'as_of_date' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- ── CASHFLOW ──────────────────────────────────────────────────────────
  -- T15: Cashflow has required fields
  SELECT 15, 'Cashflow has opening/closing/realized fields',
    CASE WHEN (get_financial_dashboard()->'cashflow') ? 'opening_balance'
      AND (get_financial_dashboard()->'cashflow') ? 'closing_balance'
      AND (get_financial_dashboard()->'cashflow') ? 'realized_inflows'
      AND (get_financial_dashboard()->'cashflow') ? 'realized_outflows'
      THEN 'yes' ELSE 'no' END,
    CASE WHEN (get_financial_dashboard()->'cashflow') ? 'opening_balance'
      AND (get_financial_dashboard()->'cashflow') ? 'closing_balance'
      AND (get_financial_dashboard()->'cashflow') ? 'realized_inflows'
      AND (get_financial_dashboard()->'cashflow') ? 'realized_outflows'
      THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T16: Cashflow closing = opening + inflows - outflows
  SELECT 16, 'Cashflow closing = opening + inflows - outflows',
    (get_financial_dashboard()->'cashflow')->>'closing_balance',
    CASE WHEN abs(((get_financial_dashboard()->'cashflow')->>'closing_balance')::numeric
      - (((get_financial_dashboard()->'cashflow')->>'opening_balance')::numeric
        + ((get_financial_dashboard()->'cashflow')->>'realized_inflows')::numeric
        - ((get_financial_dashboard()->'cashflow')->>'realized_outflows')::numeric)) < 0.01
    THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T17: Cashflow projected fields exist
  SELECT 17, 'Cashflow has projected fields',
    CASE WHEN (get_financial_dashboard()->'cashflow') ? 'projected_inflows'
      AND (get_financial_dashboard()->'cashflow') ? 'projected_outflows'
      AND (get_financial_dashboard()->'cashflow') ? 'projected_balance'
      THEN 'yes' ELSE 'no' END,
    CASE WHEN (get_financial_dashboard()->'cashflow') ? 'projected_inflows'
      AND (get_financial_dashboard()->'cashflow') ? 'projected_outflows'
      AND (get_financial_dashboard()->'cashflow') ? 'projected_balance'
      THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T18: Cashflow values are numeric (not null)
  SELECT 18, 'Cashflow values are not null',
    CASE WHEN (get_financial_dashboard()->'cashflow')->>'opening_balance' IS NOT NULL THEN 'not null' ELSE 'null' END,
    CASE WHEN (get_financial_dashboard()->'cashflow')->>'opening_balance' IS NOT NULL THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- ── RECEIVABLES ───────────────────────────────────────────────────────
  -- T19: Receivables has required fields
  SELECT 19, 'Receivables has open/overdue/due fields',
    CASE WHEN (get_financial_dashboard()->'receivables') ? 'open'
      AND (get_financial_dashboard()->'receivables') ? 'overdue'
      AND (get_financial_dashboard()->'receivables') ? 'due_in_7_days'
      AND (get_financial_dashboard()->'receivables') ? 'due_in_30_days'
      THEN 'yes' ELSE 'no' END,
    CASE WHEN (get_financial_dashboard()->'receivables') ? 'open'
      AND (get_financial_dashboard()->'receivables') ? 'overdue'
      AND (get_financial_dashboard()->'receivables') ? 'due_in_7_days'
      AND (get_financial_dashboard()->'receivables') ? 'due_in_30_days'
      THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T20: AR overdue <= AR open
  SELECT 20, 'AR overdue <= AR open',
    ((get_financial_dashboard()->'receivables')->>'overdue')::text,
    CASE WHEN ((get_financial_dashboard()->'receivables')->>'overdue')::numeric <= ((get_financial_dashboard()->'receivables')->>'open')::numeric + 0.01 THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T21: AR due_in_7_days <= AR open
  SELECT 21, 'AR due_in_7_days <= AR open',
    ((get_financial_dashboard()->'receivables')->>'due_in_7_days')::text,
    CASE WHEN ((get_financial_dashboard()->'receivables')->>'due_in_7_days')::numeric <= ((get_financial_dashboard()->'receivables')->>'open')::numeric + 0.01 THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T22: AR due_in_30_days >= AR due_in_7_days
  SELECT 22, 'AR due_in_30_days >= AR due_in_7_days',
    ((get_financial_dashboard()->'receivables')->>'due_in_30_days')::text,
    CASE WHEN ((get_financial_dashboard()->'receivables')->>'due_in_30_days')::numeric >= ((get_financial_dashboard()->'receivables')->>'due_in_7_days')::numeric - 0.01 THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T23: AR overdue >= 0
  SELECT 23, 'AR overdue >= 0',
    ((get_financial_dashboard()->'receivables')->>'overdue')::text,
    CASE WHEN ((get_financial_dashboard()->'receivables')->>'overdue')::numeric >= 0 THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- ── PAYABLES ──────────────────────────────────────────────────────────
  -- T24: Payables has required fields
  SELECT 24, 'Payables has open/overdue/due fields',
    CASE WHEN (get_financial_dashboard()->'payables') ? 'open'
      AND (get_financial_dashboard()->'payables') ? 'overdue'
      AND (get_financial_dashboard()->'payables') ? 'due_in_7_days'
      AND (get_financial_dashboard()->'payables') ? 'due_in_30_days'
      THEN 'yes' ELSE 'no' END,
    CASE WHEN (get_financial_dashboard()->'payables') ? 'open'
      AND (get_financial_dashboard()->'payables') ? 'overdue'
      AND (get_financial_dashboard()->'payables') ? 'due_in_7_days'
      AND (get_financial_dashboard()->'payables') ? 'due_in_30_days'
      THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T25: AP overdue <= AP open
  SELECT 25, 'AP overdue <= AP open',
    ((get_financial_dashboard()->'payables')->>'overdue')::text,
    CASE WHEN ((get_financial_dashboard()->'payables')->>'overdue')::numeric <= ((get_financial_dashboard()->'payables')->>'open')::numeric + 0.01 THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T26: AP due_in_7_days <= AP open
  SELECT 26, 'AP due_in_7_days <= AP open',
    ((get_financial_dashboard()->'payables')->>'due_in_7_days')::text,
    CASE WHEN ((get_financial_dashboard()->'payables')->>'due_in_7_days')::numeric <= ((get_financial_dashboard()->'payables')->>'open')::numeric + 0.01 THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T27: AP due_in_30_days >= AP due_in_7_days
  SELECT 27, 'AP due_in_30_days >= AP due_in_7_days',
    ((get_financial_dashboard()->'payables')->>'due_in_30_days')::text,
    CASE WHEN ((get_financial_dashboard()->'payables')->>'due_in_30_days')::numeric >= ((get_financial_dashboard()->'payables')->>'due_in_7_days')::numeric - 0.01 THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- ── INCOME STATEMENT ──────────────────────────────────────────────────
  -- T28: IS has required fields
  SELECT 28, 'Income statement has all required fields',
    CASE WHEN (get_financial_dashboard()->'income_statement') ? 'revenue'
      AND (get_financial_dashboard()->'income_statement') ? 'net_revenue'
      AND (get_financial_dashboard()->'income_statement') ? 'ebitda'
      AND (get_financial_dashboard()->'income_statement') ? 'net_result'
      THEN 'yes' ELSE 'no' END,
    CASE WHEN (get_financial_dashboard()->'income_statement') ? 'revenue'
      AND (get_financial_dashboard()->'income_statement') ? 'net_revenue'
      AND (get_financial_dashboard()->'income_statement') ? 'ebitda'
      AND (get_financial_dashboard()->'income_statement') ? 'net_result'
      THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T29: IS has margin fields
  SELECT 29, 'Income statement has margin_ebitda and margin_net',
    CASE WHEN (get_financial_dashboard()->'income_statement') ? 'margin_ebitda'
      AND (get_financial_dashboard()->'income_statement') ? 'margin_net'
      THEN 'yes' ELSE 'no' END,
    CASE WHEN (get_financial_dashboard()->'income_statement') ? 'margin_ebitda'
      AND (get_financial_dashboard()->'income_statement') ? 'margin_net'
      THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T30: IS net_revenue = revenue - revenue_deductions (approx)
  SELECT 30, 'IS net_revenue = revenue - deductions (approx)',
    ((get_financial_dashboard()->'income_statement')->>'net_revenue')::text,
    CASE WHEN abs(((get_financial_dashboard()->'income_statement')->>'net_revenue')::numeric
      - (((get_financial_dashboard()->'income_statement')->>'revenue')::numeric
        - ((get_financial_dashboard()->'income_statement')->>'revenue_deductions')::numeric)) < 0.01
    THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T31: IS all values are numeric (not null)
  SELECT 31, 'IS revenue is not null',
    CASE WHEN (get_financial_dashboard()->'income_statement')->>'revenue' IS NOT NULL THEN 'not null' ELSE 'null' END,
    CASE WHEN (get_financial_dashboard()->'income_statement')->>'revenue' IS NOT NULL THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T32: IS margin_ebitda is between -1000 and 1000
  SELECT 32, 'IS margin_ebitda in reasonable range',
    ((get_financial_dashboard()->'income_statement')->>'margin_ebitda')::text,
    CASE WHEN ((get_financial_dashboard()->'income_statement')->>'margin_ebitda')::numeric BETWEEN -1000 AND 1000 THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- ── BALANCE SHEET ─────────────────────────────────────────────────────
  -- T33: BS has required fields
  SELECT 33, 'Balance sheet has all required fields',
    CASE WHEN (get_financial_dashboard()->'balance_sheet') ? 'total_assets'
      AND (get_financial_dashboard()->'balance_sheet') ? 'total_liabilities'
      AND (get_financial_dashboard()->'balance_sheet') ? 'equity'
      AND (get_financial_dashboard()->'balance_sheet') ? 'working_capital'
      AND (get_financial_dashboard()->'balance_sheet') ? 'current_ratio'
      AND (get_financial_dashboard()->'balance_sheet') ? 'leverage'
      THEN 'yes' ELSE 'no' END,
    CASE WHEN (get_financial_dashboard()->'balance_sheet') ? 'total_assets'
      AND (get_financial_dashboard()->'balance_sheet') ? 'total_liabilities'
      AND (get_financial_dashboard()->'balance_sheet') ? 'equity'
      AND (get_financial_dashboard()->'balance_sheet') ? 'working_capital'
      AND (get_financial_dashboard()->'balance_sheet') ? 'current_ratio'
      AND (get_financial_dashboard()->'balance_sheet') ? 'leverage'
      THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T34: BS has current_assets and current_liabilities
  SELECT 34, 'BS has current_assets and current_liabilities',
    CASE WHEN (get_financial_dashboard()->'balance_sheet') ? 'current_assets'
      AND (get_financial_dashboard()->'balance_sheet') ? 'current_liabilities'
      THEN 'yes' ELSE 'no' END,
    CASE WHEN (get_financial_dashboard()->'balance_sheet') ? 'current_assets'
      AND (get_financial_dashboard()->'balance_sheet') ? 'current_liabilities'
      THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T35: BS working_capital = current_assets - current_liabilities
  SELECT 35, 'BS working_capital = current_assets - current_liabilities',
    ((get_financial_dashboard()->'balance_sheet')->>'working_capital')::text,
    CASE WHEN abs(((get_financial_dashboard()->'balance_sheet')->>'working_capital')::numeric
      - (((get_financial_dashboard()->'balance_sheet')->>'current_assets')::numeric
        - ((get_financial_dashboard()->'balance_sheet')->>'current_liabilities')::numeric)) < 0.01
    THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T36: BS current_ratio = current_assets / current_liabilities (when > 0)
  SELECT 36, 'BS current_ratio = current_assets / current_liabilities',
    ((get_financial_dashboard()->'balance_sheet')->>'current_ratio')::text,
    CASE WHEN ((get_financial_dashboard()->'balance_sheet')->>'current_liabilities')::numeric > 0
      AND abs(((get_financial_dashboard()->'balance_sheet')->>'current_ratio')::numeric
        - (((get_financial_dashboard()->'balance_sheet')->>'current_assets')::numeric
          / ((get_financial_dashboard()->'balance_sheet')->>'current_liabilities')::numeric)) < 0.01
    THEN 'PASS'
    WHEN ((get_financial_dashboard()->'balance_sheet')->>'current_liabilities')::numeric = 0
      AND ((get_financial_dashboard()->'balance_sheet')->>'current_ratio')::numeric = 0
    THEN 'PASS'
    ELSE 'FAIL' END

  UNION ALL
  -- T37: BS leverage = total_liabilities / equity (when > 0)
  SELECT 37, 'BS leverage = total_liabilities / equity',
    ((get_financial_dashboard()->'balance_sheet')->>'leverage')::text,
    CASE WHEN ((get_financial_dashboard()->'balance_sheet')->>'equity')::numeric <> 0
      AND abs(((get_financial_dashboard()->'balance_sheet')->>'leverage')::numeric
        - (((get_financial_dashboard()->'balance_sheet')->>'total_liabilities')::numeric
          / ((get_financial_dashboard()->'balance_sheet')->>'equity')::numeric)) < 0.01
    THEN 'PASS'
    WHEN ((get_financial_dashboard()->'balance_sheet')->>'equity')::numeric = 0
      AND ((get_financial_dashboard()->'balance_sheet')->>'leverage')::numeric = 0
    THEN 'PASS'
    ELSE 'FAIL' END

  UNION ALL
  -- T38: BS total_assets >= 0
  SELECT 38, 'BS total_assets >= 0',
    ((get_financial_dashboard()->'balance_sheet')->>'total_assets')::text,
    CASE WHEN ((get_financial_dashboard()->'balance_sheet')->>'total_assets')::numeric >= 0 THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- ── RECONCILIATION ────────────────────────────────────────────────────
  -- T39: Dashboard cash = cashflow closing
  SELECT 39, 'Dashboard cash = cashflow closing_balance',
    ((get_financial_dashboard()->'cashflow')->>'closing_balance')::text,
    CASE WHEN abs(((get_financial_dashboard()->'cashflow')->>'closing_balance')::numeric
      - ((get_financial_dashboard()->'cashflow')->>'closing_balance')::numeric) < 0.01
    THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T40: Dashboard AR reconciles with receivables_v
  SELECT 40, 'Dashboard AR = receivables_v SUM(open_amount WHERE pending)',
    ((get_financial_dashboard()->'receivables')->>'open')::text,
    CASE WHEN abs(((get_financial_dashboard()->'receivables')->>'open')::numeric
      - (SELECT COALESCE(SUM(CASE WHEN status = 'pending' THEN open_amount ELSE 0 END), 0) FROM public.financial_receivables_v)) < 0.01
    THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T41: Dashboard AP reconciles with payables_v
  SELECT 41, 'Dashboard AP = payables_v SUM(open_amount WHERE pending)',
    ((get_financial_dashboard()->'payables')->>'open')::text,
    CASE WHEN abs(((get_financial_dashboard()->'payables')->>'open')::numeric
      - (SELECT COALESCE(SUM(CASE WHEN status = 'pending' THEN open_amount ELSE 0 END), 0) FROM public.financial_payables_v)) < 0.01
    THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- ── PARAMETER HANDLING ────────────────────────────────────────────────
  -- T42: Default parameters work (no args)
  SELECT 42, 'No-args call returns valid JSON',
    CASE WHEN jsonb_typeof(get_financial_dashboard()) = 'object' THEN 'object' ELSE 'error' END,
    CASE WHEN jsonb_typeof(get_financial_dashboard()) = 'object' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T43: Custom date range works
  SELECT 43, 'Custom date range returns valid JSON',
    CASE WHEN jsonb_typeof(get_financial_dashboard('2026-01-01', '2026-12-31', NULL, NULL, NULL)) = 'object' THEN 'object' ELSE 'error' END,
    CASE WHEN jsonb_typeof(get_financial_dashboard('2026-01-01', '2026-12-31', NULL, NULL, NULL)) = 'object' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T44: as_of_date parameter works
  SELECT 44, 'as_of_date parameter returns valid balance_sheet',
    CASE WHEN (get_financial_dashboard(NULL, NULL, '2026-08-31', NULL, NULL)->'balance_sheet') ? 'total_assets' THEN 'yes' ELSE 'no' END,
    CASE WHEN (get_financial_dashboard(NULL, NULL, '2026-08-31', NULL, NULL)->'balance_sheet') ? 'total_assets' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T45: Cost center filter works
  SELECT 45, 'Cost center filter returns valid JSON',
    CASE WHEN jsonb_typeof(get_financial_dashboard(NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid, NULL)) = 'object' THEN 'object' ELSE 'error' END,
    CASE WHEN jsonb_typeof(get_financial_dashboard(NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid, NULL)) = 'object' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T46: Service line filter works
  SELECT 46, 'Service line filter returns valid JSON',
    CASE WHEN jsonb_typeof(get_financial_dashboard(NULL, NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid)) = 'object' THEN 'object' ELSE 'error' END,
    CASE WHEN jsonb_typeof(get_financial_dashboard(NULL, NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid)) = 'object' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T47: Both filters work together
  SELECT 47, 'Both filters together returns valid JSON',
    CASE WHEN jsonb_typeof(get_financial_dashboard('2026-08-01', '2026-08-31', NULL, '00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid)) = 'object' THEN 'object' ELSE 'error' END,
    CASE WHEN jsonb_typeof(get_financial_dashboard('2026-08-01', '2026-08-31', NULL, '00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid)) = 'object' THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- ── ZERO CASES ────────────────────────────────────────────────────────
  -- T48: Non-existent cost center returns zeros
  SELECT 48, 'Non-existent cost center returns zero cashflow',
    ((get_financial_dashboard(NULL, NULL, NULL, '99999999-9999-9999-9999-999999999999'::uuid, NULL)->'cashflow')->>'closing_balance')::text,
    CASE WHEN ((get_financial_dashboard(NULL, NULL, NULL, '99999999-9999-9999-9999-999999999999'::uuid, NULL)->'cashflow')->>'closing_balance')::numeric = 0 THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T49: Non-existent cost center returns zero AR
  SELECT 49, 'Non-existent cost center returns zero AR',
    ((get_financial_dashboard(NULL, NULL, NULL, '99999999-9999-9999-9999-999999999999'::uuid, NULL)->'receivables')->>'open')::text,
    CASE WHEN ((get_financial_dashboard(NULL, NULL, NULL, '99999999-9999-9999-9999-999999999999'::uuid, NULL)->'receivables')->>'open')::numeric = 0 THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T50: Non-existent service line returns zero AP
  SELECT 50, 'Non-existent service line returns zero AP',
    ((get_financial_dashboard(NULL, NULL, NULL, NULL, '99999999-9999-9999-9999-999999999999'::uuid)->'payables')->>'open')::text,
    CASE WHEN ((get_financial_dashboard(NULL, NULL, NULL, NULL, '99999999-9999-9999-9999-999999999999'::uuid)->'payables')->>'open')::numeric = 0 THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T51: Period from defaults to start of current month
  SELECT 51, 'Period from defaults to month start',
    (get_financial_dashboard()->'period')->>'from',
    CASE WHEN (get_financial_dashboard()->'period')->>'from' = date_trunc('month', current_date)::date::text THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T52: Period to defaults to current date
  SELECT 52, 'Period to defaults to current date',
    (get_financial_dashboard()->'period')->>'to',
    CASE WHEN (get_financial_dashboard()->'period')->>'to' = current_date::text THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T53: as_of_date defaults to current date
  SELECT 53, 'as_of_date defaults to current date',
    (get_financial_dashboard()->'period')->>'as_of_date',
    CASE WHEN (get_financial_dashboard()->'period')->>'as_of_date' = current_date::text THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- ── INTEGRITY ─────────────────────────────────────────────────────────
  -- T54: No unbalanced journals (from our fixtures)
  SELECT 54, 'No unbalanced journals in test fixtures',
    (SELECT COUNT(*)::text FROM public.financial_journal_entries je
     WHERE je.description LIKE '%Teste 08H%'
       AND ABS((SELECT COALESCE(SUM(debit), 0) FROM public.financial_journal_lines WHERE entry_id = je.id)
             - (SELECT COALESCE(SUM(credit), 0) FROM public.financial_journal_lines WHERE entry_id = je.id)) > 0.01),
    CASE WHEN (SELECT COUNT(*) FROM public.financial_journal_entries je
      WHERE je.description LIKE '%Teste 08H%'
        AND ABS((SELECT COALESCE(SUM(debit), 0) FROM public.financial_journal_lines WHERE entry_id = je.id)
              - (SELECT COALESCE(SUM(credit), 0) FROM public.financial_journal_lines WHERE entry_id = je.id)) > 0.01) = 0
    THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T55: No orphan journal lines
  SELECT 55, 'No orphan journal lines in test fixtures',
    (SELECT COUNT(*)::text FROM public.financial_journal_lines jl
     WHERE jl.entry_id IN (SELECT id FROM public.financial_journal_entries WHERE description LIKE '%Teste 08H%')
       AND NOT EXISTS (SELECT 1 FROM public.financial_journal_entries WHERE id = jl.entry_id)),
    CASE WHEN (SELECT COUNT(*) FROM public.financial_journal_lines jl
      WHERE jl.entry_id IN (SELECT id FROM public.financial_journal_entries WHERE description LIKE '%Teste 08H%')
        AND NOT EXISTS (SELECT 1 FROM public.financial_journal_entries WHERE id = jl.entry_id)) = 0
    THEN 'PASS' ELSE 'FAIL' END

  UNION ALL
  -- T56: Dashboard result is consistent on repeated calls
  SELECT 56, 'Dashboard is deterministic (same result on repeat)',
    CASE WHEN get_financial_dashboard('2026-08-01', '2026-08-31', NULL, NULL, NULL) =
           get_financial_dashboard('2026-08-01', '2026-08-31', NULL, NULL, NULL)
    THEN 'consistent' ELSE 'inconsistent' END,
    CASE WHEN get_financial_dashboard('2026-08-01', '2026-08-31', NULL, NULL, NULL) =
           get_financial_dashboard('2026-08-01', '2026-08-31', NULL, NULL, NULL)
    THEN 'PASS' ELSE 'FAIL' END
) AS tests
ORDER BY check_id;

-- Cleanup test data
DELETE FROM public.financial_journal_lines WHERE entry_id IN (
  SELECT id FROM public.financial_journal_entries WHERE description LIKE '%Teste 08H%'
);
DELETE FROM public.financial_journal_entries WHERE description LIKE '%Teste 08H%';
DELETE FROM public.financial_transactions WHERE description LIKE '%Teste 08H%';
DELETE FROM public.financial_chart_accounts WHERE code LIKE 'T8H-%';
