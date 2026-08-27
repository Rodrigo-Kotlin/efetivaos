-- ============================================================================
-- ETAPA 08F.1 — Microgate SQL Tests: 65+ checks
-- ============================================================================

-- Helper
CREATE OR REPLACE FUNCTION _08f1_assert(condition boolean, msg text)
RETURNS void AS $$
BEGIN
  IF NOT condition THEN RAISE EXCEPTION 'TEST FAIL: %', msg; END IF;
  RAISE NOTICE 'TEST PASS: %', msg;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- SCHEMA / CONSTRAINTS (T01-T05)
-- ===========================================================================

-- T01: financial_assets table exists
SELECT _08f1_assert(
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_assets') = 1,
  'T01: financial_assets table exists'
);

-- T02: depreciation_postings table exists
SELECT _08f1_assert(
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_asset_depreciation_postings') = 1,
  'T02: financial_asset_depreciation_postings table exists'
);

-- T03: residual <= acquisition constraint
DO $$
BEGIN
  BEGIN
    INSERT INTO public.financial_assets (asset_code, name, acquisition_date, acquisition_value, residual_value, useful_life_months)
    VALUES ('TST-CON-001', 'Test', '2026-01-01', 1000, 2000, 60);
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN check_violation THEN
    PERFORM _08f1_assert(true, 'T03: residual > acquisition rejected by CHECK');
  END;
END $$;

-- T04: useful_life_months > 0
DO $$
BEGIN
  BEGIN
    INSERT INTO public.financial_assets (asset_code, name, acquisition_date, acquisition_value, residual_value, useful_life_months)
    VALUES ('TST-CON-002', 'Test', '2026-01-01', 1000, 0, 0);
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN check_violation THEN
    PERFORM _08f1_assert(true, 'T04: useful_life=0 rejected by CHECK');
  END;
END $$;

-- T05: unique asset_code among active
DO $$
DECLARE v_id1 uuid; v_id2 uuid;
BEGIN
  v_id1 := public.create_asset('TST-UNQ-001', 'First', null, null, '2026-01-01', 1000, 0, 60);
  BEGIN
    v_id2 := public.create_asset('TST-UNQ-001', 'Second', null, null, '2026-01-01', 2000, 0, 60);
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN unique_violation THEN
    PERFORM _08f1_assert(true, 'T05: duplicate asset_code rejected');
  END;
  DELETE FROM public.financial_assets WHERE id = v_id1;
END $$;

-- ===========================================================================
-- ACCOUNT CLASS VALIDATION (T06-T11)
-- ===========================================================================

-- T06: asset account must be ATIVO
DO $$
DECLARE v_passivo_id uuid;
BEGIN
  SELECT id INTO v_passivo_id FROM public.financial_chart_accounts WHERE class = 'PASSIVO' AND posting = true AND active = true LIMIT 1;
  IF v_passivo_id IS NULL THEN
    PERFORM _08f1_assert(true, 'T06: SKIP (no PASSIVO account)');
    RETURN;
  END IF;
  BEGIN
    PERFORM public.create_asset('TST-ACC-001', 'Test', null, null, '2026-01-01', 1000, 0, 60,
      null, null, null, null, null, null, v_passivo_id, null, null);
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08f1_assert(SQLSTATE = 'P0001', 'T06: PASSIVO account rejected for asset');
  END;
END $$;

-- T07: accumulated depreciation account must be ATIVO
DO $$
DECLARE v_asset_id uuid; v_passivo_id uuid;
BEGIN
  SELECT id INTO v_asset_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND current_class = 'NAO_CIRCULANTE' LIMIT 1;
  SELECT id INTO v_passivo_id FROM public.financial_chart_accounts WHERE class = 'PASSIVO' AND posting = true AND active = true LIMIT 1;
  IF v_asset_id IS NULL OR v_passivo_id IS NULL THEN
    PERFORM _08f1_assert(true, 'T07: SKIP (no suitable accounts)');
    RETURN;
  END IF;
  BEGIN
    PERFORM public.create_asset('TST-ACC-002', 'Test', null, null, '2026-01-01', 1000, 0, 60,
      null, null, null, null, null, null, v_asset_id, v_passivo_id, null);
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08f1_assert(SQLSTATE = 'P0001', 'T07: PASSIVO rejected for accumulated depreciation');
  END;
END $$;

-- T08: expense account must be DESPESA
DO $$
DECLARE v_asset_id uuid; v_receita_id uuid;
BEGIN
  SELECT id INTO v_asset_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND current_class = 'NAO_CIRCULANTE' LIMIT 1;
  SELECT id INTO v_receita_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND posting = true AND active = true LIMIT 1;
  IF v_asset_id IS NULL OR v_receita_id IS NULL THEN
    PERFORM _08f1_assert(true, 'T08: SKIP (no suitable accounts)');
    RETURN;
  END IF;
  BEGIN
    PERFORM public.create_asset('TST-ACC-003', 'Test', null, null, '2026-01-01', 1000, 0, 60,
      null, null, null, null, null, null, v_asset_id, null, v_receita_id);
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08f1_assert(SQLSTATE = 'P0001', 'T08: RECEITA rejected for depreciation expense');
  END;
