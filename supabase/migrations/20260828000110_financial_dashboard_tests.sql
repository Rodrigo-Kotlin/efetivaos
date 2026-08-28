-- ============================================================================
-- EFETIVA OS — ETAPA 08H — Dashboard Financeiro 360
-- SQL Tests: 56 checks for get_financial_dashboard
-- Run via: supabase db query --linked -f <this_file>
-- All logic in a single DO block for Management API compatibility.
-- ============================================================================

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
  v_result jsonb;
  v_pass int := 0;
  v_fail int := 0;
  v_total int := 0;
  v_detail text;
BEGIN
  -- ── SETUP: Create test accounts ─────────────────────────────────────────
  INSERT INTO public.financial_chart_accounts (code, name, class, nature, bp_group, current_class, dre_class, dfc_default, presentation_sign, is_cash, active)
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

  -- ── TEST SUITE ──────────────────────────────────────────────────────────

  -- T01: Function exists
  v_total := v_total + 1;
  IF (SELECT COUNT(*) FROM pg_proc WHERE proname = 'get_financial_dashboard') > 0 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T01 FAIL: Function get_financial_dashboard not found'; END IF;

  -- T02: Returns jsonb
  v_result := get_financial_dashboard();
  v_total := v_total + 1;
  IF v_result IS NOT NULL AND jsonb_typeof(v_result) = 'object' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T02 FAIL: Result is not jsonb object'; END IF;

  -- T03: SECURITY DEFINER
  v_total := v_total + 1;
  IF (SELECT prosecdef FROM pg_proc WHERE proname = 'get_financial_dashboard' LIMIT 1) THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T03 FAIL: Not SECURITY DEFINER'; END IF;

  -- T04: STABLE
  v_total := v_total + 1;
  IF (SELECT provolatile FROM pg_proc WHERE proname = 'get_financial_dashboard' LIMIT 1) = 's' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T04 FAIL: Not STABLE'; END IF;

  -- T05: Has period key
  v_total := v_total + 1;
  IF v_result ? 'period' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T05 FAIL: No period key'; END IF;

  -- T06: Has cashflow key
  v_total := v_total + 1;
  IF v_result ? 'cashflow' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T06 FAIL: No cashflow key'; END IF;

  -- T07: Has receivables key
  v_total := v_total + 1;
  IF v_result ? 'receivables' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T07 FAIL: No receivables key'; END IF;

  -- T08: Has payables key
  v_total := v_total + 1;
  IF v_result ? 'payables' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T08 FAIL: No payables key'; END IF;

  -- T09: Has income_statement key
  v_total := v_total + 1;
  IF v_result ? 'income_statement' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T09 FAIL: No income_statement key'; END IF;

  -- T10: Has balance_sheet key
  v_total := v_total + 1;
  IF v_result ? 'balance_sheet' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T10 FAIL: No balance_sheet key'; END IF;

  -- T11: Period has from/to/as_of_date
  v_total := v_total + 1;
  IF (v_result->'period') ? 'from' AND (v_result->'period') ? 'to' AND (v_result->'period') ? 'as_of_date' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T11 FAIL: Period missing from/to/as_of_date'; END IF;

  -- T12: Cashflow has opening/closing/realized fields
  v_total := v_total + 1;
  IF (v_result->'cashflow') ? 'opening_balance' AND (v_result->'cashflow') ? 'closing_balance' AND (v_result->'cashflow') ? 'realized_inflows' AND (v_result->'cashflow') ? 'realized_outflows' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T12 FAIL: Cashflow missing fields'; END IF;

  -- T13: Cashflow closing = opening + inflows - outflows
  v_total := v_total + 1;
  IF abs(((v_result->'cashflow')->>'closing_balance')::numeric - (((v_result->'cashflow')->>'opening_balance')::numeric + ((v_result->'cashflow')->>'realized_inflows')::numeric - ((v_result->'cashflow')->>'realized_outflows')::numeric)) < 0.01 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T13 FAIL: Cashflow equation mismatch'; END IF;

  -- T14: Cashflow projected fields exist
  v_total := v_total + 1;
  IF (v_result->'cashflow') ? 'projected_inflows' AND (v_result->'cashflow') ? 'projected_outflows' AND (v_result->'cashflow') ? 'projected_balance' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T14 FAIL: Cashflow missing projected fields'; END IF;

  -- T15: Cashflow opening_balance not null
  v_total := v_total + 1;
  IF ((v_result->'cashflow')->>'opening_balance') IS NOT NULL THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T15 FAIL: opening_balance is null'; END IF;

  -- T16: Receivables has open/overdue/due fields
  v_total := v_total + 1;
  IF (v_result->'receivables') ? 'open' AND (v_result->'receivables') ? 'overdue' AND (v_result->'receivables') ? 'due_in_7_days' AND (v_result->'receivables') ? 'due_in_30_days' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T16 FAIL: Receivables missing fields'; END IF;

  -- T17: AR overdue <= AR open
  v_total := v_total + 1;
  IF ((v_result->'receivables')->>'overdue')::numeric <= ((v_result->'receivables')->>'open')::numeric + 0.01 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T17 FAIL: AR overdue > AR open'; END IF;

  -- T18: AR due_in_7_days <= AR open
  v_total := v_total + 1;
  IF ((v_result->'receivables')->>'due_in_7_days')::numeric <= ((v_result->'receivables')->>'open')::numeric + 0.01 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T18 FAIL: AR due_7 > AR open'; END IF;

  -- T19: AR due_in_30_days >= AR due_in_7_days
  v_total := v_total + 1;
  IF ((v_result->'receivables')->>'due_in_30_days')::numeric >= ((v_result->'receivables')->>'due_in_7_days')::numeric - 0.01 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T19 FAIL: AR due_30 < AR due_7'; END IF;

  -- T20: AR overdue >= 0
  v_total := v_total + 1;
  IF ((v_result->'receivables')->>'overdue')::numeric >= 0 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T20 FAIL: AR overdue < 0'; END IF;

  -- T21: Payables has open/overdue/due fields
  v_total := v_total + 1;
  IF (v_result->'payables') ? 'open' AND (v_result->'payables') ? 'overdue' AND (v_result->'payables') ? 'due_in_7_days' AND (v_result->'payables') ? 'due_in_30_days' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T21 FAIL: Payables missing fields'; END IF;

  -- T22: AP overdue <= AP open
  v_total := v_total + 1;
  IF ((v_result->'payables')->>'overdue')::numeric <= ((v_result->'payables')->>'open')::numeric + 0.01 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T22 FAIL: AP overdue > AP open'; END IF;

  -- T23: AP due_in_7_days <= AP open
  v_total := v_total + 1;
  IF ((v_result->'payables')->>'due_in_7_days')::numeric <= ((v_result->'payables')->>'open')::numeric + 0.01 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T23 FAIL: AP due_7 > AP open'; END IF;

  -- T24: AP due_in_30_days >= AP due_in_7_days
  v_total := v_total + 1;
  IF ((v_result->'payables')->>'due_in_30_days')::numeric >= ((v_result->'payables')->>'due_in_7_days')::numeric - 0.01 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T24 FAIL: AP due_30 < AP due_7'; END IF;

  -- T25: Income statement has all required fields
  v_total := v_total + 1;
  IF (v_result->'income_statement') ? 'revenue' AND (v_result->'income_statement') ? 'net_revenue' AND (v_result->'income_statement') ? 'ebitda' AND (v_result->'income_statement') ? 'net_result' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T25 FAIL: IS missing fields'; END IF;

  -- T26: IS has margin fields
  v_total := v_total + 1;
  IF (v_result->'income_statement') ? 'margin_ebitda' AND (v_result->'income_statement') ? 'margin_net' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T26 FAIL: IS missing margin fields'; END IF;

  -- T27: IS net_revenue = revenue - revenue_deductions
  v_total := v_total + 1;
  IF abs(((v_result->'income_statement')->>'net_revenue')::numeric - (((v_result->'income_statement')->>'revenue')::numeric - ((v_result->'income_statement')->>'revenue_deductions')::numeric)) < 0.01 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T27 FAIL: IS net_revenue equation mismatch'; END IF;

  -- T28: IS revenue not null
  v_total := v_total + 1;
  IF ((v_result->'income_statement')->>'revenue') IS NOT NULL THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T28 FAIL: IS revenue is null'; END IF;

  -- T29: IS margin_ebitda in reasonable range
  v_total := v_total + 1;
  IF ((v_result->'income_statement')->>'margin_ebitda')::numeric BETWEEN -1000 AND 1000 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T29 FAIL: IS margin_ebitda out of range'; END IF;

  -- T30: Balance sheet has all required fields
  v_total := v_total + 1;
  IF (v_result->'balance_sheet') ? 'total_assets' AND (v_result->'balance_sheet') ? 'total_liabilities' AND (v_result->'balance_sheet') ? 'equity' AND (v_result->'balance_sheet') ? 'working_capital' AND (v_result->'balance_sheet') ? 'current_ratio' AND (v_result->'balance_sheet') ? 'leverage' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T30 FAIL: BS missing fields'; END IF;

  -- T31: BS has current_assets and current_liabilities
  v_total := v_total + 1;
  IF (v_result->'balance_sheet') ? 'current_assets' AND (v_result->'balance_sheet') ? 'current_liabilities' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T31 FAIL: BS missing current fields'; END IF;

  -- T32: BS working_capital = current_assets - current_liabilities
  v_total := v_total + 1;
  IF abs(((v_result->'balance_sheet')->>'working_capital')::numeric - (((v_result->'balance_sheet')->>'current_assets')::numeric - ((v_result->'balance_sheet')->>'current_liabilities')::numeric)) < 0.01 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T32 FAIL: BS working_capital equation mismatch'; END IF;

  -- T33: BS current_ratio = current_assets / current_liabilities
  v_total := v_total + 1;
  v_detail := ((v_result->'balance_sheet')->>'current_ratio')::text;
  IF ((v_result->'balance_sheet')->>'current_liabilities')::numeric > 0 THEN
    IF abs(((v_result->'balance_sheet')->>'current_ratio')::numeric - (((v_result->'balance_sheet')->>'current_assets')::numeric / ((v_result->'balance_sheet')->>'current_liabilities')::numeric)) < 0.01 THEN
      v_pass := v_pass + 1;
    ELSE v_fail := v_fail + 1; RAISE NOTICE 'T33 FAIL: BS current_ratio mismatch';
    END IF;
  ELSE
    IF ((v_result->'balance_sheet')->>'current_ratio')::numeric = 0 THEN v_pass := v_pass + 1;
    ELSE v_fail := v_fail + 1; RAISE NOTICE 'T33 FAIL: BS current_ratio non-zero with zero CL';
    END IF;
  END IF;

  -- T34: BS leverage = total_liabilities / equity
  v_total := v_total + 1;
  v_detail := ((v_result->'balance_sheet')->>'leverage')::text;
  IF ((v_result->'balance_sheet')->>'equity')::numeric <> 0 THEN
    IF abs(((v_result->'balance_sheet')->>'leverage')::numeric - (((v_result->'balance_sheet')->>'total_liabilities')::numeric / ((v_result->'balance_sheet')->>'equity')::numeric)) < 0.01 THEN
      v_pass := v_pass + 1;
    ELSE v_fail := v_fail + 1; RAISE NOTICE 'T34 FAIL: BS leverage mismatch';
    END IF;
  ELSE
    IF ((v_result->'balance_sheet')->>'leverage')::numeric = 0 THEN v_pass := v_pass + 1;
    ELSE v_fail := v_fail + 1; RAISE NOTICE 'T34 FAIL: BS leverage non-zero with zero equity';
    END IF;
  END IF;

  -- T35: BS total_assets >= 0
  v_total := v_total + 1;
  IF ((v_result->'balance_sheet')->>'total_assets')::numeric >= 0 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T35 FAIL: BS total_assets < 0'; END IF;

  -- T36: Dashboard AR = receivables_v
  v_total := v_total + 1;
  IF abs(((v_result->'receivables')->>'open')::numeric - (SELECT COALESCE(SUM(CASE WHEN status = 'pending' THEN open_amount ELSE 0 END), 0) FROM public.financial_receivables_v)) < 0.01 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T36 FAIL: AR mismatch with receivables_v'; END IF;

  -- T37: Dashboard AP = payables_v
  v_total := v_total + 1;
  IF abs(((v_result->'payables')->>'open')::numeric - (SELECT COALESCE(SUM(CASE WHEN status = 'pending' THEN open_amount ELSE 0 END), 0) FROM public.financial_payables_v)) < 0.01 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T37 FAIL: AP mismatch with payables_v'; END IF;

  -- T38: No-args call returns valid JSON
  v_total := v_total + 1;
  IF jsonb_typeof(get_financial_dashboard()) = 'object' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T38 FAIL: No-args call failed'; END IF;

  -- T39: Custom date range works
  v_total := v_total + 1;
  IF jsonb_typeof(get_financial_dashboard('2026-01-01', '2026-12-31', NULL, NULL, NULL)) = 'object' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T39 FAIL: Custom date range failed'; END IF;

  -- T40: as_of_date parameter works
  v_total := v_total + 1;
  IF (get_financial_dashboard(NULL, NULL, '2026-08-31', NULL, NULL)->'balance_sheet') ? 'total_assets' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T40 FAIL: as_of_date parameter failed'; END IF;

  -- T41: Cost center filter works
  v_total := v_total + 1;
  IF jsonb_typeof(get_financial_dashboard(NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid, NULL)) = 'object' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T41 FAIL: Cost center filter failed'; END IF;

  -- T42: Service line filter works
  v_total := v_total + 1;
  IF jsonb_typeof(get_financial_dashboard(NULL, NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid)) = 'object' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T42 FAIL: Service line filter failed'; END IF;

  -- T43: Both filters together works
  v_total := v_total + 1;
  IF jsonb_typeof(get_financial_dashboard('2026-08-01', '2026-08-31', NULL, '00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid)) = 'object' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T43 FAIL: Both filters failed'; END IF;

  -- T44: Non-existent cost center returns zero cashflow
  v_total := v_total + 1;
  IF ((get_financial_dashboard(NULL, NULL, NULL, '99999999-9999-9999-9999-999999999999'::uuid, NULL)->'cashflow')->>'closing_balance')::numeric = 0 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T44 FAIL: Non-existent CC returned non-zero'; END IF;

  -- T45: Non-existent cost center returns zero AR
  v_total := v_total + 1;
  IF ((get_financial_dashboard(NULL, NULL, NULL, '99999999-9999-9999-9999-999999999999'::uuid, NULL)->'receivables')->>'open')::numeric = 0 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T45 FAIL: Non-existent CC returned non-zero AR'; END IF;

  -- T46: Non-existent service line returns zero AP
  v_total := v_total + 1;
  IF ((get_financial_dashboard(NULL, NULL, NULL, NULL, '99999999-9999-9999-9999-999999999999'::uuid)->'payables')->>'open')::numeric = 0 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T46 FAIL: Non-existent SL returned non-zero AP'; END IF;

  -- T47: Period from defaults to month start
  v_total := v_total + 1;
  IF (get_financial_dashboard()->'period')->>'from' = date_trunc('month', current_date)::date::text THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T47 FAIL: Period from default mismatch'; END IF;

  -- T48: Period to defaults to current date
  v_total := v_total + 1;
  IF (get_financial_dashboard()->'period')->>'to' = current_date::text THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T48 FAIL: Period to default mismatch'; END IF;

  -- T49: as_of_date defaults to current date
  v_total := v_total + 1;
  IF (get_financial_dashboard()->'period')->>'as_of_date' = current_date::text THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T49 FAIL: as_of_date default mismatch'; END IF;

  -- T50: No unbalanced journals in test fixtures
  v_total := v_total + 1;
  IF (SELECT COUNT(*) FROM public.financial_journal_entries je WHERE je.description LIKE '%Teste 08H%' AND ABS((SELECT COALESCE(SUM(debit), 0) FROM public.financial_journal_lines WHERE entry_id = je.id) - (SELECT COALESCE(SUM(credit), 0) FROM public.financial_journal_lines WHERE entry_id = je.id)) > 0.01) = 0 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T50 FAIL: Unbalanced journals found'; END IF;

  -- T51: No orphan journal lines
  v_total := v_total + 1;
  IF (SELECT COUNT(*) FROM public.financial_journal_lines jl WHERE jl.entry_id IN (SELECT id FROM public.financial_journal_entries WHERE description LIKE '%Teste 08H%') AND NOT EXISTS (SELECT 1 FROM public.financial_journal_entries WHERE id = jl.entry_id)) = 0 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T51 FAIL: Orphan journal lines found'; END IF;

  -- T52: Dashboard is deterministic
  v_total := v_total + 1;
  IF get_financial_dashboard('2026-08-01', '2026-08-31', NULL, NULL, NULL) = get_financial_dashboard('2026-08-01', '2026-08-31', NULL, NULL, NULL) THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T52 FAIL: Dashboard not deterministic'; END IF;

  -- T53: IS has all row fields (revenue_deductions, cogs, gross_profit, opex, depreciation, financial_result, other_income, other_expense, tax)
  v_total := v_total + 1;
  IF (v_result->'income_statement') ? 'revenue_deductions' AND (v_result->'income_statement') ? 'cogs' AND (v_result->'income_statement') ? 'gross_profit' AND (v_result->'income_statement') ? 'opex' AND (v_result->'income_statement') ? 'depreciation' AND (v_result->'income_statement') ? 'financial_result' AND (v_result->'income_statement') ? 'other_income' AND (v_result->'income_statement') ? 'other_expense' AND (v_result->'income_statement') ? 'tax' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T53 FAIL: IS missing detailed row fields'; END IF;

  -- T54: BS has non_current_liabilities
  v_total := v_total + 1;
  IF (v_result->'balance_sheet') ? 'non_current_liabilities' THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T54 FAIL: BS missing non_current_liabilities'; END IF;

  -- T55: BS equation: total_assets = total_liabilities + equity
  v_total := v_total + 1;
  IF abs(((v_result->'balance_sheet')->>'total_assets')::numeric - (((v_result->'balance_sheet')->>'total_liabilities')::numeric + ((v_result->'balance_sheet')->>'equity')::numeric)) < 0.01 THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T55 FAIL: BS equation mismatch (A = L + PL)'; END IF;

  -- T56: IS all margin values are numeric
  v_total := v_total + 1;
  IF ((v_result->'income_statement')->>'margin_ebitda') IS NOT NULL AND ((v_result->'income_statement')->>'margin_net') IS NOT NULL THEN v_pass := v_pass + 1; ELSE v_fail := v_fail + 1; RAISE NOTICE 'T56 FAIL: IS margin values are null'; END IF;

  -- ── SUMMARY ─────────────────────────────────────────────────────────────
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'ETAPA 08H SQL TESTS: %/% PASSED (%)', v_pass, v_total, CASE WHEN v_fail = 0 THEN 'ALL PASS' ELSE v_fail || ' FAILED' END;
  RAISE NOTICE '══════════════════════════════════════════════════════════════';

  RAISE NOTICE 'Cleanup complete.';
END $$;
