-- 2H.3 / ETAPA 13E: Hardening de search_path nas funcoes SECURITY DEFINER do schema public
--
-- Achado A4 da auditoria 2G: 25 funcoes SECURITY DEFINER do schema public ainda usavam
-- search_path = 'public, pg_temp'. O objetivo e normalizar para search_path = '' (padrao
-- vigente do projeto, DEC-031) eliminando qualquer risco de hijack via pg_temp/outros schemas.
--
-- Auditoria de referencias (DEV, 2026-09-23):
-- - 24 das 25 funcoes ja usam apenas referencias qualificadas (public.*, auth.uid(), pg_catalog)
--   ou built-ins do pg_catalog; para elas basta ALTER FUNCTION ... SET search_path = '';
-- - create_manual_journal_adjustment: unica com chamada NAO qualificada: gen_random_uuid().
--   No DEV gen_random_uuid() existe em pg_catalog (core, oid 3432) e extensions (pgcrypto,
--   oid 16460); a chamada nao qualificada resolve sempre para pg_catalog (pesquisado
--   implicitamente primeiro). Qualificada explicitamente para pg_catalog.gen_random_uuid()
--   mantendo comportamento identico (senha: pg_catalog e implicitamente primeiro no
--   search_path vazio) e removendo ambiguidade futura.
--
-- Escopo: somente banco DEV. Nao altera assinaturas, ACLs, regras contabeis, CRM ou pricing.
-- PROD intocado. Sem reset.

