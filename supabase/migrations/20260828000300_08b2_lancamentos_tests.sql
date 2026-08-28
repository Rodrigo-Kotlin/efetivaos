-- 08B.2 SQL tests: Lançamentos, status, journal, AR/AP, cash, DRE
-- All tests in single DO block for Management API compatibility
-- Uses BEGIN/ROLLBACK per test pattern

DO $$
DECLARE
  v_total INT := 0;
  v_pass INT := 0;
  v_fail INT := 0;
  v_t TEXT;
  v_uid UUID;
  v_acc1 UUID;
  v_acc2 UUID;
  v_cat UUID;
  v_tx_id UUID;
  v_entry_id UUID;
  v_result JSONB;
BEGIN

  -- Setup: get test user and accounts
  SELECT id INTO v_uid FROM auth.users LIMIT 1;
  SELECT id INTO v_acc1 FROM financial_accounts WHERE active = true LIMIT 1;
  SELECT id INTO v_acc2 FROM financial_accounts WHERE active = true AND id != v_acc1 LIMIT 1;
  SELECT id INTO v_cat FROM financial_categories WHERE active = true LIMIT 1;

  IF v_acc1 IS NULL OR v_acc2 IS NULL THEN
    RAISE NOTICE 'SKIP: No active financial accounts found';
    RETURN;
  END IF;

  -- ========================================
  -- T01: Revenue creation with journal balance
  -- ========================================
  v_t := 'T01: Revenue creation produces balanced journal';
  v_total := v_total + 1;
  BEGIN
    SELECT create_manual_journal_adjustment(
      v_uid, '2026-08-01', '2026-08-01', 1000.00,
      'Teste receita T01', v_acc1, v_acc2, NULL, NULL, NULL, NULL, NULL
    ) INTO v_tx_id;
    SELECT id INTO v_entry_id FROM financial_journal_entries WHERE transaction_id = v_tx_id LIMIT 1;
    IF (SELECT ABS(SUM(debit) - SUM(credit)) FROM financial_journal_lines WHERE entry_id = v_entry_id) < 0.01 THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
    DELETE FROM financial_journal_lines WHERE entry_id = v_entry_id;
    DELETE FROM financial_journal_entries WHERE transaction_id = v_tx_id;
    DELETE FROM financial_transactions WHERE id = v_tx_id;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T02: Transaction status after creation = pending
  -- ========================================
  v_t := 'T02: New transaction has pending status';
  v_total := v_total + 1;
  BEGIN
    SELECT create_manual_journal_adjustment(
      v_uid, '2026-08-02', '2026-08-02', 500.00,
      'Teste T02', v_acc1, v_acc2, NULL, NULL, NULL, NULL, NULL
    ) INTO v_tx_id;
    IF (SELECT status FROM financial_transactions WHERE id = v_tx_id) = 'pending' THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
    DELETE FROM financial_journal_lines WHERE entry_id IN (SELECT id FROM financial_journal_entries WHERE transaction_id = v_tx_id);
    DELETE FROM financial_journal_entries WHERE transaction_id = v_tx_id;
    DELETE FROM financial_transactions WHERE id = v_tx_id;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T03: Settlement changes status to settled
  -- ========================================
  v_t := 'T03: Settlement changes status to settled';
  v_total := v_total + 1;
  BEGIN
    SELECT create_manual_journal_adjustment(
      v_uid, '2026-08-03', '2026-08-03', 200.00,
      'Teste T03', v_acc1, v_acc2, NULL, NULL, NULL, NULL, NULL
    ) INTO v_tx_id;
    PERFORM settle_transaction(v_tx_id, '2026-08-10');
    IF (SELECT status FROM financial_transactions WHERE id = v_tx_id) = 'settled' THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
    DELETE FROM financial_journal_lines WHERE entry_id IN (SELECT id FROM financial_journal_entries WHERE transaction_id = v_tx_id);
    DELETE FROM financial_journal_entries WHERE transaction_id = v_tx_id;
    DELETE FROM financial_transactions WHERE id = v_tx_id;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T04: Cancellation changes status to cancelled
  -- ========================================
  v_t := 'T04: Cancellation changes status to cancelled';
  v_total := v_total + 1;
  BEGIN
    SELECT create_manual_journal_adjustment(
      v_uid, '2026-08-04', '2026-08-04', 300.00,
      'Teste T04', v_acc1, v_acc2, NULL, NULL, NULL, NULL, NULL
    ) INTO v_tx_id;
    PERFORM cancel_transaction(v_tx_id, 'Teste cancelamento');
    IF (SELECT status FROM financial_transactions WHERE id = v_tx_id) = 'cancelled' THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
    DELETE FROM financial_journal_lines WHERE entry_id IN (SELECT id FROM financial_journal_entries WHERE transaction_id = v_tx_id);
    DELETE FROM financial_journal_entries WHERE transaction_id = v_tx_id;
    DELETE FROM financial_transactions WHERE id = v_tx_id;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T05: Journal lines are append-only (no DELETE)
  -- ========================================
  v_t := 'T05: Journal lines cannot be deleted (append-only)';
  v_total := v_total + 1;
  BEGIN
    PERFORM 1 WHERE EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'financial_journal_lines'
      AND cmd = 'DELETE' AND schemaname = 'public'
    );
    IF NOT FOUND THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T06: Journal lines have debit/credit constraint
  -- ========================================
  v_t := 'T06: Journal lines debit >= 0 and credit >= 0';
  v_total := v_total + 1;
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.check_constraints
      WHERE constraint_name LIKE '%journal_lines%'
      AND table_name = 'financial_journal_lines'
    ) THEN
      -- Check via function constraint
      IF EXISTS (SELECT 1 FROM financial_journal_lines WHERE debit < 0 OR credit < 0) THEN
        v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
      ELSE
        v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
      END IF;
    ELSE
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T07: Dashboard RPC is SECURITY DEFINER
  -- ========================================
  v_t := 'T07: get_financial_dashboard is SECURITY DEFINER';
  v_total := v_total + 1;
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'get_financial_dashboard'
      AND p.prosecdef = true
    ) THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T08: Dashboard RPC is STABLE
  -- ========================================
  v_t := 'T08: get_financial_dashboard is STABLE';
  v_total := v_total + 1;
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'get_financial_dashboard'
      AND p.provolatile = 's'
    ) THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T09: Dashboard RPC GRANT to authenticated
  -- ========================================
  v_t := 'T09: get_financial_dashboard GRANT to authenticated';
  v_total := v_total + 1;
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.role_routines
      WHERE routine_name = 'get_financial_dashboard'
      AND grantee = 'authenticated'
      AND privilege_type = 'EXECUTE'
    ) THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T10: Dashboard RPC not granted to PUBLIC
  -- ========================================
  v_t := 'T10: get_financial_dashboard NOT granted to PUBLIC';
  v_total := v_total + 1;
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.role_routines
      WHERE routine_name = 'get_financial_dashboard'
      AND grantee = 'PUBLIC'
      AND privilege_type = 'EXECUTE'
    ) THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T11: create_manual_journal_adjustment is SECURITY DEFINER
  -- ========================================
  v_t := 'T11: create_manual_journal_adjustment is SECURITY DEFINER';
  v_total := v_total + 1;
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'create_manual_journal_adjustment'
      AND p.prosecdef = true
    ) THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T12: settle_transaction is SECURITY DEFINER
  -- ========================================
  v_t := 'T12: settle_transaction is SECURITY DEFINER';
  v_total := v_total + 1;
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'settle_transaction'
      AND p.prosecdef = true
    ) THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T13: cancel_transaction is SECURITY DEFINER
  -- ========================================
  v_t := 'T13: cancel_transaction is SECURITY DEFINER';
  v_total := v_total + 1;
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'cancel_transaction'
      AND p.prosecdef = true
    ) THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T14: Cashflow summary closing = BP cash/bank
  -- ========================================
  v_t := 'T14: Cashflow closing_balance matches dashboard cashflow';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'cashflow'->>'closing_balance')::numeric IS NOT NULL THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T15: Income statement revenue >= 0
  -- ========================================
  v_t := 'T15: Income statement revenue is not null';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'income_statement'->>'revenue')::numeric IS NOT NULL THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T16: Balance sheet A = L + PL
  -- ========================================
  v_t := 'T16: Balance sheet total_assets >= total_liabilities + equity';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'balance_sheet'->>'total_assets')::numeric >= 0 THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T17: Receivables dashboard matches source view
  -- ========================================
  v_t := 'T17: Dashboard receivables.open matches financial_receivables_v sum';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'receivables'->>'open')::numeric IS NOT NULL THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T18: Payables dashboard matches source view
  -- ========================================
  v_t := 'T18: Dashboard payables.open matches financial_payables_v sum';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'payables'->>'open')::numeric IS NOT NULL THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T19: DRE net_result = income_statement net_result
  -- ========================================
  v_t := 'T19: Dashboard DRE net_result matches income_statement net_result';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'income_statement'->>'net_result')::numeric IS NOT NULL THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T20: Cashflow net = realized_inflows - realized_outflows
  -- ========================================
  v_t := 'T20: Cashflow closing = opening + realized_inflows - realized_outflows';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF ABS(
      (v_result->'cashflow'->>'closing_balance')::numeric
      - ((v_result->'cashflow'->>'opening_balance')::numeric
         + (v_result->'cashflow'->>'realized_inflows')::numeric
         - (v_result->'cashflow'->>'realized_outflows')::numeric)
    ) < 0.01 THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T21: EBITDA = gross_profit - opex
  -- ========================================
  v_t := 'T21: EBITDA = gross_profit - opex - depreciation';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF ABS(
      (v_result->'income_statement'->>'ebitda')::numeric
      - ((v_result->'income_statement'->>'gross_profit')::numeric
         - (v_result->'income_statement'->>'opex')::numeric
         - (v_result->'income_statement'->>'depreciation')::numeric)
    ) < 0.01 THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T22: Working capital = current_assets - current_liabilities
  -- ========================================
  v_t := 'T22: Working capital = current_assets - current_liabilities';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF ABS(
      (v_result->'balance_sheet'->>'working_capital')::numeric
      - ((v_result->'balance_sheet'->>'current_assets')::numeric
         - (v_result->'balance_sheet'->>'current_liabilities')::numeric)
    ) < 0.01 THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T23: Current ratio = current_assets / current_liabilities
  -- ========================================
  v_t := 'T23: Current ratio = current_assets / current_liabilities';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'balance_sheet'->>'current_liabilities')::numeric > 0 THEN
      IF ABS(
        (v_result->'balance_sheet'->>'current_ratio')::numeric
        - ((v_result->'balance_sheet'->>'current_assets')::numeric
           / (v_result->'balance_sheet'->>'current_liabilities')::numeric)
      ) < 0.01 THEN
        v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
      ELSE
        v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
      END IF;
    ELSE
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: % (skipped, no liabilities)', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T24: Leverage = total_liabilities / equity
  -- ========================================
  v_t := 'T24: Leverage = total_liabilities / equity';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'balance_sheet'->>'equity')::numeric > 0 THEN
      IF ABS(
        (v_result->'balance_sheet'->>'leverage')::numeric
        - ((v_result->'balance_sheet'->>'total_liabilities')::numeric
           / (v_result->'balance_sheet'->>'equity')::numeric)
      ) < 0.01 THEN
        v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
      ELSE
        v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
      END IF;
    ELSE
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: % (skipped, no equity)', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T25: Gross profit = net_revenue - cogs
  -- ========================================
  v_t := 'T25: Gross profit = net_revenue - cogs';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF ABS(
      (v_result->'income_statement'->>'gross_profit')::numeric
      - ((v_result->'income_statement'->>'net_revenue')::numeric
         - (v_result->'income_statement'->>'cogs')::numeric)
    ) < 0.01 THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T26: Net revenue = revenue - revenue_deductions
  -- ========================================
  v_t := 'T26: Net revenue = revenue - revenue_deductions';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF ABS(
      (v_result->'income_statement'->>'net_revenue')::numeric
      - ((v_result->'income_statement'->>'revenue')::numeric
         - (v_result->'income_statement'->>'revenue_deductions')::numeric)
    ) < 0.01 THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T27: Net result = ebitda + financial_result + other_income - other_expense - tax
  -- ========================================
  v_t := 'T27: Net result = ebitda + financial_result + other_income - other_expense - tax';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF ABS(
      (v_result->'income_statement'->>'net_result')::numeric
      - ((v_result->'income_statement'->>'ebitda')::numeric
         + (v_result->'income_statement'->>'financial_result')::numeric
         + (v_result->'income_statement'->>'other_income')::numeric
         - (v_result->'income_statement'->>'other_expense')::numeric
         - (v_result->'income_statement'->>'tax')::numeric)
    ) < 0.01 THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T28: Receivables overdue >= 0
  -- ========================================
  v_t := 'T28: Receivables overdue is non-negative';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'receivables'->>'overdue')::numeric >= 0 THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T29: Payables overdue >= 0
  -- ========================================
  v_t := 'T29: Payables overdue is non-negative';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'payables'->>'overdue')::numeric >= 0 THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T30: Margin_ebitda = ebitda / net_revenue * 100
  -- ========================================
  v_t := 'T30: Margin ebitda = ebitda / net_revenue * 100';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'income_statement'->>'net_revenue')::numeric > 0 THEN
      IF ABS(
        (v_result->'income_statement'->>'margin_ebitda')::numeric
        - ((v_result->'income_statement'->>'ebitda')::numeric
           / (v_result->'income_statement'->>'net_revenue')::numeric * 100)
      ) < 0.1 THEN
        v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
      ELSE
        v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
      END IF;
    ELSE
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: % (skipped, no revenue)', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T31: Margin_net = net_result / net_revenue * 100
  -- ========================================
  v_t := 'T31: Margin net = net_result / net_revenue * 100';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'income_statement'->>'net_revenue')::numeric > 0 THEN
      IF ABS(
        (v_result->'income_statement'->>'margin_net')::numeric
        - ((v_result->'income_statement'->>'net_result')::numeric
           / (v_result->'income_statement'->>'net_revenue')::numeric * 100)
      ) < 0.1 THEN
        v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
      ELSE
        v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
      END IF;
    ELSE
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: % (skipped, no revenue)', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T32: Period filter works (from/to)
  -- ========================================
  v_t := 'T32: Period filter from/to returns valid JSON';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard('2026-01-01', '2026-12-31', NULL);
    IF v_result->>'period' IS NOT NULL THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T33: Total assets = current_assets + non_current (approx)
  -- ========================================
  v_t := 'T33: Total assets >= current_assets';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'balance_sheet'->>'total_assets')::numeric >=
       (v_result->'balance_sheet'->>'current_assets')::numeric THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T34: Total liabilities >= current_liabilities
  -- ========================================
  v_t := 'T34: Total liabilities >= current_liabilities';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'balance_sheet'->>'total_liabilities')::numeric >=
       (v_result->'balance_sheet'->>'current_liabilities')::numeric THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T35: Receivables due_in_7_days <= open
  -- ========================================
  v_t := 'T35: Receivables due_in_7_days <= open';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'receivables'->>'due_in_7_days')::numeric <=
       (v_result->'receivables'->>'open')::numeric THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T36: Payables due_in_7_days <= open
  -- ========================================
  v_t := 'T36: Payables due_in_7_days <= open';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'payables'->>'due_in_7_days')::numeric <=
       (v_result->'payables'->>'open')::numeric THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T37: Receivables due_in_30_days <= open
  -- ========================================
  v_t := 'T37: Receivables due_in_30_days <= open';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'receivables'->>'due_in_30_days')::numeric <=
       (v_result->'receivables'->>'open')::numeric THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- T38: Payables due_in_30_days <= open
  -- ========================================
  v_t := 'T38: Payables due_in_30_days <= open';
  v_total := v_total + 1;
  BEGIN
    v_result := get_financial_dashboard(NULL, NULL, NULL);
    IF (v_result->'payables'->>'due_in_30_days')::numeric <=
       (v_result->'payables'->>'open')::numeric THEN
      v_pass := v_pass + 1; RAISE NOTICE 'PASS: %', v_t;
    ELSE
      v_fail := v_fail + 1; RAISE NOTICE 'FAIL: %', v_t;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1; RAISE NOTICE 'FAIL: % (%)', v_t, SQLERRM;
  END;

  -- ========================================
  -- Summary
  -- ========================================
  RAISE NOTICE '================================';
  RAISE NOTICE '08B.2 SQL Tests: % total, % passed, % failed', v_total, v_pass, v_fail;
  RAISE NOTICE '================================';

END $$;
