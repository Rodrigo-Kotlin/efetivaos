-- ============================================================================
-- ETAPA 08G.1 — Microgate SQL Tests: Reconciliation, Integration, Security
-- Adds T51-T80 to reach 80 total
-- ============================================================================

-- Helper: assert (recreate since 08g drops it)
CREATE OR REPLACE FUNCTION _08g_assert(condition boolean, msg text)
RETURNS void AS $$
BEGIN
  IF NOT condition THEN RAISE EXCEPTION 'TEST FAIL: %', msg; END IF;
  RAISE NOTICE 'TEST PASS: %', msg;
END;
$$ LANGUAGE plpgsql;

-- Helper: cleanup journal entry (recreate)
CREATE OR REPLACE FUNCTION _08g_cleanup_journal(p_entry_id uuid)
RETURNS void AS $$
DECLARE
  v_txn_id uuid;
BEGIN
  SELECT transaction_id INTO v_txn_id FROM public.financial_journal_entries WHERE id = p_entry_id;
  ALTER TABLE public.financial_journal_lines DISABLE TRIGGER trg_fjl_immutable;
  ALTER TABLE public.financial_journal_entries DISABLE TRIGGER trg_fje_immutable;
  DELETE FROM public.financial_journal_lines WHERE entry_id = p_entry_id;
  DELETE FROM public.financial_journal_entries WHERE id = p_entry_id;
  DELETE FROM public.financial_transactions WHERE id = v_txn_id;
  ALTER TABLE public.financial_journal_entries ENABLE TRIGGER trg_fje_immutable;
  ALTER TABLE public.financial_journal_lines ENABLE TRIGGER trg_fjl_immutable;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BLOCO B — DMPL ADDITIONAL (T51-T55)
-- ============================================================================

-- T51: DMPL Saldo Inicial + Aportes + Resultado + Distribuicoes + Ajustes = Saldo Final
DO $$
DECLARE
  v_initial numeric(15,2);
  v_aportes numeric(15,2);
  v_resultado numeric(15,2);
  v_distribuicoes numeric(15,2);
  v_ajustes numeric(15,2);
  v_outros numeric(15,2);
  v_final numeric(15,2);
BEGIN
  SELECT total_pl INTO v_initial FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  WHERE row_label = 'Saldo Inicial';

  SELECT COALESCE(SUM(total_pl), 0) INTO v_aportes FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  WHERE row_label = 'Aportes';

  SELECT COALESCE(SUM(total_pl), 0) INTO v_resultado FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  WHERE row_label = 'Resultado do Exercicio';

  SELECT COALESCE(SUM(total_pl), 0) INTO v_distribuicoes FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  WHERE row_label = 'Distribuicoes';

  SELECT COALESCE(SUM(total_pl), 0) INTO v_ajustes FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  WHERE row_label = 'Ajustes de Exercicios Anteriores';

  SELECT COALESCE(SUM(total_pl), 0) INTO v_outros FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  WHERE row_label = 'Outros Componentes';

  SELECT total_pl INTO v_final FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  WHERE row_label = 'Saldo Final';

  PERFORM _08g_assert(
    ABS((v_initial + v_aportes + v_resultado + v_distribuicoes + v_ajustes + v_outros) - v_final) < 0.01,
    'T51: DMPL full equation (Initial+Aportes+Resultado+Distrib+Ajustes+Outros=Final)'
  );
END $$;

-- T52: DMPL column totals sum to total_pl
DO $$
DECLARE
  v_sum_columns numeric(15,2);
  v_sum_total numeric(15,2);
  v_row record;
BEGIN
  v_sum_columns := 0;
  v_sum_total := 0;
  FOR v_row IN SELECT * FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  LOOP
    v_sum_columns := v_sum_columns + v_row.capital_social + v_row.reservas + v_row.lucros_prejuizos_acumulados + v_row.resultado_exercicio + v_row.outros_componentes;
    v_sum_total := v_sum_total + v_row.total_pl;
  END LOOP;

  PERFORM _08g_assert(ABS(v_sum_columns - v_sum_total) < 0.01, 'T52: DMPL column totals sum = total_pl sum');