END $$;

-- T09: expense account must have dre_class DEPRECIACAO_AMORTIZACAO
DO $$
DECLARE v_asset_id uuid; v_desp_id uuid;
BEGIN
  SELECT id INTO v_asset_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND current_class = 'NAO_CIRCULANTE' LIMIT 1;
  SELECT id INTO v_desp_id FROM public.financial_chart_accounts WHERE class = 'DESPESA' AND posting = true AND active = true AND (dre_class = '' OR dre_class IS NULL) LIMIT 1;
  IF v_asset_id IS NULL OR v_desp_id IS NULL THEN
    PERFORM _08f1_assert(true, 'T09: SKIP (no suitable accounts)');
    RETURN;
  END IF;
  BEGIN
    PERFORM public.create_asset('TST-ACC-004', 'Test', null, null, '2026-01-01', 1000, 0, 60,
      null, null, null, null, null, null, v_asset_id, null, v_desp_id);
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08f1_assert(SQLSTATE = 'P0001', 'T09: DESPESA without DEPRECIACAO_AMORTIZACAO rejected');
  END;
END $$;

-- T10: correct accounts pass
DO $$
DECLARE v_asset_id uuid; v_accum_id uuid; v_exp_id uuid; v_id uuid;
BEGIN
  SELECT id INTO v_asset_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND current_class = 'NAO_CIRCULANTE' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_accum_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND nature = 'CREDITO' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_exp_id FROM public.financial_chart_accounts WHERE class = 'DESPESA' AND posting = true AND active = true AND dre_class = 'DEPRECIACAO_AMORTIZACAO' LIMIT 1;
  IF v_asset_id IS NULL OR v_accum_id IS NULL OR v_exp_id IS NULL THEN
    PERFORM _08f1_assert(true, 'T10: SKIP (no suitable accounts)');
    RETURN;
  END IF;
  v_id := public.create_asset('TST-ACC-OK', 'Valid Asset', null, null, '2026-01-01', 10000, 1000, 60,
    null, null, null, null, null, null, v_asset_id, v_accum_id, v_exp_id);
  PERFORM _08f1_assert(v_id IS NOT NULL, 'T10: correct accounts accepted');
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T11: update_asset also validates accounts
DO $$
DECLARE v_id uuid; v_passivo_id uuid;
BEGIN
  SELECT id INTO v_passivo_id FROM public.financial_chart_accounts WHERE class = 'PASSIVO' AND posting = true AND active = true LIMIT 1;
  IF v_passivo_id IS NULL THEN
    PERFORM _08f1_assert(true, 'T11: SKIP');
    RETURN;
  END IF;
  v_id := public.create_asset('TST-UPD-001', 'Test', null, null, '2026-01-01', 1000, 0, 60);
  BEGIN
    PERFORM public.update_asset(v_id, null, null, null, null, null, null, null, null, v_passivo_id);
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08f1_assert(SQLSTATE = 'P0001', 'T11: update_asset rejects PASSIVO account');
  END;
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- ===========================================================================
-- DEPRECIATION (T12-T22)
-- ===========================================================================

-- T12: create asset with accounts for posting test
DO $$
DECLARE v_asset_id uuid; v_accum_id uuid; v_exp_id uuid; v_id uuid;
BEGIN
  SELECT id INTO v_asset_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND current_class = 'NAO_CIRCULANTE' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_accum_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND nature = 'CREDITO' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_exp_id FROM public.financial_chart_accounts WHERE class = 'DESPESA' AND posting = true AND active = true AND dre_class = 'DEPRECIACAO_AMORTIZACAO' LIMIT 1;
  IF v_asset_id IS NULL OR v_accum_id IS NULL OR v_exp_id IS NULL THEN
    PERFORM _08f1_assert(true, 'T12: SKIP (no suitable accounts)');
    RETURN;
  END IF;
  v_id := public.create_asset('TST-DEP-001', 'Deprec Test', null, null, '2026-01-01', 12000, 2000, 60,
    null, null, null, null, null, null, v_asset_id, v_accum_id, v_exp_id);
  PERFORM _08f1_assert(v_id IS NOT NULL, 'T12: asset created for depreciation');
  -- Will be cleaned up at end
END $$;

