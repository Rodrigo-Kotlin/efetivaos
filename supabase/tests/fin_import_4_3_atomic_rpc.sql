-- FIN-IMPORT-4.3 static RPC verification. This test never calls the executor.

DO $test$
DECLARE
  v_function oid;
  v_definition text;
  v_config text[];
BEGIN
  SELECT p.oid, pg_get_functiondef(p.oid), p.proconfig
  INTO v_function, v_definition, v_config
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'execute_authoritative_financial_import_march_2026'
    AND pg_get_function_identity_arguments(p.oid) = 'p_manifest_hash text, p_batch_key text, p_manifest_json text';

  IF v_function IS NULL THEN RAISE EXCEPTION 'FIN-IMPORT-4.3 RPC missing'; END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = v_function) IS NOT TRUE THEN RAISE EXCEPTION 'RPC is not SECURITY DEFINER'; END IF;
  IF NOT (v_config @> ARRAY['search_path=pg_catalog, public, extensions']) THEN RAISE EXCEPTION 'RPC search_path mismatch'; END IF;
  IF NOT has_function_privilege('anon', v_function, 'EXECUTE') IS FALSE THEN RAISE EXCEPTION 'anon has EXECUTE'; END IF;
  IF NOT has_function_privilege('public', v_function, 'EXECUTE') IS FALSE THEN RAISE EXCEPTION 'PUBLIC has EXECUTE'; END IF;
  IF NOT has_function_privilege('authenticated', v_function, 'EXECUTE') THEN RAISE EXCEPTION 'authenticated lacks EXECUTE'; END IF;

  IF position('a35fb5d177d8424c77373a0ef29eb12a2ad4c0ee0912f826d4b5960fb2f067fb' IN v_definition) = 0
     OR position('FIN-IMPORT-4::2026-03::a35fb5d177d8424c77373a0ef29eb12a2ad4c0ee0912f826d4b5960fb2f067fb' IN v_definition) = 0
     OR position('FIN-IMPORT-4.2.v1' IN v_definition) = 0
     OR position('v_row_count <> 106' IN v_definition) = 0
     OR position('v_row->>''debit_account_code'' <> ''5.9.01.001''' IN v_definition) = 0
     OR position('v_row->>''debit_account_code'' <> ''2.1.09.001''' IN v_definition) = 0
     OR position('v_row->>''credit_account_code'' <> ''1.1.01.002''' IN v_definition) = 0
     OR position('v_inflows <> 75591.68' IN v_definition) = 0
     OR position('v_outflows <> 59474.22' IN v_definition) = 0
     OR position('v_operating <> 16924.61' IN v_definition) = 0
     OR position('v_investing <> -807.15' IN v_definition) = 0
     OR position('v_financing <> 0' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'RPC static authorization rules or totals missing';
  END IF;

  IF (SELECT count(*) FROM public.financial_transactions WHERE idempotency_key LIKE 'FIN-IMPORT-4%') <> 0
     OR (SELECT count(*) FROM public.financial_import_batches WHERE column_mapping->>'scope' = 'FIN-IMPORT-4') <> 0
     OR (SELECT count(*) FROM public.financial_import_rows WHERE idempotency_key LIKE 'FIN-IMPORT-4%') <> 0 THEN
    RAISE EXCEPTION 'DEV already contains FIN-IMPORT-4 data';
  END IF;
END;
$test$;

SELECT 'FIN-IMPORT-4.3 static assertions passed' AS result;