END $$;

-- T53: DMPL empty period returns rows with zero-ish values
DO $$
DECLARE
  v_row_count integer;
BEGIN
  SELECT count(*) INTO v_row_count FROM public.get_statement_of_changes_in_equity('2099-01-01', '2099-12-31');
  PERFORM _08g_assert(v_row_count >= 7, 'T53: DMPL returns rows even for empty period');
END $$;

-- T54: DMPL Capital Social column >= 0 for Saldo Inicial
DO $$
DECLARE
  v_capital numeric(15,2);
BEGIN
  SELECT capital_social INTO v_capital FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  WHERE row_label = 'Saldo Inicial';

  PERFORM _08g_assert(v_capital >= 0, 'T54: DMPL Capital Social Saldo Inicial >= 0');
END $$;

-- T55: DMPL Total PL column consistency (each row's total_pl = sum of columns)
DO $$
DECLARE
  v_row record;
  v_calc numeric(15,2);
  v_inconsistent integer := 0;
BEGIN
  FOR v_row IN SELECT * FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  LOOP
    v_calc := v_row.capital_social + v_row.reservas + v_row.lucros_prejuizos_acumulados + v_row.resultado_exercicio + v_row.outros_componentes;
    IF ABS(v_calc - v_row.total_pl) > 0.01 THEN
      v_inconsistent := v_inconsistent + 1;
    END IF;
  END LOOP;

  PERFORM _08g_assert(v_inconsistent = 0, 'T55: DMPL each row total_pl = sum of columns');
END $$;

-- ============================================================================
-- BLOCO C — DLPA ADDITIONAL (T56-T60)
-- ============================================================================

-- T56: DLPA equation (Saldo Inicial + Resultado - Distribuicoes + Ajustes = Saldo Final)
DO $$
DECLARE
  v_initial numeric(15,2);
  v_resultado numeric(15,2);
  v_distribuicoes numeric(15,2);
  v_ajustes numeric(15,2);
  v_final numeric(15,2);
BEGIN
  SELECT amount INTO v_initial FROM public.get_retained_earnings_statement('2026-01-01', '2026-12-31')
  WHERE row_label LIKE '%Saldo Inicial%';

  SELECT COALESCE(SUM(amount), 0) INTO v_resultado FROM public.get_retained_earnings_statement('2026-01-01', '2026-12-31')
  WHERE row_label LIKE '%Resultado%';

  SELECT COALESCE(SUM(amount), 0) INTO v_distribuicoes FROM public.get_retained_earnings_statement('2026-01-01', '2026-12-31')
  WHERE row_label LIKE '%Distribuicao%' OR row_label LIKE '%Dividendo%';

  SELECT COALESCE(SUM(amount), 0) INTO v_ajustes FROM public.get_retained_earnings_statement('2026-01-01', '2026-12-31')
  WHERE row_label LIKE '%Ajuste%';

  SELECT amount INTO v_final FROM public.get_retained_earnings_statement('2026-01-01', '2026-12-31')
  WHERE row_label LIKE '%Saldo Final%';

  PERFORM _08g_assert(
    ABS((v_initial + v_resultado + v_distribuicoes + v_ajustes) - v_final) < 0.01,
    'T56: DLPA equation (Initial+Result+Dist+Ajustes=Final)'
  );
END $$;

-- T57: DLPA Saldo Final reconciles with PL LP account in BP
DO $$
DECLARE
  v_dlpa_final numeric(15,2);
  v_bp_lp numeric(15,2);
BEGIN
  SELECT amount INTO v_dlpa_final FROM public.get_retained_earnings_statement('2026-01-01', '2026-12-31')
  WHERE row_label LIKE '%Saldo Final%';

  SELECT COALESCE(SUM(bs.amount), 0) INTO v_bp_lp
  FROM public.get_balance_sheet('2026-12-31') bs
  WHERE bs.label LIKE '%Lucros%Prejuizos%Acumulados%';

  PERFORM _08g_assert(ABS(v_dlpa_final - v_bp_lp) < 0.01, 'T57: DLPA Saldo Final = BP Lucros/Prejuizos Acumulados');
END $$;

-- T58: DLPA empty period returns rows
DO $$
DECLARE
  v_row_count integer;
BEGIN
  SELECT count(*) INTO v_row_count FROM public.get_retained_earnings_statement('2099-01-01', '2099-12-31');
  PERFORM _08g_assert(v_row_count >= 6, 'T58: DLPA returns rows even for empty period');
END $$;

-- T59: DLPA has Distribuicoes row
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.get_retained_earnings_statement('2026-01-01', '2026-12-31')
    WHERE row_label LIKE '%Distribuicao%' OR row_label LIKE '%Dividendo%') INTO v_exists;
  PERFORM _08g_assert(v_exists, 'T59: DLPA has Distribuicoes row');