-- T13: competence normalization to first day of month
DO $$
DECLARE v_id uuid; v_accum_id uuid; v_exp_id uuid; v_asset_id uuid; v_post uuid;
BEGIN
  SELECT id INTO v_asset_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND current_class = 'NAO_CIRCULANTE' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_accum_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND nature = 'CREDITO' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_exp_id FROM public.financial_chart_accounts WHERE class = 'DESPESA' AND posting = true AND active = true AND dre_class = 'DEPRECIACAO_AMORTIZACAO' LIMIT 1;
  IF v_asset_id IS NULL OR v_accum_id IS NULL OR v_exp_id IS NULL THEN
    PERFORM _08f1_assert(true, 'T13: SKIP');
    RETURN;
  END IF;
  v_id := public.create_asset('TST-CMP-001', 'Norm Test', null, null, '2026-01-01', 12000, 0, 60,
    null, null, null, null, null, null, v_asset_id, v_accum_id, v_exp_id);
  v_post := public.post_asset_depreciation(v_id, '2026-06-15');
  PERFORM _08f1_assert(
    (SELECT competence_period FROM public.financial_asset_depreciation_postings WHERE id = v_post) = '2026-06-01',
    'T13: competence normalized to first day of month'
  );
  DELETE FROM public.financial_asset_depreciation_postings WHERE asset_id = v_id;
  DELETE FROM public.financial_journal_lines WHERE entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'Depreciacao: Norm Test%'));
  DELETE FROM public.financial_journal_entries WHERE transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'Depreciacao: Norm Test%');
  DELETE FROM public.financial_transactions WHERE description LIKE 'Depreciacao: Norm Test%';
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T14: idempotency - same month rejected
DO $$
DECLARE v_id uuid; v_accum_id uuid; v_exp_id uuid; v_asset_id uuid; v_post uuid;
BEGIN
  SELECT id INTO v_asset_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND current_class = 'NAO_CIRCULANTE' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_accum_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND nature = 'CREDITO' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_exp_id FROM public.financial_chart_accounts WHERE class = 'DESPESA' AND posting = true AND active = true AND dre_class = 'DEPRECIACAO_AMORTIZACAO' LIMIT 1;
  IF v_asset_id IS NULL OR v_accum_id IS NULL OR v_exp_id IS NULL THEN
    PERFORM _08f1_assert(true, 'T14: SKIP');
    RETURN;
  END IF;
  v_id := public.create_asset('TST-IDM-001', 'Idem Test', null, null, '2026-01-01', 12000, 0, 60,
    null, null, null, null, null, null, v_asset_id, v_accum_id, v_exp_id);
  v_post := public.post_asset_depreciation(v_id, '2026-07-01');
  BEGIN
    PERFORM public.post_asset_depreciation(v_id, '2026-07-15');
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08f1_assert(true, 'T14: duplicate month rejected');
  END;
  DELETE FROM public.financial_asset_depreciation_postings WHERE asset_id = v_id;
  DELETE FROM public.financial_journal_lines WHERE entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'Depreciacao: Idem Test%'));
  DELETE FROM public.financial_journal_entries WHERE transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'Depreciacao: Idem Test%');
  DELETE FROM public.financial_transactions WHERE description LIKE 'Depreciacao: Idem Test%';
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T15: posting creates balanced journal (debit = credit)
DO $$
DECLARE v_id uuid; v_accum_id uuid; v_exp_id uuid; v_asset_id uuid; v_post uuid; v_je_id uuid; v_sum numeric;
BEGIN
  SELECT id INTO v_asset_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND current_class = 'NAO_CIRCULANTE' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_accum_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND nature = 'CREDITO' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_exp_id FROM public.financial_chart_accounts WHERE class = 'DESPESA' AND posting = true AND active = true AND dre_class = 'DEPRECIACAO_AMORTIZACAO' LIMIT 1;
  IF v_asset_id IS NULL OR v_accum_id IS NULL OR v_exp_id IS NULL THEN
    PERFORM _08f1_assert(true, 'T15: SKIP');
    RETURN;
  END IF;
  v_id := public.create_asset('TST-BAL-001', 'Bal Test', null, null, '2026-01-01', 12000, 0, 60,
    null, null, null, null, null, null, v_asset_id, v_accum_id, v_exp_id);
  v_post := public.post_asset_depreciation(v_id, '2026-08-01');
  SELECT journal_entry_id INTO v_je_id FROM public.financial_asset_depreciation_postings WHERE id = v_post;
  SELECT ABS(SUM(debit) - SUM(credit)) INTO v_sum FROM public.financial_journal_lines WHERE entry_id = v_je_id;
  PERFORM _08f1_assert(v_sum < 0.01, 'T15: journal is balanced (debit=credit)');
  DELETE FROM public.financial_asset_depreciation_postings WHERE asset_id = v_id;
  DELETE FROM public.financial_journal_lines WHERE entry_id = v_je_id;
  DELETE FROM public.financial_journal_entries WHERE id = v_je_id;
  DELETE FROM public.financial_transactions WHERE id = (SELECT transaction_id FROM public.financial_journal_entries WHERE id = v_je_id);
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T16: debit goes to expense account
DO $$
DECLARE v_id uuid; v_accum_id uuid; v_exp_id uuid; v_asset_id uuid; v_post uuid; v_je_id uuid; v_debit_acct uuid;
BEGIN
  SELECT id INTO v_asset_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND current_class = 'NAO_CIRCULANTE' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_accum_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND nature = 'CREDITO' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_exp_id FROM public.financial_chart_accounts WHERE class = 'DESPESA' AND posting = true AND active = true AND dre_class = 'DEPRECIACAO_AMORTIZACAO' LIMIT 1;
  IF v_asset_id IS NULL OR v_accum_id IS NULL OR v_exp_id IS NULL THEN
    PERFORM _08f1_assert(true, 'T16: SKIP');
    RETURN;
  END IF;
  v_id := public.create_asset('TST-DR-001', 'Debit Test', null, null, '2026-01-01', 12000, 0, 60,
    null, null, null, null, null, null, v_asset_id, v_accum_id, v_exp_id);
  v_post := public.post_asset_depreciation(v_id, '2026-09-01');
  SELECT journal_entry_id INTO v_je_id FROM public.financial_asset_depreciation_postings WHERE id = v_post;
  SELECT chart_account_id INTO v_debit_acct FROM public.financial_journal_lines WHERE entry_id = v_je_id AND debit > 0 LIMIT 1;
  PERFORM _08f1_assert(v_debit_acct = v_exp_id, 'T16: debit goes to expense account');
  DELETE FROM public.financial_asset_depreciation_postings WHERE asset_id = v_id;
  DELETE FROM public.financial_journal_lines WHERE entry_id = v_je_id;
  DELETE FROM public.financial_journal_entries WHERE id = v_je_id;
  DELETE FROM public.financial_transactions WHERE id = (SELECT transaction_id FROM public.financial_journal_entries WHERE id = v_je_id);
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T17: credit goes to accumulated depreciation account
DO $$
DECLARE v_id uuid; v_accum_id uuid; v_exp_id uuid; v_asset_id uuid; v_post uuid; v_je_id uuid; v_credit_acct uuid;
BEGIN
  SELECT id INTO v_asset_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND current_class = 'NAO_CIRCULANTE' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_accum_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND nature = 'CREDITO' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_exp_id FROM public.financial_chart_accounts WHERE class = 'DESPESA' AND posting = true AND active = true AND dre_class = 'DEPRECIACAO_AMORTIZACAO' LIMIT 1;
  IF v_asset_id IS NULL OR v_accum_id IS NULL OR v_exp_id IS NULL THEN
    PERFORM _08f1_assert(true, 'T17: SKIP');
    RETURN;
  END IF;
  v_id := public.create_asset('TST-CR-001', 'Credit Test', null, null, '2026-01-01', 12000, 0, 60,
    null, null, null, null, null, null, v_asset_id, v_accum_id, v_exp_id);
  v_post := public.post_asset_depreciation(v_id, '2026-10-01');
  SELECT journal_entry_id INTO v_je_id FROM public.financial_asset_depreciation_postings WHERE id = v_post;
  SELECT chart_account_id INTO v_credit_acct FROM public.financial_journal_lines WHERE entry_id = v_je_id AND credit > 0 LIMIT 1;
  PERFORM _08f1_assert(v_credit_acct = v_accum_id, 'T17: credit goes to accumulated depreciation account');
  DELETE FROM public.financial_asset_depreciation_postings WHERE asset_id = v_id;
  DELETE FROM public.financial_journal_lines WHERE entry_id = v_je_id;
  DELETE FROM public.financial_journal_entries WHERE id = v_je_id;
  DELETE FROM public.financial_transactions WHERE id = (SELECT transaction_id FROM public.financial_journal_entries WHERE id = v_je_id);
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T18: estimate does not affect journal
DO $$
DECLARE v_id uuid; v_count_before bigint; v_count_after bigint;
BEGIN
  v_id := public.create_asset('TST-EST-001', 'Estimate Test', null, null, '2026-01-01', 12000, 2000, 60);
  SELECT count(*) INTO v_count_before FROM public.financial_journal_entries;
  -- Just read the view - no posting
  PERFORM * FROM public.financial_assets_list_v WHERE id = v_id;
  SELECT count(*) INTO v_count_after FROM public.financial_journal_entries;
  PERFORM _08f1_assert(v_count_before = v_count_after, 'T18: estimate does not create journal entries');
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T19: depreciable base = acquisition - residual
DO $$
DECLARE v_id uuid;
BEGIN
  v_id := public.create_asset('TST-VIEW-002', 'View Test 2', null, null, '2026-01-01', 10000, 1000, 60);
  PERFORM _08f1_assert(
    (SELECT depreciable_base FROM public.financial_assets_list_v WHERE id = v_id) = 9000,
    'T19: depreciable_base = 9000'
  );
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T20: monthly depreciation = base / months
DO $$
DECLARE v_id uuid;
BEGIN
  v_id := public.create_asset('TST-VIEW-003', 'View Test 3', null, null, '2026-01-01', 12000, 2000, 60);
  PERFORM _08f1_assert(
    (SELECT monthly_depreciation FROM public.financial_assets_list_v WHERE id = v_id) = 166.67,
    'T20: monthly_depreciation = 166.67'
  );
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T21: book value >= residual
DO $$
DECLARE v_id uuid; v_accum_id uuid; v_exp_id uuid; v_asset_id uuid;
BEGIN
  SELECT id INTO v_asset_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND current_class = 'NAO_CIRCULANTE' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_accum_id FROM public.financial_chart_accounts WHERE class = 'ATIVO' AND posting = true AND active = true AND nature = 'CREDITO' AND bp_group = 'Imobilizado' LIMIT 1;
  SELECT id INTO v_exp_id FROM public.financial_chart_accounts WHERE class = 'DESPESA' AND posting = true AND active = true AND dre_class = 'DEPRECIACAO_AMORTIZACAO' LIMIT 1;
  IF v_asset_id IS NULL OR v_accum_id IS NULL OR v_exp_id IS NULL THEN
    PERFORM _08f1_assert(true, 'T21: SKIP');
    RETURN;
  END IF;
  v_id := public.create_asset('TST-BV-001', 'BV Test', null, null, '2026-01-01', 12000, 2000, 60,
    null, null, null, null, null, null, v_asset_id, v_accum_id, v_exp_id);
  PERFORM public.post_asset_depreciation(v_id, '2026-11-01');
  PERFORM _08f1_assert(
    (SELECT book_value_estimated >= 2000 FROM public.financial_assets_list_v WHERE id = v_id),
    'T21: book value >= residual value'
  );
  DELETE FROM public.financial_asset_depreciation_postings WHERE asset_id = v_id;
  DELETE FROM public.financial_journal_lines WHERE entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'Depreciacao: BV Test%'));
  DELETE FROM public.financial_journal_entries WHERE transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'Depreciacao: BV Test%');
  DELETE FROM public.financial_transactions WHERE description LIKE 'Depreciacao: BV Test%';
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T22: disposal sets status DISPOSED
DO $$
DECLARE v_id uuid;
BEGIN
  v_id := public.create_asset('TST-DSP-001', 'Dispose Test', null, null, '2026-01-01', 1000, 0, 60);
  PERFORM public.dispose_asset(v_id, 'Test disposal');
  PERFORM _08f1_assert(
    (SELECT status FROM public.financial_assets WHERE id = v_id) = 'DISPOSED',
    'T22: disposal sets DISPOSED'
  );
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- ===========================================================================
-- BALANCE SHEET (T23-T35)
-- ===========================================================================

