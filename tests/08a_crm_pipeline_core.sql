DO $$
DECLARE
  v_count INT;
  v_pipeline_id UUID;
  v_stage_id UUID;
  v_opp_id UUID;
BEGIN
  RAISE NOTICE '=== CRM 08A — Pipeline Core SQL Tests ===';

  -- =====================================================================
  -- SCHEMA CHECKS
  -- =====================================================================
  RAISE NOTICE '--- Schema ---';

  -- 01: crm_pipelines table exists
  SELECT COUNT(*) INTO v_count FROM information_schema.tables WHERE table_name = 'crm_pipelines';
  IF v_count = 1 THEN RAISE NOTICE 'PASS 01: crm_pipelines table exists'; ELSE RAISE WARNING 'FAIL 01'; END IF;

  -- 02: crm_stages table exists
  SELECT COUNT(*) INTO v_count FROM information_schema.tables WHERE table_name = 'crm_stages';
  IF v_count = 1 THEN RAISE NOTICE 'PASS 02: crm_stages table exists'; ELSE RAISE WARNING 'FAIL 02'; END IF;

  -- 03: crm_opportunities table exists
  SELECT COUNT(*) INTO v_count FROM information_schema.tables WHERE table_name = 'crm_opportunities';
  IF v_count = 1 THEN RAISE NOTICE 'PASS 03: crm_opportunities table exists'; ELSE RAISE WARNING 'FAIL 03'; END IF;

  -- 04: crm_pipelines columns
  SELECT COUNT(*) INTO v_count FROM information_schema.columns WHERE table_name = 'crm_pipelines' AND column_name IN ('id','name','description','active','is_default','created_at','updated_at','created_by');
  IF v_count >= 7 THEN RAISE NOTICE 'PASS 04: crm_pipelines has required columns'; ELSE RAISE WARNING 'FAIL 04: found %', v_count; END IF;

  -- 05: crm_stages columns
  SELECT COUNT(*) INTO v_count FROM information_schema.columns WHERE table_name = 'crm_stages' AND column_name IN ('id','pipeline_id','name','position','probability','active','created_at','updated_at');
  IF v_count >= 7 THEN RAISE NOTICE 'PASS 05: crm_stages has required columns'; ELSE RAISE WARNING 'FAIL 05: found %', v_count; END IF;

  -- 06: crm_opportunities columns
  SELECT COUNT(*) INTO v_count FROM information_schema.columns WHERE table_name = 'crm_opportunities' AND column_name IN ('id','client_id','pipeline_id','stage_id','title','description','value','probability','expected_close_date','responsible_user_id','status','won_at','lost_at','lost_reason','sort_order','created_by','created_at','updated_at');
  IF v_count >= 18 THEN RAISE NOTICE 'PASS 06: crm_opportunities has required columns'; ELSE RAISE WARNING 'FAIL 06: found %', v_count; END IF;

  -- 07: crm_opportunities.client_id FK to clients
  SELECT COUNT(*) INTO v_count FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'crm_opportunities' AND kcu.column_name = 'client_id' AND tc.constraint_type = 'FOREIGN KEY';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 07: client_id FK exists'; ELSE RAISE WARNING 'FAIL 07'; END IF;

  -- 08: crm_opportunities.pipeline_id FK to crm_pipelines
  SELECT COUNT(*) INTO v_count FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'crm_opportunities' AND kcu.column_name = 'pipeline_id' AND tc.constraint_type = 'FOREIGN KEY';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 08: pipeline_id FK exists'; ELSE RAISE WARNING 'FAIL 08'; END IF;

  -- 09: crm_opportunities.stage_id FK to crm_stages
  SELECT COUNT(*) INTO v_count FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'crm_opportunities' AND kcu.column_name = 'stage_id' AND tc.constraint_type = 'FOREIGN KEY';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 09: stage_id FK exists'; ELSE RAISE WARNING 'FAIL 09'; END IF;

  -- 10: crm_stages.pipeline_id FK to crm_pipelines
  SELECT COUNT(*) INTO v_count FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'crm_stages' AND kcu.column_name = 'pipeline_id' AND tc.constraint_type = 'FOREIGN KEY';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 10: stages.pipeline_id FK exists'; ELSE RAISE WARNING 'FAIL 10'; END IF;

  -- =====================================================================
  -- SEED CHECKS
  -- =====================================================================
  RAISE NOTICE '--- Seed ---';

  -- 11: Default pipeline exists
  SELECT COUNT(*) INTO v_count FROM crm_pipelines WHERE is_default = true AND active = true;
  IF v_count = 1 THEN RAISE NOTICE 'PASS 11: One default active pipeline'; ELSE RAISE WARNING 'FAIL 11: found %', v_count; END IF;

  -- 12: Default pipeline named correctly
  SELECT id INTO v_pipeline_id FROM crm_pipelines WHERE is_default = true LIMIT 1;
  SELECT COUNT(*) INTO v_count FROM crm_pipelines WHERE id = v_pipeline_id AND name = 'Pipeline Comercial';
  IF v_count = 1 THEN RAISE NOTICE 'PASS 12: Pipeline named Pipeline Comercial'; ELSE RAISE WARNING 'FAIL 12'; END IF;

  -- 13: Five stages exist
  SELECT COUNT(*) INTO v_count FROM crm_stages WHERE pipeline_id = v_pipeline_id;
  IF v_count = 5 THEN RAISE NOTICE 'PASS 13: 5 stages seeded'; ELSE RAISE WARNING 'FAIL 13: found %', v_count; END IF;

  -- 14: Stage positions are 1-5
  SELECT COUNT(*) INTO v_count FROM crm_stages WHERE pipeline_id = v_pipeline_id AND position BETWEEN 1 AND 5;
  IF v_count = 5 THEN RAISE NOTICE 'PASS 14: Stage positions 1-5'; ELSE RAISE WARNING 'FAIL 14'; END IF;

  -- 15: Stage probabilities correct
  SELECT COUNT(*) INTO v_count FROM crm_stages WHERE pipeline_id = v_pipeline_id AND (
    (position = 1 AND probability = 10) OR
    (position = 2 AND probability = 20) OR
    (position = 3 AND probability = 40) OR
    (position = 4 AND probability = 60) OR
    (position = 5 AND probability = 80)
  );
  IF v_count = 5 THEN RAISE NOTICE 'PASS 15: Stage probabilities correct'; ELSE RAISE WARNING 'FAIL 15'; END IF;

  -- 16: Unique pipeline+position constraint
  SELECT COUNT(*) INTO v_count FROM pg_indexes WHERE tablename = 'crm_stages' AND indexname LIKE '%pipeline_position%';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 16: Unique pipeline+position index'; ELSE RAISE WARNING 'FAIL 16'; END IF;

  -- 17: Unique default pipeline constraint
  SELECT COUNT(*) INTO v_count FROM pg_indexes WHERE tablename = 'crm_pipelines' AND indexname LIKE '%default%';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 17: Unique default pipeline index'; ELSE RAISE WARNING 'FAIL 17'; END IF;

  -- =====================================================================
  -- RPC CHECKS
  -- =====================================================================
  RAISE NOTICE '--- RPCs ---';

  -- 18: create_crm_opportunity exists
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'create_crm_opportunity';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 18: create_crm_opportunity exists'; ELSE RAISE WARNING 'FAIL 18'; END IF;

  -- 19: update_crm_opportunity exists
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'update_crm_opportunity';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 19: update_crm_opportunity exists'; ELSE RAISE WARNING 'FAIL 19'; END IF;

  -- 20: move_crm_opportunity exists
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'move_crm_opportunity';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 20: move_crm_opportunity exists'; ELSE RAISE WARNING 'FAIL 20'; END IF;

  -- 21: mark_opportunity_won exists
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'mark_opportunity_won';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 21: mark_opportunity_won exists'; ELSE RAISE WARNING 'FAIL 21'; END IF;

  -- 22: mark_opportunity_lost exists
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'mark_opportunity_lost';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 22: mark_opportunity_lost exists'; ELSE RAISE WARNING 'FAIL 22'; END IF;

  -- 23: All RPCs are SECURITY DEFINER
  SELECT COUNT(*) INTO v_count FROM pg_proc
  WHERE proname IN ('create_crm_opportunity','update_crm_opportunity','move_crm_opportunity','mark_opportunity_won','mark_opportunity_lost')
    AND prosecdef = true;
  IF v_count = 5 THEN RAISE NOTICE 'PASS 23: All 5 RPCs are SECURITY DEFINER'; ELSE RAISE WARNING 'FAIL 23: %', v_count; END IF;

  -- =====================================================================
  -- VIEW CHECKS
  -- =====================================================================
  RAISE NOTICE '--- Views ---';

  -- 24: crm_opportunities_board_v exists
  SELECT COUNT(*) INTO v_count FROM information_schema.views WHERE table_name = 'crm_opportunities_board_v';
  IF v_count = 1 THEN RAISE NOTICE 'PASS 24: board view exists'; ELSE RAISE WARNING 'FAIL 24'; END IF;

  -- 25: board view has security_invoker
  SELECT COUNT(*) INTO v_count FROM pg_views WHERE viewname = 'crm_opportunities_board_v' AND definition LIKE '%security_invoker%';
  IF v_count = 1 THEN RAISE NOTICE 'PASS 25: board view is security_invoker'; ELSE RAISE WARNING 'FAIL 25'; END IF;

  -- =====================================================================
  -- RLS CHECKS
  -- =====================================================================
  RAISE NOTICE '--- RLS ---';

  -- 26: RLS enabled on crm_pipelines
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'crm_pipelines' AND relrowsecurity = true) THEN
    RAISE NOTICE 'PASS 26: RLS on crm_pipelines'; ELSE RAISE WARNING 'FAIL 26'; END IF;

  -- 27: RLS enabled on crm_stages
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'crm_stages' AND relrowsecurity = true) THEN
    RAISE NOTICE 'PASS 27: RLS on crm_stages'; ELSE RAISE WARNING 'FAIL 27'; END IF;

  -- 28: RLS enabled on crm_opportunities
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'crm_opportunities' AND relrowsecurity = true) THEN
    RAISE NOTICE 'PASS 28: RLS on crm_opportunities'; ELSE RAISE WARNING 'FAIL 28'; END IF;

  -- 29: Internal user SELECT on pipelines
  SELECT COUNT(*) INTO v_count FROM pg_policies WHERE tablename = 'crm_pipelines' AND cmd = 'SELECT' AND policyname LIKE '%internal%';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 29: Internal SELECT on pipelines'; ELSE RAISE WARNING 'FAIL 29'; END IF;

  -- 30: Admin INSERT on pipelines
  SELECT COUNT(*) INTO v_count FROM pg_policies WHERE tablename = 'crm_pipelines' AND cmd = 'INSERT' AND policyname LIKE '%admin%';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 30: Admin INSERT on pipelines'; ELSE RAISE WARNING 'FAIL 30'; END IF;

  -- 31: Internal user SELECT on opportunities
  SELECT COUNT(*) INTO v_count FROM pg_policies WHERE tablename = 'crm_opportunities' AND cmd = 'SELECT' AND policyname LIKE '%internal%';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 31: Internal SELECT on opportunities'; ELSE RAISE WARNING 'FAIL 31'; END IF;

  -- 32: Internal user INSERT on opportunities
  SELECT COUNT(*) INTO v_count FROM pg_policies WHERE tablename = 'crm_opportunities' AND cmd = 'INSERT' AND policyname LIKE '%internal%';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 32: Internal INSERT on opportunities'; ELSE RAISE WARNING 'FAIL 32'; END IF;

  -- 33: No anon access
  SELECT COUNT(*) INTO v_count FROM pg_policies WHERE tablename IN ('crm_pipelines','crm_stages','crm_opportunities') AND roles = '{anon}';
  IF v_count = 0 THEN RAISE NOTICE 'PASS 33: No anon policies'; ELSE RAISE WARNING 'FAIL 33: %', v_count; END IF;

  -- =====================================================================
  -- INDEX CHECKS
  -- =====================================================================
  RAISE NOTICE '--- Indexes ---';

  -- 34: Pipeline status index
  SELECT COUNT(*) INTO v_count FROM pg_indexes WHERE tablename = 'crm_opportunities' AND indexname LIKE '%pipeline_status%';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 34: pipeline+status index'; ELSE RAISE WARNING 'FAIL 34'; END IF;

  -- 35: Stage index
  SELECT COUNT(*) INTO v_count FROM pg_indexes WHERE tablename = 'crm_opportunities' AND indexname LIKE '%stage%';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 35: stage index'; ELSE RAISE WARNING 'FAIL 35'; END IF;

  -- 36: Client index
  SELECT COUNT(*) INTO v_count FROM pg_indexes WHERE tablename = 'crm_opportunities' AND indexname LIKE '%client%';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 36: client index'; ELSE RAISE WARNING 'FAIL 36'; END IF;

  -- =====================================================================
  -- CONSTRAINT CHECKS
  -- =====================================================================
  RAISE NOTICE '--- Constraints ---';

  -- 37: value >= 0 constraint
  SELECT COUNT(*) INTO v_count FROM pg_constraint WHERE conname LIKE '%value%' AND conrelid = 'crm_opportunities'::regclass;
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 37: value >= 0 constraint'; ELSE RAISE WARNING 'FAIL 37'; END IF;

  -- 38: probability 0-100 constraint on opportunities
  SELECT COUNT(*) INTO v_count FROM pg_constraint WHERE conname LIKE '%probability%' AND conrelid = 'crm_opportunities'::regclass;
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 38: probability 0-100 on opportunities'; ELSE RAISE WARNING 'FAIL 38'; END IF;

  -- 39: probability 0-100 constraint on stages
  SELECT COUNT(*) INTO v_count FROM pg_constraint WHERE conname LIKE '%probability%' AND conrelid = 'crm_stages'::regclass;
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 39: probability 0-100 on stages'; ELSE RAISE WARNING 'FAIL 39'; END IF;

  -- 40: status CHECK constraint
  SELECT COUNT(*) INTO v_count FROM pg_constraint WHERE conname LIKE '%status%' AND conrelid = 'crm_opportunities'::regclass AND contype = 'c';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 40: status CHECK constraint'; ELSE RAISE WARNING 'FAIL 40'; END IF;

  -- =====================================================================
  -- GRANT CHECKS
  -- =====================================================================
  RAISE NOTICE '--- Grants ---';

  -- 41: authenticated SELECT on pipelines
  SELECT COUNT(*) INTO v_count FROM information_schema.role_table_grants WHERE table_name = 'crm_pipelines' AND grantee = 'authenticated' AND privilege_type = 'SELECT';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 41: authenticated SELECT on pipelines'; ELSE RAISE WARNING 'FAIL 41'; END IF;

  -- 42: authenticated SELECT on opportunities
  SELECT COUNT(*) INTO v_count FROM information_schema.role_table_grants WHERE table_name = 'crm_opportunities' AND grantee = 'authenticated' AND privilege_type = 'SELECT';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 42: authenticated SELECT on opportunities'; ELSE RAISE WARNING 'FAIL 42'; END IF;

  -- 43: authenticated INSERT on opportunities
  SELECT COUNT(*) INTO v_count FROM information_schema.role_table_grants WHERE table_name = 'crm_opportunities' AND grantee = 'authenticated' AND privilege_type = 'INSERT';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 43: authenticated INSERT on opportunities'; ELSE RAISE WARNING 'FAIL 43'; END IF;

  -- 44: authenticated EXECUTE on create_crm_opportunity
  SELECT COUNT(*) INTO v_count FROM information_schema.routine_privileges WHERE routine_name = 'create_crm_opportunity' AND grantee = 'authenticated' AND privilege_type = 'EXECUTE';
  IF v_count >= 1 THEN RAISE NOTICE 'PASS 44: authenticated EXECUTE create_crm_opportunity'; ELSE RAISE WARNING 'FAIL 44'; END IF;

  -- 45: anon cannot execute RPCs
  SELECT COUNT(*) INTO v_count FROM information_schema.routine_privileges
  WHERE routine_name IN ('create_crm_opportunity','move_crm_opportunity','mark_opportunity_won','mark_opportunity_lost')
    AND grantee = 'anon' AND privilege_type = 'EXECUTE';
  IF v_count = 0 THEN RAISE NOTICE 'PASS 45: anon cannot execute CRM RPCs'; ELSE RAISE WARNING 'FAIL 45: %', v_count; END IF;

  -- =====================================================================
  -- INTEGRITY CHECKS
  -- =====================================================================
  RAISE NOTICE '--- Integrity ---';

  -- 46: No orphan opportunities (invalid stage pipeline)
  SELECT COUNT(*) INTO v_count FROM crm_opportunities o
  JOIN crm_stages s ON s.id = o.stage_id
  WHERE s.pipeline_id != o.pipeline_id;
  IF v_count = 0 THEN RAISE NOTICE 'PASS 46: No stage/pipeline mismatches'; ELSE RAISE WARNING 'FAIL 46: %', v_count; END IF;

  -- 47: No invalid probability ranges
  SELECT COUNT(*) INTO v_count FROM crm_opportunities WHERE probability < 0 OR probability > 100;
  IF v_count = 0 THEN RAISE NOTICE 'PASS 47: No invalid probabilities on opportunities'; ELSE RAISE WARNING 'FAIL 47: %', v_count; END IF;

  -- 48: No invalid stage probabilities
  SELECT COUNT(*) INTO v_count FROM crm_stages WHERE probability < 0 OR probability > 100;
  IF v_count = 0 THEN RAISE NOTICE 'PASS 48: No invalid probabilities on stages'; ELSE RAISE WARNING 'FAIL 48: %', v_count; END IF;

  -- 49: No won opportunities with won_at = NULL
  SELECT COUNT(*) INTO v_count FROM crm_opportunities WHERE status = 'won' AND won_at IS NULL;
  IF v_count = 0 THEN RAISE NOTICE 'PASS 49: Won opps have won_at'; ELSE RAISE WARNING 'FAIL 49: %', v_count; END IF;

  -- 50: No lost opportunities with lost_at = NULL
  SELECT COUNT(*) INTO v_count FROM crm_opportunities WHERE status = 'lost' AND lost_at IS NULL;
  IF v_count = 0 THEN RAISE NOTICE 'PASS 50: Lost opps have lost_at'; ELSE RAISE WARNING 'FAIL 50: %', v_count; END IF;

  RAISE NOTICE '=== CRM 08A SQL Tests Complete (50 checks) ===';
END $$;