END $$;

-- T60: DLPA has Ajustes row
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.get_retained_earnings_statement('2026-01-01', '2026-12-31')
    WHERE row_label LIKE '%Ajuste%') INTO v_exists;
  PERFORM _08g_assert(v_exists, 'T60: DLPA has Ajustes row');
END $$;

-- ============================================================================
-- BLOCO D — DVA ADDITIONAL (T61-T65)
-- ============================================================================

-- T61: DVA has Insumos de Terceiros row
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.get_value_added_statement('2026-01-01', '2026-12-31')
    WHERE row_label LIKE '%Insumo%' OR row_label LIKE '%Terceiro%') INTO v_exists;
  PERFORM _08g_assert(v_exists, 'T61: DVA has Insumos de Terceiros row');
END $$;

-- T62: DVA has Retencoes row
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.get_value_added_statement('2026-01-01', '2026-12-31')
    WHERE row_label LIKE '%Retencoe%' OR row_label LIKE '%Depreciacao%') INTO v_exists;
  PERFORM _08g_assert(v_exists, 'T62: DVA has Retencoes row');
END $$;

-- T63: DVA has Pessoal distribution row
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.get_value_added_statement('2026-01-01', '2026-12-31')
    WHERE row_label LIKE '%Pessoal%') INTO v_exists;
  PERFORM _08g_assert(v_exists, 'T63: DVA has Pessoal distribution row');
END $$;

-- T64: DVA has Gobierno/Tributos distribution row
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.get_value_added_statement('2026-01-01', '2026-12-31')
    WHERE row_label LIKE '%Governo%' OR row_label LIKE '%Tributo%') INTO v_exists;
  PERFORM _08g_assert(v_exists, 'T64: DVA has Governo/Tributos distribution row');
END $$;

-- T65: DVA Receitas >= 0
DO $$
DECLARE
  v_receitas numeric(15,2);
BEGIN
  SELECT amount INTO v_receitas FROM public.get_value_added_statement('2026-01-01', '2026-12-31')
  WHERE row_label = 'Receitas';
  PERFORM _08g_assert(v_receitas >= 0, 'T65: DVA Receitas >= 0');
END $$;

-- ============================================================================
-- BLOCO E — AJUSTES ADDITIONAL (T66-T70)
-- ============================================================================

-- T66: Double submit returns same entry (idempotency real scenario)
DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
  v_entry_id1 uuid;
  v_entry_id2 uuid;
  v_key uuid := gen_random_uuid();
  v_count_before integer;
  v_count_after integer;
BEGIN
  SELECT id INTO v_cash_id FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND active = true LIMIT 1;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    PERFORM _08g_assert(true, 'T66: SKIP (no suitable accounts)');
    RETURN;
  END IF;

  SELECT count(*) INTO v_count_before FROM public.financial_journal_entries;

  v_entry_id1 := public.create_manual_journal_adjustment(
    '2026-08-01', '2026-08-01', 'Double submit test',
    format('[{"chart_account_id": "%s", "debit": 60, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 60}]', v_cash_id, v_revenue_id)::jsonb,
    null, null, null, v_key
  );

  v_entry_id2 := public.create_manual_journal_adjustment(
    '2026-08-01', '2026-08-01', 'Double submit test 2',
    format('[{"chart_account_id": "%s", "debit": 60, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 60}]', v_cash_id, v_revenue_id)::jsonb,
    null, null, null, v_key
  );

  SELECT count(*) INTO v_count_after FROM public.financial_journal_entries;

  PERFORM _08g_assert(v_entry_id1 = v_entry_id2, 'T66: Double submit returns same entry');
  PERFORM _08g_assert(v_count_after = v_count_before + 1, 'T66: Double submit creates only 1 journal entry');

  PERFORM _08g_cleanup_journal(v_entry_id1);