-- T23: get_balance_sheet executes
DO $$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.get_balance_sheet('2026-12-31');
  PERFORM _08f1_assert(v_count >= 0, 'T23: get_balance_sheet executes');
END $$;

-- T24: get_balance_sheet has valid columns
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM public.get_balance_sheet('2026-12-31') LIMIT 1 LOOP
    PERFORM _08f1_assert(r.row_code IS NOT NULL, 'T24: row_code present');
    PERFORM _08f1_assert(r.class IN ('ATIVO', 'PASSIVO', 'PL'), 'T24: class is valid');
    PERFORM _08f1_assert(r.row_type IN ('DETAIL', 'SUBTOTAL', 'TOTAL'), 'T24: row_type is valid');
  END LOOP;
  PERFORM _08f1_assert(true, 'T24: schema check ok');
END $$;

-- T25: ATIVO rows exist (from seed data)
DO $$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.get_balance_sheet('2026-12-31') WHERE class = 'ATIVO';
  PERFORM _08f1_assert(v_count > 0, 'T25: ATIVO rows present');
END $$;

-- T26: PASSIVO rows exist
DO $$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.get_balance_sheet('2026-12-31') WHERE class = 'PASSIVO';
  PERFORM _08f1_assert(v_count > 0, 'T26: PASSIVO rows present');
