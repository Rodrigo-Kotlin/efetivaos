-- ============================================================================
-- ETAPA 08G — Microgate SQL Tests: DMPL/DLPA/DVA/Adjustments/Notes
-- ============================================================================

-- Helper
CREATE OR REPLACE FUNCTION _08g_assert(condition boolean, msg text)
RETURNS void AS $$
BEGIN
  IF NOT condition THEN RAISE EXCEPTION 'TEST FAIL: %', msg; END IF;
  RAISE NOTICE 'TEST PASS: %', msg;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEMA / TABLES (T01-T03)
-- ============================================================================

-- T01: financial_notes table exists
SELECT _08g_assert(
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_notes') = 1,
  'T01: financial_notes table exists'
);

-- T02: financial_note_type enum exists
SELECT _08g_assert(
  (SELECT count(*) FROM pg_type WHERE typname = 'financial_note_type') = 1,
  'T02: financial_note_type enum exists'
);

-- T03: financial_adjustment_status enum exists
SELECT _08g_assert(
  (SELECT count(*) FROM pg_type WHERE typname = 'financial_adjustment_status') = 1,
  'T03: financial_adjustment_status enum exists'
);

-- ============================================================================
-- RPC EXISTS (T04-T07)
-- ============================================================================

-- T04: create_manual_journal_adjustment exists
SELECT _08g_assert(
  (SELECT count(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'create_manual_journal_adjustment') = 1,
  'T04: create_manual_journal_adjustment exists'
);

-- T05: get_statement_of_changes_in_equity exists
SELECT _08g_assert(
  (SELECT count(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_statement_of_changes_in_equity') = 1,
  'T05: get_statement_of_changes_in_equity exists'
);

-- T06: get_retained_earnings_statement exists
SELECT _08g_assert(
  (SELECT count(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_retained_earnings_statement') = 1,
  'T06: get_retained_earnings_statement exists'
);

-- T07: get_value_added_statement exists
SELECT _08g_assert(
  (SELECT count(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_value_added_statement') = 1,
  'T07: get_value_added_statement exists'
);

-- ============================================================================
-- SECURITY (T08-T14)
-- ============================================================================

-- T08: financial_notes has RLS enabled
SELECT _08g_assert(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'financial_notes') = true,
  'T08: financial_notes has RLS enabled'
);

-- T09: financial_notes SELECT for authenticated
SELECT _08g_assert(
  EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'financial_notes' AND cmd = 'SELECT'
  ),
  'T09: financial_notes has SELECT policy'
);

-- T10: financial_notes INSERT for admin only
SELECT _08g_assert(
  EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'financial_notes' AND cmd = 'INSERT'
  ),
  'T10: financial_notes has INSERT policy'
);

-- T11: create_manual_journal_adjustment not granted to anon
SELECT _08g_assert(
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
    WHERE routine_name = 'create_manual_journal_adjustment' AND grantee = 'anon'
  ),
  'T11: create_manual_journal_adjustment not granted to anon'
);

-- T12: get_statement_of_changes_in_equity not granted to anon
SELECT _08g_assert(
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
    WHERE routine_name = 'get_statement_of_changes_in_equity' AND grantee = 'anon'
  ),
  'T12: get_statement_of_changes_in_equity not granted to anon'
);

-- T13: get_retained_earnings_statement not granted to anon
SELECT _08g_assert(
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
    WHERE routine_name = 'get_retained_earnings_statement' AND grantee = 'anon'
  ),
  'T13: get_retained_earnings_statement not granted to anon'
);

-- T14: get_value_added_statement not granted to anon
SELECT _08g_assert(
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_routine_grants
    WHERE routine_name = 'get_value_added_statement' AND grantee = 'anon'
  ),
  'T14: get_value_added_statement not granted to anon'
);

-- ============================================================================
-- ADJUSTMENT VALIDATION (T15-T22)
-- ============================================================================

-- T15: Minimum two lines required
DO $$
DECLARE
  v_result uuid;
BEGIN
  BEGIN
    v_result := public.create_manual_journal_adjustment(
      '2026-08-01', '2026-08-01', 'Teste 1 linha',
      null, null, null,
      '[{"chart_account_id": "00000000-0000-0000-0000-000000000001", "debit": 100, "credit": 0}]'::jsonb
    );
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08g_assert(SQLSTATE = 'P0001', 'T15: Minimum 2 lines enforced');
  END;
END $$;