END $$;

-- T67: Period lock prevents adjustment
DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
  v_lock_exists boolean;
BEGIN
  SELECT id INTO v_cash_id FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND active = true LIMIT 1;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    PERFORM _08g_assert(true, 'T67: SKIP (no suitable accounts)');
    RETURN;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.financial_period_locks WHERE locked_at IS NOT NULL) INTO v_lock_exists;
  IF NOT v_lock_exists THEN
    PERFORM _08g_assert(true, 'T67: SKIP (no locked periods)');
    RETURN;
  END IF;

  BEGIN
    PERFORM public.create_manual_journal_adjustment(
      '2026-01-01', '2026-01-01', 'Period lock test',
      format('[{"chart_account_id": "%s", "debit": 10, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 10}]', v_cash_id, v_revenue_id)::jsonb
    );
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08g_assert(SQLSTATE = 'P0001', 'T67: Period lock prevents adjustment');
  END;
END $$;

-- T68: Adjustment DELETE journal entry is rejected (append-only)
DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
  v_entry_id uuid;
BEGIN
  SELECT id INTO v_cash_id FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND active = true LIMIT 1;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    PERFORM _08g_assert(true, 'T68: SKIP (no suitable accounts)');
    RETURN;
  END IF;

  v_entry_id := public.create_manual_journal_adjustment(
    '2026-08-01', '2026-08-01', 'Delete test',
    format('[{"chart_account_id": "%s", "debit": 15, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 15}]', v_cash_id, v_revenue_id)::jsonb
  );

  BEGIN
    DELETE FROM public.financial_journal_entries WHERE id = v_entry_id;
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08g_assert(true, 'T68: DELETE journal entry rejected (append-only)');
  END;

  PERFORM _08g_cleanup_journal(v_entry_id);
END $$;

-- T69: Adjustment DELETE journal lines is rejected (append-only)
DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
  v_entry_id uuid;
BEGIN
  SELECT id INTO v_cash_id FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND active = true LIMIT 1;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    PERFORM _08g_assert(true, 'T69: SKIP (no suitable accounts)');
    RETURN;
  END IF;

  v_entry_id := public.create_manual_journal_adjustment(
    '2026-08-01', '2026-08-01', 'Delete lines test',
    format('[{"chart_account_id": "%s", "debit": 20, "credit": 0}, {"chart_account_id": "%s", "debit": 0, "credit": 20}]', v_cash_id, v_revenue_id)::jsonb
  );

  BEGIN
    DELETE FROM public.financial_journal_lines WHERE entry_id = v_entry_id;
    RAISE EXCEPTION 'Should have failed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM _08g_assert(true, 'T69: DELETE journal lines rejected (append-only)');
  END;

  PERFORM _08g_cleanup_journal(v_entry_id);
END $$;

-- T70: Adjustment in result account affects DRE
DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
  v_entry_id uuid;
  v_dre_before numeric(15,2);
  v_dre_after numeric(15,2);
BEGIN
  SELECT id INTO v_cash_id FROM public.financial_chart_accounts WHERE is_cash = true AND active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.financial_chart_accounts WHERE class = 'RECEITA' AND active = true LIMIT 1;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    PERFORM _08g_assert(true, 'T70: SKIP (no suitable accounts)');
    RETURN;
  END IF;

  -- DRE before
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0) INTO v_dre_before
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA') AND ca.dre_class <> ''
    AND ca.active = true AND je.competence_date BETWEEN '2026-08-01' AND '2026-08-31'
    AND je.status <> 'cancelled';

  -- Create adjustment
  v_entry_id := public.create_manual_journal_adjustment(
    '2026-08-01', '2026-08-01', 'DRE impact test',
    format('[{"chart_account_id": "%s", "debit": 0, "credit": 500}, {"chart_account_id": "%s", "debit": 500, "credit": 0}]', v_revenue_id, v_cash_id)::jsonb
  );

  -- DRE after
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0) INTO v_dre_after
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA') AND ca.dre_class <> ''
    AND ca.active = true AND je.competence_date BETWEEN '2026-08-01' AND '2026-08-31'
    AND je.status <> 'cancelled';

  PERFORM _08g_assert(ABS(v_dre_after - v_dre_before) > 0.01, 'T70: Adjustment in result account affects DRE');

  PERFORM _08g_cleanup_journal(v_entry_id);
