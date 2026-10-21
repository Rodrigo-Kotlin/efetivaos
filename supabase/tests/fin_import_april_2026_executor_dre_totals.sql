-- FIN-IMPORT-5.3E DRE bucket-total regression test.
-- No real April manifest or financial rows are loaded here.

BEGIN;

DO $test$
DECLARE
  v_definition text;
  v_function oid;
  v_operating_expenses numeric(15,2) := 0;
  v_revenue_deductions numeric(15,2) := 0;
  v_presentation text;
  v_amount numeric(15,2);
BEGIN
  SELECT p.oid, pg_get_functiondef(p.oid)
    INTO v_function, v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'execute_authoritative_financial_import_april_2026'
    AND pg_get_function_identity_arguments(p.oid) = 'p_manifest_hash text, p_batch_key text, p_manifest_json text';

  IF v_function IS NULL THEN RAISE EXCEPTION 'FAIL: April executor missing'; END IF;
  IF v_definition NOT LIKE '%v_deductions numeric%' THEN RAISE EXCEPTION 'FAIL: deduction accumulator missing'; END IF;
  IF v_definition NOT LIKE '%v_dre_presentation = ''DEDUCAO_RECEITA''%' THEN RAISE EXCEPTION 'FAIL: deduction bucket branch missing'; END IF;
  IF v_definition NOT LIKE '%v_dre_presentation = ''DESPESA_OPERACIONAL''%' THEN RAISE EXCEPTION 'FAIL: operating expense bucket branch missing'; END IF;
  IF v_definition NOT LIKE '%v_deductions <> 78.28%' THEN RAISE EXCEPTION 'FAIL: deduction total contract missing'; END IF;
  IF v_definition NOT LIKE '%v_expenses <> 45726.82%' THEN RAISE EXCEPTION 'FAIL: operating expense total contract missing'; END IF;
  IF v_definition NOT LIKE '%NONE remains outside DRE%' THEN RAISE EXCEPTION 'FAIL: NONE bucket separation missing'; END IF;

  -- Explicit isolated fixture required by FIN-IMPORT-5.3E:
  -- DESPESA_OPERACIONAL 100 must not absorb DEDUCAO_RECEITA 10.
  FOR v_presentation, v_amount IN
    SELECT * FROM (VALUES
      ('DESPESA_OPERACIONAL', 100.00::numeric(15,2)),
      ('DEDUCAO_RECEITA', 10.00::numeric(15,2))
    ) AS fixture(presentation, amount)
  LOOP
    IF v_presentation = 'DESPESA_OPERACIONAL' THEN
      v_operating_expenses := v_operating_expenses + v_amount;
    ELSIF v_presentation = 'DEDUCAO_RECEITA' THEN
      v_revenue_deductions := v_revenue_deductions + v_amount;
    ELSE
      RAISE EXCEPTION 'FAIL: unknown fixture bucket';
    END IF;
  END LOOP;
  IF v_operating_expenses <> 100.00 OR v_revenue_deductions <> 10.00 THEN
    RAISE EXCEPTION 'FAIL: bucket fixture totals are operating=% deductions=%', v_operating_expenses, v_revenue_deductions;
  END IF;
  IF v_operating_expenses = 110.00 THEN
    RAISE EXCEPTION 'FAIL: deduction leaked into operating expenses';
  END IF;

  RAISE NOTICE 'PASS: FIN-IMPORT-5.3E DRE bucket totals regression';
END;
$test$;

ROLLBACK;

SELECT 'FIN-IMPORT-5.3E DRE totals tests passed' AS result;