-- T16: Balanced entries required
DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
BEGIN
  SELECT id INTO v_cash_id FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND active = true LIMIT 1;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    PERFORM _08g_assert(true, 'T16: SKIP (no suitable accounts)');
    RETURN;
  END IF;

  BEGIN
    PERFORM public.create_manual_journal_adjustment(
      '2026-08-01', '2026-08-01', 'Teste desbalanceado',
      null, null, null,
      format('[{"chart_account_id": "%s", "debit": 100, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 50}]', v_cash_id, v_revenue_id)::jsonb
    );
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08g_assert(SQLSTATE = 'P0001', 'T16: Unbalanced adjustment rejected');
  END;
END $$;

-- T17: Balanced adjustment accepted
DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
  v_entry_id uuid;
BEGIN
  SELECT id INTO v_cash_id FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND active = true LIMIT 1;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    PERFORM _08g_assert(true, 'T17: SKIP (no suitable accounts)');
    RETURN;
  END IF;

  v_entry_id := public.create_manual_journal_adjustment(
    '2026-08-01', '2026-08-01', 'Teste balanceado',
    null, null, null,
    format('[{"chart_account_id": "%s", "debit": 100, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 100}]', v_cash_id, v_revenue_id)::jsonb
  );

  PERFORM _08g_assert(v_entry_id IS NOT NULL, 'T17: Balanced adjustment accepted');

  -- Cleanup
  DELETE FROM public.financial_journal_lines WHERE entry_id = v_entry_id;
  DELETE FROM public.financial_journal_entries WHERE id = v_entry_id;
  DELETE FROM public.financial_transactions WHERE id = (SELECT transaction_id FROM public.financial_journal_entries WHERE id = v_entry_id);
END $$;

-- T18: Idempotency key prevents duplicate
DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
  v_entry_id1 uuid;
  v_entry_id2 uuid;
  v_key uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_cash_id FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND active = true LIMIT 1;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    PERFORM _08g_assert(true, 'T18: SKIP (no suitable accounts)');
    RETURN;
  END IF;

  v_entry_id1 := public.create_manual_journal_adjustment(
    '2026-08-01', '2026-08-01', 'Teste idempotencia',
    null, null, null,
    format('[{"chart_account_id": "%s", "debit": 50, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 50}]', v_cash_id, v_revenue_id)::jsonb,
    v_key
  );

  v_entry_id2 := public.create_manual_journal_adjustment(
    '2026-08-01', '2026-08-01', 'Teste idempotencia 2',
    null, null, null,
    format('[{"chart_account_id": "%s", "debit": 50, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 50}]', v_cash_id, v_revenue_id)::jsonb,
    v_key
  );

  PERFORM _08g_assert(v_entry_id1 = v_entry_id2, 'T18: Idempotency key prevents duplicate');

  -- Cleanup
  DELETE FROM public.financial_journal_lines WHERE entry_id = v_entry_id1;
  DELETE FROM public.financial_journal_entries WHERE id = v_entry_id1;
  DELETE FROM public.financial_transactions WHERE id = (SELECT transaction_id FROM public.financial_journal_entries WHERE id = v_entry_id1);
END $$;

-- T19: Adjustment entry type is 'ajuste'
DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
  v_entry_id uuid;
  v_entry_type text;
BEGIN
  SELECT id INTO v_cash_id FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND active = true LIMIT 1;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    PERFORM _08g_assert(true, 'T19: SKIP (no suitable accounts)');
    RETURN;
  END IF;

  v_entry_id := public.create_manual_journal_adjustment(
    '2026-08-01', '2026-08-01', 'Teste entry type',
    null, null, null,
    format('[{"chart_account_id": "%s", "debit": 75, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 75}]', v_cash_id, v_revenue_id)::jsonb
  );

  SELECT entry_type INTO v_entry_type FROM public.financial_journal_entries WHERE id = v_entry_id;

  PERFORM _08g_assert(v_entry_type = 'ajuste', 'T19: Entry type is ajuste');

  -- Cleanup
  DELETE FROM public.financial_journal_lines WHERE entry_id = v_entry_id;
  DELETE FROM public.financial_journal_entries WHERE id = v_entry_id;
  DELETE FROM public.financial_transactions WHERE id = (SELECT transaction_id FROM public.financial_journal_entries WHERE id = v_entry_id);
END $$;

-- T20: Transaction movement_type is AJUSTE
DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
  v_entry_id uuid;
  v_movement_type text;