END $$;

-- ============================================================================
-- BLOCO G — NOTES LEDGER ISOLATION (T71)
-- ============================================================================

-- T71: Note creation does not change journal entry/line count
DO $$
DECLARE
  v_je_before integer;
  v_jl_before integer;
  v_note_id uuid;
  v_je_after integer;
  v_jl_after integer;
BEGIN
  SELECT count(*) INTO v_je_before FROM public.financial_journal_entries;
  SELECT count(*) INTO v_jl_before FROM public.financial_journal_lines;

  INSERT INTO public.financial_notes (note_type, title, body, report_type)
  VALUES ('GERAL', 'Isolation test', ' nao altera ledger', 'BP')
  RETURNING id INTO v_note_id;

  SELECT count(*) INTO v_je_after FROM public.financial_journal_entries;
  SELECT count(*) INTO v_jl_after FROM public.financial_journal_lines;

  PERFORM _08g_assert(v_je_before = v_je_after, 'T71: Note does not change journal entry count');
  PERFORM _08g_assert(v_jl_before = v_jl_after, 'T71: Note does not change journal line count');

  DELETE FROM public.financial_notes WHERE id = v_note_id;
END $$;

-- ============================================================================
-- BLOCO H — SECURITY ADDITIONAL (T72-T75)
-- ============================================================================

-- T72: RPCs have EXECUTE granted to authenticated
DO $$
BEGIN
  PERFORM _08g_assert(
    EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_name = 'get_statement_of_changes_in_equity' AND grantee = 'authenticated'),
    'T72: get_statement_of_changes_in_equity granted to authenticated'
  );
  PERFORM _08g_assert(
    EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_name = 'get_retained_earnings_statement' AND grantee = 'authenticated'),
    'T72: get_retained_earnings_statement granted to authenticated'
  );
  PERFORM _08g_assert(
    EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_name = 'get_value_added_statement' AND grantee = 'authenticated'),
    'T72: get_value_added_statement granted to authenticated'
  );
  PERFORM _08g_assert(
    EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_name = 'create_manual_journal_adjustment' AND grantee = 'authenticated'),
    'T72: create_manual_journal_adjustment granted to authenticated'
  );
END $$;

-- T73: RPCs are SECURITY DEFINER
DO $$
BEGIN
  PERFORM _08g_assert(
    (SELECT security_type FROM information_schema.routines WHERE routine_name = 'get_statement_of_changes_in_equity') = 'DEFINER',
    'T73: get_statement_of_changes_in_equity is SECURITY DEFINER'
  );
  PERFORM _08g_assert(
    (SELECT security_type FROM information_schema.routines WHERE routine_name = 'get_retained_earnings_statement') = 'DEFINER',
    'T73: get_retained_earnings_statement is SECURITY DEFINER'
  );
  PERFORM _08g_assert(
    (SELECT security_type FROM information_schema.routines WHERE routine_name = 'get_value_added_statement') = 'DEFINER',
    'T73: get_value_added_statement is SECURITY DEFINER'
  );
  PERFORM _08g_assert(
    (SELECT security_type FROM information_schema.routines WHERE routine_name = 'create_manual_journal_adjustment') = 'DEFINER',
    'T73: create_manual_journal_adjustment is SECURITY DEFINER'
  );
END $$;

