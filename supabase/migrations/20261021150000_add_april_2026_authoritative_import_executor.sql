-- FIN-IMPORT-5.3A — atomic executor for the authoritative April 2026 manifest.
-- This migration creates infrastructure only. It never executes the manifest.

BEGIN;

CREATE OR REPLACE FUNCTION public.execute_authoritative_financial_import_april_2026(
  p_manifest_hash text,
  p_batch_key text,
  p_manifest_json text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  c_hash CONSTANT text := '6605a548fdb031d83e95e84945cb5853bbd816485eab17ed2b7bdc42749af662';
  c_batch_key CONSTANT text := 'APRIL_2026_AUTHORITATIVE';
  c_key_prefix CONSTANT text := 'FIN-IMPORT-5.2A::2026-04::';
  v_manifest jsonb;
  v_rows jsonb;
  v_row jsonb;
  v_line jsonb;
  v_line_debits integer;
  v_line_credits integer;
  v_batch_id uuid;
  v_transaction_id uuid;
  v_entry_id uuid;
  v_cash_account_id uuid;
  v_source_row integer;
  v_amount numeric(15,2);
  v_date date;
  v_movement_text text;
  v_stored_movement public.financial_movement_type;
  v_direction text;
  v_dre text;
  v_dre_presentation text;
  v_dfc text;
  v_ar_ap text;
  v_category_text text;
  v_debit_id uuid;
  v_credit_id uuid;
  v_debit_class public.financial_account_class;
  v_credit_class public.financial_account_class;
  v_key text;
  v_note text;
  v_hash text;
  v_row_count integer;
  v_unique_source_count integer;
  v_unique_key_count integer;
  v_batch_count integer;
  v_existing_key_count integer;
  v_existing_journal_count integer;
  v_existing_row_count integer;
  v_existing_tx_count integer;
  v_existing_april_count integer;
  v_total_debit numeric(15,2) := 0;
  v_total_credit numeric(15,2) := 0;
  v_inflows numeric(15,2) := 0;
  v_outflows numeric(15,2) := 0;
  v_revenue numeric(15,2) := 0;
  v_costs numeric(15,2) := 0;
  v_expenses numeric(15,2) := 0;
  v_operating numeric(15,2) := 0;
  v_investing numeric(15,2) := 0;
  v_financing numeric(15,2) := 0;
  v_journal_count integer;
  v_unbalanced_count integer;
  v_imported_count integer;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A exige usuario autenticado Admin';
  END IF;

  IF p_manifest_hash <> c_hash OR p_batch_key <> c_batch_key THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A manifesto ou batch key nao autorizado';
  END IF;
  IF p_manifest_json IS NULL OR p_manifest_json = '' THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A manifesto ausente';
  END IF;

  v_hash := encode(digest(convert_to(p_manifest_json, 'UTF8'), 'sha256'), 'hex');
  IF v_hash <> c_hash THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A hash do payload diverge do hash autorizado';
  END IF;

  BEGIN
    v_manifest := p_manifest_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A payload JSON invalido';
  END;

  IF v_manifest->>'schema_version' <> 'FIN-IMPORT-5.2A.v1'
     OR v_manifest->'source'->>'file' <> 'FLUXO_CAIXA_2026.xlsx'
     OR v_manifest->'source'->>'sheet' <> 'ABRIL'
     OR (v_manifest->'period'->>'year')::integer <> 2026
     OR (v_manifest->'period'->>'month')::integer <> 4 THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A schema, fonte ou periodo divergente';
  END IF;

  v_rows := v_manifest->'rows';
  IF jsonb_typeof(v_rows) <> 'array' THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A rows deve ser array';
  END IF;

  -- Serialize concurrent attempts for this one authoritative batch.
  PERFORM pg_advisory_xact_lock(hashtextextended(c_batch_key, 0));

  SELECT count(*), count(DISTINCT (r->>'source_row')::integer), count(DISTINCT r->>'idempotency_key')
    INTO v_row_count, v_unique_source_count, v_unique_key_count
  FROM jsonb_array_elements(v_rows) AS x(r);
  IF v_row_count <> 92 OR v_unique_source_count <> 92 OR v_unique_key_count <> 92 THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A exige exatamente 92 rows/source_rows/keys';
  END IF;

  -- The manifest carries its own audit counters, but the executor also checks
  -- the contract independently instead of trusting those counters blindly.
  IF (v_manifest->'validation'->>'source_rows')::integer <> 92
     OR (v_manifest->'validation'->>'inflows_count')::integer <> 35
     OR (v_manifest->'validation'->>'outflows_count')::integer <> 57
     OR (v_manifest->'validation'->>'duplicate_source_rows')::integer <> 0
     OR (v_manifest->'validation'->>'missing_source_rows')::integer <> 0
     OR (v_manifest->'validation'->>'unknown_accounts')::integer <> 0
     OR (v_manifest->'validation'->>'unbalanced_journals')::integer <> 0
     OR (v_manifest->'validation'->>'balanced_journals')::integer <> 92 THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A metadados de validacao divergentes';
  END IF;
  IF (v_manifest->'approved_totals'->>'opening_balance')::numeric <> 18187.58
     OR (v_manifest->'approved_totals'->>'cash_inflows')::numeric <> 56185.87
     OR (v_manifest->'approved_totals'->>'cash_outflows')::numeric <> 62733.49
     OR (v_manifest->'approved_totals'->>'net_change')::numeric <> -6547.62
     OR (v_manifest->'approved_totals'->>'closing_balance')::numeric <> 11639.96
     OR (v_manifest->'approved_totals'->>'revenue')::numeric <> 56185.87
     OR (v_manifest->'approved_totals'->>'costs')::numeric <> 12578.39
     OR (v_manifest->'approved_totals'->>'expenses')::numeric <> 45726.82
     OR (v_manifest->'approved_totals'->>'net_income')::numeric <> -2197.62
     OR (v_manifest->'approved_totals'->>'dfc_operating')::numeric <> -6547.62
     OR (v_manifest->'approved_totals'->>'dfc_investing')::numeric <> 0
     OR (v_manifest->'approved_totals'->>'dfc_financing')::numeric <> 0 THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A totais autorizados divergentes';
  END IF;

  SELECT count(*) INTO v_batch_count
  FROM public.financial_import_batches WHERE file_name = c_batch_key;
  SELECT count(*) INTO v_existing_key_count
  FROM public.financial_transactions t
  WHERE t.idempotency_key IN (SELECT r->>'idempotency_key' FROM jsonb_array_elements(v_rows) x(r));
  SELECT count(*) INTO v_existing_row_count
  FROM public.financial_import_rows r
  WHERE r.idempotency_key IN (SELECT x.r->>'idempotency_key' FROM jsonb_array_elements(v_rows) x(r));
  SELECT count(*) INTO v_existing_journal_count
  FROM public.financial_journal_entries e
  WHERE e.idempotency_key IN (SELECT r->>'journal_idempotency_key' FROM jsonb_array_elements(v_rows) x(r));

  IF v_batch_count > 1 THEN
    RAISE EXCEPTION 'PARTIAL_IMPORT_DETECTED: mais de um batch Abril/2026';
  ELSIF v_batch_count = 1 THEN
    SELECT count(*) INTO v_existing_tx_count FROM public.financial_transactions
    WHERE idempotency_key LIKE c_key_prefix || '%';
    SELECT count(*) INTO v_imported_count FROM public.financial_import_rows r
    JOIN public.financial_import_batches b ON b.id = r.batch_id
    WHERE b.file_name = c_batch_key AND r.status = 'imported';
    IF EXISTS (SELECT 1 FROM public.financial_import_batches WHERE file_name = c_batch_key AND status = 'completed')
       AND v_existing_tx_count = 92 AND v_imported_count = 92
       AND v_existing_journal_count = 92 THEN
      RETURN jsonb_build_object('status', 'ALREADY_IMPORTED', 'batch_key', c_batch_key, 'rows', 92);
    END IF;
    RAISE EXCEPTION 'PARTIAL_IMPORT_DETECTED: batch Abril/2026 incompleto';
  END IF;
  IF v_existing_key_count <> 0 OR v_existing_row_count <> 0 OR v_existing_journal_count <> 0 THEN
    RAISE EXCEPTION 'PARTIAL_IMPORT_DETECTED: referencias autoritativas Abril/2026 ja existentes';
  END IF;

  SELECT count(*) INTO v_existing_april_count
  FROM public.financial_transactions t
  WHERE t.competence_date >= date '2026-04-01'
    AND t.competence_date < date '2026-05-01'
    AND t.movement_type <> 'AJUSTE';
  IF v_existing_april_count <> 0 THEN
    RAISE EXCEPTION 'PARTIAL_IMPORT_DETECTED: Abril/2026 ja possui transacoes economicas';
  END IF;

  SELECT fa.id INTO v_cash_account_id
  FROM public.financial_accounts fa
  JOIN public.financial_chart_accounts ca ON ca.id = fa.chart_account_id
  WHERE ca.code = '1.1.01.002' AND fa.active AND ca.active;
  IF v_cash_account_id IS NULL THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A conta financeira Banco Cora ausente ou inativa';
  END IF;

  -- Complete pre-write validation. No INSERT occurs before this loop ends.
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_rows)
  LOOP
    v_source_row := (v_row->>'source_row')::integer;
    v_amount := (v_row->>'amount')::numeric(15,2);
    v_date := (v_row->>'normalized_date')::date;
    v_movement_text := v_row->>'movement_type';
    v_direction := v_row->>'direction';
    v_dre := v_row->>'dre_effect';
    v_dre_presentation := v_row->>'dre_presentation';
    v_dfc := v_row->>'dfc_class';
    v_ar_ap := v_row->>'ar_ap_effect';
    v_category_text := nullif(v_row->>'category_id', '');

    IF v_source_row IS NULL OR v_source_row <= 0 OR v_amount IS NULL OR v_amount <= 0
       OR nullif(v_row->>'normalized_description', '') IS NULL
       OR nullif(v_row->>'idempotency_key', '') IS NULL
       OR nullif(v_row->'journal'->>'journal_idempotency_key', '') IS NULL
       OR v_row->>'row_status' <> 'READY' THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A row % possui campos invalidos', v_source_row;
    END IF;
    IF v_date < date '2026-04-01' OR v_date >= date '2026-05-01' THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A row % fora de Abril/2026', v_source_row;
    END IF;
    PERFORM public.assert_period_unlocked(v_date);
    IF v_direction NOT IN ('INFLOW', 'OUTFLOW')
       OR v_movement_text NOT IN ('RECEITA', 'DESPESA', 'CUSTO', 'ADIANTAMENTO_EMPREGADO', 'ADIANTAMENTO_SOCIO_ADMIN')
       OR v_dre NOT IN ('RECEITA', 'DESPESA', 'CUSTO', 'NONE')
       OR v_dre_presentation NOT IN ('RECEITA_BRUTA', 'CUSTOS', 'DESPESAS', 'NAO_APLICAVEL')
       OR v_dfc <> 'OPERACIONAL' OR v_ar_ap <> 'DIRECT_CASH' THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A classificacao invalida na row %', v_source_row;
    END IF;
    IF (v_dre = 'RECEITA' AND v_dre_presentation <> 'RECEITA_BRUTA')
       OR (v_dre = 'CUSTO' AND v_dre_presentation <> 'CUSTOS')
       OR (v_dre = 'DESPESA' AND v_dre_presentation <> 'DESPESAS')
       OR (v_dre = 'NONE' AND v_dre_presentation <> 'NAO_APLICAVEL') THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A DRE presentation invalida na row %', v_source_row;
    END IF;
    IF v_direction = 'INFLOW' AND v_row->>'debit_account_code' <> '1.1.01.002' THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A entrada sem Banco Cora no debito na row %', v_source_row;
    END IF;
    IF v_direction = 'OUTFLOW' AND v_row->>'credit_account_code' <> '1.1.01.002' THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A saida sem Banco Cora no credito na row %', v_source_row;
    END IF;
    SELECT id, class INTO v_debit_id, v_debit_class FROM public.financial_chart_accounts
    WHERE code = v_row->>'debit_account_code' AND active;
    SELECT id, class INTO v_credit_id, v_credit_class FROM public.financial_chart_accounts
    WHERE code = v_row->>'credit_account_code' AND active;
    IF v_debit_id IS NULL OR v_credit_id IS NULL OR v_debit_id = v_credit_id THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A conta explicita invalida na row %', v_source_row;
    END IF;
    IF v_dre = 'RECEITA' AND v_credit_class <> 'RECEITA' THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A receita incoerente na row %', v_source_row;
    ELSIF v_dre = 'CUSTO' AND v_debit_class <> 'CUSTO' THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A custo incoerente na row %', v_source_row;
    ELSIF v_dre = 'DESPESA' AND v_debit_class <> 'DESPESA' THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A despesa incoerente na row %', v_source_row;
    END IF;
    IF (v_row->'journal'->>'balanced')::boolean IS NOT TRUE
       OR jsonb_typeof(v_row->'journal'->'lines') <> 'array'
       OR jsonb_array_length(v_row->'journal'->'lines') <> 2 THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A journal invalido na row %', v_source_row;
    END IF;
    v_line_debits := 0;
    v_line_credits := 0;
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_row->'journal'->'lines')
    LOOP
      IF v_line->>'account_code' NOT IN (v_row->>'debit_account_code', v_row->>'credit_account_code')
         OR (v_line->>'amount')::numeric(15,2) <> v_amount THEN
        RAISE EXCEPTION 'FIN-IMPORT-5.3A linha de journal divergente na row %', v_source_row;
      END IF;
      IF v_line->>'side' = 'DEBIT' AND v_line->>'account_code' = v_row->>'debit_account_code' THEN
        v_line_debits := v_line_debits + 1;
      ELSIF v_line->>'side' = 'CREDIT' AND v_line->>'account_code' = v_row->>'credit_account_code' THEN
        v_line_credits := v_line_credits + 1;
      END IF;
    END LOOP;
    IF v_line_debits <> 1 OR v_line_credits <> 1 THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A lados do journal divergentes na row %', v_source_row;
    END IF;

    -- These are guardrails for the already-approved manifest decisions. The
    -- executor does not reclassify them; it rejects a differently classified
    -- payload before any write.
    IF v_source_row = 85 AND (v_amount <> 1500.00 OR v_row->>'debit_account_code' <> '5.1.01.001'
       OR v_dre <> 'DESPESA' OR position('pagamento parcial' IN lower(v_row->>'evidence')) = 0) THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A regra de salario parcial da row 85 diverge';
    END IF;
    IF v_source_row = 89 AND (v_row->>'debit_account_code' <> '1.1.02.006' OR v_dre <> 'NONE'
       OR v_movement_text <> 'ADIANTAMENTO_SOCIO_ADMIN') THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A regra Valdilene da row 89 diverge';
    END IF;
    IF v_source_row IN (106, 118) AND (v_row->>'debit_account_code' <> '1.1.02.003' OR v_dre <> 'NONE'
       OR v_movement_text <> 'ADIANTAMENTO_EMPREGADO') THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A regra de adiantamento de empregado diverge na row %', v_source_row;
    END IF;
    IF v_source_row IN (81, 82, 83, 84) AND (v_row->>'debit_account_code' <> '4.4.01.001' OR v_dre <> 'CUSTO') THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A regra Bombeiro Civil diverge na row %', v_source_row;
    END IF;
    IF v_source_row = 122 AND (v_row->>'debit_account_code' <> '4.4.01.002' OR v_dre <> 'CUSTO') THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A regra EPI Bombeiro da row 122 diverge';
    END IF;
    IF v_source_row = 104 AND (v_amount <> 468.75 OR v_row->>'debit_account_code' <> '5.9.01.001' OR v_dre <> 'DESPESA') THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A regra Cartao Caixa da row 104 diverge';
    END IF;
    IF v_source_row IN (87, 99, 116) AND nullif(v_row->>'disclosure', '') IS NULL THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A disclosure obrigatorio ausente na row %', v_source_row;
    END IF;
    IF v_source_row = 126 AND position('2025' IN v_row->>'normalized_description') = 0 THEN
      RAISE EXCEPTION 'FIN-IMPORT-5.3A disclosure de periodo anterior da row 126 diverge';
    END IF;

    v_total_debit := v_total_debit + v_amount;
    v_total_credit := v_total_credit + v_amount;
    IF v_direction = 'INFLOW' THEN v_inflows := v_inflows + v_amount; ELSE v_outflows := v_outflows + v_amount; END IF;
    IF v_dre = 'RECEITA' THEN v_revenue := v_revenue + v_amount; END IF;
    IF v_dre = 'CUSTO' THEN v_costs := v_costs + v_amount; END IF;
    IF v_dre = 'DESPESA' THEN v_expenses := v_expenses + v_amount; END IF;
    v_operating := v_operating + CASE WHEN v_direction = 'INFLOW' THEN v_amount ELSE -v_amount END;
  END LOOP;

  IF v_total_debit <> v_total_credit OR v_inflows <> 56185.87 OR v_outflows <> 62733.49
     OR v_revenue <> 56185.87 OR v_costs <> 12578.39 OR v_expenses <> 45726.82
     OR v_operating <> -6547.62 THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A totais calculados divergem do contrato';
  END IF;
  IF 18187.58 + v_inflows - v_outflows <> 11639.96 THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A fechamento de caixa divergente';
  END IF;

  INSERT INTO public.financial_import_batches
    (user_id, file_name, file_type, status, total_rows, valid_rows, imported_rows, column_mapping)
  VALUES
    (auth.uid(), c_batch_key, 'xlsx', 'processing', 92, 92, 0,
     jsonb_build_object('manifest_hash', c_hash, 'schema_version', v_manifest->>'schema_version', 'scope', 'FIN-IMPORT-5.3A', 'source_file', 'FLUXO_CAIXA_2026.xlsx', 'source_sheet', 'ABRIL'))
  RETURNING id INTO v_batch_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(v_rows)
  LOOP
    v_source_row := (v_row->>'source_row')::integer;
    v_amount := (v_row->>'amount')::numeric(15,2);
    v_date := (v_row->>'normalized_date')::date;
    v_key := v_row->>'idempotency_key';
    v_movement_text := v_row->>'movement_type';
    v_stored_movement := CASE WHEN v_movement_text = 'RECEITA' THEN 'RECEITA'::public.financial_movement_type ELSE 'DESPESA'::public.financial_movement_type END;
    v_note := format('FIN-IMPORT-5.3A source_row=%s movement=%s dre=%s dfc=%s ar_ap=%s disclosure=%s', v_source_row, v_movement_text, v_row->>'dre_effect', v_row->>'dfc_class', v_row->>'ar_ap_effect', coalesce(v_row->>'disclosure', ''));
    SELECT id INTO v_debit_id FROM public.financial_chart_accounts WHERE code = v_row->>'debit_account_code' AND active;
    SELECT id INTO v_credit_id FROM public.financial_chart_accounts WHERE code = v_row->>'credit_account_code' AND active;

    INSERT INTO public.financial_transactions
      (description, transaction_date, competence_date, movement_type, amount, status, category_id,
       origin_account_id, destination_account_id, payment_date, notes, review_required, created_by, updated_by, idempotency_key)
    VALUES
      (v_row->>'normalized_description', v_date, v_date, v_stored_movement, v_amount, 'settled',
       nullif(v_row->>'category_id', '')::uuid,
       CASE WHEN v_row->>'direction' = 'INFLOW' THEN v_cash_account_id ELSE NULL END,
       CASE WHEN v_row->>'direction' = 'OUTFLOW' THEN v_cash_account_id ELSE NULL END,
       v_date, v_note, false, auth.uid(), auth.uid(), v_key)
    RETURNING id INTO v_transaction_id;

    INSERT INTO public.financial_journal_entries
      (transaction_id, entry_type, entry_date, competence_date, description, status, review_required, created_by, idempotency_key)
    VALUES
      (v_transaction_id, 'caixa', v_date, v_date, v_row->>'normalized_description' || ' - FIN-IMPORT-5.3A', 'settled', false, auth.uid(), v_row->'journal'->>'journal_idempotency_key')
    RETURNING id INTO v_entry_id;

    INSERT INTO public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES
      (v_entry_id, v_debit_id, v_amount, 0, v_row->>'normalized_description' || ' - Debito'),
      (v_entry_id, v_credit_id, 0, v_amount, v_row->>'normalized_description' || ' - Credito');

    INSERT INTO public.financial_import_rows
      (batch_id, row_number, raw_data, mapped_data, status, transaction_id, idempotency_key)
    VALUES
      (v_batch_id, v_source_row, v_row, v_row, 'imported', v_transaction_id, v_key);
  END LOOP;

  SELECT count(*) INTO v_journal_count
  FROM public.financial_journal_entries e JOIN public.financial_transactions t ON t.id = e.transaction_id
  WHERE t.idempotency_key LIKE c_key_prefix || '%';
  SELECT count(*) INTO v_unbalanced_count
  FROM public.financial_journal_entries e
  JOIN public.financial_transactions t ON t.id = e.transaction_id
  LEFT JOIN public.financial_journal_lines l ON l.entry_id = e.id
  WHERE t.idempotency_key LIKE c_key_prefix || '%'
  GROUP BY e.id HAVING coalesce(sum(l.debit), 0) <> coalesce(sum(l.credit), 0);
  IF v_journal_count <> 92 OR coalesce(v_unbalanced_count, 0) <> 0 THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A journals ausentes ou desbalanceados';
  END IF;
  SELECT count(*) INTO v_imported_count FROM public.financial_import_rows WHERE batch_id = v_batch_id AND status = 'imported';
  IF v_imported_count <> 92 THEN
    RAISE EXCEPTION 'FIN-IMPORT-5.3A cobertura de source rows divergente';
  END IF;

  UPDATE public.financial_import_batches
  SET status = 'completed', imported_rows = 92, updated_at = now()
  WHERE id = v_batch_id;

  RETURN jsonb_build_object('status', 'IMPORTED', 'batch_id', v_batch_id, 'batch_key', c_batch_key, 'manifest_hash', c_hash, 'rows', 92, 'debits', v_total_debit, 'credits', v_total_credit, 'inflows', v_inflows, 'outflows', v_outflows, 'net', v_inflows - v_outflows);
END;
$$;

COMMENT ON FUNCTION public.execute_authoritative_financial_import_april_2026(text, text, text)
IS 'FIN-IMPORT-5.3A restricted atomic executor for the SHA-256-authorized April 2026 manifest only. Never a general-purpose import API.';

REVOKE ALL ON FUNCTION public.execute_authoritative_financial_import_april_2026(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_authoritative_financial_import_april_2026(text, text, text) TO authenticated;

COMMIT;