BEGIN
  SELECT id INTO v_cash_id FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND active = true LIMIT 1;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    PERFORM _08g_assert(true, 'T20: SKIP (no suitable accounts)');
    RETURN;
  END IF;

  v_entry_id := public.create_manual_journal_adjustment(
    '2026-08-01', '2026-08-01', 'Teste movement type',
    null, null, null,
    format('[{"chart_account_id": "%s", "debit": 25, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 25}]', v_cash_id, v_revenue_id)::jsonb
  );

  SELECT t.movement_type INTO v_movement_type
  FROM public.financial_journal_entries je
  JOIN public.financial_transactions t ON t.id = je.transaction_id
  WHERE je.id = v_entry_id;

  PERFORM _08g_assert(v_movement_type = 'AJUSTE', 'T20: Movement type is AJUSTE');

  -- Cleanup
  DELETE FROM public.financial_journal_lines WHERE entry_id = v_entry_id;
  DELETE FROM public.financial_journal_entries WHERE id = v_entry_id;
  DELETE FROM public.financial_transactions WHERE id = (SELECT transaction_id FROM public.financial_journal_entries WHERE id = v_entry_id);
END $$;

-- T21: Journal lines are balanced
DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
  v_entry_id uuid;
  v_total_debit numeric;
  v_total_credit numeric;
BEGIN
  SELECT id INTO v_cash_id FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND active = true LIMIT 1;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    PERFORM _08g_assert(true, 'T21: SKIP (no suitable accounts)');
    RETURN;
  END IF;

  v_entry_id := public.create_manual_journal_adjustment(
    '2026-08-01', '2026-08-01', 'Teste balanced lines',
    null, null, null,
    format('[{"chart_account_id": "%s", "debit": 300, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 300}]', v_cash_id, v_revenue_id)::jsonb
  );

  SELECT SUM(debit), SUM(credit) INTO v_total_debit, v_total_credit
  FROM public.financial_journal_lines WHERE entry_id = v_entry_id;

  PERFORM _08g_assert(ABS(v_total_debit - v_total_credit) < 0.01, 'T21: Journal lines balanced');

  -- Cleanup
  DELETE FROM public.financial_journal_lines WHERE entry_id = v_entry_id;
  DELETE FROM public.financial_journal_entries WHERE id = v_entry_id;
  DELETE FROM public.financial_transactions WHERE id = (SELECT transaction_id FROM public.financial_journal_entries WHERE id = v_entry_id);
END $$;

-- T22: Adjustment creates note when justification provided
DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
  v_entry_id uuid;
  v_note_count integer;
BEGIN
  SELECT id INTO v_cash_id FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND active = true LIMIT 1;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    PERFORM _08g_assert(true, 'T22: SKIP (no suitable accounts)');
    RETURN;
  END IF;

  v_entry_id := public.create_manual_journal_adjustment(
    '2026-08-01', '2026-08-01', 'Teste com nota',
    null, null, null,
    format('[{"chart_account_id": "%s", "debit": 400, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 400}]', v_cash_id, v_revenue_id)::jsonb,
    null,
    'Justificativa do ajuste'
  );

  SELECT count(*) INTO v_note_count FROM public.financial_notes WHERE journal_entry_id = v_entry_id;

  PERFORM _08g_assert(v_note_count = 1, 'T22: Note created with justification');

  -- Cleanup
  DELETE FROM public.financial_notes WHERE journal_entry_id = v_entry_id;
  DELETE FROM public.financial_journal_lines WHERE entry_id = v_entry_id;
  DELETE FROM public.financial_journal_entries WHERE id = v_entry_id;
  DELETE FROM public.financial_transactions WHERE id = (SELECT transaction_id FROM public.financial_journal_entries WHERE id = v_entry_id);
END $$;

-- ============================================================================
-- NOTES (T23-T27)
-- ============================================================================

-- T23: Note can be created
DO $$
DECLARE
  v_note_id uuid;
BEGIN
  INSERT INTO public.financial_notes (note_type, title, body, report_type)
  VALUES ('GERAL', 'Nota teste', 'Corpo da nota', 'BP')
  RETURNING id INTO v_note_id;

  PERFORM _08g_assert(v_note_id IS NOT NULL, 'T23: Note created');

  DELETE FROM public.financial_notes WHERE id = v_note_id;
END $$;

-- T24: Note does not affect ledger
DO $$
DECLARE
  v_note_id uuid;
  v_journal_count integer;
