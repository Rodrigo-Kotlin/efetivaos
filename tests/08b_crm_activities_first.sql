-- ETAPA 08B — CRM Activities First: SQL Structure & Integrity Checks
-- Execute: supabase db query -f tests/08b_crm_activities_first.sql --linked

DO $$
DECLARE
  v_total INT := 0;
  v_passed INT := 0;
  v_failed INT := 0;
  v_result TEXT;
  v_tmp INT;

  v_pipeline_id UUID;
  v_stage_id UUID;
  v_client_id UUID;
  v_opp_id UUID;
  v_act_id UUID;
  v_event_id UUID;
  v_reason_id UUID;
  v_reason_outro_id UUID;
BEGIN

  -- ======================================================================
  -- 1. SCHEMA: Tables exist
  -- ======================================================================

  -- 1.1 crm_activities table exists
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM information_schema.tables
  WHERE table_schema='public' AND table_name='crm_activities';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 1.1 crm_activities table missing'; END IF;

  -- 1.2 crm_opportunity_events table exists
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM information_schema.tables
  WHERE table_schema='public' AND table_name='crm_opportunity_events';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 1.2 crm_opportunity_events table missing'; END IF;

  -- 1.3 crm_loss_reasons table exists
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM information_schema.tables
  WHERE table_schema='public' AND table_name='crm_loss_reasons';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 1.3 crm_loss_reasons table missing'; END IF;

  -- 1.4 lost_reason_id column on crm_opportunities
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM information_schema.columns
  WHERE table_schema='public' AND table_name='crm_opportunities' AND column_name='lost_reason_id';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 1.4 lost_reason_id column missing'; END IF;

  -- 1.5 lost_reason_detail column on crm_opportunities
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM information_schema.columns
  WHERE table_schema='public' AND table_name='crm_opportunities' AND column_name='lost_reason_detail';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 1.5 lost_reason_detail column missing'; END IF;

  -- ======================================================================
  -- 2. SEED: Loss reasons
  -- ======================================================================

  -- 2.1 8 loss reasons exist
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_loss_reasons WHERE active = true;
  IF v_tmp = 8 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 2.1 expected 8 active reasons, got %', v_tmp; END IF;

  -- 2.2 'Preço' exists
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_loss_reasons WHERE name = 'Preço' AND active = true;
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 2.2 Preço reason missing'; END IF;

  -- 2.3 'Outro' exists
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_loss_reasons WHERE name = 'Outro' AND active = true;
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 2.3 Outro reason missing'; END IF;

  -- 2.4 Positions are sequential
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM (
    SELECT position, row_number() OVER (ORDER BY position) AS rn
    FROM public.crm_loss_reasons WHERE active = true
  ) sub WHERE position = rn;
  IF v_tmp = 8 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 2.4 Loss reason positions not sequential'; END IF;

  -- ======================================================================
  -- 3. SEED: Default pipeline + stages (from 08A)
  -- ======================================================================

  -- 3.1 Default pipeline exists
  v_total := v_total + 1;
  SELECT id INTO v_pipeline_id FROM public.crm_pipelines WHERE is_default = true AND active = true LIMIT 1;
  IF v_pipeline_id IS NOT NULL THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 3.1 Default pipeline missing'; END IF;

  -- 3.2 5 stages exist
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_stages WHERE pipeline_id = v_pipeline_id AND active = true;
  IF v_tmp = 5 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 3.2 Expected 5 stages, got %', v_tmp; END IF;

  -- ======================================================================
  -- 4. TEST DATA
  -- ======================================================================

  SELECT id INTO v_client_id FROM public.clients LIMIT 1;

  -- 4.1 Create test opportunity
  v_total := v_total + 1;
  SELECT id INTO v_stage_id FROM public.crm_stages WHERE pipeline_id = v_pipeline_id AND active = true ORDER BY position LIMIT 1;
  BEGIN
    INSERT INTO public.crm_opportunities (client_id, pipeline_id, stage_id, title, value, probability, status, sort_order, created_by)
    VALUES (v_client_id, v_pipeline_id, v_stage_id, 'Teste 08B', 5000.00, 10, 'open', 0, auth.uid())
    RETURNING id INTO v_opp_id;
    v_passed := v_passed + 1;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 4.1 Create test opp: %', SQLERRM;
  END;

  -- ======================================================================
  -- 5. ACTIVITIES: Create
  -- ======================================================================

  -- 5.1 create_crm_activity RPC succeeds
  v_total := v_total + 1;
  BEGIN
    SELECT public.create_crm_activity(
      v_opp_id, 'Ligação', 'Teste ligação', now() + interval '1 day',
      v_client_id, 'Descrição teste', NULL
    ) INTO v_act_id;
    IF v_act_id IS NOT NULL THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.1 create_crm_activity returned null'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.1 create_crm_activity: %', SQLERRM;
  END;

  -- 5.2 Activity status is pending
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_activities WHERE id = v_act_id AND status = 'pending';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.2 Activity status not pending'; END IF;

  -- 5.3 Activity has correct type
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_activities WHERE id = v_act_id AND type = 'Ligação';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.3 Activity type mismatch'; END IF;

  -- 5.4 Event created for activity
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunity_events
  WHERE opportunity_id = v_opp_id AND event_type = 'activity_created';
  IF v_tmp >= 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.4 activity_created event not found'; END IF;

  -- 5.5 Invalid opportunity fails
  v_total := v_total + 1;
  BEGIN
    PERFORM public.create_crm_activity(
      '00000000-0000-0000-0000-000000000000'::uuid, 'Ligação', 'Fail', now(), NULL, NULL, NULL
    );
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.5 Should have raised exception';
  EXCEPTION WHEN OTHERS THEN
    v_passed := v_passed + 1;
  END;

  -- 5.6 Closed opportunity fails
  v_total := v_total + 1;
  UPDATE public.crm_opportunities SET status = 'won', won_at = now() WHERE id = v_opp_id;
  BEGIN
    PERFORM public.create_crm_activity(
      v_opp_id, 'Ligação', 'Fail closed', now(), NULL, NULL, NULL
    );
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 5.6 Should have raised for closed opp';
  EXCEPTION WHEN OTHERS THEN
    v_passed := v_passed + 1;
  END;
  UPDATE public.crm_opportunities SET status = 'open', won_at = NULL WHERE id = v_opp_id;

  -- ======================================================================
  -- 6. ACTIVITIES: Complete
  -- ======================================================================

  -- 6.1 complete_crm_activity succeeds
  v_total := v_total + 1;
  BEGIN
    PERFORM public.complete_crm_activity(v_act_id, 'Cliente confirmou');
    v_passed := v_passed + 1;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 6.1 complete_crm_activity: %', SQLERRM;
  END;

  -- 6.2 Activity status is completed
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_activities
  WHERE id = v_act_id AND status = 'completed' AND completed_at IS NOT NULL;
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 6.2 Activity not completed'; END IF;

  -- 6.3 Outcome recorded
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_activities WHERE id = v_act_id AND outcome = 'Cliente confirmou';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 6.3 Outcome not recorded'; END IF;

  -- 6.4 activity_completed event
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunity_events
  WHERE opportunity_id = v_opp_id AND event_type = 'activity_completed';
  IF v_tmp >= 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 6.4 activity_completed event missing'; END IF;

  -- 6.5 Cannot complete already completed
  v_total := v_total + 1;
  BEGIN
    PERFORM public.complete_crm_activity(v_act_id);
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 6.5 Should fail on completed activity';
  EXCEPTION WHEN OTHERS THEN
    v_passed := v_passed + 1;
  END;

  -- ======================================================================
  -- 7. ACTIVITIES: Cancel
  -- ======================================================================

  -- 7.1 Create + cancel
  v_total := v_total + 1;
  DECLARE v_cancel_id UUID;
  BEGIN
    SELECT public.create_crm_activity(v_opp_id, 'WhatsApp', 'Cancel test', now() + interval '2 days') INTO v_cancel_id;
    PERFORM public.cancel_crm_activity(v_cancel_id);
    SELECT count(*) INTO v_tmp FROM public.crm_activities WHERE id = v_cancel_id AND status = 'cancelled';
    IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 7.1 Cancel failed'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 7.1 cancel: %', SQLERRM;
  END;

  -- 7.2 activity_cancelled event
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunity_events
  WHERE opportunity_id = v_opp_id AND event_type = 'activity_cancelled';
  IF v_tmp >= 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 7.2 activity_cancelled event missing'; END IF;

  -- ======================================================================
  -- 8. ACTIVITIES: Update (reschedule)
  -- ======================================================================

  -- 8.1 Create + update
  v_total := v_total + 1;
  DECLARE v_upd_id UUID; v_new_due TIMESTAMPTZ;
  BEGIN
    SELECT public.create_crm_activity(v_opp_id, 'E-mail', 'Update test', now() + interval '3 days') INTO v_upd_id;
    v_new_due := now() + interval '5 days';
    PERFORM public.update_crm_activity(v_upd_id, NULL, NULL, NULL, v_new_due, NULL);
    SELECT count(*) INTO v_tmp FROM public.crm_activities WHERE id = v_upd_id AND due_at::date = v_new_due::date;
    IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 8.1 Update failed'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 8.1 update: %', SQLERRM;
  END;

  -- ======================================================================
  -- 9. EVENTS: Opportunity create/move/won/lost events
  -- ======================================================================

  -- 9.1 opportunity_created event from test opp
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunity_events
  WHERE opportunity_id = v_opp_id AND event_type = 'opportunity_created';
  IF v_tmp >= 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 9.1 opportunity_created event missing'; END IF;

  -- 9.2 stage_changed event
  v_total := v_total + 1;
  DECLARE v_new_stage UUID;
  BEGIN
    SELECT id INTO v_new_stage FROM public.crm_stages WHERE pipeline_id = v_pipeline_id AND active = true ORDER BY position OFFSET 1 LIMIT 1;
    PERFORM public.move_crm_opportunity(v_opp_id, v_new_stage);
    SELECT count(*) INTO v_tmp FROM public.crm_opportunity_events
    WHERE opportunity_id = v_opp_id AND event_type = 'stage_changed';
    IF v_tmp >= 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 9.2 stage_changed event missing'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 9.2 move: %', SQLERRM;
  END;

  -- 9.3 marked_won event + pending activities cancelled
  v_total := v_total + 1;
  BEGIN
    PERFORM public.create_crm_activity(v_opp_id, 'Reunião', 'Pending at won', now() + interval '1 day');
    PERFORM public.mark_opportunity_won(v_opp_id);
    SELECT count(*) INTO v_tmp FROM public.crm_opportunity_events
    WHERE opportunity_id = v_opp_id AND event_type = 'marked_won';
    IF v_tmp >= 1 THEN
      v_tmp := 0;
      SELECT count(*) INTO v_tmp FROM public.crm_activities
      WHERE opportunity_id = v_opp_id AND status = 'pending';
      IF v_tmp = 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 9.3 pending activities not cancelled on won'; END IF;
    ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 9.3 marked_won event missing'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 9.3 won: %', SQLERRM;
  END;

  -- 9.4 marked_lost event
  v_total := v_total + 1;
  BEGIN
    UPDATE public.crm_opportunities SET status = 'open', won_at = NULL, lost_at = NULL WHERE id = v_opp_id;
    SELECT id INTO v_reason_id FROM public.crm_loss_reasons WHERE name = 'Preço' LIMIT 1;
    PERFORM public.mark_opportunity_lost(v_opp_id, 'Preço', v_reason_id, NULL);
    SELECT count(*) INTO v_tmp FROM public.crm_opportunity_events
    WHERE opportunity_id = v_opp_id AND event_type = 'marked_lost';
    IF v_tmp >= 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 9.4 marked_lost event missing'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 9.4 lost: %', SQLERRM;
  END;

  -- 9.5 append-only: cannot delete events
  v_total := v_total + 1;
  BEGIN
    DELETE FROM public.crm_opportunity_events WHERE opportunity_id = v_opp_id;
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 9.5 Events should be append-only';
  EXCEPTION WHEN OTHERS THEN
    v_passed := v_passed + 1;
  END;

  -- ======================================================================
  -- 10. NEXT ACTIVITY: Read model
  -- ======================================================================

  -- 10.1 View has next_activity columns
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM information_schema.columns
  WHERE table_schema='public' AND table_name='crm_opportunities_board_v' AND column_name='next_activity_status_semantic';
  IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 10.1 next_activity_status_semantic missing'; END IF;

  -- 10.2 Board returns next_activity for open opp with pending activity
  v_total := v_total + 1;
  UPDATE public.crm_opportunities SET status = 'open', lost_at = NULL, lost_reason = NULL, lost_reason_id = NULL WHERE id = v_opp_id;
  DECLARE v_new_act UUID;
  BEGIN
    SELECT public.create_crm_activity(v_opp_id, 'Follow-up', 'Board test', now() + interval '1 day') INTO v_new_act;
    SELECT count(*) INTO v_tmp FROM public.crm_opportunities_board_v
    WHERE opportunity_id = v_opp_id AND next_activity_id IS NOT NULL;
    IF v_tmp = 1 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 10.2 Board missing next_activity'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 10.2: %', SQLERRM;
  END;

  -- ======================================================================
  -- 11. LOST REASON: Structured required
  -- ======================================================================

  -- 11.1 mark_opportunity_lost with Outro requires detail
  v_total := v_total + 1;
  BEGIN
    UPDATE public.crm_opportunities SET status = 'open', lost_at = NULL WHERE id = v_opp_id;
    SELECT id INTO v_reason_outro_id FROM public.crm_loss_reasons WHERE name = 'Outro' LIMIT 1;
    PERFORM public.mark_opportunity_lost(v_opp_id, NULL, v_reason_outro_id, NULL);
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 11.1 Should require detail for Outro';
  EXCEPTION WHEN OTHERS THEN
    v_passed := v_passed + 1;
  END;

  -- 11.2 mark_opportunity_lost without reason fails
  v_total := v_total + 1;
  BEGIN
    UPDATE public.crm_opportunities SET status = 'open', lost_at = NULL WHERE id = v_opp_id;
    PERFORM public.mark_opportunity_lost(v_opp_id, NULL, NULL, NULL);
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 11.2 Should require reason';
  EXCEPTION WHEN OTHERS THEN
    v_passed := v_passed + 1;
  END;

  -- ======================================================================
  -- 12. SECURITY
  -- ======================================================================

  -- 12.1 Anon cannot read activities
  v_total := v_total + 1;
  IF has_table_privilege('anon', 'public.crm_activities', 'SELECT') THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 12.1 Anon can SELECT crm_activities';
  ELSE v_passed := v_passed + 1;
  END IF;

  -- 12.2 Anon cannot insert activities
  v_total := v_total + 1;
  IF has_table_privilege('anon', 'public.crm_activities', 'INSERT') THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 12.2 Anon can INSERT crm_activities';
  ELSE v_passed := v_passed + 1;
  END IF;

  -- 12.3 Anon cannot update events
  v_total := v_total + 1;
  IF has_table_privilege('anon', 'public.crm_opportunity_events', 'UPDATE') THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 12.3 Anon can UPDATE crm_opportunity_events';
  ELSE v_passed := v_passed + 1;
  END IF;

  -- 12.4 Anon cannot delete events
  v_total := v_total + 1;
  IF has_table_privilege('anon', 'public.crm_opportunity_events', 'DELETE') THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 12.4 Anon can DELETE crm_opportunity_events';
  ELSE v_passed := v_passed + 1;
  END IF;

  -- 12.5 Authenticated cannot update events
  v_total := v_total + 1;
  IF has_table_privilege('authenticated', 'public.crm_opportunity_events', 'UPDATE') THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 12.5 Authenticated can UPDATE events';
  ELSE v_passed := v_passed + 1;
  END IF;

  -- 12.6 Authenticated cannot delete events
  v_total := v_total + 1;
  IF has_table_privilege('authenticated', 'public.crm_opportunity_events', 'DELETE') THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 12.6 Authenticated can DELETE events';
  ELSE v_passed := v_passed + 1;
  END IF;

  -- ======================================================================
  -- 13. INTEGRITY
  -- ======================================================================

  -- 13.1 No orphan activities
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_activities a
  WHERE NOT EXISTS (SELECT 1 FROM public.crm_opportunities o WHERE o.id = a.opportunity_id);
  IF v_tmp = 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 13.1 Orphan activities: %', v_tmp; END IF;

  -- 13.2 No orphan events
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_opportunity_events e
  WHERE NOT EXISTS (SELECT 1 FROM public.crm_opportunities o WHERE o.id = e.opportunity_id);
  IF v_tmp = 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 13.2 Orphan events: %', v_tmp; END IF;

  -- 13.3 No completed_at on non-completed activities
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_activities
  WHERE status != 'completed' AND completed_at IS NOT NULL;
  IF v_tmp = 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 13.3 completed_at on non-completed: %', v_tmp; END IF;

  -- 13.4 No invalid activity status
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_activities
  WHERE status NOT IN ('pending', 'completed', 'cancelled');
  IF v_tmp = 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 13.4 Invalid activity status: %', v_tmp; END IF;

  -- 13.5 No pending activity on won opportunity
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_activities a
  JOIN public.crm_opportunities o ON o.id = a.opportunity_id
  WHERE o.status = 'won' AND a.status = 'pending';
  IF v_tmp = 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 13.5 Pending on won: %', v_tmp; END IF;

  -- 13.6 No pending activity on lost opportunity
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM public.crm_activities a
  JOIN public.crm_opportunities o ON o.id = a.opportunity_id
  WHERE o.status = 'lost' AND a.status = 'pending';
  IF v_tmp = 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 13.6 Pending on lost: %', v_tmp; END IF;

  -- 13.7 No duplicate loss reason seed
  v_total := v_total + 1;
  SELECT count(*) INTO v_tmp FROM (
    SELECT name, count(*) c FROM public.crm_loss_reasons GROUP BY name HAVING count(*) > 1
  ) sub;
  IF v_tmp = 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 13.7 Duplicate loss reasons: %', v_tmp; END IF;

  -- ======================================================================
  -- 14. EVENT SECURITY: Direct INSERT/UPDATE/DELETE denied
  -- ======================================================================

  -- 14.1 Authenticated cannot INSERT events directly
  v_total := v_total + 1;
  IF has_table_privilege('authenticated', 'public.crm_opportunity_events', 'INSERT') THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 14.1 Authenticated can INSERT events directly';
  ELSE v_passed := v_passed + 1;
  END IF;

  -- 14.2 Authenticated cannot UPDATE events
  v_total := v_total + 1;
  IF has_table_privilege('authenticated', 'public.crm_opportunity_events', 'UPDATE') THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 14.2 Authenticated can UPDATE events';
  ELSE v_passed := v_passed + 1;
  END IF;

  -- 14.3 Authenticated cannot DELETE events
  v_total := v_total + 1;
  IF has_table_privilege('authenticated', 'public.crm_opportunity_events', 'DELETE') THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 14.3 Authenticated can DELETE events';
  ELSE v_passed := v_passed + 1;
  END IF;

  -- ======================================================================
  -- 15. RPC EVENT ATOMICITY: complete_crm_activity writes event
  -- ======================================================================

  -- 15.1 complete_crm_activity generates activity_completed event
  v_total := v_total + 1;
  DECLARE v_act_test UUID; v_evt_count_before INT; v_evt_count_after INT;
  BEGIN
    UPDATE public.crm_opportunities SET status = 'open', won_at = NULL, lost_at = NULL, lost_reason_id = NULL WHERE id = v_opp_id;
    SELECT public.create_crm_activity(v_opp_id, 'Follow-up', 'Event test', now() + interval '1 day') INTO v_act_test;
    SELECT count(*) INTO v_evt_count_before FROM public.crm_opportunity_events
    WHERE opportunity_id = v_opp_id AND event_type = 'activity_completed';
    PERFORM public.complete_crm_activity(v_act_test, 'Teste concluido');
    SELECT count(*) INTO v_evt_count_after FROM public.crm_opportunity_events
    WHERE opportunity_id = v_opp_id AND event_type = 'activity_completed';
    IF v_evt_count_after > v_evt_count_before THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 15.1 complete_crm_activity no event'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 15.1: %', SQLERRM;
  END;

  -- ======================================================================
  -- 16. CLOSED OPPORTUNITY CLEANUP
  -- ======================================================================

  -- 16.1 Won cancels all pending
  v_total := v_total + 1;
  BEGIN
    PERFORM public.create_crm_activity(v_opp_id, 'Ligação', 'Pending 1', now() + interval '1 day');
    PERFORM public.create_crm_activity(v_opp_id, 'WhatsApp', 'Pending 2', now() + interval '2 days');
    PERFORM public.mark_opportunity_won(v_opp_id);
    SELECT count(*) INTO v_tmp FROM public.crm_activities
    WHERE opportunity_id = v_opp_id AND status = 'pending';
    IF v_tmp = 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 16.1 Won pending cleanup: %', v_tmp; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 16.1: %', SQLERRM;
  END;

  -- 16.2 Lost cancels all pending
  v_total := v_total + 1;
  BEGIN
    UPDATE public.crm_opportunities SET status = 'open', won_at = NULL, lost_at = NULL, lost_reason_id = NULL WHERE id = v_opp_id;
    PERFORM public.create_crm_activity(v_opp_id, 'E-mail', 'Lost pending', now() + interval '1 day');
    SELECT id INTO v_reason_id FROM public.crm_loss_reasons WHERE name = 'Preço' LIMIT 1;
    PERFORM public.mark_opportunity_lost(v_opp_id, 'Preço', v_reason_id, NULL);
    SELECT count(*) INTO v_tmp FROM public.crm_activities
    WHERE opportunity_id = v_opp_id AND status = 'pending';
    IF v_tmp = 0 THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 16.2 Lost pending cleanup: %', v_tmp; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 16.2: %', SQLERRM;
  END;

  -- ======================================================================
  -- 17. NEXT ACTIVITY ORDERING
  -- ======================================================================

  -- 17.1 Earliest pending wins
  v_total := v_total + 1;
  DECLARE v_act_early UUID; v_act_late UUID; v_next_id UUID;
  BEGIN
    UPDATE public.crm_opportunities SET status = 'open', won_at = NULL, lost_at = NULL, lost_reason_id = NULL WHERE id = v_opp_id;
    SELECT public.create_crm_activity(v_opp_id, 'Ligação', 'Late', now() + interval '10 days') INTO v_act_late;
    SELECT public.create_crm_activity(v_opp_id, 'WhatsApp', 'Early', now() + interval '1 day') INTO v_act_early;
    SELECT next_activity_id INTO v_next_id FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp_id;
    IF v_next_id = v_act_early THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 17.1 Next activity not earliest: got %, expected %', v_next_id, v_act_early; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 17.1: %', SQLERRM;
  END;

  -- 17.2 Completed excluded, next pending used
  v_total := v_total + 1;
  DECLARE v_next_before UUID; v_next_after UUID;
  BEGIN
    SELECT next_activity_id INTO v_next_before FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp_id;
    PERFORM public.complete_crm_activity(v_next_before, 'Done');
    SELECT next_activity_id INTO v_next_after FROM public.crm_opportunities_board_v WHERE opportunity_id = v_opp_id;
    IF v_next_after IS NOT NULL AND v_next_after != v_next_before THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 17.2 Completed not excluded: before=% after=%', v_next_before, v_next_after; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 17.2: %', SQLERRM;
  END;

  -- ======================================================================
  -- 18. EVENT APPEND-ONLY INTEGRITY
  -- ======================================================================

  -- 18.1 Event data unchanged after other mutations
  v_total := v_total + 1;
  DECLARE v_evt_original JSONB; v_evt_after JSONB; v_evt_id_check UUID;
  BEGIN
    SELECT id, event_data INTO v_evt_id_check, v_evt_original FROM public.crm_opportunity_events
    WHERE opportunity_id = v_opp_id AND event_type = 'opportunity_created' LIMIT 1;
    PERFORM public.update_crm_opportunity(v_opp_id, 'Updated Title', NULL, NULL, NULL, NULL, NULL);
    SELECT event_data INTO v_evt_after FROM public.crm_opportunity_events WHERE id = v_evt_id_check;
    IF v_evt_original = v_evt_after THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; RAISE WARNING 'FAIL 18.1 Event data changed after update'; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_failed := v_failed + 1; RAISE WARNING 'FAIL 18.1: %', SQLERRM;
  END;

  -- ======================================================================
  -- CLEANUP
  -- ======================================================================
  DELETE FROM public.crm_opportunity_events WHERE opportunity_id = v_opp_id;
  DELETE FROM public.crm_activities WHERE opportunity_id = v_opp_id;
  DELETE FROM public.crm_opportunities WHERE id = v_opp_id;

  -- ======================================================================
  -- SUMMARY
  -- ======================================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== ETAPA 08B SQL RESULTS: %/% passed (total: %) ===', v_passed, v_total, v_total;
  IF v_failed = 0 THEN
    RAISE NOTICE 'ALL CHECKS PASSED';
  ELSE
    RAISE WARNING '% CHECKS FAILED', v_failed;
  END IF;
END $$;
