-- FIN-IMPORT-5.3G canonical manifest hash contract tests.
-- Read-only: no real April manifest is executed and no financial rows are written.

BEGIN;

DO $test$
DECLARE
  v_function oid;
  v_definition text;
  v_base jsonb := '{"a":1,"b":{"long":2,"x":3}}'::jsonb;
  v_reordered jsonb := '{"b":{"x":3,"long":2},"a":1}'::jsonb;
  v_whitespace jsonb := (' { "b" : { "x" : 3, "long" : 2 }, "a" : 1 } ')::jsonb;
  v_mutated jsonb := '{"a":1,"b":{"long":2,"x":4}}'::jsonb;
  v_base_hash text;
  v_reordered_hash text;
  v_whitespace_hash text;
  v_mutated_hash text;
BEGIN
  SELECT p.oid, pg_get_functiondef(p.oid)
    INTO v_function, v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'execute_authoritative_financial_import_april_2026'
    AND pg_get_function_identity_arguments(p.oid) = 'p_manifest_hash text, p_batch_key text, p_manifest_json text';

  IF v_function IS NULL THEN RAISE EXCEPTION 'FAIL: April executor missing'; END IF;
  IF v_definition NOT LIKE '%c_canonical_hash CONSTANT text%' THEN RAISE EXCEPTION 'FAIL: canonical hash constant missing'; END IF;
  IF v_definition NOT LIKE '%v_manifest::text%' THEN RAISE EXCEPTION 'FAIL: JSONB canonical serialization missing'; END IF;
  IF v_definition NOT LIKE '%6605a548fdb031d83e95e84945cb5853bbd816485eab17ed2b7bdc42749af662%' THEN RAISE EXCEPTION 'FAIL: file hash contract missing'; END IF;
  IF v_definition NOT LIKE '%adf6e94c52bfe00a6c997127377f8ed4a8edc4db0ab501e3536fe84ebc5039f9%' THEN RAISE EXCEPTION 'FAIL: canonical hash contract missing'; END IF;

  v_base_hash := encode(digest(convert_to(v_base::text, 'UTF8'), 'sha256'), 'hex');
  v_reordered_hash := encode(digest(convert_to(v_reordered::text, 'UTF8'), 'sha256'), 'hex');
  v_whitespace_hash := encode(digest(convert_to(v_whitespace::text, 'UTF8'), 'sha256'), 'hex');
  v_mutated_hash := encode(digest(convert_to(v_mutated::text, 'UTF8'), 'sha256'), 'hex');

  IF v_base_hash <> v_reordered_hash OR v_base_hash <> v_whitespace_hash THEN
    RAISE EXCEPTION 'FAIL: whitespace/key order changed canonical hash';
  END IF;
  IF v_base_hash = v_mutated_hash THEN
    RAISE EXCEPTION 'FAIL: semantic mutation was not detected';
  END IF;

  RAISE NOTICE 'PASS: canonical file/payload hash contract, whitespace, key order, semantic mutation';
END;
$test$;

ROLLBACK;

SELECT 'FIN-IMPORT-5.3G hash contract tests passed' AS result;