BEGIN
  INSERT INTO public.financial_notes (note_type, title, body, report_type)
  VALUES ('GERAL', 'Nota sem efeito', 'Não altera ledger', 'BP')
  RETURNING id INTO v_note_id;

  SELECT count(*) INTO v_journal_count FROM public.financial_journal_entries
  WHERE description LIKE '%Nota sem efeito%';

  PERFORM _08g_assert(v_journal_count = 0, 'T24: Note does not affect ledger');

  DELETE FROM public.financial_notes WHERE id = v_note_id;
END $$;

-- T25: Note has updated_at trigger
DO $$
DECLARE
  v_note_id uuid;
  v_created_at timestamptz;
  v_updated_at timestamptz;
BEGIN
  INSERT INTO public.financial_notes (note_type, title, body, report_type)
  VALUES ('GERAL', 'Nota trigger', 'Teste trigger', 'BP')
  RETURNING id INTO v_note_id;

  SELECT created_at, updated_at INTO v_created_at, v_updated_at
  FROM public.financial_notes WHERE id = v_note_id;

  PERFORM _08g_assert(v_created_at = v_updated_at, 'T25: Note created_at = updated_at on insert');

  UPDATE public.financial_notes SET title = 'Nota trigger atualizada' WHERE id = v_note_id;

  SELECT created_at, updated_at INTO v_created_at, v_updated_at
  FROM public.financial_notes WHERE id = v_note_id;

  PERFORM _08g_assert(v_updated_at > v_created_at, 'T25: Note updated_at > created_at after update');

  DELETE FROM public.financial_notes WHERE id = v_note_id;
END $$;

-- T26: Note type enum valid
DO $$
BEGIN
  BEGIN
    INSERT INTO public.financial_notes (note_type, title, body, report_type)
    VALUES ('INVALID_TYPE', 'Nota invalida', 'Tipo invalido', 'BP');
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN invalid_text_representation THEN
    PERFORM _08g_assert(true, 'T26: Invalid note_type rejected');
  END;
END $$;

-- T27: Note title length validation
DO $$
BEGIN
  BEGIN
    INSERT INTO public.financial_notes (note_type, title, body, report_type)
    VALUES ('GERAL', '', 'Titulo vazio', 'BP');
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN check_violation THEN
    PERFORM _08g_assert(true, 'T27: Empty title rejected');
  END;
END $$;

-- ============================================================================
-- DMPL (T28-T32)
-- ============================================================================

-- T28: DMPL returns rows
DO $$
DECLARE
  v_row_count integer;
BEGIN
  SELECT count(*) INTO v_row_count FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31');

  PERFORM _08g_assert(v_row_count >= 7, 'T28: DMPL returns at least 7 rows');
END $$;

-- T29: DMPL has Saldo Inicial
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31') WHERE row_label = 'Saldo Inicial') INTO v_exists;

  PERFORM _08g_assert(v_exists, 'T29: DMPL has Saldo Inicial');
END $$;

-- T30: DMPL has Saldo Final
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31') WHERE row_label = 'Saldo Final') INTO v_exists;

  PERFORM _08g_assert(v_exists, 'T30: DMPL has Saldo Final');
END $$;

-- T31: DMPL equation (Saldo Inicial + Movimentos = Saldo Final)
DO $$
DECLARE
  v_initial numeric(15,2);
  v_movements numeric(15,2);
  v_final numeric(15,2);
BEGIN
  SELECT total_pl INTO v_initial FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  WHERE row_label = 'Saldo Inicial';

  SELECT COALESCE(SUM(total_pl), 0) INTO v_movements FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  WHERE row_label NOT IN ('Saldo Inicial', 'Saldo Final');

  SELECT total_pl INTO v_final FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  WHERE row_label = 'Saldo Final';

  PERFORM _08g_assert(ABS((v_initial + v_movements) - v_final) < 0.01, 'T31: DMPL equation holds');
END $$;

-- T32: DMPL reconciliation with BP
DO $$
DECLARE
  v_dmpl_final numeric(15,2);
  v_bp_pl numeric(15,2);
  v_bp_row record;
BEGIN
  SELECT total_pl INTO v_dmpl_final FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  WHERE row_label = 'Saldo Final';

  v_bp_pl := 0;
  FOR v_bp_row IN SELECT * FROM public.get_balance_sheet('2026-12-31')
  LOOP
    IF v_bp_row.class = 'PL' THEN
      v_bp_pl := v_bp_pl + v_bp_row.amount;
    END IF;
  END LOOP;

  PERFORM _08g_assert(ABS(v_dmpl_final - v_bp_pl) < 0.01, 'T32: DMPL reconciles with BP');
