-- ============================================================================
-- ETAPA 08F — Gestao de Ativos/Bens + Balanco Patrimonial Gerencial
-- Migration: financial_assets + depreciation_postings + RPCs + balance sheet
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.financial_asset_status AS ENUM (
    'ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED', 'INACTIVE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.financial_asset_depreciation_method AS ENUM (
    'STRAIGHT_LINE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add DEPRECIACAO movement type
DO $$ BEGIN
  ALTER TYPE public.financial_movement_type ADD VALUE IF NOT EXISTS 'DEPRECIACAO';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. TABLE: financial_assets (operational register, NOT a ledger)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.financial_assets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code            text NOT NULL,
  name                  text NOT NULL,
  description           text,
  category              text,
  acquisition_date      date NOT NULL,
  acquisition_value     numeric(15,2) NOT NULL CHECK (acquisition_value > 0),
  residual_value        numeric(15,2) NOT NULL DEFAULT 0 CHECK (residual_value >= 0),
  useful_life_months    integer NOT NULL DEFAULT 60 CHECK (useful_life_months > 0),
  depreciation_method   public.financial_asset_depreciation_method NOT NULL DEFAULT 'STRAIGHT_LINE',
  depreciation_start_date date,
  status                public.financial_asset_status NOT NULL DEFAULT 'ACTIVE',
  location              text,
  responsible           text,
  serial_number         text,
  patrimony_number      text,
  notes                 text,
  active                boolean NOT NULL DEFAULT true,
  -- FKs to chart of accounts
  asset_chart_account_id            uuid REFERENCES public.financial_chart_accounts(id) ON DELETE RESTRICT,
  accumulated_depreciation_account_id uuid REFERENCES public.financial_chart_accounts(id) ON DELETE RESTRICT,
  depreciation_expense_account_id   uuid REFERENCES public.financial_chart_accounts(id) ON DELETE RESTRICT,
  -- FKs to dimensions
  cost_center_id         uuid REFERENCES public.financial_cost_centers(id) ON DELETE SET NULL,
  service_line_id        uuid REFERENCES public.financial_service_lines(id) ON DELETE SET NULL,
  -- FK to party/supplier
  party_id               uuid REFERENCES public.financial_parties(id) ON DELETE SET NULL,
  -- FK to acquisition transaction
  acquisition_transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  -- Audit
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Unique asset_code
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_assets_asset_code
  ON public.financial_assets (asset_code) WHERE active = true;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_financial_assets_status ON public.financial_assets (status) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_financial_assets_acquisition_date ON public.financial_assets (acquisition_date);
CREATE INDEX IF NOT EXISTS idx_financial_assets_category ON public.financial_assets (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_assets_cost_center ON public.financial_assets (cost_center_id) WHERE cost_center_id IS NOT NULL;

-- Normalize trigger
CREATE OR REPLACE FUNCTION public.normalize_financial_asset()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.asset_code := upper(btrim(NEW.asset_code));
  NEW.name := btrim(NEW.name);
  IF NEW.description IS NOT NULL THEN NEW.description := btrim(NEW.description); END IF;
  IF NEW.category IS NOT NULL THEN NEW.category := btrim(NEW.category); END IF;
  IF NEW.location IS NOT NULL THEN NEW.location := btrim(NEW.location); END IF;
  IF NEW.responsible IS NOT NULL THEN NEW.responsible := btrim(NEW.responsible); END IF;
  IF NEW.serial_number IS NOT NULL THEN NEW.serial_number := btrim(NEW.serial_number); END IF;
  IF NEW.patrimony_number IS NOT NULL THEN NEW.patrimony_number := btrim(NEW.patrimony_number); END IF;
  IF NEW.depreciation_start_date IS NULL THEN
    NEW.depreciation_start_date := NEW.acquisition_date;
  END IF;
  IF NEW.residual_value > NEW.acquisition_value THEN
    NEW.residual_value := NEW.acquisition_value;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_assets_normalize ON public.financial_assets;
CREATE TRIGGER trg_financial_assets_normalize
  BEFORE INSERT OR UPDATE ON public.financial_assets
  FOR EACH ROW EXECUTE FUNCTION public.normalize_financial_asset();

DROP TRIGGER IF EXISTS trg_financial_assets_audit ON public.financial_assets;
CREATE TRIGGER trg_financial_assets_audit
  BEFORE INSERT OR UPDATE ON public.financial_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

-- ---------------------------------------------------------------------------
-- 3. TABLE: financial_asset_depreciation_postings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.financial_asset_depreciation_postings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            uuid NOT NULL REFERENCES public.financial_assets(id) ON DELETE RESTRICT,
  competence_period   date NOT NULL,
  amount              numeric(15,2) NOT NULL CHECK (amount >= 0),
  journal_entry_id    uuid REFERENCES public.financial_journal_entries(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REVERSED')),
  idempotency_key     text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_depreciation_postings_asset_period
  ON public.financial_asset_depreciation_postings (asset_id, competence_period)
  WHERE status = 'POSTED';

CREATE INDEX IF NOT EXISTS idx_depreciation_postings_asset ON public.financial_asset_depreciation_postings (asset_id);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.financial_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_asset_depreciation_postings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assets_select_authenticated ON public.financial_assets;
CREATE POLICY assets_select_authenticated ON public.financial_assets
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS depreciation_postings_select_authenticated ON public.financial_asset_depreciation_postings;
CREATE POLICY depreciation_postings_select_authenticated ON public.financial_asset_depreciation_postings
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.financial_assets TO authenticated;
GRANT SELECT ON public.financial_asset_depreciation_postings TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC: create_asset (Admin-only)
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

REVOKE ALL ON FUNCTION public.create_asset(text, text, text, text, date, numeric, numeric, integer, date, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_asset(text, text, text, text, date, numeric, numeric, integer, date, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC: update_asset (Admin-only)
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
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
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
$$;

REVOKE ALL ON FUNCTION public.update_asset(uuid, text, text, text, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_asset(uuid, text, text, text, text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC: dispose_asset (Admin-only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dispose_asset(
  p_asset_id uuid,
  p_notes text DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
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
$$;

REVOKE ALL ON FUNCTION public.dispose_asset(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispose_asset(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. RPC: post_asset_depreciation (Admin-only, idempotent)
--    Creates: D Depreciacao / C Depreciacao Acumulada
--    Journal entry is linked to a DEPRECIACAO transaction
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
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
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

  -- Check idempotency
  IF EXISTS (
    SELECT 1 FROM public.financial_asset_depreciation_postings
    WHERE asset_id = p_asset_id AND competence_period = p_competence_period AND status = 'POSTED'
  ) THEN
    RAISE EXCEPTION 'Depreciacao ja contabilizada para este ativo no periodo %', to_char(p_competence_period, 'YYYY-MM');
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

  -- Create a DEPRECIACAO transaction (minimal record for FK)
  INSERT INTO public.financial_transactions (
    description, transaction_date, competence_date, movement_type, amount, status
  ) VALUES (
    'Depreciacao: ' || v_asset.name || ' (' || to_char(p_competence_period, 'MM/YYYY') || ')',
    current_date, p_competence_period, 'DEPRECIACAO', v_depr_amount, 'settled'
  ) RETURNING id INTO v_transaction_id;

  -- Create journal entry
  INSERT INTO public.financial_journal_entries (
    transaction_id, entry_type, entry_date, competence_date, description, status
  ) VALUES (
    v_transaction_id, 'ajuste', current_date, p_competence_period,
    'Depreciacao: ' || v_asset.name || ' (' || to_char(p_competence_period, 'MM/YYYY') || ')',
    'settled'
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit: Depreciation Expense
  INSERT INTO public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_asset.depreciation_expense_account_id, v_depr_amount, 0, 'Despesa de Depreciacao - ' || v_asset.asset_code);

  -- Credit: Accumulated Depreciation
  INSERT INTO public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_asset.accumulated_depreciation_account_id, 0, v_depr_amount, 'Depreciacao Acumulada - ' || v_asset.asset_code);

  -- Record posting
  INSERT INTO public.financial_asset_depreciation_postings (
    asset_id, competence_period, amount, journal_entry_id, idempotency_key
  ) VALUES (
    p_asset_id, p_competence_period, v_depr_amount, v_journal_entry_id,
    p_asset_id::text || ':' || to_char(p_competence_period, 'YYYY-MM')
  ) RETURNING id INTO v_posting_id;

  -- Check if fully depreciated
  v_accumulated := v_accumulated + v_depr_amount;
  IF v_accumulated >= (v_asset.acquisition_value - v_asset.residual_value) THEN
    UPDATE public.financial_assets SET status = 'FULLY_DEPRECIATED' WHERE id = p_asset_id;
  END IF;

  RETURN v_posting_id;
END;
$$;

REVOKE ALL ON FUNCTION public.post_asset_depreciation(uuid, date, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_asset_depreciation(uuid, date, numeric) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. RPC: get_balance_sheet (Admin + Equipe, read-only)
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
$$;

REVOKE ALL ON FUNCTION public.get_balance_sheet(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_balance_sheet(date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. VIEW: financial_assets_list_v
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.financial_assets_list_v
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.asset_code,
  a.name,
  a.description,
  a.category,
  a.acquisition_date,
  a.acquisition_value,
  a.residual_value,
  a.useful_life_months,
  a.depreciation_method,
  a.depreciation_start_date,
  a.status,
  a.location,
  a.responsible,
  a.serial_number,
  a.patrimony_number,
  a.notes,
  a.active,
  a.cost_center_id,
  a.service_line_id,
  a.party_id,
  a.acquisition_transaction_id,
  a.asset_chart_account_id,
  a.accumulated_depreciation_account_id,
  a.depreciation_expense_account_id,
  a.created_at,
  a.created_by,
  a.updated_at,
  a.updated_by,
  GREATEST(0, a.acquisition_value - a.residual_value) AS depreciable_base,
  CASE WHEN a.useful_life_months > 0
    THEN ROUND((GREATEST(0, a.acquisition_value - a.residual_value) / a.useful_life_months)::numeric, 2)
    ELSE 0 END AS monthly_depreciation,
  COALESCE(dp.total_accumulated, 0) AS accumulated_depreciation,
  GREATEST(
    a.residual_value,
    a.acquisition_value - COALESCE(dp.total_accumulated, 0)
  ) AS book_value_estimated,
  cc.name AS cost_center_name,
  sl.name AS service_line_name,
  ca.code AS chart_account_code,
  ca.name AS chart_account_name,
  ca_acc.code AS accumulated_account_code,
  ca_acc.name AS accumulated_account_name,
  ca_dep.code AS expense_account_code,
  ca_dep.name AS expense_account_name
FROM public.financial_assets a
LEFT JOIN (
  SELECT asset_id, SUM(amount) AS total_accumulated
  FROM public.financial_asset_depreciation_postings
  WHERE status = 'POSTED'
  GROUP BY asset_id
) dp ON dp.asset_id = a.id
LEFT JOIN public.financial_cost_centers cc ON cc.id = a.cost_center_id
LEFT JOIN public.financial_service_lines sl ON sl.id = a.service_line_id
LEFT JOIN public.financial_chart_accounts ca ON ca.id = a.asset_chart_account_id
LEFT JOIN public.financial_chart_accounts ca_acc ON ca_acc.id = a.accumulated_depreciation_account_id
LEFT JOIN public.financial_chart_accounts ca_dep ON ca_dep.id = a.depreciation_expense_account_id
WHERE a.active = true;

GRANT SELECT ON public.financial_assets_list_v TO authenticated;