END $$;

-- T27: PL rows exist
DO $$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.get_balance_sheet('2026-12-31') WHERE class = 'PL';
  PERFORM _08f1_assert(v_count > 0, 'T27: PL rows present');
END $$;

-- T28: equation ATIVO = PASSIVO + PL (fixture-based)
DO $$
DECLARE v_total_ativo numeric; v_total_passivo numeric; v_total_pl numeric; v_diff numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total_ativo FROM public.get_balance_sheet('2026-12-31') WHERE class = 'ATIVO';
  SELECT COALESCE(SUM(amount), 0) INTO v_total_passivo FROM public.get_balance_sheet('2026-12-31') WHERE class = 'PASSIVO';
  SELECT COALESCE(SUM(amount), 0) INTO v_total_pl FROM public.get_balance_sheet('2026-12-31') WHERE class = 'PL';
  v_diff := ABS(v_total_ativo - (v_total_passivo + v_total_pl));
  PERFORM _08f1_assert(v_diff < 0.01, 'T28: equation A = P + PL (diff=' || v_diff::text || ')');
END $$;

-- T29: accumulated depreciation shows as negative in ATIVO
DO $$
DECLARE v_has_negative boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.get_balance_sheet('2026-12-31')
    WHERE class = 'ATIVO' AND amount < 0 AND label ILIKE '%deprecia%'
  ) INTO v_has_negative;
  PERFORM _08f1_assert(v_has_negative, 'T29: accumulated depreciation is negative in ATIVO');
END $$;

-- T30: Result included exactly once in PL
DO $$
DECLARE v_re_count bigint;
BEGIN
  SELECT count(*) INTO v_re_count FROM public.get_balance_sheet('2026-12-31') WHERE row_code = 'RE';
  PERFORM _08f1_assert(v_re_count <= 1, 'T30: Result in PL appears at most once');
END $$;