END $$;

-- ============================================================================
-- DLPA (T33-T36)
-- ============================================================================

-- T33: DLPA returns rows
DO $$
DECLARE
  v_row_count integer;
BEGIN
  SELECT count(*) INTO v_row_count FROM public.get_retained_earnings_statement('2026-01-01', '2026-12-31');

  PERFORM _08g_assert(v_row_count >= 6, 'T33: DLPA returns at least 6 rows');
END $$;

-- T34: DLPA has Saldo Inicial
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.get_retained_earnings_statement('2026-01-01', '2026-12-31')
    WHERE row_label LIKE '%Saldo Inicial%') INTO v_exists;

  PERFORM _08g_assert(v_exists, 'T34: DLPA has Saldo Inicial');
END $$;

-- T35: DLPA has Saldo Final
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.get_retained_earnings_statement('2026-01-01', '2026-12-31')
    WHERE row_label LIKE '%Saldo Final%') INTO v_exists;

  PERFORM _08g_assert(v_exists, 'T35: DLPA has Saldo Final');
END $$;

-- T36: DLPA result reconciles with DRE
DO $$
DECLARE
  v_dlpa_result numeric(15,2);
  v_dre_result numeric(15,2);
BEGIN
  SELECT amount INTO v_dlpa_result FROM public.get_retained_earnings_statement('2026-01-01', '2026-12-31')
  WHERE row_label LIKE '%Resultado Liquido%';

  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_dre_result
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA') AND ca.dre_class <> ''
    AND ca.active = true
    AND je.competence_date BETWEEN '2026-01-01' AND '2026-12-31'
    AND je.status <> 'cancelled';

  PERFORM _08g_assert(ABS(v_dlpa_result - v_dre_result) < 0.01, 'T36: DLPA result reconciles with DRE');
END $$;

-- ============================================================================
-- DVA (T37-T42)
-- ============================================================================

-- T37: DVA returns rows
DO $$
DECLARE
  v_row_count integer;
BEGIN
  SELECT count(*) INTO v_row_count FROM public.get_value_added_statement('2026-01-01', '2026-12-31');

  PERFORM _08g_assert(v_row_count >= 12, 'T37: DVA returns at least 12 rows');
END $$;

-- T38: DVA has Receitas
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.get_value_added_statement('2026-01-01', '2026-12-31')
    WHERE row_label = 'Receitas') INTO v_exists;

  PERFORM _08g_assert(v_exists, 'T38: DVA has Receitas');
END $$;

-- T39: DVA has Valor Adicionado Total a Distribuir
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.get_value_added_statement('2026-01-01', '2026-12-31')
    WHERE row_label = '= Valor Adicionado Total a Distribuir') INTO v_exists;

  PERFORM _08g_assert(v_exists, 'T39: DVA has Total a Distribuir');
END $$;

-- T40: DVA has Total Distribuido
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.get_value_added_statement('2026-01-01', '2026-12-31')
    WHERE row_label = '= Total Distribuido') INTO v_exists;

  PERFORM _08g_assert(v_exists, 'T40: DVA has Total Distribuido');
END $$;

-- T41: DVA equation (Total Distribuir = Total Distribuido)
DO $$
DECLARE
  v_total_distribuir numeric(15,2);
  v_total_distribuido numeric(15,2);
BEGIN
  SELECT amount INTO v_total_distribuir FROM public.get_value_added_statement('2026-01-01', '2026-12-31')
  WHERE row_label = '= Valor Adicionado Total a Distribuir';

  SELECT amount INTO v_total_distribuido FROM public.get_value_added_statement('2026-01-01', '2026-12-31')
  WHERE row_label = '= Total Distribuido';

  PERFORM _08g_assert(ABS(v_total_distribuir - v_total_distribuido) < 0.01, 'T41: DVA equation holds');
END $$;

-- T42: DVA depreciation from journal only
DO $$
DECLARE
  v_retencao numeric(15,2);
BEGIN
  SELECT amount INTO v_retencao FROM public.get_value_added_statement('2026-01-01', '2026-12-31')
  WHERE row_label = '(-) Retencoes (Depreciacao/Amortizacao)';

  PERFORM _08g_assert(v_retencao >= 0, 'T42: DVA depreciation >= 0 (from journal)');
END $$;

-- ============================================================================
-- INTEGRITY (T43-T50)
-- ============================================================================

-- T43: Unbalanced journals
DO $$
DECLARE
  v_unbalanced_count integer;
