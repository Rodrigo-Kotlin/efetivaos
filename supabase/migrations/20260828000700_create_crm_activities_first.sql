-- ETAPA 08B — CRM Activities First
-- Migration: crm_activities, crm_opportunity_events, crm_loss_reasons
-- + lost_reason_id on opportunities, updated board view, activity RPCs, event writes

-- ============================================================
-- 1. crm_loss_reasons
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crm_loss_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crm_loss_reasons IS 'Structured loss reasons for CRM opportunities (ETAPA 08B).';

CREATE UNIQUE INDEX uq_crm_loss_reasons_name ON public.crm_loss_reasons (name);

DO $$
BEGIN
  INSERT INTO public.crm_loss_reasons (name, position, active) VALUES
    ('Preço', 1, true),
    ('Concorrente', 2, true),
    ('Sem orçamento', 3, true),
    ('Sem retorno', 4, true),
    ('Prazo', 5, true),
    ('Escopo incompatível', 6, true),
    ('Cliente desistiu', 7, true),
    ('Outro', 8, true)
  ON CONFLICT (name) DO NOTHING;
END $$;

-- ============================================================
-- 2. Add lost_reason_id to crm_opportunities
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_opportunities' AND column_name = 'lost_reason_id'
  ) THEN
    ALTER TABLE public.crm_opportunities
      ADD COLUMN lost_reason_id UUID REFERENCES public.crm_loss_reasons(id);
    ALTER TABLE public.crm_opportunities
      ADD COLUMN lost_reason_detail TEXT;
  END IF;
END $$;

-- ============================================================
-- 3. crm_activities
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id),
  type TEXT NOT NULL CHECK (type IN (
    'Ligação','WhatsApp','E-mail','Reunião','Visita','Follow-up',
    'Preparar proposta','Enviar proposta','Solicitar documentos','Outro'
  )),
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  responsible_user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  outcome TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crm_activities IS 'Commercial activities for opportunities — next activity, follow-ups, tasks (ETAPA 08B).';

CREATE INDEX idx_crm_activities_opportunity ON public.crm_activities(opportunity_id);
CREATE INDEX idx_crm_activities_due_at ON public.crm_activities(due_at);
CREATE INDEX idx_crm_activities_status ON public.crm_activities(status);
CREATE INDEX idx_crm_activities_responsible ON public.crm_activities(responsible_user_id);

-- ============================================================
-- 4. crm_opportunity_events (append-only audit timeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crm_opportunity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'opportunity_created','opportunity_updated','stage_changed',
    'activity_created','activity_completed','activity_cancelled','activity_rescheduled',
    'marked_won','marked_lost','loss_reason_changed'
  )),
  event_data JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crm_opportunity_events IS 'Append-only audit timeline for CRM opportunities (ETAPA 08B).';

CREATE INDEX idx_crm_events_opportunity ON public.crm_opportunity_events(opportunity_id);
CREATE INDEX idx_crm_events_created_at ON public.crm_opportunity_events(opportunity_id, created_at DESC);

-- Prevent UPDATE/DELETE on events
REVOKE UPDATE, DELETE ON public.crm_opportunity_events FROM authenticated;
REVOKE UPDATE, DELETE ON public.crm_opportunity_events FROM anon;

