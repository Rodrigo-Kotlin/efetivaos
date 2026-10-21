-- FIN-IMPORT-5.5 period-lock trigger and enforcement regression tests.
-- All fixture writes are rolled back; no real April lock is created here.

BEGIN;

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);

DO $test$
DECLARE
  v_definition text;
  v_lock public.financial_period_locks%ROWTYPE;
  v_inserted boolean := false;
  v_blocked boolean := false;
  v_open_allowed boolean := false;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'set_audit_fields'
  LIMIT 1;

  IF v_definition IS NULL THEN RAISE EXCEPTION 'FAIL: audit trigger function missing'; END IF;
  IF v_definition LIKE '%NEW.created_by%' AND v_definition NOT LIKE '%TG_TABLE_NAME = ''financial_period_locks''%' THEN
    RAISE EXCEPTION 'FAIL: invalid created_by reference is unguarded';
  END IF;
  IF v_definition NOT LIKE '%NEW.locked_by%' OR v_definition NOT LIKE '%NEW.locked_at%' THEN
    RAISE EXCEPTION 'FAIL: financial_period_locks audit branch missing';
  END IF;

  INSERT INTO public.financial_period_locks (period_start, period_end, locked_by, reason)
  VALUES (date '2099-04-01', date '2099-04-30', auth.uid(), 'FIN-IMPORT-5.5 TEST FIXTURE')
  RETURNING * INTO v_lock;
  v_inserted := true;

  IF v_lock.locked_by <> auth.uid() OR v_lock.locked_at IS NULL OR v_lock.created_at IS NULL THEN
    RAISE EXCEPTION 'FAIL: valid lock audit fields were not populated';
  END IF;

  BEGIN
    PERFORM public.assert_period_unlocked(date '2099-04-15');
  EXCEPTION WHEN others THEN
    v_blocked := SQLERRM LIKE 'Período bloqueado para a data%';
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: locked-period enforcement did not reject'; END IF;

  BEGIN
    PERFORM public.assert_period_unlocked(date '2099-05-01');
    v_open_allowed := true;
  EXCEPTION WHEN others THEN
    v_open_allowed := false;
  END;
  IF NOT v_open_allowed THEN RAISE EXCEPTION 'FAIL: open-period behavior rejected'; END IF;

  IF NOT v_inserted THEN RAISE EXCEPTION 'FAIL: fixture lock was not inserted'; END IF;
  RAISE NOTICE 'PASS: period lock insert, locked_by audit, enforcement, and open period';
END;
$test$;

ROLLBACK;

SELECT 'FIN-IMPORT-5.5 period lock tests passed' AS result;