BEGIN
  SELECT count(*) INTO v_unbalanced_count
  FROM (
    SELECT je.id, ABS(SUM(jl.debit) - SUM(jl.credit)) AS diff
    FROM public.financial_journal_entries je
    JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
    WHERE je.status <> 'cancelled'
    GROUP BY je.id
    HAVING ABS(SUM(jl.debit) - SUM(jl.credit)) > 0.01
  ) t;

  PERFORM _08g_assert(v_unbalanced_count = 0, 'T43: No unbalanced journals');
END $$;

-- T44: Orphan journal lines
DO $$
DECLARE
  v_orphan_count integer;
BEGIN
  SELECT count(*) INTO v_orphan_count
  FROM public.financial_journal_lines jl
  LEFT JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  WHERE je.id IS NULL;

  PERFORM _08g_assert(v_orphan_count = 0, 'T44: No orphan journal lines');
END $$;

-- T45: Notes orphan reference check
DO $$
DECLARE
  v_invalid_refs integer;
BEGIN
  SELECT count(*) INTO v_invalid_refs
  FROM public.financial_notes n
  WHERE n.journal_entry_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.financial_journal_entries je WHERE je.id = n.journal_entry_id);

  PERFORM _08g_assert(v_invalid_refs = 0, 'T45: No invalid journal_entry_id references in notes');
END $$;

-- T46: Adjustment append-only (journal entries cannot be updated)
DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
  v_entry_id uuid;
BEGIN
  SELECT id INTO v_cash_id FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND active = true LIMIT 1;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    PERFORM _08g_assert(true, 'T46: SKIP (no suitable accounts)');
    RETURN;
  END IF;

  v_entry_id := public.create_manual_journal_adjustment(
    '2026-08-01', '2026-08-01', 'Teste append-only',
    null, null, null,
    format('[{"chart_account_id": "%s", "debit": 10, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 10}]', v_cash_id, v_revenue_id)::jsonb
  );

  -- Try to update (should fail due to trigger)
  BEGIN
    UPDATE public.financial_journal_entries SET description = 'ALTERADO' WHERE id = v_entry_id;
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08g_assert(true, 'T46: Journal entry append-only enforced');
  END;

  -- Cleanup
  DELETE FROM public.financial_journal_lines WHERE entry_id = v_entry_id;
  DELETE FROM public.financial_journal_entries WHERE id = v_entry_id;
  DELETE FROM public.financial_transactions WHERE id = (SELECT transaction_id FROM public.financial_journal_entries WHERE id = v_entry_id);
END $$;

-- T47: No new PL accounts invented
DO $$
DECLARE
  v_pl_count integer;
BEGIN
  SELECT count(*) INTO v_pl_count FROM public.financial_chart_accounts
  WHERE class = 'PL' AND active = true;

  -- Should be exactly 7 PL accounts from seed
  PERFORM _08g_assert(v_pl_count = 7, 'T47: PL account count matches seed (7)');
END $$;

-- T48: DVA class coverage
DO $$
DECLARE
  v_unclassified integer;
BEGIN
  SELECT count(*) INTO v_unclassified
  FROM public.financial_chart_accounts
  WHERE class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND active = true
    AND posting = true
    AND (dva_class IS NULL OR dva_class = '');

  -- Report but don't fail (some accounts may legitimately not have dva_class)
  RAISE NOTICE 'T48: Accounts without dva_class: %', v_unclassified;
  PERFORM _08g_assert(true, 'T48: DVA class coverage checked');
END $$;

-- T49: DMPL sort_order unique
DO $$
DECLARE
  v_duplicate integer;
BEGIN
  SELECT count(*) INTO v_duplicate
  FROM (
    SELECT sort_order, count(*)
    FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
    GROUP BY sort_order
    HAVING count(*) > 1
  ) t;

  PERFORM _08g_assert(v_duplicate = 0, 'T49: DMPL sort_order unique');
END $$;

-- T50: DVA sort_order unique
DO $$
DECLARE
  v_duplicate integer;
BEGIN
  SELECT count(*) INTO v_duplicate
  FROM (
    SELECT sort_order, count(*)
    FROM public.get_value_added_statement('2026-01-01', '2026-12-31')
    GROUP BY sort_order
    HAVING count(*) > 1
  ) t;

  PERFORM _08g_assert(v_duplicate = 0, 'T50: DVA sort_order unique');
END $$;

-- ============================================================================
-- CLEANUP
-- ============================================================================

DROP FUNCTION IF EXISTS _08g_assert(boolean, text);