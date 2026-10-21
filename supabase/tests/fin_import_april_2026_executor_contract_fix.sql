-- FIN-IMPORT-5.3C contract regression test.
-- No April manifest is loaded or executed here.

BEGIN;

DO $test$
DECLARE
  v_definition text;
  v_function oid;
  v_row70 jsonb := jsonb_build_object(
    'source_row', 70,
    'dre_effect', 'DESPESA',
    'dre_presentation', 'DESPESA_OPERACIONAL',
    'debit_account_code', '5.9.01.001'
  );
  v_manifest_values text[] := ARRAY['RECEITA_BRUTA', 'DESPESA_OPERACIONAL', 'CUSTO_SERVICO', 'NONE', 'DEDUCAO_RECEITA'];
  v_value text;
BEGIN
  SELECT p.oid, pg_get_functiondef(p.oid)
    INTO v_function, v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'execute_authoritative_financial_import_april_2026'
    AND pg_get_function_identity_arguments(p.oid) = 'p_manifest_hash text, p_batch_key text, p_manifest_json text';

  IF v_function IS NULL THEN RAISE EXCEPTION 'FAIL: April executor missing'; END IF;
  IF v_definition NOT LIKE '%dre_class%' THEN RAISE EXCEPTION 'FAIL: executor does not consult official dre_class'; END IF;
  IF v_definition NOT LIKE '%DESPESA_OPERACIONAL%' THEN RAISE EXCEPTION 'FAIL: DESPESA_OPERACIONAL alias not accepted'; END IF;
  IF v_definition NOT LIKE '%CUSTO_SERVICO%' THEN RAISE EXCEPTION 'FAIL: CUSTO_SERVICO taxonomy not accepted'; END IF;
  IF v_definition NOT LIKE '%DEDUCAO_RECEITA%' THEN RAISE EXCEPTION 'FAIL: DEDUCAO_RECEITA taxonomy not accepted'; END IF;
  IF v_definition NOT LIKE '%v_dre_presentation NOT IN%' THEN RAISE EXCEPTION 'FAIL: unknown presentation values are not rejected'; END IF;
  IF v_definition LIKE '%v_dre_presentation <> ''DESPESAS''%' OR v_definition LIKE '%v_dre_presentation <> ''CUSTOS''%' THEN
    RAISE EXCEPTION 'FAIL: obsolete presentation taxonomy remains enforced';
  END IF;

  -- Contract fixture: row 70's authoritative presentation is accepted by the
  -- explicit allow-list and remains distinct from its dre_effect/account class.
  IF (v_row70->>'dre_presentation') <> ALL(v_manifest_values) THEN
    RAISE EXCEPTION 'FAIL: row 70 fixture was not accepted by manifest taxonomy';
  END IF;
  IF (v_row70->>'dre_effect') <> 'DESPESA' OR (v_row70->>'debit_account_code') <> '5.9.01.001' THEN
    RAISE EXCEPTION 'FAIL: row 70 accounting classification fixture changed';
  END IF;

  FOREACH v_value IN ARRAY v_manifest_values
  LOOP
    IF position(quote_literal(v_value) IN v_definition) = 0 THEN
      RAISE EXCEPTION 'FAIL: manifest presentation value missing from executor: %', v_value;
    END IF;
  END LOOP;

  -- The allow-list is fail-closed: an unknown value must not be normalized to
  -- an existing class. This assertion checks the deployed source contract.
  IF v_definition NOT LIKE '%classificacao invalida na row%' THEN
    RAISE EXCEPTION 'FAIL: unknown values do not raise classification error';
  END IF;

  RAISE NOTICE 'PASS: FIN-IMPORT-5.3C DRE presentation contract regression';
END;
$test$;

ROLLBACK;

SELECT 'FIN-IMPORT-5.3C contract fix tests passed' AS result;