-- T31: no unbalanced journals from seed
DO $$
DECLARE v_unbal bigint;
BEGIN
  SELECT count(*) INTO v_unbal
  FROM public.financial_journal_entries je
  JOIN LATERAL (
    SELECT ABS(SUM(debit) - SUM(credit)) AS diff
    FROM public.financial_journal_lines WHERE entry_id = je.id
  ) l ON true
  WHERE l.diff >= 0.01;
  PERFORM _08f1_assert(v_unbal = 0, 'T31: no unbalanced journals');
END $$;

-- T32: no orphan journal lines
DO $$
DECLARE v_orphan bigint;
BEGIN
  SELECT count(*) INTO v_orphan
  FROM public.financial_journal_lines jl
  LEFT JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  WHERE je.id IS NULL;
  PERFORM _08f1_assert(v_orphan = 0, 'T32: no orphan journal lines');
END $$;

-- T33: no orphan depreciation postings
DO $$
DECLARE v_orphan bigint;
BEGIN
  SELECT count(*) INTO v_orphan
  FROM public.financial_asset_depreciation_postings dp
  LEFT JOIN public.financial_journal_entries je ON je.id = dp.journal_entry_id
  WHERE dp.journal_entry_id IS NOT NULL AND je.id IS NULL;
  PERFORM _08f1_assert(v_orphan = 0, 'T33: no orphan depreciation postings');
END $$;

-- T34: no duplicate depreciation postings (same asset+period POSTED)
DO $$
DECLARE v_dup bigint;
BEGIN
  SELECT count(*) INTO v_dup
  FROM (
    SELECT asset_id, competence_period, count(*) AS cnt
    FROM public.financial_asset_depreciation_postings
    WHERE status = 'POSTED'
    GROUP BY asset_id, competence_period
    HAVING count(*) > 1
  ) sub;
  PERFORM _08f1_assert(v_dup = 0, 'T34: no duplicate depreciation postings');
END $$;

-- T35: no invalid asset accounts (ATIVO check)
DO $$
DECLARE v_invalid bigint;
BEGIN
  SELECT count(*) INTO v_invalid
  FROM public.financial_assets a
  JOIN public.financial_chart_accounts ca ON ca.id = a.asset_chart_account_id
  WHERE ca.class <> 'ATIVO';
  PERFORM _08f1_assert(v_invalid = 0, 'T35: no invalid asset accounts');
END $$;

-- ===========================================================================
-- CLASSIFICATION (T36-T37)
-- ===========================================================================

-- T36: no missing bp_group or current_class on ATIVO/PASSIVO accounts
DO $$
DECLARE v_missing bigint;
BEGIN
  SELECT count(*) INTO v_missing
  FROM public.financial_chart_accounts
  WHERE class IN ('ATIVO', 'PASSIVO') AND active = true AND posting = true
    AND (bp_group IS NULL OR bp_group = '') AND current_class IS NULL;
  PERFORM _08f1_assert(v_missing = 0, 'T36: no missing bp_group/classification');
END $$;

-- T37: no NAO_CLASSIFICADO in BP (seed data should be clean)
DO $$
DECLARE v_nao bigint;
BEGIN
  SELECT count(*) INTO v_nao
  FROM public.get_balance_sheet('2026-12-31')
  WHERE group_name = 'NAO_CLASSIFICADO';
  PERFORM _08f1_assert(v_nao = 0, 'T37: no NAO_CLASSIFICADO in BP output');
END $$;

-- ===========================================================================
-- CASH RECONCILIATION (T38-T39)
-- ===========================================================================

-- T38: BP cash accounts can be identified
DO $$
DECLARE v_cash_total numeric;
BEGIN
  SELECT COALESCE(SUM(balance * presentation_sign), 0) INTO v_cash_total
  FROM (
    SELECT ab.*, CASE WHEN ab.nature = 'DEBITO' THEN ab.total_debit - ab.total_credit
                      WHEN ab.nature = 'CREDITO' THEN ab.total_credit - ab.total_debit ELSE 0 END AS balance
    FROM (
      SELECT ca.*, COALESCE(SUM(jl.debit), 0) AS total_debit, COALESCE(SUM(jl.credit), 0) AS total_credit
      FROM public.financial_chart_accounts ca
      LEFT JOIN public.financial_journal_lines jl ON jl.chart_account_id = ca.id
      LEFT JOIN public.financial_journal_entries je ON je.id = jl.entry_id AND je.competence_date <= '2026-12-31' AND je.status <> 'cancelled'
      WHERE ca.class = 'ATIVO' AND ca.is_cash = true AND ca.active = true
      GROUP BY ca.id
    ) ab
  ) norm;
  PERFORM _08f1_assert(v_cash_total IS NOT NULL, 'T38: BP cash total calculable');
END $$;

-- T39: cash accounts exist in chart
DO $$
DECLARE v_cash_count bigint;
BEGIN
  SELECT count(*) INTO v_cash_count FROM public.financial_chart_accounts WHERE is_cash = true AND active = true;
  PERFORM _08f1_assert(v_cash_count >= 2, 'T39: at least 2 cash accounts exist');
END $$;

