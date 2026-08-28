-- ETAPA 08A — CRM Pipeline Core
-- Migration: crm_pipelines, crm_stages, crm_opportunities + seed + RPCs + RLS

-- ============================================================================
-- 1. TABLE: crm_pipelines
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.crm_pipelines IS 'Commercial pipelines for opportunity tracking (ETAPA 08A).';

-- Only one default active pipeline allowed
CREATE UNIQUE INDEX uq_crm_pipelines_default
  ON public.crm_pipelines (is_default)
  WHERE is_default = true;

CREATE INDEX idx_crm_pipelines_active ON public.crm_pipelines(active);

-- ============================================================================
-- 2. TABLE: crm_stages
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  probability INTEGER NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crm_stages IS 'Pipeline stages with position and probability (ETAPA 08A).';

CREATE UNIQUE INDEX uq_crm_stages_pipeline_position
  ON public.crm_stages (pipeline_id, position);

CREATE INDEX idx_crm_stages_pipeline ON public.crm_stages(pipeline_id);

-- ============================================================================
-- 3. TABLE: crm_opportunities
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE RESTRICT,
  stage_id UUID NOT NULL REFERENCES public.crm_stages(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  value NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  probability INTEGER NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,
  responsible_user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  lost_reason TEXT,
  sort_order NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crm_opportunities IS 'Commercial opportunities linked to clients (ETAPA 08A). Client 1:N Opportunities.';

-- Indexes
CREATE INDEX idx_crm_opps_pipeline_status ON public.crm_opportunities(pipeline_id, status);
CREATE INDEX idx_crm_opps_stage ON public.crm_opportunities(stage_id);
CREATE INDEX idx_crm_opps_client ON public.crm_opportunities(client_id);
CREATE INDEX idx_crm_opps_responsible ON public.crm_opportunities(responsible_user_id);
CREATE INDEX idx_crm_opps_status ON public.crm_opportunities(status);

-- ============================================================================
-- 4. SEED: Default Pipeline + 5 Stages (idempotent)
-- ============================================================================

DO $$
DECLARE
  v_pipeline_id UUID;
BEGIN
  -- Insert default pipeline only if none exists
  INSERT INTO public.crm_pipelines (name, description, active, is_default)
  SELECT 'Pipeline Comercial', 'Pipeline principal de oportunidades comerciais', true, true
  WHERE NOT EXISTS (SELECT 1 FROM public.crm_pipelines WHERE is_default = true)
  RETURNING id INTO v_pipeline_id;

  -- If pipeline already existed, get its id
  IF v_pipeline_id IS NULL THEN
    SELECT id INTO v_pipeline_id FROM public.crm_pipelines WHERE is_default = true LIMIT 1;
  END IF;

  -- Insert stages only if none exist for this pipeline
  IF NOT EXISTS (SELECT 1 FROM public.crm_stages WHERE pipeline_id = v_pipeline_id) THEN
    INSERT INTO public.crm_stages (pipeline_id, name, position, probability, active) VALUES
      (v_pipeline_id, 'Novo contato',    1, 10, true),
      (v_pipeline_id, 'Qualificação',    2, 20, true),
      (v_pipeline_id, 'Diagnóstico',     3, 40, true),
      (v_pipeline_id, 'Proposta',        4, 60, true),
      (v_pipeline_id, 'Negociação',      5, 80, true);
  END IF;
END $$;

-- ============================================================================
-- 5. READ MODEL: crm_opportunities_board_v
-- ============================================================================

CREATE OR REPLACE VIEW public.crm_opportunities_board_v
WITH (security_invoker = true)
AS
SELECT
  o.id AS opportunity_id,
  o.client_id,
  COALESCE(c.trade_name, c.legal_name) AS client_name,
  c.legal_name AS client_legal_name,
  c.tax_id AS client_tax_id,
  o.title,
  o.description,
  o.pipeline_id,
  p.name AS pipeline_name,
  o.stage_id,
  s.name AS stage_name,
  s.position AS stage_position,
  s.probability AS stage_probability,
  o.value,
  o.probability,
  o.expected_close_date,
  o.responsible_user_id,
  pr.full_name AS responsible_name,
  o.status,
  o.sort_order,
  o.won_at,
  o.lost_at,
  o.lost_reason,
  o.created_at,
  o.updated_at,
  o.created_by
FROM public.crm_opportunities o
JOIN public.clients c ON c.id = o.client_id
JOIN public.crm_pipelines p ON p.id = o.pipeline_id
JOIN public.crm_stages s ON s.id = o.stage_id
LEFT JOIN public.profiles pr ON pr.id = o.responsible_user_id;

COMMENT ON VIEW public.crm_opportunities_board_v IS 'Read model for Kanban board. security_invoker ensures RLS from crm_opportunities.';

-- ============================================================================
-- 6. RPC: move_crm_opportunity
-- Atomic move: updates stage, probability, sort_order, updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.move_crm_opportunity(
  p_opportunity_id UUID,
  p_target_stage_id UUID,
  p_target_position NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_opp RECORD;
  v_stage RECORD;
  v_pipeline RECORD;
BEGIN
  -- Guard: must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Load opportunity
  SELECT id, stage_id, pipeline_id, status, sort_order
  INTO v_opp
  FROM public.crm_opportunities
  WHERE id = p_opportunity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity not found';
  END IF;

  -- Cannot move closed opportunities
  IF v_opp.status != 'open' THEN
    RAISE EXCEPTION 'Cannot move a closed opportunity (status: %)', v_opp.status;
  END IF;

  -- Validate target stage
  SELECT id, pipeline_id, probability
  INTO v_stage
  FROM public.crm_stages
  WHERE id = p_target_stage_id AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target stage not found or inactive';
  END IF;

  -- Validate same pipeline
  IF v_stage.pipeline_id != v_opp.pipeline_id THEN
    RAISE EXCEPTION 'Cannot move opportunity to a stage in a different pipeline';
  END IF;

  -- Update opportunity
  UPDATE public.crm_opportunities
  SET
    stage_id = p_target_stage_id,
    probability = v_stage.probability,
    sort_order = COALESCE(p_target_position, sort_order),
    updated_at = now()
  WHERE id = p_opportunity_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_crm_opportunity TO authenticated;
REVOKE EXECUTE ON FUNCTION public.move_crm_opportunity FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_crm_opportunity FROM anon;

-- ============================================================================
-- 7. RPC: create_crm_opportunity
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_crm_opportunity(
  p_client_id UUID,
  p_title TEXT,
  p_pipeline_id UUID DEFAULT NULL,
  p_stage_id UUID DEFAULT NULL,
  p_value NUMERIC DEFAULT 0,
  p_expected_close_date DATE DEFAULT NULL,
  p_responsible_user_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_pipeline_id UUID;
  v_stage_id UUID;
  v_probability INTEGER;
  v_sort_order NUMERIC;
  v_opp_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate client exists
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  -- Resolve default pipeline
  v_pipeline_id := COALESCE(
    p_pipeline_id,
    (SELECT id FROM public.crm_pipelines WHERE is_default = true AND active = true LIMIT 1)
  );

  IF v_pipeline_id IS NULL THEN
    RAISE EXCEPTION 'No active pipeline found';
  END IF;

  -- Resolve default stage (first stage of pipeline)
  v_stage_id := COALESCE(
    p_stage_id,
    (SELECT id FROM public.crm_stages WHERE pipeline_id = v_pipeline_id AND active = true ORDER BY position LIMIT 1)
  );

  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'No active stage found for pipeline';
  END IF;

  -- Get probability from stage
  SELECT probability INTO v_probability FROM public.crm_stages WHERE id = v_stage_id;

  -- Get next sort order
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_sort_order
  FROM public.crm_opportunities
  WHERE pipeline_id = v_pipeline_id AND stage_id = v_stage_id AND status = 'open';

  INSERT INTO public.crm_opportunities (
    client_id, pipeline_id, stage_id, title, description,
    value, probability, expected_close_date, responsible_user_id,
    sort_order, created_by
  ) VALUES (
    p_client_id, v_pipeline_id, v_stage_id, p_title, p_description,
    COALESCE(p_value, 0), v_probability, p_expected_close_date, p_responsible_user_id,
    v_sort_order, auth.uid()
  )
  RETURNING id INTO v_opp_id;

  RETURN v_opp_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_crm_opportunity TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_crm_opportunity FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_crm_opportunity FROM anon;

-- ============================================================================
-- 8. RPC: update_crm_opportunity
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_crm_opportunity(
  p_opportunity_id UUID,
  p_title TEXT DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_value NUMERIC DEFAULT NULL,
  p_expected_close_date DATE DEFAULT NULL,
  p_responsible_user_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_opportunities WHERE id = p_opportunity_id) THEN
    RAISE EXCEPTION 'Opportunity not found';
  END IF;

  IF p_client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  UPDATE public.crm_opportunities
  SET
    title = COALESCE(p_title, title),
    client_id = COALESCE(p_client_id, client_id),
    value = COALESCE(p_value, value),
    expected_close_date = COALESCE(p_expected_close_date, expected_close_date),
    responsible_user_id = COALESCE(p_responsible_user_id, responsible_user_id),
    description = COALESCE(p_description, description),
    updated_at = now()
  WHERE id = p_opportunity_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_crm_opportunity TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_crm_opportunity FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_crm_opportunity FROM anon;

-- ============================================================================
-- 9. RPC: mark_opportunity_won
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_opportunity_won(
  p_opportunity_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.crm_opportunities
  SET status = 'open', won_at = NULL
  WHERE id = p_opportunity_id AND status = 'won';

  UPDATE public.crm_opportunities
  SET status = 'won', won_at = now(), updated_at = now()
  WHERE id = p_opportunity_id AND status = 'open';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity not found or not open';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_opportunity_won TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_opportunity_won FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_opportunity_won FROM anon;

-- ============================================================================
-- 10. RPC: mark_opportunity_lost
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_opportunity_lost(
  p_opportunity_id UUID,
  p_lost_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_lost_reason IS NULL OR trim(p_lost_reason) = '' THEN
    RAISE EXCEPTION 'Loss reason is required';
  END IF;

  UPDATE public.crm_opportunities
  SET
    status = 'lost',
    lost_at = now(),
    lost_reason = p_lost_reason,
    updated_at = now()
  WHERE id = p_opportunity_id AND status = 'open';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity not found or not open';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_opportunity_lost TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_opportunity_lost FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_opportunity_lost FROM anon;

-- ============================================================================
-- 11. RLS POLICIES
-- ============================================================================

-- crm_pipelines
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipelines FORCE ROW LEVEL SECURITY;

CREATE POLICY "pipelines_select_internal" ON public.crm_pipelines
  FOR SELECT USING (public.is_internal_user());

CREATE POLICY "pipelines_insert_admin" ON public.crm_pipelines
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "pipelines_update_admin" ON public.crm_pipelines
  FOR UPDATE USING (public.is_admin());

-- crm_stages
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages FORCE ROW LEVEL SECURITY;

CREATE POLICY "stages_select_internal" ON public.crm_stages
  FOR SELECT USING (public.is_internal_user());

CREATE POLICY "stages_insert_admin" ON public.crm_stages
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "stages_update_admin" ON public.crm_stages
  FOR UPDATE USING (public.is_admin());

-- crm_opportunities
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_opportunities FORCE ROW LEVEL SECURITY;

CREATE POLICY "opportunities_select_internal" ON public.crm_opportunities
  FOR SELECT USING (public.is_internal_user());

CREATE POLICY "opportunities_insert_internal" ON public.crm_opportunities
  FOR INSERT WITH CHECK (public.is_internal_user());

CREATE POLICY "opportunities_update_internal" ON public.crm_opportunities
  FOR UPDATE USING (public.is_internal_user());

-- ============================================================================
-- 12. BASE GRANTS
-- ============================================================================

REVOKE ALL ON public.crm_pipelines FROM PUBLIC;
GRANT SELECT ON public.crm_pipelines TO authenticated;

REVOKE ALL ON public.crm_stages FROM PUBLIC;
GRANT SELECT ON public.crm_stages TO authenticated;

REVOKE ALL ON public.crm_opportunities FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.crm_opportunities TO authenticated;

REVOKE ALL ON public.crm_opportunities_board_v FROM PUBLIC;
GRANT SELECT ON public.crm_opportunities_board_v TO authenticated;