-- ============================================================
-- 5. RPC: create_crm_activity
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_crm_activity(
  p_opportunity_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_due_at TIMESTAMPTZ,
  p_client_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_responsible_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_opp RECORD;
  v_activity_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, client_id, status INTO v_opp
  FROM public.crm_opportunities WHERE id = p_opportunity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity not found';
  END IF;

  IF v_opp.status != 'open' THEN
    RAISE EXCEPTION 'Cannot add activity to closed opportunity (status: %)', v_opp.status;
  END IF;

  IF p_type NOT IN ('Ligação','WhatsApp','E-mail','Reunião','Visita','Follow-up',
    'Preparar proposta','Enviar proposta','Solicitar documentos','Outro') THEN
    RAISE EXCEPTION 'Invalid activity type: %', p_type;
  END IF;

  IF p_due_at IS NULL THEN
    RAISE EXCEPTION 'due_at is required';
  END IF;

  INSERT INTO public.crm_activities (opportunity_id, client_id, type, title, description, due_at, responsible_user_id, status, created_by)
  VALUES (p_opportunity_id, COALESCE(p_client_id, v_opp.client_id), p_type, p_title, p_description, p_due_at, p_responsible_user_id, 'pending', auth.uid())
  RETURNING id INTO v_activity_id;

  INSERT INTO public.crm_opportunity_events (opportunity_id, event_type, event_data, created_by)
  VALUES (p_opportunity_id, 'activity_created', jsonb_build_object(
    'activity_id', v_activity_id, 'type', p_type, 'title', p_title, 'due_at', p_due_at
  ), auth.uid());

  RETURN v_activity_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_crm_activity TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_crm_activity FROM PUBLIC, anon;

-- ============================================================
-- 6. RPC: update_crm_activity
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_crm_activity(
  p_activity_id UUID,
  p_type TEXT DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_due_at TIMESTAMPTZ DEFAULT NULL,
  p_responsible_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_act RECORD;
  v_opp RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT a.id, a.opportunity_id, a.status, o.status AS opp_status
  INTO v_act
  FROM public.crm_activities a
  JOIN public.crm_opportunities o ON o.id = a.opportunity_id
  WHERE a.id = p_activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity not found';
  END IF;

  IF v_act.status != 'pending' THEN
    RAISE EXCEPTION 'Can only update pending activities';
  END IF;

  UPDATE public.crm_activities
  SET
    type = COALESCE(p_type, type),
    title = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    due_at = COALESCE(p_due_at, due_at),
    responsible_user_id = COALESCE(p_responsible_user_id, responsible_user_id),
    updated_at = now()
  WHERE id = p_activity_id;

  IF p_due_at IS NOT NULL THEN
    INSERT INTO public.crm_opportunity_events (opportunity_id, event_type, event_data, created_by)
    VALUES (v_act.opportunity_id, 'activity_rescheduled', jsonb_build_object(
      'activity_id', p_activity_id, 'new_due_at', p_due_at
    ), auth.uid());
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_crm_activity TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_crm_activity FROM PUBLIC, anon;

-- ============================================================
-- 7. RPC: complete_crm_activity
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_crm_activity(
  p_activity_id UUID,
  p_outcome TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_act RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, opportunity_id, status INTO v_act
  FROM public.crm_activities WHERE id = p_activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity not found';
  END IF;

  IF v_act.status != 'pending' THEN
    RAISE EXCEPTION 'Can only complete pending activities';
  END IF;

  UPDATE public.crm_activities
  SET status = 'completed', completed_at = now(), outcome = p_outcome, updated_at = now()
  WHERE id = p_activity_id;

  INSERT INTO public.crm_opportunity_events (opportunity_id, event_type, event_data, created_by)
  VALUES (v_act.opportunity_id, 'activity_completed', jsonb_build_object(
    'activity_id', p_activity_id, 'outcome', p_outcome
  ), auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_crm_activity TO authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_crm_activity FROM PUBLIC, anon;

-- ============================================================
-- 8. RPC: cancel_crm_activity
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_crm_activity(
  p_activity_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_act RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, opportunity_id, status INTO v_act
  FROM public.crm_activities WHERE id = p_activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity not found';
  END IF;

  IF v_act.status != 'pending' THEN
    RAISE EXCEPTION 'Can only cancel pending activities';
  END IF;

  UPDATE public.crm_activities
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_activity_id;

  INSERT INTO public.crm_opportunity_events (opportunity_id, event_type, event_data, created_by)
  VALUES (v_act.opportunity_id, 'activity_cancelled', jsonb_build_object('activity_id', p_activity_id), auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_crm_activity TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_crm_activity FROM PUBLIC, anon;

-- ============================================================
-- 9. Update existing RPCs to write events atomically
-- ============================================================

-- create_crm_opportunity: add event
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

  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  v_pipeline_id := COALESCE(
    p_pipeline_id,
    (SELECT id FROM public.crm_pipelines WHERE is_default = true AND active = true LIMIT 1)
  );

  IF v_pipeline_id IS NULL THEN
    RAISE EXCEPTION 'No pipeline specified and no default pipeline found';
  END IF;

  v_stage_id := COALESCE(
    p_stage_id,
    (SELECT id FROM public.crm_stages WHERE pipeline_id = v_pipeline_id AND active = true ORDER BY position LIMIT 1)
  );

  SELECT probability INTO v_probability FROM public.crm_stages WHERE id = v_stage_id;

  SELECT COALESCE(MAX(sort_order) + 1, 0) INTO v_sort_order
  FROM public.crm_opportunities WHERE pipeline_id = v_pipeline_id AND stage_id = v_stage_id AND status = 'open';

  INSERT INTO public.crm_opportunities (
    client_id, pipeline_id, stage_id, title, description, value,
    probability, expected_close_date, responsible_user_id,
    sort_order, created_by, status
  ) VALUES (
    p_client_id, v_pipeline_id, v_stage_id, p_title, p_description, COALESCE(p_value, 0),
    COALESCE(v_probability, 0), p_expected_close_date, p_responsible_user_id,
    v_sort_order, auth.uid(), 'open'
  )
  RETURNING id INTO v_opp_id;

  INSERT INTO public.crm_opportunity_events (opportunity_id, event_type, event_data, created_by)
  VALUES (v_opp_id, 'opportunity_created', jsonb_build_object(
    'title', p_title, 'client_id', p_client_id, 'value', COALESCE(p_value, 0)
  ), auth.uid());

  RETURN v_opp_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_crm_opportunity TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_crm_opportunity FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_crm_opportunity FROM anon;

-- update_crm_opportunity: add event
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

  INSERT INTO public.crm_opportunity_events (opportunity_id, event_type, event_data, created_by)
  VALUES (p_opportunity_id, 'opportunity_updated', jsonb_build_object(
    'fields', COALESCE(
      NULLIF(jsonb_build_object(
        'title', p_title, 'value', p_value, 'expected_close_date', p_expected_close_date
      )::text, '{}')::jsonb,
      '{}'::jsonb
    )
  ), auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_crm_opportunity TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_crm_opportunity FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_crm_opportunity FROM anon;

-- move_crm_opportunity: add event
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
  v_old_stage_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, stage_id, pipeline_id, status, sort_order
  INTO v_opp
  FROM public.crm_opportunities
  WHERE id = p_opportunity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity not found';
  END IF;

  IF v_opp.status != 'open' THEN
    RAISE EXCEPTION 'Cannot move a closed opportunity (status: %)', v_opp.status;
  END IF;

  SELECT id, pipeline_id, probability
  INTO v_stage
  FROM public.crm_stages
  WHERE id = p_target_stage_id AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target stage not found or inactive';
  END IF;

  IF v_stage.pipeline_id != v_opp.pipeline_id THEN
    RAISE EXCEPTION 'Cannot move opportunity to a stage in a different pipeline';
  END IF;

  v_old_stage_id := v_opp.stage_id;

  UPDATE public.crm_opportunities
  SET
    stage_id = p_target_stage_id,
    probability = v_stage.probability,
    sort_order = COALESCE(p_target_position, sort_order),
    updated_at = now()
  WHERE id = p_opportunity_id;

  INSERT INTO public.crm_opportunity_events (opportunity_id, event_type, event_data, created_by)
  VALUES (p_opportunity_id, 'stage_changed', jsonb_build_object(
    'from_stage_id', v_old_stage_id, 'to_stage_id', p_target_stage_id
  ), auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_crm_opportunity TO authenticated;
REVOKE EXECUTE ON FUNCTION public.move_crm_opportunity FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_crm_opportunity FROM anon;

-- mark_opportunity_won: add event + cancel pending activities
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

  IF NOT EXISTS (SELECT 1 FROM public.crm_opportunities WHERE id = p_opportunity_id AND status = 'open') THEN
    RAISE EXCEPTION 'Open opportunity not found';
  END IF;

  UPDATE public.crm_opportunities
  SET status = 'won', won_at = now(), updated_at = now()
  WHERE id = p_opportunity_id AND status = 'open';

  UPDATE public.crm_activities
  SET status = 'cancelled', updated_at = now()
  WHERE opportunity_id = p_opportunity_id AND status = 'pending';

  INSERT INTO public.crm_opportunity_events (opportunity_id, event_type, event_data, created_by)
  VALUES (p_opportunity_id, 'marked_won', '{}'::jsonb, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_opportunity_won TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_opportunity_won FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_opportunity_won FROM anon;

-- mark_opportunity_lost: add event + cancel pending activities
CREATE OR REPLACE FUNCTION public.mark_opportunity_lost(
  p_opportunity_id UUID,
  p_lost_reason TEXT DEFAULT NULL,
  p_lost_reason_id UUID DEFAULT NULL,
  p_lost_reason_detail TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_final_reason TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_opportunities WHERE id = p_opportunity_id AND status = 'open') THEN
    RAISE EXCEPTION 'Open opportunity not found';
  END IF;

  IF p_lost_reason_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.crm_loss_reasons WHERE id = p_lost_reason_id AND active = true) THEN
      RAISE EXCEPTION 'Invalid loss reason';
    END IF;
    SELECT name INTO v_final_reason FROM public.crm_loss_reasons WHERE id = p_lost_reason_id;
    IF v_final_reason = 'Outro' AND (p_lost_reason_detail IS NULL OR p_lost_reason_detail = '') THEN
      RAISE EXCEPTION 'Detail required when reason is Outro';
    END IF;
  ELSIF p_lost_reason IS NOT NULL THEN
    v_final_reason := p_lost_reason;
  ELSE
    RAISE EXCEPTION 'Lost reason is required';
  END IF;

  UPDATE public.crm_opportunities
  SET
    status = 'lost', lost_at = now(),
    lost_reason = COALESCE(p_lost_reason, v_final_reason),
    lost_reason_id = p_lost_reason_id,
    lost_reason_detail = p_lost_reason_detail,
    updated_at = now()
  WHERE id = p_opportunity_id AND status = 'open';

  UPDATE public.crm_activities
  SET status = 'cancelled', updated_at = now()
  WHERE opportunity_id = p_opportunity_id AND status = 'pending';

  INSERT INTO public.crm_opportunity_events (opportunity_id, event_type, event_data, created_by)
  VALUES (p_opportunity_id, 'marked_lost', jsonb_build_object(
    'lost_reason', COALESCE(p_lost_reason, v_final_reason),
    'lost_reason_id', p_lost_reason_id,
    'lost_reason_detail', p_lost_reason_detail
  ), auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_opportunity_lost TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_opportunity_lost FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_opportunity_lost FROM anon;

-- ============================================================
-- 10. Updated crm_opportunities_board_v with next_activity fields
-- ============================================================
DROP VIEW IF EXISTS public.crm_opportunities_board_v;

CREATE VIEW public.crm_opportunities_board_v
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
  o.lost_reason_id,
  o.lost_reason_detail,
  lr.name AS loss_reason_name,
  o.created_at,
  o.updated_at,
  o.created_by,
  na.next_activity_id,
  na.next_activity_type,
  na.next_activity_title,
  na.next_activity_due_at,
  na.next_activity_responsible_user_id,
  CASE
    WHEN na.next_activity_due_at IS NULL THEN 'none'
    WHEN na.next_activity_due_at < date_trunc('day', now()) THEN 'overdue'
    WHEN na.next_activity_due_at < date_trunc('day', now()) + interval '1 day' THEN 'today'
    ELSE 'upcoming'
  END AS next_activity_status_semantic
FROM public.crm_opportunities o
JOIN public.clients c ON c.id = o.client_id
JOIN public.crm_pipelines p ON p.id = o.pipeline_id
JOIN public.crm_stages s ON s.id = o.stage_id
LEFT JOIN public.profiles pr ON pr.id = o.responsible_user_id
LEFT JOIN public.crm_loss_reasons lr ON lr.id = o.lost_reason_id
LEFT JOIN LATERAL (
  SELECT a.id AS next_activity_id, a.type AS next_activity_type, a.title AS next_activity_title,
         a.due_at AS next_activity_due_at, a.responsible_user_id AS next_activity_responsible_user_id
  FROM public.crm_activities a
  WHERE a.opportunity_id = o.id AND a.status = 'pending'
  ORDER BY a.due_at ASC LIMIT 1
) na ON true;

COMMENT ON VIEW public.crm_opportunities_board_v IS 'Read model with next activity semantic status. security_invoker ensures RLS.';

-- ============================================================
-- 11. RLS Policies for crm_activities
-- ============================================================
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal read crm_activities"
  ON public.crm_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Internal insert crm_activities"
  ON public.crm_activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Internal update crm_activities"
  ON public.crm_activities FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Deny inactive crm_activities"
  ON public.crm_activities FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny anon crm_activities"
  ON public.crm_activities FOR ALL
  TO anon
  USING (false);

-- ============================================================
-- 12. RLS Policies for crm_opportunity_events
-- ============================================================
ALTER TABLE public.crm_opportunity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal read crm_events"
  ON public.crm_opportunity_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Internal insert crm_events"
  ON public.crm_opportunity_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Deny inactive crm_events"
  ON public.crm_opportunity_events FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny anon crm_events"
  ON public.crm_opportunity_events FOR ALL
  TO anon
  USING (false);

-- ============================================================
-- 13. RLS Policies for crm_loss_reasons
-- ============================================================
ALTER TABLE public.crm_loss_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal read crm_loss_reasons"
  ON public.crm_loss_reasons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin write crm_loss_reasons"
  ON public.crm_loss_reasons FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny anon crm_loss_reasons"
  ON public.crm_loss_reasons FOR ALL
  TO anon
  USING (false);

-- ============================================================
-- 14. Grants
-- ============================================================
GRANT SELECT ON public.crm_loss_reasons TO authenticated;
GRANT SELECT ON public.crm_activities TO authenticated;
GRANT SELECT, INSERT ON public.crm_opportunity_events TO authenticated;