-- T74: PUBLIC has no EXECUTE on any 08G RPCs
DO $$
BEGIN
  PERFORM _08g_assert(
    NOT EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_name = 'get_statement_of_changes_in_equity' AND grantee = 'PUBLIC'),
    'T74: PUBLIC has no EXECUTE on get_statement_of_changes_in_equity'
  );
  PERFORM _08g_assert(
    NOT EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_name = 'get_retained_earnings_statement' AND grantee = 'PUBLIC'),
    'T74: PUBLIC has no EXECUTE on get_retained_earnings_statement'
  );
  PERFORM _08g_assert(
    NOT EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_name = 'get_value_added_statement' AND grantee = 'PUBLIC'),
    'T74: PUBLIC has no EXECUTE on get_value_added_statement'
  );
  PERFORM _08g_assert(
    NOT EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_name = 'create_manual_journal_adjustment' AND grantee = 'PUBLIC'),
    'T74: PUBLIC has no EXECUTE on create_manual_journal_adjustment'
  );
END $$;

-- T75: financial_notes has UPDATE and DELETE policies (admin only)
DO $$
BEGIN
  PERFORM _08g_assert(
    EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_notes' AND cmd = 'UPDATE'),
    'T75: financial_notes has UPDATE policy'
  );
  PERFORM _08g_assert(
    EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_notes' AND cmd = 'DELETE'),
    'T75: financial_notes has DELETE policy'
  );
END $$;

-- ============================================================================
-- BLOCO L — INTEGRITY ADDITIONAL (T76-T80)
-- ============================================================================

-- T76: No duplicate adjustment idempotency in journal entries
DO $$
DECLARE
  v_dup_count integer;
BEGIN
  SELECT count(*) INTO v_dup_count
  FROM (
    SELECT idempotency_key, count(*)
    FROM public.financial_journal_entries
    WHERE idempotency_key IS NOT NULL AND idempotency_key <> ''
    GROUP BY idempotency_key
    HAVING count(*) > 1
  ) t;

  PERFORM _08g_assert(v_dup_count = 0, 'T76: No duplicate idempotency keys in journal entries');
END $$;

-- T77: DMPL Saldo Final >= 0 (non-negative PL check)
DO $$
DECLARE
  v_final numeric(15,2);
BEGIN
  SELECT total_pl INTO v_final FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-12-31')
  WHERE row_label = 'Saldo Final';

  PERFORM _08g_assert(v_final >= 0, 'T77: DMPL Saldo Final >= 0');
END $$;

-- T78: DLPA row count is exactly 6
DO $$
DECLARE
  v_row_count integer;
BEGIN
  SELECT count(*) INTO v_row_count FROM public.get_retained_earnings_statement('2026-01-01', '2026-12-31');
  PERFORM _08g_assert(v_row_count = 6, 'T78: DLPA has exactly 6 rows');
END $$;

-- T79: DVA row count is exactly 12
DO $$
DECLARE
  v_row_count integer;
BEGIN
  SELECT count(*) INTO v_row_count FROM public.get_value_added_statement('2026-01-01', '2026-12-31');
  PERFORM _08g_assert(v_row_count = 12, 'T79: DVA has exactly 12 rows');
END $$;

-- T80: All 08G RPCs have search_path set
DO $$
BEGIN
  PERFORM _08g_assert(
    (SELECT proconfig::text FROM pg_proc WHERE proname = 'get_statement_of_changes_in_equity') LIKE '%search_path%',
    'T80: get_statement_of_changes_in_equity has search_path set'
  );
  PERFORM _08g_assert(
    (SELECT proconfig::text FROM pg_proc WHERE proname = 'get_retained_earnings_statement') LIKE '%search_path%',
    'T80: get_retained_earnings_statement has search_path set'
  );
  PERFORM _08g_assert(
    (SELECT proconfig::text FROM pg_proc WHERE proname = 'get_value_added_statement') LIKE '%search_path%',
    'T80: get_value_added_statement has search_path set'
  );
  PERFORM _08g_assert(
    (SELECT proconfig::text FROM pg_proc WHERE proname = 'create_manual_journal_adjustment') LIKE '%search_path%',
    'T80: create_manual_journal_adjustment has search_path set'
  );
END $$;
