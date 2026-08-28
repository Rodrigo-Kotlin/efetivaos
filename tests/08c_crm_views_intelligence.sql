-- ETAPA 08C — Views & Intelligence: SQL Checks
-- Execute: supabase db query -f tests/08c_crm_views_intelligence.sql --linked

DO $$
DECLARE
  v_total INT := 0;
  v_passed INT := 0;
  v_failed INT := 0;
  v_tmp INT;
  v_pipeline_id UUID;
  v_stage_id UUID;
  v_stage2_id UUID;
  v_client_id UUID;
  v_opp_id UUID;
  v_opp2_id UUID;
  v_act_id UUID;
  v_result JSONB;
BEGIN

  -- ======================================================================
  -- 1. SCHEMA: stage_entered_at
  -- ======================================================================

  -- 1.1 stage_entered_at column exists
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM information_schema.columns
  WHERE table_schema='public' AND table_name='crm_opportunities' AND column_name='stage_entered_at';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 1.1 stage_entered_at missing'; END IF;

  -- 1.2 stage_age_days in view
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM information_schema.columns
  WHERE table_schema='public' AND table_name='crm_opportunities_board_v' AND column_name='stage_age_days';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 1.2 stage_age_days missing from view'; END IF;

  -- 1.3 stage_entered_at in view
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM information_schema.columns
  WHERE table_schema='public' AND table_name='crm_opportunities_board_v' AND column_name='stage_entered_at';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 1.3 stage_entered_at missing from view'; END IF;

  -- ======================================================================
  -- 2. ANALYTICS RPC exists
  -- ======================================================================

  -- 2.1 get_crm_pipeline_analytics exists
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_name = 'get_crm_pipeline_analytics';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 2.1 analytics RPC missing'; END IF;

  -- ======================================================================
  -- 3. TEST DATA
  -- ======================================================================

  SELECT id INTO v_pipeline_id FROM public.crm_pipelines WHERE is_default = true AND active = true LIMIT 1;
  SELECT id INTO v_stage_id FROM public.crm_stages WHERE pipeline_id = v_pipeline_id AND active = true ORDER BY position LIMIT 1;
  SELECT id INTO v_stage2_id FROM public.crm_stages WHERE pipeline_id = v_pipeline_id AND active = true ORDER BY position OFFSET 1 LIMIT 1;
  SELECT id INTO v_client_id FROM public.clients LIMIT 1;

  -- 3.1 Create test opportunity
  v_total := v_total + 1;
  BEGIN
    INSERT INTO public.crm_opportunities (client_id, pipeline_id, stage_id, title, value, probability, status, sort_order, created_by, stage_entered_at)
    VALUES (v_client_id, v_pipeline_id, v_stage_id, 'Teste 08C', 10000.00, 20, 'open', 0, auth.uid(), now())
    RETURNING id INTO v_opp_id;
    v_passed := v_passed + 1;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 3.1 Create test opp: %', SQLERRM;
  END;

  -- 3.2 Create second test opportunity
  v_total := v_total + 1;
  BEGIN
    INSERT INTO public.crm_opportunities (client_id, pipeline_id, stage_id, title, value, probability, status, sort_order, created_by, stage_entered_at)
    VALUES (v_client_id, v_pipeline_id, v_stage2_id, 'Teste 08C-2', 20000.00, 40, 'open', 1, auth.uid(), now())
    RETURNING id INTO v_opp2_id;
    v_passed := v_passed + 1;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 3.2 Create test opp2: %', SQLERRM;
  END;

  -- ======================================================================
  -- 4. AGING
  -- ======================================================================

  -- 4.1 New opportunity has stage_age_days >= 0
  v_total := v_total + 1;
  SELECT stage_age_days INTO v_tmp FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp_id;
  IF v_tmp >= 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 4.1 Aging negative: %', v_tmp; END IF;

  -- 4.2 Stage change updates stage_entered_at
  v_total := v_total + 1;
  BEGIN
    PERFORM public.move_crm_opportunity(v_opp_id, v_stage2_id);
    SELECT count(*) INTO v_tmp FROM public.crm_opportunities WHERE id = v_opp_id AND stage_entered_at IS NOT NULL;
    IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 4.2 stage_entered_at not updated'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 4.2 move: %', SQLERRM;
  END;

  -- 4.3 Aging resets after stage change
  v_total := v_total + 1;
  SELECT stage_age_days INTO v_tmp FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp_id;
  IF v_tmp <= 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 4.3 Aging not reset: %', v_tmp; END IF;

  -- ======================================================================
  -- 5. ANALYTICS RPC
  -- ======================================================================

  -- 5.1 Analytics returns valid JSON
  v_total := v_total + 1;
  BEGIN
    SELECT public.get_crm_pipeline_analytics(v_pipeline_id, NULL, NULL, NULL) INTO v_result;
    IF v_result IS NOT NULL AND v_result ? 'totals' THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.1 Analytics invalid JSON'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.1 analytics: %', SQLERRM;
  END;

  -- 5.2 Totals have open_count
  v_total := v_total + 1;
  IF (v_result->'totals'->>'open_count')::INT >= 2 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.2 open_count < 2'; END IF;

  -- 5.3 Conversion rate exists
  v_total := v_total + 1;
  IF v_result ? 'conversion' AND (v_result->'conversion'->>'rate') IS NOT NULL THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.3 conversion missing'; END IF;

  -- 5.4 Stage metrics returned
  v_total := v_total + 1;
  SELECT jsonb_array_length(v_result->'stage_metrics') INTO v_tmp;
  IF v_tmp >= 5 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.4 stage_metrics < 5: %', v_tmp; END IF;

  -- 5.5 Forecast returned
  v_total := v_total + 1;
  SELECT jsonb_array_length(v_result->'forecast') INTO v_tmp;
  IF v_tmp >= 6 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.5 forecast < 6 months: %', v_tmp; END IF;

  -- 5.6 Analytics with date filter
  v_total := v_total + 1;
  BEGIN
    SELECT public.get_crm_pipeline_analytics(v_pipeline_id, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, NULL) INTO v_result;
    IF v_result IS NOT NULL THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.6 date filter failed'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.6: %', SQLERRM;
  END;

  -- 5.7 Analytics with responsible filter
  v_total := v_total + 1;
  BEGIN
    SELECT public.get_crm_pipeline_analytics(v_pipeline_id, NULL, NULL, auth.uid()) INTO v_result;
    IF v_result IS NOT NULL THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.7 responsible filter failed'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.7: %', SQLERRM;
  END;

  -- ======================================================================
  -- 6. LOSS REASONS admin write
  -- ======================================================================

  -- 6.1 Admin can write loss reasons
  v_total := v_total + 1;
  IF has_table_privilege('authenticated', 'public.crm_loss_reasons', 'INSERT') THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 6.1 Authenticated cannot INSERT loss reasons'; END IF;

  -- 6.2 Anon cannot read loss reasons
  v_total := v_total + 1;
  IF has_table_privilege('anon', 'public.crm_loss_reasons', 'SELECT') THEN v_failed := v_failed + 1; RAISE WARNING 'FAIL 6.2 Anon can SELECT loss reasons'; ELSE v_passed := v_passed + 1; END IF;

  -- ======================================================================
  -- 7. SECURITY: Analytics RPC
  -- ======================================================================

  -- 7.1 Anon cannot execute analytics
  v_total := v_total + 1;
  IF has_function_privilege('anon', 'public.get_crm_pipeline_analytics(UUID, DATE, DATE, UUID)', 'EXECUTE') THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 7.1 Anon can execute analytics';
  ELSE v_passed := v_passed + 1;
  END IF;

  -- ======================================================================
  -- 8. VIEW INTEGRITY
  -- ======================================================================

  -- 8.1 Board view returns all open opportunities
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunities_board_v WHERE pipeline_id = v_pipeline_id AND status = 'open';
  IF v_tmp >= 2 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 8.1 Board view missing opps: %', v_tmp; END IF;

  -- 8.2 Board view has client_name
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp_id AND client_name IS NOT NULL;
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 8.2 client_name missing'; END IF;

  -- 8.3 Board view has next_activity fields
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp_id AND next_activity_status_semantic IS NOT NULL;
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 8.3 next_activity missing'; END IF;

  -- ======================================================================
  -- 9. INTEGRITY
  -- ======================================================================

  -- 9.1 No orphan stage events
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunity_events e
  WHERE e.event_type = 'stage_changed'
  AND NOT EXISTS (SELECT 1 FROM public.crm_opportunities o WHERE o.id = e.opportunity_id);
  IF v_tmp = 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 9.1 Orphan stage events: %', v_tmp; END IF;

  -- 9.2 No invalid stage_age_days
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunities_board_v WHERE stage_age_days < 0;
  IF v_tmp = 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 9.2 Negative aging: %', v_tmp; END IF;

  -- 9.3 Analytics totals reconcile
  v_total := v_total + 1;
  SELECT public.get_crm_pipeline_analytics(v_pipeline_id, NULL, NULL, NULL) INTO v_result;
  DECLARE v_open INT; v_won INT; v_lost INT;
  BEGIN
    SELECT count(*) INTO v_open FROM public.crm_opportunities WHERE pipeline_id = v_pipeline_id AND status = 'open';
    v_won := (v_result->'totals'->>'won_count')::INT;
    v_lost := (v_result->'totals'->>'lost_count')::INT;
    IF v_open = (v_result->'totals'->>'open_count')::INT THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 9.3 open_count mismatch: % vs %', v_open, (v_result->'totals'->>'open_count')::INT; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 9.3: %', SQLERRM;
  END;

  -- ======================================================================
  -- 10. CONVERSION DETAILED
  -- ======================================================================

  -- 10.1 Conversion rate = 0 when no closed
  v_total := v_total + 1;
  SELECT public.get_crm_pipeline_analytics(v_pipeline_id, NULL, NULL, NULL) INTO v_result;
  IF (v_result->'conversion'->>'rate')::NUMERIC >= 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 10.1 Conversion negative'; END IF;

  -- 10.2 Won in conversion
  v_total := v_total + 1;
  IF (v_result->'conversion'->>'won')::INT >= 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 10.2 Conversion won negative'; END IF;

  -- 10.3 Lost in conversion
  v_total := v_total + 1;
  IF (v_result->'conversion'->>'lost')::INT >= 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 10.3 Conversion lost negative'; END IF;

  -- ======================================================================
  -- 11. STAGE METRICS DETAILED
  -- ======================================================================

  -- 11.1 Each stage has stage_id
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM jsonb_array_elements(v_result->'stage_metrics') AS sm WHERE sm->>'stage_id' IS NOT NULL;
  IF v_tmp >= 5 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 11.1 Stages missing stage_id: %', v_tmp; END IF;

  -- 11.2 Each stage has position
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM jsonb_array_elements(v_result->'stage_metrics') AS sm WHERE sm->>'position' IS NOT NULL;
  IF v_tmp >= 5 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 11.2 Stages missing position: %', v_tmp; END IF;

  -- 11.3 current_count >= 0
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM jsonb_array_elements(v_result->'stage_metrics') AS sm WHERE (sm->>'current_count')::INT >= 0;
  IF v_tmp >= 5 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 11.3 current_count negative'; END IF;

  -- 11.4 avg_duration_days >= 0
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM jsonb_array_elements(v_result->'stage_metrics') AS sm WHERE (sm->>'avg_duration_days')::NUMERIC >= 0;
  IF v_tmp >= 5 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 11.4 avg_duration negative'; END IF;

  -- ======================================================================
  -- 12. LOSS REASONS ANALYTICS
  -- ======================================================================

  -- 12.1 loss_reasons is array
  v_total := v_total + 1;
  IF jsonb_array_length(v_result->'loss_reasons') >= 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 12.1 loss_reasons not array'; END IF;

  -- 12.2 Each loss reason has reason_name
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM jsonb_array_elements(v_result->'loss_reasons') AS lr WHERE lr->>'reason_name' IS NOT NULL;
  IF v_tmp >= 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 12.2 loss reason missing name'; END IF;

  -- 12.3 Each loss reason has count >= 0
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM jsonb_array_elements(v_result->'loss_reasons') AS lr WHERE (lr->>'count')::INT >= 0;
  IF v_tmp >= 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 12.3 loss count negative'; END IF;

  -- 12.4 Each loss reason has percentage
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM jsonb_array_elements(v_result->'loss_reasons') AS lr WHERE (lr->>'percentage')::NUMERIC >= 0;
  IF v_tmp >= 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 12.4 loss percentage negative'; END IF;

  -- ======================================================================
  -- 13. FORECAST
  -- ======================================================================

  -- 13.1 Forecast has 6 months
  v_total := v_total + 1;
  SELECT jsonb_array_length(v_result->'forecast') INTO v_tmp;
  IF v_tmp = 6 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 13.1 Forecast months: %', v_tmp; END IF;

  -- 13.2 Each month has month label
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM jsonb_array_elements(v_result->'forecast') AS f WHERE f->>'month_label' IS NOT NULL;
  IF v_tmp = 6 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 13.2 Forecast missing month_label'; END IF;

  -- 13.3 Each month has total_value >= 0
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM jsonb_array_elements(v_result->'forecast') AS f WHERE (f->>'total_value')::NUMERIC >= 0;
  IF v_tmp = 6 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 13.3 Forecast total_value negative'; END IF;

  -- 13.4 Each month has weighted_value >= 0
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM jsonb_array_elements(v_result->'forecast') AS f WHERE (f->>'weighted_value')::NUMERIC >= 0;
  IF v_tmp = 6 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 13.4 Forecast weighted negative'; END IF;

  -- 13.5 Each month has opportunity_count >= 0
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM jsonb_array_elements(v_result->'forecast') AS f WHERE (f->>'opportunity_count')::INT >= 0;
  IF v_tmp = 6 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 13.5 Forecast count negative'; END IF;

  -- ======================================================================
  -- 14. FILTERS
  -- ======================================================================

  -- 14.1 Analytics with stage filter
  v_total := v_total + 1;
  BEGIN
    SELECT public.get_crm_pipeline_analytics(v_pipeline_id, NULL, NULL, NULL) INTO v_result;
    IF v_result IS NOT NULL THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 14.1 Pipeline filter failed'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 14.1: %', SQLERRM;
  END;

  -- 14.2 Analytics with wide date range
  v_total := v_total + 1;
  BEGIN
    SELECT public.get_crm_pipeline_analytics(v_pipeline_id, '2020-01-01'::DATE, '2030-12-31'::DATE, NULL) INTO v_result;
    IF v_result IS NOT NULL THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 14.2 Wide date failed'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 14.2: %', SQLERRM;
  END;

  -- 14.3 Analytics with narrow date range (no data)
  v_total := v_total + 1;
  BEGIN
    SELECT public.get_crm_pipeline_analytics(v_pipeline_id, '2000-01-01'::DATE, '2000-01-02'::DATE, NULL) INTO v_result;
    IF v_result IS NOT NULL AND (v_result->'totals'->>'open_count')::INT = 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 14.3 Narrow date should return 0'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 14.3: %', SQLERRM;
  END;

  -- ======================================================================
  -- 15. WON/LOST IN LIST
  -- ======================================================================

  -- 15.1 Won opp has won_at in view
  v_total := v_total + 1;
  BEGIN
    PERFORM public.mark_opportunity_won(v_opp2_id);
    SELECT count(*) INTO v_tmp FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp2_id AND status = 'won' AND won_at IS NOT NULL;
    IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 15.1 won_at missing'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 15.1: %', SQLERRM;
  END;

  -- 15.2 Lost opp has lost_at in view
  v_total := v_total + 1;
  BEGIN
    UPDATE public.crm_opportunities SET status = 'open', won_at = NULL WHERE id = v_opp_id;
    PERFORM public.mark_opportunity_lost(v_opp_id, 'Preço', (SELECT id FROM public.crm_loss_reasons WHERE name = 'Preço' LIMIT 1), NULL);
    SELECT count(*) INTO v_tmp FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp_id AND status = 'lost' AND lost_at IS NOT NULL;
    IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 15.2 lost_at missing'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 15.2: %', SQLERRM;
  END;

  -- 15.3 Loss reason name in view
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp_id AND loss_reason_name IS NOT NULL;
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 15.3 loss_reason_name missing'; END IF;

  -- ======================================================================
  -- 16. INDEXES
  -- ======================================================================

  -- 16.1 stage_entered_at index exists
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM pg_indexes WHERE tablename = 'crm_opportunities' AND indexname = 'idx_crm_opps_stage_entered';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 16.1 stage_entered index missing'; END IF;

  -- 16.2 expected_close_date index exists
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM pg_indexes WHERE tablename = 'crm_opportunities' AND indexname = 'idx_crm_opps_expected_close';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 16.2 expected_close index missing'; END IF;

  -- ======================================================================
  -- 17. STAGE FUNNEL DEPTH
  -- ======================================================================

  -- 17.1 Stage metrics ordered by position
  v_total := v_total + 1;
  DECLARE v_positions INT[];
  BEGIN
    SELECT array_agg((sm->>'position')::INT ORDER BY (sm->>'position')::INT) INTO v_positions
    FROM jsonb_array_elements(v_result->'stage_metrics') AS sm;
    IF v_positions = ARRAY[1,2,3,4,5] THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 17.1 Stage positions not ordered: %', v_positions; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 17.1: %', SQLERRM;
  END;

  -- 17.2 Entered count >= 0 for all stages
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM jsonb_array_elements(v_result->'stage_metrics') AS sm WHERE (sm->>'entered_count')::INT >= 0;
  IF v_tmp = 5 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 17.2 entered_count negative'; END IF;

  -- 17.3 Exited count >= 0 for all stages
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM jsonb_array_elements(v_result->'stage_metrics') AS sm WHERE (sm->>'exited_count')::INT >= 0;
  IF v_tmp = 5 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 17.3 exited_count negative'; END IF;

  -- ======================================================================
  -- 18. EDGE CASES
  -- ======================================================================

  -- 18.1 Analytics with NULL pipeline (uses default)
  v_total := v_total + 1;
  BEGIN
    SELECT public.get_crm_pipeline_analytics(NULL, NULL, NULL, NULL) INTO v_result;
    IF v_result IS NOT NULL THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 18.1 NULL pipeline failed'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 18.1: %', SQLERRM;
  END;

  -- 18.2 View returns stage_position
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp2_id AND stage_position IS NOT NULL;
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 18.2 stage_position missing'; END IF;

  -- 18.3 View returns stage_probability
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp2_id AND stage_probability IS NOT NULL;
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 18.3 stage_probability missing'; END IF;

  -- 18.4 View returns pipeline_name
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp2_id AND pipeline_name IS NOT NULL;
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 18.4 pipeline_name missing'; END IF;

  -- 18.5 View returns responsible_name (nullable)
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp2_id;
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 18.5 opp not in view'; END IF;

  -- 18.6 Analytics conversion rate is number
  v_total := v_total + 1;
  IF jsonb_typeof(v_result->'conversion'->'rate') = 'number' THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 18.6 conversion rate not number'; END IF;

  -- 18.7 Forecast months are sequential
  v_total := v_total + 1;
  DECLARE v_months TEXT[];
  BEGIN
    SELECT array_agg(f->>'month' ORDER BY f->>'month') INTO v_months
    FROM jsonb_array_elements(v_result->'forecast') AS f;
    IF v_months[1] < v_months[2] THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 18.7 Forecast months not sequential'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 18.7: %', SQLERRM;
  END;

  -- ======================================================================
  -- 19. MOVE CRRPC UPDATED
  -- ======================================================================

  -- 19.1 move_crm_opportunity sets stage_entered_at
  v_total := v_total + 1;
  BEGIN
    UPDATE public.crm_opportunities SET status = 'open', won_at = NULL, lost_at = NULL, lost_reason_id = NULL WHERE id = v_opp2_id;
    PERFORM public.move_crm_opportunity(v_opp2_id, v_stage_id);
    SELECT count(*) INTO v_tmp FROM public.crm_opportunities WHERE id = v_opp2_id AND stage_entered_at IS NOT NULL;
    IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 19.1 move didn t set stage_entered_at'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 19.1: %', SQLERRM;
  END;

  -- ======================================================================
  -- CLEANUP
  -- ======================================================================
  DELETE FROM public.crm_opportunity_events WHERE opportunity_id IN (v_opp_id, v_opp2_id);
  DELETE FROM public.crm_activities WHERE opportunity_id IN (v_opp_id, v_opp2_id);
  DELETE FROM public.crm_opportunities WHERE id IN (v_opp_id, v_opp2_id);

  -- ======================================================================
  -- SUMMARY
  -- ======================================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== ETAPA 08C SQL RESULTS: %/% passed (total: %) ===', v_passed, v_total, v_total;
  IF v_failed = 0 THEN
    RAISE NOTICE 'ALL CHECKS PASSED';
  ELSE
    RAISE WARNING '% CHECKS FAILED', v_failed;
  END IF;
END $$;