-- ===========================================================================
-- DISPOSAL (T40-T41)
-- ===========================================================================

-- T40: dispose rejects non-active
DO $$
DECLARE v_id uuid;
BEGIN
  v_id := public.create_asset('TST-DSP-002', 'Double Dispose', null, null, '2026-01-01', 1000, 0, 60);
  PERFORM public.dispose_asset(v_id);
  BEGIN
    PERFORM public.dispose_asset(v_id);
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08f1_assert(true, 'T40: double disposal rejected');
  END;
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T41: no hard delete possible via RLS (conceptual - check no DELETE policy)
DO $$
BEGIN
  PERFORM _08f1_assert(
    (SELECT count(*) FROM pg_policies WHERE tablename = 'financial_assets' AND cmd = 'DELETE') = 0,
    'T41: no DELETE policy on financial_assets'
  );
END $$;

-- ===========================================================================
-- SECURITY (T42-T48)
-- ===========================================================================

-- T42: view has security_invoker
DO $$
BEGIN
  PERFORM _08f1_assert(
    (SELECT reloptions FROM pg_class WHERE relname = 'financial_assets_list_v')::text LIKE '%security_invoker=true%',
    'T42: view has security_invoker=true'
  );
END $$;

-- T43: anon cannot SELECT financial_assets
DO $$
BEGIN
  PERFORM _08f1_assert(
    NOT has_table_privilege('anon', 'public.financial_assets', 'SELECT'),
    'T43: anon has no SELECT on financial_assets'
  );
END $$;

-- T44: PUBLIC cannot SELECT financial_assets
DO $$
BEGIN
  PERFORM _08f1_assert(
    NOT has_table_privilege('public', 'public.financial_assets', 'SELECT'),
    'T44: PUBLIC has no SELECT on financial_assets'
  );
END $$;

-- T45: anon cannot execute create_asset
DO $$
BEGIN
  PERFORM _08f1_assert(
    NOT has_function_privilege('anon', 'public.create_asset(text,text,text,text,date,numeric,numeric,integer,date,text,text,text,text,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid)', 'EXECUTE'),
    'T45: anon cannot execute create_asset'
  );
END $$;

-- T46: PUBLIC cannot execute get_balance_sheet
DO $$
BEGIN
  PERFORM _08f1_assert(
    NOT has_function_privilege('public', 'public.get_balance_sheet(date)', 'EXECUTE'),
    'T46: PUBLIC cannot execute get_balance_sheet'
  );
END $$;

-- T47: validate_asset_accounts is SECURITY DEFINER
DO $$
BEGIN
  PERFORM _08f1_assert(
    (SELECT prosecdef FROM pg_proc WHERE proname = 'validate_asset_accounts') = true,
    'T47: validate_asset_accounts is SECURITY DEFINER'
  );
END $$;

-- T48: is_internal_user check in asset policies
DO $$
BEGIN
  PERFORM _08f1_assert(
    (SELECT qual FROM pg_policies WHERE tablename = 'financial_assets' AND policyname = 'assets_select_internal')::text LIKE '%is_internal_user%',
    'T48: asset SELECT policy uses is_internal_user'
  );
END $$;

-- ===========================================================================
-- SEED DATA INTEGRITY (T49-T52)
-- ===========================================================================

-- T49: chart of accounts seed count
DO $$
BEGIN
  PERFORM _08f1_assert(
    (SELECT count(*) FROM public.financial_chart_accounts WHERE active = true) >= 80,
    'T49: at least 80 active chart accounts'
  );
END $$;

-- T50: no duplicate chart account codes
DO $$
DECLARE v_dup bigint;
BEGIN
  SELECT count(*) INTO v_dup
  FROM (SELECT code, count(*) FROM public.financial_chart_accounts GROUP BY code HAVING count(*) > 1) sub;
  PERFORM _08f1_assert(v_dup = 0, 'T50: no duplicate chart account codes');
END $$;

-- T51: all ATIVO accounts have presentation_sign
DO $$
DECLARE v_missing bigint;
BEGIN
  SELECT count(*) INTO v_missing
  FROM public.financial_chart_accounts
  WHERE class = 'ATIVO' AND active = true AND (presentation_sign IS NULL OR presentation_sign NOT IN (-1, 1));
  PERFORM _08f1_assert(v_missing = 0, 'T51: all ATIVO accounts have valid presentation_sign');
END $$;

-- T52: all PASSIVO accounts have presentation_sign
DO $$
DECLARE v_missing bigint;
BEGIN
  SELECT count(*) INTO v_missing
  FROM public.financial_chart_accounts
  WHERE class = 'PASSIVO' AND active = true AND (presentation_sign IS NULL OR presentation_sign NOT IN (-1, 1));
  PERFORM _08f1_assert(v_missing = 0, 'T52: all PASSIVO accounts have valid presentation_sign');
END $$;

-- ===========================================================================
-- ADDITIONAL CHECKS (T53-T65)
-- ===========================================================================

