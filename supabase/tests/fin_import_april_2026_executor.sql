-- FIN-IMPORT-5.3A executor contract and isolated atomicity tests.
-- This file intentionally never loads or calls the real April manifest.

BEGIN;

DO $test$
DECLARE
  v_function oid;
  v_definition text;
  v_config text[];
  v_tx_before integer;
  v_entry_before integer;
  v_line_before integer;
  v_batch_before integer;
  v_row_before integer;
BEGIN
  SELECT p.oid, pg_get_functiondef(p.oid), p.proconfig
    INTO v_function, v_definition, v_config
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'execute_authoritative_financial_import_april_2026'
    AND pg_get_function_identity_arguments(p.oid) = 'p_manifest_hash text, p_batch_key text, p_manifest_json text';

  IF v_function IS NULL THEN RAISE EXCEPTION 'FAIL: April executor missing'; END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = v_function) IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: April executor is not SECURITY DEFINER';
  END IF;
  IF NOT (v_config @> ARRAY['search_path=pg_catalog, public, extensions']) THEN
    RAISE EXCEPTION 'FAIL: April executor search_path is not hardened';
  END IF;
  IF has_function_privilege('anon', v_function, 'EXECUTE') OR has_function_privilege('public', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon/PUBLIC can execute April executor';
  END IF;
  IF NOT has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated lacks April executor EXECUTE';
  END IF;

  IF position('6605a548fdb031d83e95e84945cb5853bbd816485eab17ed2b7bdc42749af662' IN v_definition) = 0
     OR position('APRIL_2026_AUTHORITATIVE' IN v_definition) = 0
     OR position('FIN-IMPORT-5.2A.v1' IN v_definition) = 0
     OR position('v_row_count <> 92' IN v_definition) = 0
     OR position('v_unique_source_count <> 92' IN v_definition) = 0
     OR position('v_unique_key_count <> 92' IN v_definition) = 0
     OR position('v_inflows <> 56185.87' IN v_definition) = 0
     OR position('v_outflows <> 62733.49' IN v_definition) = 0
     OR position('v_operating <> -6547.62' IN v_definition) = 0
     OR position('PARTIAL_IMPORT_DETECTED' IN v_definition) = 0
     OR position('ALREADY_IMPORTED' IN v_definition) = 0
     OR position('regra Valdilene' IN v_definition) = 0
     OR position('regra de adiantamento de empregado' IN v_definition) = 0
     OR position('regra Bombeiro Civil' IN v_definition) = 0
     OR position('regra Cartao Caixa' IN v_definition) = 0
     OR position('disclosure obrigatorio' IN v_definition) = 0
     OR position('2026-04-01' IN v_definition) = 0
     OR position('2026-05-01' IN v_definition) = 0
     OR position('pg_advisory_xact_lock' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'FAIL: April executor contract validation missing';
  END IF;

  -- All contract checks must precede the first financial INSERT.
  IF position('Complete pre-write validation' IN v_definition) = 0
     OR position('Complete pre-write validation' IN v_definition) > position('INSERT INTO public.financial_import_batches' IN v_definition) THEN
    RAISE EXCEPTION 'FAIL: pre-write validation is not before persistence';
  END IF;
  IF position('financial_journal_lines' IN v_definition) = 0
     OR position('coalesce(sum(l.debit)' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'FAIL: post-write journal balance validation missing';
  END IF;

  -- Read-only DEV safety assertions: this test never supplies a manifest.
  SELECT count(*) INTO v_tx_before FROM public.financial_transactions
  WHERE idempotency_key LIKE 'FIN-IMPORT-5.2A::2026-04::%';
  SELECT count(*) INTO v_entry_before FROM public.financial_journal_entries
  WHERE idempotency_key LIKE 'FIN-IMPORT-5.2A::2026-04::%';
  SELECT count(*) INTO v_batch_before FROM public.financial_import_batches
  WHERE file_name = 'APRIL_2026_AUTHORITATIVE';
  SELECT count(*) INTO v_row_before FROM public.financial_import_rows r
  WHERE r.idempotency_key LIKE 'FIN-IMPORT-5.2A::2026-04::%';
  IF v_tx_before <> 0 OR v_entry_before <> 0 OR v_batch_before <> 0 OR v_row_before <> 0 THEN
    RAISE EXCEPTION 'FAIL: real April authoritative data exists before executor gate';
  END IF;

  -- Isolated rollback fixture: a forced mid-batch exception must leave no
  -- financial transaction, journal entry, journal line, batch, or import row.
  SELECT count(*) INTO v_tx_before FROM public.financial_transactions WHERE description = 'FIN-IMPORT-5.3A TEST FIXTURE';
  SELECT count(*) INTO v_entry_before FROM public.financial_journal_entries WHERE description = 'FIN-IMPORT-5.3A TEST FIXTURE';
  SELECT count(*) INTO v_line_before FROM public.financial_journal_lines l
  JOIN public.financial_journal_entries e ON e.id = l.entry_id
  WHERE e.description = 'FIN-IMPORT-5.3A TEST FIXTURE';
  IF v_tx_before <> 0 OR v_entry_before <> 0 OR v_line_before <> 0 THEN
    RAISE EXCEPTION 'FAIL: fixture namespace is not clean';
  END IF;

  BEGIN
    INSERT INTO public.financial_transactions (description, transaction_date, competence_date, movement_type, amount, status)
    VALUES ('FIN-IMPORT-5.3A TEST FIXTURE', date '2026-04-01', date '2026-04-01', 'DESPESA', 1.00, 'settled');
    RAISE EXCEPTION 'forced fixture failure';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'forced fixture failure' THEN RAISE; END IF;
  END;

  IF (SELECT count(*) FROM public.financial_transactions WHERE description = 'FIN-IMPORT-5.3A TEST FIXTURE') <> 0 THEN
    RAISE EXCEPTION 'FAIL: transaction fixture survived rollback';
  END IF;
  IF (SELECT count(*) FROM public.financial_journal_entries WHERE description = 'FIN-IMPORT-5.3A TEST FIXTURE') <> 0 THEN
    RAISE EXCEPTION 'FAIL: journal fixture survived rollback';
  END IF;
  IF (SELECT count(*) FROM public.financial_journal_lines l JOIN public.financial_journal_entries e ON e.id = l.entry_id WHERE e.description = 'FIN-IMPORT-5.3A TEST FIXTURE') <> 0 THEN
    RAISE EXCEPTION 'FAIL: journal line fixture survived rollback';
  END IF;

  RAISE NOTICE 'PASS: FIN-IMPORT-5.3A contract, security, safety, and isolated rollback assertions';
END;
$test$;

ROLLBACK;

SELECT 'FIN-IMPORT-5.3A executor tests passed' AS result;