-- 1) create_manual_journal_adjustment — reescrita com chamada qualificada + search_path vazio,
--    depois reaplica os grants/revokes para garantir a ACL (DEC-031) mesmo apos CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION public.create_manual_journal_adjustment(p_entry_date date, p_competence_date date, p_description text, p_lines jsonb, p_reference text DEFAULT NULL::text, p_cost_center_id uuid DEFAULT NULL::uuid, p_service_line_id uuid DEFAULT NULL::uuid, p_idempotency_key uuid DEFAULT NULL::uuid, p_justification text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_entry_id uuid;
  v_transaction_id uuid;
  v_line jsonb;
  v_total_debit numeric(15,2) := 0;
  v_total_credit numeric(15,2) := 0;
  v_line_count integer := 0;
  v_idempotency uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem criar ajustes contabeis';
  END IF;

  v_idempotency := COALESCE(p_idempotency_key, pg_catalog.gen_random_uuid());

  IF EXISTS (
    SELECT 1 FROM public.financial_journal_entries
    WHERE idempotency_key = v_idempotency::text
  ) THEN
    SELECT id INTO v_entry_id FROM public.financial_journal_entries
    WHERE idempotency_key = v_idempotency::text;
    RETURN v_entry_id;
  END IF;

  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Ajuste deve ter pelo menos 2 linhas';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_total_debit := v_total_debit + COALESCE((v_line->>'debit')::numeric, 0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::numeric, 0);
    v_line_count := v_line_count + 1;
  END LOOP;

  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Ajuste desbalanceado: debitos (%) != creditos (%)', v_total_debit, v_total_credit;
  END IF;

  INSERT INTO public.financial_transactions (
    description, transaction_date, competence_date, movement_type, amount, status
  ) VALUES (
    p_description, p_entry_date, p_competence_date, 'AJUSTE', v_total_debit, 'settled'
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO public.financial_journal_entries (
    transaction_id, entry_type, entry_date, competence_date, description, status, idempotency_key
  ) VALUES (
    v_transaction_id, 'ajuste', p_entry_date, p_competence_date, p_description, 'settled', v_idempotency::text
  ) RETURNING id INTO v_entry_id;

  INSERT INTO public.financial_journal_lines (
    entry_id, chart_account_id, debit, credit, description
  )
  SELECT
    v_entry_id,
    (elem->>'chart_account_id')::uuid,
    COALESCE((elem->>'debit')::numeric, 0),
    COALESCE((elem->>'credit')::numeric, 0),
    COALESCE(elem->>'description', '')
  FROM jsonb_array_elements(p_lines) AS elem;

  IF p_justification IS NOT NULL AND p_justification <> '' THEN
    INSERT INTO public.financial_notes (
      note_type, title, body, reference_date, journal_entry_id, report_type
    ) VALUES (
      'AJUSTE', 'Ajuste: ' || p_description, p_justification, p_entry_date, v_entry_id, 'AJUSTE'
    );
  END IF;

  RETURN v_entry_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_manual_journal_adjustment(
  date, date, text, jsonb, text, uuid, uuid, uuid, text
) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_journal_adjustment(
  date, date, text, jsonb, text, uuid, uuid, uuid, text
) TO authenticated;

-- 2) Demais 24 funcoes: apenas normalizacao do search_path (corpos ja qualificados).
ALTER FUNCTION public.cancel_crm_activity(p_activity_id uuid) SET search_path = '';
ALTER FUNCTION public.complete_crm_activity(p_activity_id uuid, p_outcome text) SET search_path = '';
ALTER FUNCTION public.create_asset(
  p_asset_code text, p_name text, p_description text, p_category text,
  p_acquisition_date date, p_acquisition_value numeric, p_residual_value numeric,
  p_useful_life_months integer, p_depreciation_start_date date, p_location text,
  p_responsible text, p_serial_number text, p_patrimony_number text, p_notes text,
  p_asset_chart_account_id uuid, p_accumulated_depreciation_account_id uuid,
  p_depreciation_expense_account_id uuid, p_cost_center_id uuid, p_service_line_id uuid,
  p_party_id uuid, p_acquisition_transaction_id uuid
) SET search_path = '';
ALTER FUNCTION public.create_crm_activity(
  p_opportunity_id uuid, p_type text, p_title text, p_due_at timestamp with time zone,
  p_client_id uuid, p_description text, p_responsible_user_id uuid
) SET search_path = '';
ALTER FUNCTION public.create_crm_opportunity(
  p_client_id uuid, p_title text, p_pipeline_id uuid, p_stage_id uuid, p_value numeric,
  p_expected_close_date date, p_responsible_user_id uuid, p_description text
) SET search_path = '';
ALTER FUNCTION public.create_import_batch(p_file_name text, p_file_type text, p_file_size integer, p_column_mapping jsonb) SET search_path = '';
ALTER FUNCTION public.create_import_row(
  p_batch_id uuid, p_row_number integer, p_raw_data jsonb, p_mapped_data jsonb,
  p_status text, p_errors jsonb, p_idempotency_key text
) SET search_path = '';
ALTER FUNCTION public.dispose_asset(p_asset_id uuid, p_notes text) SET search_path = '';
ALTER FUNCTION public.finalize_import_row(p_row_id uuid, p_transaction_id uuid, p_status text) SET search_path = '';
ALTER FUNCTION public.get_balance_sheet(p_as_of_date date) SET search_path = '';
ALTER FUNCTION public.get_crm_pipeline_analytics(
  p_pipeline_id uuid, p_from_date date, p_to_date date, p_responsible_user_id uuid
) SET search_path = '';
ALTER FUNCTION public.get_financial_dashboard(
  p_from date, p_to date, p_as_of_date date, p_cost_center_id uuid, p_service_line_id uuid
) SET search_path = '';
ALTER FUNCTION public.get_income_statement(p_from date, p_to date, p_cost_center_id uuid, p_service_line_id uuid) SET search_path = '';
ALTER FUNCTION public.get_retained_earnings_statement(p_from date, p_to date) SET search_path = '';
ALTER FUNCTION public.get_statement_of_changes_in_equity(p_from date, p_to date) SET search_path = '';
ALTER FUNCTION public.get_value_added_statement(p_from date, p_to date) SET search_path = '';
ALTER FUNCTION public.mark_opportunity_lost(
  p_opportunity_id uuid, p_lost_reason text, p_lost_reason_id uuid, p_lost_reason_detail text
) SET search_path = '';
ALTER FUNCTION public.mark_opportunity_won(p_opportunity_id uuid) SET search_path = '';
ALTER FUNCTION public.move_crm_opportunity(p_opportunity_id uuid, p_target_stage_id uuid, p_target_position numeric) SET search_path = '';
ALTER FUNCTION public.post_asset_depreciation(p_asset_id uuid, p_competence_period date, p_amount numeric) SET search_path = '';
ALTER FUNCTION public.update_asset(
  p_asset_id uuid, p_name text, p_description text, p_category text, p_location text,
  p_responsible text, p_serial_number text, p_patrimony_number text, p_notes text,
  p_asset_chart_account_id uuid, p_accumulated_depreciation_account_id uuid,
  p_depreciation_expense_account_id uuid, p_cost_center_id uuid, p_service_line_id uuid,
  p_party_id uuid
) SET search_path = '';
ALTER FUNCTION public.update_crm_activity(
  p_activity_id uuid, p_type text, p_title text, p_description text,
  p_due_at timestamp with time zone, p_responsible_user_id uuid
) SET search_path = '';
ALTER FUNCTION public.update_crm_opportunity(
  p_opportunity_id uuid, p_title text, p_client_id uuid, p_value numeric,
  p_expected_close_date date, p_responsible_user_id uuid, p_description text
) SET search_path = '';
ALTER FUNCTION public.update_import_batch_status(
  p_batch_id uuid, p_status text, p_total_rows integer, p_valid_rows integer,
  p_imported_rows integer, p_skipped_rows integer, p_duplicate_rows integer,
  p_error_rows integer, p_errors jsonb
) SET search_path = '';