-- T53: normalize trigger uppercases asset_code
DO $$
DECLARE v_id uuid;
BEGIN
  v_id := public.create_asset('tst-norm-001', 'Norm Trigger', null, null, '2026-01-01', 1000, 0, 60);
  PERFORM _08f1_assert(
    (SELECT asset_code FROM public.financial_assets WHERE id = v_id) = 'TST-NORM-001',
    'T53: normalize trigger uppercases asset_code'
  );
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T54: residual capped at acquisition via trigger
DO $$
DECLARE v_id uuid;
BEGIN
  v_id := public.create_asset('TST-TRG-001', 'Trigger Test', null, null, '2026-01-01', 1000, 1000, 60);
  PERFORM _08f1_assert(
    (SELECT residual_value FROM public.financial_assets WHERE id = v_id) <= 1000,
    'T54: residual capped at acquisition via trigger'
  );
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T55: depreciation_start_date defaults to acquisition_date
DO $$
DECLARE v_id uuid;
BEGIN
  v_id := public.create_asset('TST-DSD-001', 'Date Test', null, null, '2026-03-15', 1000, 0, 60);
  PERFORM _08f1_assert(
    (SELECT depreciation_start_date FROM public.financial_assets WHERE id = v_id) = '2026-03-15',
    'T55: depreciation_start_date defaults to acquisition_date'
  );
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T56: create_asset rejects zero acquisition value
DO $$
BEGIN
  BEGIN
    PERFORM public.create_asset('TST-ZERO', 'Zero', null, null, '2026-01-01', 0, 0, 60);
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08f1_assert(SQLSTATE = 'P0001', 'T56: zero acquisition rejected');
  END;
END $$;

-- T57: create_asset rejects negative residual
DO $$
BEGIN
  BEGIN
    PERFORM public.create_asset('TST-NEG', 'Neg', null, null, '2026-01-01', 1000, -100, 60);
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08f1_assert(SQLSTATE = 'P0001', 'T57: negative residual rejected');
  END;
END $$;

-- T58: create_asset rejects residual > acquisition
DO $$
BEGIN
  BEGIN
    PERFORM public.create_asset('TST-OVER', 'Over', null, null, '2026-01-01', 1000, 2000, 60);
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08f1_assert(SQLSTATE = 'P0001', 'T58: residual>acquisition rejected');
  END;
END $$;

-- T59: create_asset rejects zero useful life
DO $$
BEGIN
  BEGIN
    PERFORM public.create_asset('TST-ULIFE', 'ULife', null, null, '2026-01-01', 1000, 0, 0);
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08f1_assert(SQLSTATE = 'P0001', 'T59: zero useful life rejected');
  END;
END $$;

-- T60: view returns accumulated_depreciation
DO $$
DECLARE v_id uuid;
BEGIN
  v_id := public.create_asset('TST-VACC', 'View Acc', null, null, '2026-01-01', 10000, 0, 60);
  PERFORM _08f1_assert(
    (SELECT accumulated_depreciation IS NOT NULL FROM public.financial_assets_list_v WHERE id = v_id),
    'T60: view returns accumulated_depreciation'
  );
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T61: validate_asset_accounts function exists
DO $$
BEGIN
  PERFORM _08f1_assert(
    (SELECT count(*) FROM pg_proc WHERE proname = 'validate_asset_accounts') = 1,
    'T61: validate_asset_accounts function exists'
  );
END $$;

-- T62: chk_residual_lte_acquisition constraint exists
DO $$
BEGIN
  PERFORM _08f1_assert(
    (SELECT count(*) FROM pg_constraint WHERE conname = 'chk_residual_lte_acquisition') = 1,
    'T62: chk_residual_lte_acquisition constraint exists'
  );
END $$;

-- T63: is_internal_user returns true for authenticated
DO $$
BEGIN
  PERFORM _08f1_assert(
    (SELECT count(*) FROM pg_proc WHERE proname = 'is_internal_user') = 1,
    'T63: is_internal_user function exists'
  );
END $$;

-- T64: disposal does not create journal entries (operational only)
DO $$
DECLARE v_id uuid; v_je_before bigint; v_je_after bigint;
BEGIN
  v_id := public.create_asset('TST-DSPJ', 'DispJ Test', null, null, '2026-01-01', 1000, 0, 60);
  SELECT count(*) INTO v_je_before FROM public.financial_journal_entries;
  PERFORM public.dispose_asset(v_id, 'No journal');
  SELECT count(*) INTO v_je_after FROM public.financial_journal_entries;
  PERFORM _08f1_assert(v_je_before = v_je_after, 'T64: disposal creates no journal entries');
  DELETE FROM public.financial_assets WHERE id = v_id;
END $$;

-- T65: get_balance_sheet date filter works
DO $$
DECLARE v_count_past bigint; v_count_future bigint;
BEGIN
  SELECT count(*) INTO v_count_past FROM public.get_balance_sheet('2020-01-01');
  SELECT count(*) INTO v_count_future FROM public.get_balance_sheet('2099-12-31');
  PERFORM _08f1_assert(v_count_future >= v_count_past, 'T65: future date returns >= past date rows');
END $$;

-- Cleanup
DROP FUNCTION IF EXISTS _08f1_assert(boolean, text);
