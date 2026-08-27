-- ============================================================================
-- ETAPA 08F.1 — Hardening: constraints, account validation, competence,
--                 security, classification, indicators
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CONSTRAINT: residual_value <= acquisition_value
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE public.financial_assets
    ADD CONSTRAINT chk_residual_lte_acquisition
    CHECK (residual_value <= acquisition_value);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. VALIDATOR: asset account classes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_asset_accounts(
  p_asset_account_id uuid,
  p_accumulated_account_id uuid,
  p_expense_account_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_asset_class text;
  v_accum_class text;
  v_expense_class text;
  v_expense_dre text;
BEGIN
  -- Asset account must be ATIVO
  IF p_asset_account_id IS NOT NULL THEN
    SELECT class INTO v_asset_class
    FROM public.financial_chart_accounts
    WHERE id = p_asset_account_id AND active = true;
    IF v_asset_class IS NULL THEN
      RAISE EXCEPTION 'Conta de imobilizado nao encontrada ou inativa';
    END IF;
    IF v_asset_class <> 'ATIVO' THEN
      RAISE EXCEPTION 'Conta de imobilizado deve ser da classe ATIVO (encontrado: %)', v_asset_class;
    END IF;
  END IF;

  -- Accumulated depreciation account must be ATIVO (contra-ativo)
  IF p_accumulated_account_id IS NOT NULL THEN
    SELECT class INTO v_accum_class
    FROM public.financial_chart_accounts
    WHERE id = p_accumulated_account_id AND active = true;
    IF v_accum_class IS NULL THEN
      RAISE EXCEPTION 'Conta de depreciacao acumulada nao encontrada ou inativa';
    END IF;
    IF v_accum_class <> 'ATIVO' THEN
      RAISE EXCEPTION 'Conta de depreciacao acumulada deve ser da classe ATIVO (encontrado: %)', v_accum_class;
    END IF;
  END IF;

  -- Depreciation expense account must be DESPESA with dre_class DEPRECIACAO_AMORTIZACAO
  IF p_expense_account_id IS NOT NULL THEN
    SELECT ca.class, ca.dre_class INTO v_expense_class, v_expense_dre
    FROM public.financial_chart_accounts ca
    WHERE ca.id = p_expense_account_id AND ca.active = true;
    IF v_expense_class IS NULL THEN
      RAISE EXCEPTION 'Conta de despesa de depreciacao nao encontrada ou inativa';
    END IF;
    IF v_expense_class <> 'DESPESA' THEN
      RAISE EXCEPTION 'Conta de despesa de depreciacao deve ser da classe DESPESA (encontrado: %)', v_expense_class;
    END IF;
    IF v_expense_dre <> 'DEPRECIACAO_AMORTIZACAO' THEN
      RAISE EXCEPTION 'Conta de despesa de depreciacao deve ter dre_class = DEPRECIACAO_AMORTIZACAO (encontrado: %)', v_expense_dre;
    END IF;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. UPDATE create_asset to validate accounts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_asset(
  p_asset_code text,
  p_name text,
  p_description text DEFAULT null,
  p_category text DEFAULT null,
  p_acquisition_date date DEFAULT current_date,
  p_acquisition_value numeric(15,2) DEFAULT 0,
  p_residual_value numeric(15,2) DEFAULT 0,
  p_useful_life_months integer DEFAULT 60,
  p_depreciation_start_date date DEFAULT null,
  p_location text DEFAULT null,
  p_responsible text DEFAULT null,
  p_serial_number text DEFAULT null,
  p_patrimony_number text DEFAULT null,
  p_notes text DEFAULT null,
  p_asset_chart_account_id uuid DEFAULT null,
  p_accumulated_depreciation_account_id uuid DEFAULT null,
  p_depreciation_expense_account_id uuid DEFAULT null,
  p_cost_center_id uuid DEFAULT null,
  p_service_line_id uuid DEFAULT null,
  p_party_id uuid DEFAULT null,
  p_acquisition_transaction_id uuid DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
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

  -- Validate account classes
  PERFORM public.validate_asset_accounts(
    p_asset_chart_account_id,
    p_accumulated_depreciation_account_id,
    p_depreciation_expense_account_id
  );

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
$$;

-- ---------------------------------------------------------------------------
-- 4. UPDATE update_asset to validate accounts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_asset(
  p_asset_id uuid,
  p_name text DEFAULT null,
  p_description text DEFAULT null,
  p_category text DEFAULT null,
  p_location text DEFAULT null,
  p_responsible text DEFAULT null,
  p_serial_number text DEFAULT null,
  p_patrimony_number text DEFAULT null,
  p_notes text DEFAULT null,
  p_asset_chart_account_id uuid DEFAULT null,
  p_accumulated_depreciation_account_id uuid DEFAULT null,
  p_depreciation_expense_account_id uuid DEFAULT null,
  p_cost_center_id uuid DEFAULT null,
  p_service_line_id uuid DEFAULT null,
  p_party_id uuid DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_asset record;
  v_new_asset uuid;
  v_new_accum uuid;
  v_new_expense uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar ativos';
  END IF;

  SELECT asset_chart_account_id, accumulated_depreciation_account_id,
         depreciation_expense_account_id
  INTO v_asset
  FROM public.financial_assets WHERE id = p_asset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ativo nao encontrado';
  END IF;

  v_new_asset := COALESCE(p_asset_chart_account_id, v_asset.asset_chart_account_id);
  v_new_accum := COALESCE(p_accumulated_depreciation_account_id, v_asset.accumulated_depreciation_account_id);
  v_new_expense := COALESCE(p_depreciation_expense_account_id, v_asset.depreciation_expense_account_id);

  -- Validate account classes with resolved values
  PERFORM public.validate_asset_accounts(v_new_asset, v_new_accum, v_new_expense);

  UPDATE public.financial_assets SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    category = COALESCE(p_category, category),
    location = COALESCE(p_location, location),
    responsible = COALESCE(p_responsible, responsible),
    serial_number = COALESCE(p_serial_number, serial_number),
    patrimony_number = COALESCE(p_patrimony_number, patrimony_number),
    notes = COALESCE(p_notes, notes),
    asset_chart_account_id = v_new_asset,
    accumulated_depreciation_account_id = v_new_accum,
    depreciation_expense_account_id = v_new_expense,
    cost_center_id = COALESCE(p_cost_center_id, cost_center_id),
    service_line_id = COALESCE(p_service_line_id, service_line_id),
    party_id = COALESCE(p_party_id, party_id)
  WHERE id = p_asset_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. NORMALIZE competence_period to first day of month in post_asset_depreciation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.post_asset_depreciation(
  p_asset_id uuid,
  p_competence_period date,
  p_amount numeric(15,2) DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_asset record;
  v_depr_amount numeric(15,2);
  v_depr_base numeric(15,2);
  v_monthly_depr numeric(15,2);
  v_accumulated numeric(15,2);
  v_journal_entry_id uuid;
  v_transaction_id uuid;
  v_posting_id uuid;
  v_normalized_date date;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem contabilizar depreciacao';
  END IF;

  -- Normalize competence_period to first day of month
  v_normalized_date := date_trunc('month', p_competence_period)::date;

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

  -- Check idempotency (using normalized date)
  IF EXISTS (
    SELECT 1 FROM public.financial_asset_depreciation_postings
    WHERE asset_id = p_asset_id AND competence_period = v_normalized_date AND status = 'POSTED'
  ) THEN
    RAISE EXCEPTION 'Depreciacao ja contabilizada para este ativo no periodo %', to_char(v_normalized_date, 'YYYY-MM');
  END IF;

  -- Calculate depreciation
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

  -- Create a DEPRECIACAO transaction
  INSERT INTO public.financial_transactions (
    description, transaction_date, competence_date, movement_type, amount, status
  ) VALUES (
    'Depreciacao: ' || v_asset.name || ' (' || to_char(v_normalized_date, 'MM/YYYY') || ')',
    current_date, v_normalized_date, 'DEPRECIACAO', v_depr_amount, 'settled'
  ) RETURNING id INTO v_transaction_id;

  -- Create journal entry
  INSERT INTO public.financial_journal_entries (
    transaction_id, entry_type, entry_date, competence_date, description, status
  ) VALUES (
    v_transaction_id, 'ajuste', current_date, v_normalized_date,
    'Depreciacao: ' || v_asset.name || ' (' || to_char(v_normalized_date, 'MM/YYYY') || ')',
    'settled'
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit: Depreciation Expense
  INSERT INTO public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_asset.depreciation_expense_account_id, v_depr_amount, 0, 'Despesa de Depreciacao - ' || v_asset.asset_code);

  -- Credit: Accumulated Depreciation
  INSERT INTO public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_asset.accumulated_depreciation_account_id, 0, v_depr_amount, 'Depreciacao Acumulada - ' || v_asset.asset_code);

  -- Record posting (using normalized date)
  INSERT INTO public.financial_asset_depreciation_postings (
    asset_id, competence_period, amount, journal_entry_id, idempotency_key
  ) VALUES (
    p_asset_id, v_normalized_date, v_depr_amount, v_journal_entry_id,
    p_asset_id::text || ':' || to_char(v_normalized_date, 'YYYY-MM')
  ) RETURNING id INTO v_posting_id;

  -- Check if fully depreciated
  v_accumulated := v_accumulated + v_depr_amount;
  IF v_accumulated >= (v_asset.acquisition_value - v_asset.residual_value) THEN
    UPDATE public.financial_assets SET status = 'FULLY_DEPRECIATED' WHERE id = p_asset_id;
  END IF;

  RETURN v_posting_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. SECURITY: Revoke anon/public from view + harden RLS for inactive users
-- ---------------------------------------------------------------------------

-- Revoke from view
DO $$ BEGIN REVOKE SELECT ON public.financial_assets_list_v FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON public.financial_assets_list_v FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Revoke from tables
DO $$ BEGIN REVOKE SELECT ON public.financial_assets FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON public.financial_assets FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON public.financial_asset_depreciation_postings FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON public.financial_asset_depreciation_postings FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Drop existing policies and recreate with is_internal_user check
DROP POLICY IF EXISTS assets_select_authenticated ON public.financial_assets;
CREATE POLICY assets_select_internal ON public.financial_assets
  FOR SELECT USING (public.is_internal_user());

DROP POLICY IF EXISTS depreciation_postings_select_authenticated ON public.financial_asset_depreciation_postings;
CREATE POLICY depreciation_postings_select_internal ON public.financial_asset_depreciation_postings
  FOR SELECT USING (public.is_internal_user());

-- Revoke all from PUBLIC on RPCs
DO $$ BEGIN REVOKE ALL ON FUNCTION public.create_asset(text, text, text, text, date, numeric, numeric, integer, date, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid) FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON FUNCTION public.update_asset(uuid, text, text, text, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid) FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON FUNCTION public.dispose_asset(uuid, text) FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON FUNCTION public.post_asset_depreciation(uuid, date, numeric) FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON FUNCTION public.get_balance_sheet(date) FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON FUNCTION public.validate_asset_accounts(uuid, uuid, uuid) FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Revoke from anon
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.create_asset(text, text, text, text, date, numeric, numeric, integer, date, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.update_asset(uuid, text, text, text, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.dispose_asset(uuid, text) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.post_asset_depreciation(uuid, date, numeric) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_balance_sheet(date) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.validate_asset_accounts(uuid, uuid, uuid) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 7. FIX BP: Replace generic 'Ativo' fallback with 'NAO_CLASSIFICADO'
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_balance_sheet(
  p_as_of_date date DEFAULT current_date
)
RETURNS TABLE (
  row_code text,
  label text,
  class text,
  group_name text,
  amount numeric(15,2),
  sort_order int,
  level int,
  row_type text,
  presentation_sign smallint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
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
    SELECT code, name, 'ATIVO' AS cls,
      COALESCE(NULLIF(bp_group, ''), current_class::text, 'NAO_CLASSIFICADO') AS grp,
      balance * presentation_sign AS amt, code AS sc,
      CASE WHEN bp_group = '' AND current_class IS NOT NULL THEN 1 WHEN bp_group <> '' THEN 2 ELSE 3 END AS rl,
      CASE WHEN bp_group = '' AND current_class IS NOT NULL THEN 'SUBTOTAL' ELSE 'DETAIL' END AS rt, presentation_sign AS ps, 1 AS sort_seq
    FROM normalized WHERE class = 'ATIVO' AND balance <> 0
    UNION ALL
    SELECT code, name, 'PASSIVO',
      COALESCE(NULLIF(bp_group, ''), current_class::text, 'NAO_CLASSIFICADO'),
      balance * presentation_sign, code,
      CASE WHEN bp_group = '' AND current_class IS NOT NULL THEN 1 WHEN bp_group <> '' THEN 2 ELSE 3 END,
      CASE WHEN bp_group = '' AND current_class IS NOT NULL THEN 'SUBTOTAL' ELSE 'DETAIL' END, presentation_sign, 2
    FROM normalized WHERE class = 'PASSIVO' AND balance <> 0
    UNION ALL
    SELECT code, name, 'PL',
      COALESCE(NULLIF(bp_group, ''), 'Patrimonio Liquido'),
      balance * presentation_sign, code,
      2, 'DETAIL', presentation_sign, 3
    FROM normalized WHERE class = 'PL' AND balance <> 0
    UNION ALL
    SELECT 'RE', 'Resultado do Exercicio', 'PL', 'Resultados Acumulados', dr.resultado, 'RE',
      2, 'DETAIL', 1::smallint, 3
    FROM dre_result dr WHERE dr.resultado <> 0
  )
  SELECT code AS row_code, name AS label, cls AS class, grp AS group_name, amt AS amount, 0::int AS sort_order, rl AS level, rt AS row_type, ps AS presentation_sign
  FROM all_rows ORDER BY sort_seq, sc;
$$;

-- Revoke/regrant get_balance_sheet
DO $$ BEGIN REVOKE ALL ON FUNCTION public.get_balance_sheet(date) FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_balance_sheet(date) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;
GRANT EXECUTE ON FUNCTION public.get_balance_sheet(date) TO authenticated;
