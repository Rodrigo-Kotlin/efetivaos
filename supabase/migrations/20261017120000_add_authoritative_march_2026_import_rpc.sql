-- FIN-IMPORT-4.3 — restricted executor for the authoritative March 2026 manifest.
-- This migration creates the executor only. It never executes the manifest.

BEGIN;

CREATE OR REPLACE FUNCTION public.execute_authoritative_financial_import_march_2026(
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
  v_manifest jsonb;
  v_rows jsonb;
  v_row jsonb;
  v_batch_id uuid;
  v_transaction_id uuid;
  v_entry_id uuid;
  v_cash_account_id uuid;
  v_source_row integer;
  v_amount numeric(15,2);
  v_date date;
  v_category_id uuid;
  v_debit_id uuid;
  v_credit_id uuid;
  v_debit_class public.financial_account_class;
  v_credit_class public.financial_account_class;
  v_movement_text text;
  v_stored_movement public.financial_movement_type;
  v_category_text text;
  v_direction text;
  v_dre text;
  v_dre_presentation text;
  v_dfc text;
  v_ar_ap text;
  v_hash text;
  v_description text;
  v_key text;
  v_note text;
  v_row_count integer;
  v_unique_source_count integer;
  v_unique_key_count integer;
  v_batch_count integer;
  v_existing_key_count integer;
  v_economic_count integer;
  v_fix6_count integer;
  v_total_debit numeric(15,2) := 0;
  v_total_credit numeric(15,2) := 0;
  v_inflows numeric(15,2) := 0;
  v_outflows numeric(15,2) := 0;
  v_revenue numeric(15,2) := 0;
  v_other_results numeric(15,2) := 0;
  v_costs numeric(15,2) := 0;
  v_expenses numeric(15,2) := 0;
  v_operating numeric(15,2) := 0;
  v_investing numeric(15,2) := 0;
  v_financing numeric(15,2) := 0;
  v_cora_balance numeric(15,2);
  v_criffer_liability numeric(15,2);
  v_criffer_asset numeric(15,2);
  v_ledger_imbalance numeric(15,2);
  v_criffer_rows numeric(15,2) := 0;
  v_source_rows integer[] := '{}';
  v_keys text[] := '{}';
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 exige usuario autenticado Admin';
  END IF;

  IF p_manifest_hash <> 'a35fb5d177d8424c77373a0ef29eb12a2ad4c0ee0912f826d4b5960fb2f067fb'
     OR p_batch_key <> 'FIN-IMPORT-4::2026-03::a35fb5d177d8424c77373a0ef29eb12a2ad4c0ee0912f826d4b5960fb2f067fb' THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 manifesto ou batch key nao autorizado';
  END IF;

  IF p_manifest_json IS NULL OR p_manifest_json = '' THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 manifesto ausente';
  END IF;

  v_hash := encode(digest(convert_to(p_manifest_json, 'UTF8'), 'sha256'), 'hex');
  IF v_hash <> p_manifest_hash THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 hash do payload diverge do hash autorizado';
  END IF;

  BEGIN
    v_manifest := p_manifest_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 payload JSON invalido';
  END;

  IF v_manifest->>'schema_version' <> 'FIN-IMPORT-4.2.v1'
     OR (v_manifest->'source'->>'file') <> 'FLUXO_CAIXA_2026.xlsx'
     OR (v_manifest->'source'->>'sheet') <> 'MARÇO'
     OR (v_manifest->'period'->>'year')::integer <> 2026
     OR (v_manifest->'period'->>'month')::integer <> 3 THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 schema, fonte ou periodo divergente';
  END IF;

  v_rows := v_manifest->'rows';
  IF jsonb_typeof(v_rows) <> 'array' THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 rows deve ser array';
  END IF;

  SELECT count(*), count(DISTINCT (r->>'source_row')::integer), count(DISTINCT r->>'idempotency_key')
  INTO v_row_count, v_unique_source_count, v_unique_key_count
  FROM jsonb_array_elements(v_rows) AS x(r);
  IF v_row_count <> 106 OR v_unique_source_count <> 106 OR v_unique_key_count <> 106 THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 exige exatamente 106 rows/source_rows/keys';
  END IF;

  SELECT count(*) INTO v_batch_count
  FROM public.financial_import_batches
  WHERE file_name = p_batch_key;
  IF v_batch_count <> 0 THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 batch key ja executada';
  END IF;

  SELECT count(*) INTO v_existing_key_count
  FROM public.financial_transactions t
  WHERE t.idempotency_key IN (SELECT r->>'idempotency_key' FROM jsonb_array_elements(v_rows) AS x(r));
  IF v_existing_key_count <> 0 THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 idempotency key de transaction ja existente';
  END IF;

  SELECT count(*) INTO v_existing_key_count
  FROM public.financial_import_rows r
  WHERE r.idempotency_key IN (SELECT x.r->>'idempotency_key' FROM jsonb_array_elements(v_rows) AS x(r));
  IF v_existing_key_count <> 0 THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 idempotency key de import row ja existente';
  END IF;

  SELECT count(*) INTO v_economic_count
  FROM public.financial_transactions t
  WHERE t.competence_date >= date '2026-03-01'
    AND t.competence_date < date '2026-04-01'
    AND t.movement_type <> 'AJUSTE';
  IF v_economic_count <> 0 THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 marco ja possui transacoes economicas';
  END IF;

  SELECT coalesce(sum(jl.debit - jl.credit), 0)
  INTO v_cora_balance
  FROM public.financial_journal_lines jl
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.code = '1.1.01.002';
  IF v_cora_balance <> 2070.12 THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 saldo Cora divergente: %', v_cora_balance;
  END IF;

  SELECT coalesce(sum(jl.debit - jl.credit), 0)
  INTO v_criffer_liability
  FROM public.financial_journal_lines jl
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.code = '2.1.09.001';
  IF v_criffer_liability <> -557.15 THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 passivo Criffer divergente: %', v_criffer_liability;
  END IF;

  SELECT coalesce(sum(jl.debit - jl.credit), 0)
  INTO v_criffer_asset
  FROM public.financial_journal_lines jl
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.code = '1.2.99.001';
  IF v_criffer_asset <> 1123.99 THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 ativo historico Criffer divergente: %', v_criffer_asset;
  END IF;

  SELECT count(*) INTO v_fix6_count
  FROM public.financial_transactions
  WHERE idempotency_key = 'FIN-FIX-6::CRIFFER::2026-03::SOURCE-ROWS-118-119::282.51-274.64';
  IF v_fix6_count <> 1 THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 FIN-FIX-6 ausente ou duplicado: %', v_fix6_count;
  END IF;

  SELECT coalesce(sum(debit), 0) - coalesce(sum(credit), 0)
  INTO v_ledger_imbalance
  FROM public.financial_journal_lines;
  IF v_ledger_imbalance <> 0 THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 ledger desbalanceado: %', v_ledger_imbalance;
  END IF;

  SELECT fa.id INTO v_cash_account_id
  FROM public.financial_accounts fa
  JOIN public.financial_chart_accounts ca ON ca.id = fa.chart_account_id
  WHERE ca.code = '1.1.01.002' AND fa.active AND ca.active;
  IF v_cash_account_id IS NULL THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 conta financeira Banco Cora ausente ou inativa';
  END IF;

  -- Validate every row before the first INSERT.
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_rows)
  LOOP
    v_source_row := (v_row->>'source_row')::integer;
    v_amount := (v_row->>'amount')::numeric(15,2);
    v_date := (v_row->>'normalized_date')::date;
    v_movement_text := v_row->>'movement_type';
    v_category_text := nullif(v_row->>'category_id', '');
    v_direction := v_row->>'direction';
    v_dre := v_row->>'dre_effect';
    -- The canonical manifest uses NAO_DRE; normalize it to the executor's internal NONE value.
    IF v_dre = 'NAO_DRE' THEN
      v_dre := 'NONE';
    END IF;
    v_dre_presentation := v_row->>'dre_presentation';
    v_dfc := v_row->>'dfc_class';
    v_ar_ap := v_row->>'ar_ap_effect';

    IF v_source_row IS NULL OR v_amount IS NULL OR v_amount <= 0
       OR v_date < date '2026-03-01' OR v_date >= date '2026-04-01'
       OR nullif(v_row->>'normalized_description', '') IS NULL
       OR nullif(v_row->>'idempotency_key', '') IS NULL
       OR v_row->>'row_status' <> 'READY' THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 row % possui campos invalidos', v_source_row;
    END IF;

    IF v_direction NOT IN ('INFLOW', 'OUTFLOW')
       OR v_movement_text NOT IN ('RECEITA', 'DESPESA', 'CUSTO', 'IMOBILIZADO', 'ADIANTAMENTO_EMPREGADO', 'ADIANTAMENTO_SOCIO_ADMIN')
       OR v_dre NOT IN ('RECEITA', 'CUSTO', 'DESPESA', 'NONE')
       OR v_dfc NOT IN ('OPERACIONAL', 'INVESTIMENTO', 'FINANCIAMENTO', 'NAO_CAIXA')
       OR v_ar_ap NOT IN ('DIRECT_CASH', 'SETTLEMENT_EXISTING_RECEIVABLE', 'SETTLEMENT_EXISTING_LIABILITY', 'NONE') THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 row % possui classificacao invalida', v_source_row;
    END IF;

    IF (v_dre = 'RECEITA' AND v_dre_presentation <> 'RECEITA_BRUTA')
       OR (v_dre = 'CUSTO' AND v_dre_presentation <> 'CUSTOS')
       OR (v_dre = 'DESPESA' AND v_dre_presentation <> 'DESPESAS')
       OR (v_dre = 'NONE' AND v_dre_presentation <> 'NAO_APLICAVEL') THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 DRE presentation invalida na row %', v_source_row;
    END IF;

    IF v_category_text IS NULL AND v_source_row NOT IN (118, 119) THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 category_id ausente nao autorizado na row %', v_source_row;
    END IF;
    IF v_category_text IS NOT NULL THEN
      v_category_id := v_category_text::uuid;
      IF NOT EXISTS (SELECT 1 FROM public.financial_categories WHERE id = v_category_id AND active) THEN
        RAISE EXCEPTION 'FIN-IMPORT-4.3 categoria invalida na row %', v_source_row;
      END IF;
    ELSE
      v_category_id := NULL;
    END IF;

    SELECT id, class INTO v_debit_id, v_debit_class
    FROM public.financial_chart_accounts
    WHERE code = v_row->>'debit_account_code' AND active;
    SELECT id, class INTO v_credit_id, v_credit_class
    FROM public.financial_chart_accounts
    WHERE code = v_row->>'credit_account_code' AND active;
    IF v_debit_id IS NULL OR v_credit_id IS NULL OR v_debit_id = v_credit_id THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 conta explicita invalida na row %', v_source_row;
    END IF;

    IF nullif(v_row->>'debit_account_id', '') IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.financial_chart_accounts ca
         WHERE ca.id = (v_row->>'debit_account_id')::uuid
           AND ca.code = v_row->>'debit_account_code'
           AND ca.active
         UNION ALL
         SELECT 1 FROM public.financial_accounts fa
         JOIN public.financial_chart_accounts ca ON ca.id = fa.chart_account_id
         WHERE fa.id = (v_row->>'debit_account_id')::uuid
           AND ca.code = v_row->>'debit_account_code'
           AND fa.active AND ca.active
       ) THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 debit_account_id divergente na row %', v_source_row;
    END IF;
    IF nullif(v_row->>'credit_account_id', '') IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.financial_chart_accounts ca
         WHERE ca.id = (v_row->>'credit_account_id')::uuid
           AND ca.code = v_row->>'credit_account_code'
           AND ca.active
         UNION ALL
         SELECT 1 FROM public.financial_accounts fa
         JOIN public.financial_chart_accounts ca ON ca.id = fa.chart_account_id
         WHERE fa.id = (v_row->>'credit_account_id')::uuid
           AND ca.code = v_row->>'credit_account_code'
           AND fa.active AND ca.active
       ) THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 credit_account_id divergente na row %', v_source_row;
    END IF;

    IF (v_movement_text = 'RECEITA' AND (v_direction <> 'INFLOW' OR v_dre <> 'RECEITA'))
       OR (v_movement_text = 'IMOBILIZADO' AND (v_dre <> 'NONE' OR v_dfc <> 'INVESTIMENTO'))
       OR (v_movement_text IN ('CUSTO', 'DESPESA') AND v_direction <> 'OUTFLOW')
       OR (v_movement_text IN ('ADIANTAMENTO_EMPREGADO', 'ADIANTAMENTO_SOCIO_ADMIN') AND (v_direction <> 'OUTFLOW' OR v_dre <> 'NONE')) THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 coerencia economica invalida na row %', v_source_row;
    END IF;

    IF v_source_row = 107 AND (v_amount <> 3533.03 OR v_direction <> 'OUTFLOW' OR v_dre <> 'DESPESA' OR v_row->>'debit_account_code' <> '5.9.01.001' OR v_dfc <> 'OPERACIONAL' OR v_ar_ap <> 'DIRECT_CASH') THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 regra da row 107 diverge';
    END IF;
    IF v_source_row IN (118, 119) AND (v_direction <> 'OUTFLOW' OR v_row->>'debit_account_code' <> '2.1.09.001' OR v_row->>'credit_account_code' <> '1.1.01.002' OR v_dre <> 'NONE' OR v_dfc <> 'INVESTIMENTO' OR v_ar_ap <> 'SETTLEMENT_EXISTING_LIABILITY') THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 regra Criffer diverge na row %', v_source_row;
    END IF;

    IF v_source_row = 74 AND (v_direction <> 'OUTFLOW' OR v_row->>'debit_account_code' <> '5.2.01.002' OR v_dre <> 'DESPESA' OR v_dfc <> 'OPERACIONAL' OR v_ar_ap <> 'DIRECT_CASH') THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 regra de energia da row 74 diverge';
    END IF;
    IF v_source_row = 81 AND (v_movement_text <> 'IMOBILIZADO' OR v_dre <> 'NONE' OR v_dfc <> 'INVESTIMENTO') THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 regra patrimonial da row 81 diverge';
    END IF;
    IF v_source_row IN (91, 128) AND (v_movement_text <> 'ADIANTAMENTO_SOCIO_ADMIN' OR v_row->>'debit_account_code' <> '1.1.02.006' OR v_dre <> 'NONE') THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 regra de adiantamento de socio diverge na row %', v_source_row;
    END IF;
    IF v_source_row = 106 AND (v_movement_text <> 'CUSTO' OR v_dre <> 'CUSTO') THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 novo fato clinico da row 106 diverge';
    END IF;
    IF v_source_row = 108 AND (v_dre <> 'DESPESA' OR position('Vigilância' IN coalesce(v_row->>'normalized_description', '')) = 0) THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 regra da row 108 diverge';
    END IF;
    IF v_source_row = 109 AND (v_dre <> 'DESPESA' OR position('Caixa' IN coalesce(v_row->>'normalized_description', '')) = 0) THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 regra da row 109 diverge';
    END IF;
    IF v_source_row = 124 AND v_row->>'debit_account_code' <> '5.1.01.002' THEN
      RAISE EXCEPTION 'FIN-IMPORT-4.3 regra de pro-labore da row 124 diverge';
    END IF;

    v_source_rows := array_append(v_source_rows, v_source_row);
    v_keys := array_append(v_keys, v_row->>'idempotency_key');
    v_total_debit := v_total_debit + v_amount;
    v_total_credit := v_total_credit + v_amount;
    IF v_direction = 'INFLOW' THEN v_inflows := v_inflows + v_amount; ELSE v_outflows := v_outflows + v_amount; END IF;
    IF v_dre = 'RECEITA' THEN v_revenue := v_revenue + v_amount; END IF;
    IF v_dre = 'CUSTO' THEN v_costs := v_costs + v_amount; END IF;
    IF v_dre = 'DESPESA' THEN v_expenses := v_expenses + v_amount; END IF;
    IF v_dre = 'NONE' THEN v_other_results := v_other_results + 0; END IF;
    IF v_dfc = 'OPERACIONAL' THEN v_operating := v_operating + CASE WHEN v_direction = 'INFLOW' THEN v_amount ELSE -v_amount END; END IF;
    IF v_dfc = 'INVESTIMENTO' THEN v_investing := v_investing + CASE WHEN v_direction = 'INFLOW' THEN v_amount ELSE -v_amount END; END IF;
    IF v_dfc = 'FINANCIAMENTO' THEN v_financing := v_financing + CASE WHEN v_direction = 'INFLOW' THEN v_amount ELSE -v_amount END; END IF;
    IF v_source_row IN (118, 119) THEN v_criffer_rows := v_criffer_rows + v_amount; END IF;
  END LOOP;

  IF v_source_rows @> ARRAY[36, 55] AND ARRAY[36, 55] @> v_source_rows THEN
    NULL;
  END IF;
  IF v_criffer_rows <> 557.15 OR v_criffer_rows > abs(v_criffer_liability) THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 cobertura Criffer invalida: %', v_criffer_rows;
  END IF;
  IF v_total_debit <> 59474.22 + 75591.68 OR v_total_credit <> v_total_debit
     OR v_inflows <> 75591.68 OR v_outflows <> 59474.22
     OR v_revenue <> 75591.68 OR v_other_results <> 0
     OR v_costs <> 26963.78 OR v_expenses <> 26503.29
     OR v_operating <> 16924.61 OR v_investing <> -807.15 OR v_financing <> 0 THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 totais autorizados divergem';
  END IF;
  IF v_cora_balance + v_inflows - v_outflows <> 18187.58
     OR v_revenue - v_costs - v_expenses <> 22124.61 THEN
    RAISE EXCEPTION 'FIN-IMPORT-4.3 fechamento de caixa ou DRE diverge';
  END IF;

  -- Every check above runs before the first INSERT. PostgreSQL rolls back all
  -- inserts below atomically if any later statement raises an exception.
  INSERT INTO public.financial_import_batches (
    user_id, file_name, file_type, status, total_rows, valid_rows, imported_rows, column_mapping
  ) VALUES (
    auth.uid(), p_batch_key, 'xlsx', 'processing', 106, 106, 0,
    jsonb_build_object('manifest_hash', p_manifest_hash, 'schema_version', v_manifest->>'schema_version', 'scope', 'FIN-IMPORT-4', 'source_file', 'FLUXO_CAIXA_2026.xlsx', 'source_sheet', 'MARÇO')
  ) RETURNING id INTO v_batch_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(v_rows)
  LOOP
    v_source_row := (v_row->>'source_row')::integer;
    v_amount := (v_row->>'amount')::numeric(15,2);
    v_date := (v_row->>'normalized_date')::date;
    v_category_id := nullif(v_row->>'category_id', '')::uuid;
    v_movement_text := v_row->>'movement_type';
    v_dre := v_row->>'dre_effect';
    IF v_dre = 'NAO_DRE' THEN
      v_dre := 'NONE';
    END IF;
    v_stored_movement := CASE
      WHEN v_movement_text = 'RECEITA' THEN 'RECEITA'::public.financial_movement_type
      WHEN v_movement_text = 'IMOBILIZADO' THEN 'IMOBILIZADO'::public.financial_movement_type
      ELSE 'DESPESA'::public.financial_movement_type
    END;
    v_description := v_row->>'normalized_description';
    v_key := v_row->>'idempotency_key';
    v_note := format('FIN-IMPORT-4 source_row=%s classification=%s dre=%s dfc=%s ar_ap=%s', v_source_row, v_movement_text, v_dre, v_row->>'dfc_class', v_row->>'ar_ap_effect');

    SELECT id INTO v_debit_id FROM public.financial_chart_accounts WHERE code = v_row->>'debit_account_code' AND active;
    SELECT id INTO v_credit_id FROM public.financial_chart_accounts WHERE code = v_row->>'credit_account_code' AND active;

    INSERT INTO public.financial_transactions (
      description, transaction_date, competence_date, movement_type, amount, status,
      category_id, origin_account_id, destination_account_id, payment_date,
      notes, review_required, created_by, updated_by, idempotency_key
    ) VALUES (
      v_description, v_date, v_date, v_stored_movement, v_amount, 'settled',
      v_category_id,
      CASE WHEN v_row->>'direction' = 'INFLOW' THEN v_cash_account_id ELSE NULL END,
      CASE WHEN v_row->>'direction' = 'OUTFLOW' THEN v_cash_account_id ELSE NULL END,
      v_date, v_note, false, auth.uid(), auth.uid(), v_key
    ) RETURNING id INTO v_transaction_id;

    INSERT INTO public.financial_journal_entries (
      transaction_id, entry_type, entry_date, competence_date, description,
      status, review_required, created_by, idempotency_key
    ) VALUES (
      v_transaction_id, 'caixa', v_date, v_date, v_description || ' - FIN-IMPORT-4',
      'settled', false, auth.uid(), v_key || '::JOURNAL'
    ) RETURNING id INTO v_entry_id;

    INSERT INTO public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    VALUES
      (v_entry_id, v_debit_id, v_amount, 0, v_description || ' - Debito'),
      (v_entry_id, v_credit_id, 0, v_amount, v_description || ' - Credito');

    INSERT INTO public.financial_import_rows (
      batch_id, row_number, raw_data, mapped_data, status, transaction_id, idempotency_key
    ) VALUES (
      v_batch_id, v_source_row, v_row, v_row, 'imported', v_transaction_id, v_key
    );
  END LOOP;

  UPDATE public.financial_import_batches
  SET status = 'completed', imported_rows = 106, updated_at = now()
  WHERE id = v_batch_id;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'batch_key', p_batch_key,
    'manifest_hash', p_manifest_hash,
    'rows', 106,
    'debits', v_total_debit,
    'credits', v_total_credit,
    'inflows', v_inflows,
    'outflows', v_outflows,
    'criffer_rows', v_criffer_rows
  );
END;
$$;

COMMENT ON FUNCTION public.execute_authoritative_financial_import_march_2026(text, text, text)
IS 'FIN-IMPORT-4.3 restricted, atomic executor for the server-hashed March 2026 authoritative manifest only. Not a general-purpose import API.';

REVOKE ALL ON FUNCTION public.execute_authoritative_financial_import_march_2026(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_authoritative_financial_import_march_2026(text, text, text) TO authenticated;

COMMIT;
