-- ============================================================================
-- FASE 2H.1 — Correção das vulnerabilidades A1 (ativos) e A2 (balanço)
-- Guards administrativos obrigatórios e revogação de EXECUTE de anon/PUBLIC
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A1 — create_asset: autorização administrativa obrigatória
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_asset(
  p_asset_code text,
  p_name text,
  p_description text DEFAULT NULL::text,
  p_category text DEFAULT NULL::text,
  p_acquisition_date date DEFAULT CURRENT_DATE,
  p_acquisition_value numeric DEFAULT 0,
  p_residual_value numeric DEFAULT 0,
  p_useful_life_months integer DEFAULT 60,
  p_depreciation_start_date date DEFAULT NULL::date,
  p_location text DEFAULT NULL::text,
  p_responsible text DEFAULT NULL::text,
  p_serial_number text DEFAULT NULL::text,
  p_patrimony_number text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_asset_chart_account_id uuid DEFAULT NULL::uuid,
  p_accumulated_depreciation_account_id uuid DEFAULT NULL::uuid,
  p_depreciation_expense_account_id uuid DEFAULT NULL::uuid,
  p_cost_center_id uuid DEFAULT NULL::uuid,
  p_service_line_id uuid DEFAULT NULL::uuid,
  p_party_id uuid DEFAULT NULL::uuid,
  p_acquisition_transaction_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Apenas administradores podem cadastrar ativos';
  END IF;

  IF p_acquisition_value <= 0 THEN
    RAISE EXCEPTION 'Valor de aquisicao deve ser maior que zero';
  END IF;

  IF p_residual_value < 0 THEN
    RAISE EXCEPTION 'Valor residual nao pode ser negativo';
  END IF;

  IF p_residual_value > p_acquisition_value THEN
    RAISE EXCEPTION 'Valor residual nao pode exceder valor de aquisicao';
  END IF;

  IF p_useful_life_months <= 0 THEN
    RAISE EXCEPTION 'Vida util deve ser maior que zero meses';
  END IF;

  INSERT INTO public.financial_assets (
    asset_code, name, description, category, acquisition_date,
    acquisition_value, residual_value, useful_life_months,
    depreciation_start_date, location, responsible, serial_number,
    patrimony_number, notes, asset_chart_account_id,
    accumulated_depreciation_account_id, depreciation_expense_account_id,
    cost_center_id, service_line_id, party_id, acquisition_transaction_id
  ) VALUES (
    p_asset_code, p_name, p_description, p_category, p_acquisition_date,
    p_acquisition_value, p_residual_value, p_useful_life_months,
    p_depreciation_start_date, p_location, p_responsible, p_serial_number,
    p_patrimony_number, p_notes, p_asset_chart_account_id,
    p_accumulated_depreciation_account_id, p_depreciation_expense_account_id,
    p_cost_center_id, p_service_line_id, p_party_id, p_acquisition_transaction_id
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- A1 — update_asset: autorização administrativa obrigatória
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_asset(
  p_asset_id uuid,
  p_name text DEFAULT NULL::text,
  p_description text DEFAULT NULL::text,
  p_category text DEFAULT NULL::text,
  p_location text DEFAULT NULL::text,
  p_responsible text DEFAULT NULL::text,
  p_serial_number text DEFAULT NULL::text,
  p_patrimony_number text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_asset_chart_account_id uuid DEFAULT NULL::uuid,
  p_accumulated_depreciation_account_id uuid DEFAULT NULL::uuid,
  p_depreciation_expense_account_id uuid DEFAULT NULL::uuid,
  p_cost_center_id uuid DEFAULT NULL::uuid,
  p_service_line_id uuid DEFAULT NULL::uuid,
  p_party_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar ativos';
  END IF;

  UPDATE public.financial_assets SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    category = COALESCE(p_category, category),
    location = COALESCE(p_location, location),
    responsible = COALESCE(p_responsible, responsible),
    serial_number = COALESCE(p_serial_number, serial_number),
    patrimony_number = COALESCE(p_patrimony_number, patrimony_number),
    notes = COALESCE(p_notes, notes),
    asset_chart_account_id = COALESCE(p_asset_chart_account_id, asset_chart_account_id),
    accumulated_depreciation_account_id = COALESCE(p_accumulated_depreciation_account_id, accumulated_depreciation_account_id),
    depreciation_expense_account_id = COALESCE(p_depreciation_expense_account_id, depreciation_expense_account_id),
    cost_center_id = COALESCE(p_cost_center_id, cost_center_id),
    service_line_id = COALESCE(p_service_line_id, service_line_id),
    party_id = COALESCE(p_party_id, party_id)
  WHERE id = p_asset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ativo nao encontrado';
  END IF;
END;
$function$;

-- ---------------------------------------------------------------------------
-- A1 — dispose_asset: autorização administrativa obrigatória
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispose_asset(p_asset_id uuid, p_notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Apenas administradores podem dar baixa em ativos';
  END IF;

  UPDATE public.financial_assets SET
    status = 'DISPOSED',
    notes = CASE WHEN p_notes IS NOT NULL
      THEN COALESCE(notes || E'\n', '') || 'Baixa: ' || p_notes
      ELSE notes END
  WHERE id = p_asset_id AND status = 'ACTIVE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ativo nao encontrado ou nao esta ativo';
  END IF;
END;
$function$;

-- ---------------------------------------------------------------------------
-- A1 — post_asset_depreciation: autorização administrativa obrigatória
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_asset_depreciation(
  p_asset_id uuid,
  p_competence_period date,
  p_amount numeric DEFAULT NULL::numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_asset record;
  v_depr_amount numeric(15,2);
  v_depr_base numeric(15,2);
  v_monthly_depr numeric(15,2);
  v_accumulated numeric(15,2);
  v_journal_entry_id uuid;
  v_transaction_id uuid;
  v_posting_id uuid;
BEGIN
  IF public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Apenas administradores podem contabilizar depreciacao';
  END IF;

  SELECT * INTO v_asset
  FROM public.financial_assets
  WHERE id = p_asset_id AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ativo nao encontrado ou inativo';
  END IF;

  IF v_asset.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Apenas ativos com status ACTIVE podem ter depreciacao contabilizada';
  END IF;

  IF v_asset.depreciation_expense_account_id IS NULL OR v_asset.accumulated_depreciation_account_id IS NULL THEN
    RAISE EXCEPTION 'Configure as contas de despesa de depreciacao e depreciacao acumulada no ativo';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_asset_depreciation_postings
    WHERE asset_id = p_asset_id AND competence_period = p_competence_period AND status = 'POSTED'
  ) THEN
    RAISE EXCEPTION 'Depreciacao ja contabilizada para este ativo no periodo %', to_char(p_competence_period, 'YYYY-MM');
  END IF;

  IF p_amount IS NULL THEN
    v_depr_base := v_asset.acquisition_value - v_asset.residual_value;
    IF v_depr_base <= 0 THEN
      RAISE EXCEPTION 'Base depreciavel invalida';
    END IF;

    v_monthly_depr := v_depr_base / v_asset.useful_life_months;

    SELECT COALESCE(SUM(amount), 0) INTO v_accumulated
    FROM public.financial_asset_depreciation_postings
    WHERE asset_id = p_asset_id AND status = 'POSTED';

    v_depr_amount := GREATEST(0, LEAST(v_monthly_depr, v_depr_base - v_accumulated));

    IF v_depr_amount <= 0 THEN
      RAISE EXCEPTION 'Ativo totalmente depreciado para este periodo';
    END IF;
  ELSE
    v_depr_amount := p_amount;
  END IF;

  INSERT INTO public.financial_transactions (
    description, transaction_date, competence_date, movement_type, amount, status
  ) VALUES (
    'Depreciacao: ' || v_asset.name || ' (' || to_char(p_competence_period, 'MM/YYYY') || ')',
    current_date, p_competence_period, 'DEPRECIACAO', v_depr_amount, 'settled'
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO public.financial_journal_entries (
    transaction_id, entry_type, entry_date, competence_date, description, status
  ) VALUES (
    v_transaction_id, 'ajuste', current_date, p_competence_period,
    'Depreciacao: ' || v_asset.name || ' (' || to_char(p_competence_period, 'MM/YYYY') || ')',
    'settled'
  ) RETURNING id INTO v_journal_entry_id;

  INSERT INTO public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_asset.depreciation_expense_account_id, v_depr_amount, 0, 'Despesa de Depreciacao - ' || v_asset.asset_code);

  INSERT INTO public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_asset.accumulated_depreciation_account_id, 0, v_depr_amount, 'Depreciacao Acumulada - ' || v_asset.asset_code);

  INSERT INTO public.financial_asset_depreciation_postings (
    asset_id, competence_period, amount, journal_entry_id, idempotency_key
  ) VALUES (
    p_asset_id, p_competence_period, v_depr_amount, v_journal_entry_id,
    p_asset_id::text || ':' || to_char(p_competence_period, 'YYYY-MM')
  ) RETURNING id INTO v_posting_id;

  v_accumulated := v_accumulated + v_depr_amount;
  IF v_accumulated >= (v_asset.acquisition_value - v_asset.residual_value) THEN
    UPDATE public.financial_assets SET status = 'FULLY_DEPRECIATED' WHERE id = p_asset_id;
  END IF;

  RETURN v_posting_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- A2 — get_balance_sheet: somente usuários internos, cálculos inalterados
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_balance_sheet(p_as_of_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  row_code text,
  label text,
  class text,
  group_name text,
  amount numeric,
  sort_order integer,
  level integer,
  row_type text,
  presentation_sign smallint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.is_internal_user() IS NOT TRUE THEN
    RAISE EXCEPTION 'Apenas usuarios internos podem consultar o balanco patrimonial';
  END IF;

  RETURN QUERY
  WITH account_balances AS (
    SELECT ca.id, ca.code, ca.name, ca.class, ca.nature, ca.current_class, ca.bp_group, ca.presentation_sign, ca.is_cash,
      COALESCE(SUM(jl.debit), 0) AS total_debit, COALESCE(SUM(jl.credit), 0) AS total_credit
    FROM public.financial_chart_accounts ca
    LEFT JOIN public.financial_journal_lines jl ON jl.chart_account_id = ca.id
    LEFT JOIN public.financial_journal_entries je ON je.id = jl.entry_id AND je.competence_date <= p_as_of_date AND je.status <> 'cancelled'
    WHERE ca.class IN ('ATIVO', 'PASSIVO', 'PL') AND ca.active = true
    GROUP BY ca.id, ca.code, ca.name, ca.class, ca.nature, ca.current_class, ca.bp_group, ca.presentation_sign, ca.is_cash
  ),
  normalized AS (
    SELECT ab.*, CASE WHEN ab.nature = 'DEBITO' THEN ab.total_debit - ab.total_credit WHEN ab.nature = 'CREDITO' THEN ab.total_credit - ab.total_debit ELSE 0 END AS balance
    FROM account_balances ab
  ),
  dre_result AS (
    SELECT COALESCE(SUM(CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit ELSE 0 END), 0) AS resultado
    FROM public.financial_journal_lines jl
    INNER JOIN public.financial_journal_entries je ON je.id = jl.entry_id
    INNER JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
    WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA') AND ca.dre_class <> '' AND je.competence_date <= p_as_of_date AND je.status <> 'cancelled'
  ),
  all_rows AS (
    SELECT code, name, 'ATIVO' AS cls, COALESCE(NULLIF(bp_group, ''), current_class::text, 'Ativo') AS grp, balance * presentation_sign AS amt, code AS sc,
      CASE WHEN bp_group = '' AND current_class IS NOT NULL THEN 1 WHEN bp_group <> '' THEN 2 ELSE 3 END AS rl,
      CASE WHEN bp_group = '' AND current_class IS NOT NULL THEN 'SUBTOTAL' ELSE 'DETAIL' END AS rt, presentation_sign AS ps, 1 AS sort_seq
    FROM normalized WHERE class = 'ATIVO' AND balance <> 0
    UNION ALL
    SELECT code, name, 'PASSIVO', COALESCE(NULLIF(bp_group, ''), current_class::text, 'Passivo'), balance * presentation_sign, code,
      CASE WHEN bp_group = '' AND current_class IS NOT NULL THEN 1 WHEN bp_group <> '' THEN 2 ELSE 3 END,
      CASE WHEN bp_group = '' AND current_class IS NOT NULL THEN 'SUBTOTAL' ELSE 'DETAIL' END, presentation_sign, 2
    FROM normalized WHERE class = 'PASSIVO' AND balance <> 0
    UNION ALL
    SELECT code, name, 'PL', COALESCE(NULLIF(bp_group, ''), 'Patrimonio Liquido'), balance * presentation_sign, code,
      2, 'DETAIL', presentation_sign, 3
    FROM normalized WHERE class = 'PL' AND balance <> 0
    UNION ALL
    SELECT 'RE', 'Resultado do Exercicio', 'PL', 'Resultados Acumulados', dr.resultado, 'RE',
      2, 'DETAIL', 1::smallint, 3
    FROM dre_result dr WHERE dr.resultado <> 0
  )
  SELECT code AS row_code, name AS label, cls AS class, grp AS group_name, amt AS amount, 0::int AS sort_order, rl AS level, rt AS row_type, ps AS presentation_sign
  FROM all_rows ORDER BY sort_seq, sc;
END;
$function$;

-- ---------------------------------------------------------------------------
-- REVOKE EXECUTE de anon e PUBLIC nas cinco funções (assinaturas exatas)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_asset(text, text, text, text, date, numeric, numeric, integer, date, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.update_asset(uuid, text, text, text, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.dispose_asset(uuid, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.post_asset_depreciation(uuid, date, numeric) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_balance_sheet(date) FROM public, anon;