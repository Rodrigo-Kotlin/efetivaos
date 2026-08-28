-- ETAPA 08C — Views & Intelligence
-- Migration: aging fields, analytics RPC, list view enhancements

-- ============================================================
-- 1. Add stage_entered_at to crm_opportunities
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_opportunities' AND column_name = 'stage_entered_at'
  ) THEN
    ALTER TABLE public.crm_opportunities
      ADD COLUMN stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- ============================================================
-- 2. Backfill stage_entered_at from events
-- ============================================================
DO $$
DECLARE
  v_opp RECORD;
  v_last_stage_change TIMESTAMPTZ;
BEGIN
  FOR v_opp IN SELECT id FROM public.crm_opportunities WHERE stage_entered_at = created_at
  LOOP
    SELECT MAX(created_at) INTO v_last_stage_change
    FROM public.crm_opportunity_events
    WHERE opportunity_id = v_opp.id AND event_type = 'stage_changed';

    IF v_last_stage_change IS NOT NULL THEN
      UPDATE public.crm_opportunities SET stage_entered_at = v_last_stage_change WHERE id = v_opp.id;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 3. Update move_crm_opportunity to set stage_entered_at
-- ============================================================
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
    stage_entered_at = now(),
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

-- ============================================================
-- 4. Update board view with stage_entered_at and stage_age_days
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
  o.stage_entered_at,
  EXTRACT(DAY FROM now() - o.stage_entered_at)::INT AS stage_age_days,
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

COMMENT ON VIEW public.crm_opportunities_board_v IS 'Read model with aging and next activity. security_invoker ensures RLS.';

-- ============================================================
-- 5. Analytics RPC: get_crm_pipeline_analytics
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_crm_pipeline_analytics(
  p_pipeline_id UUID DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_responsible_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_pipeline_id UUID;
  v_from TIMESTAMPTZ;
  v_to TIMESTAMPTZ;
  v_total JSONB;
  v_conversion JSONB;
  v_stage_metrics JSONB;
  v_loss_reasons JSONB;
  v_forecast JSONB;
BEGIN
  v_pipeline_id := COALESCE(
    p_pipeline_id,
    (SELECT id FROM public.crm_pipelines WHERE is_default = true AND active = true LIMIT 1)
  );

  v_from := COALESCE(p_from_date::TIMESTAMPTZ, (date_trunc('month', now()) - interval '6 months'));
  v_to := COALESCE((p_to_date + interval '1 day')::TIMESTAMPTZ, now() + interval '1 day');

  -- Totals
  SELECT jsonb_build_object(
    'open_count', (SELECT count(*) FROM public.crm_opportunities WHERE pipeline_id = v_pipeline_id AND status = 'open'
      AND (p_responsible_user_id IS NULL OR responsible_user_id = p_responsible_user_id)),
    'open_value', (SELECT COALESCE(sum(value), 0) FROM public.crm_opportunities WHERE pipeline_id = v_pipeline_id AND status = 'open'
      AND (p_responsible_user_id IS NULL OR responsible_user_id = p_responsible_user_id)),
    'weighted_value', (SELECT COALESCE(sum(value * probability / 100.0), 0) FROM public.crm_opportunities WHERE pipeline_id = v_pipeline_id AND status = 'open'
      AND (p_responsible_user_id IS NULL OR responsible_user_id = p_responsible_user_id)),
    'won_count', (SELECT count(*) FROM public.crm_opportunities WHERE pipeline_id = v_pipeline_id AND status = 'won'
      AND won_at >= v_from AND won_at < v_to
      AND (p_responsible_user_id IS NULL OR responsible_user_id = p_responsible_user_id)),
    'won_value', (SELECT COALESCE(sum(value), 0) FROM public.crm_opportunities WHERE pipeline_id = v_pipeline_id AND status = 'won'
      AND won_at >= v_from AND won_at < v_to
      AND (p_responsible_user_id IS NULL OR responsible_user_id = p_responsible_user_id)),
    'lost_count', (SELECT count(*) FROM public.crm_opportunities WHERE pipeline_id = v_pipeline_id AND status = 'lost'
      AND lost_at >= v_from AND lost_at < v_to
      AND (p_responsible_user_id IS NULL OR responsible_user_id = p_responsible_user_id)),
    'lost_value', (SELECT COALESCE(sum(value), 0) FROM public.crm_opportunities WHERE pipeline_id = v_pipeline_id AND status = 'lost'
      AND lost_at >= v_from AND lost_at < v_to
      AND (p_responsible_user_id IS NULL OR responsible_user_id = p_responsible_user_id))
  ) INTO v_total;

  -- Conversion rate (only finalized)
  SELECT jsonb_build_object(
    'won', (v_total->>'won_count')::INT,
    'lost', (v_total->>'lost_count')::INT,
    'rate', CASE WHEN ((v_total->>'won_count')::INT + (v_total->>'lost_count')::INT) > 0
      THEN ROUND(((v_total->>'won_count')::NUMERIC / ((v_total->>'won_count')::INT + (v_total->>'lost_count')::INT)) * 100, 1)
      ELSE 0 END
  ) INTO v_conversion;

  -- Stage metrics
  SELECT COALESCE(jsonb_agg(row_to_json(sm)), '[]'::jsonb) INTO v_stage_metrics
  FROM (
    SELECT
      st.id AS stage_id,
      st.name AS stage_name,
      st.position,
      (SELECT count(*) FROM public.crm_opportunity_events e
        WHERE e.event_type = 'stage_changed'
        AND (e.event_data->>'to_stage_id')::UUID = st.id
        AND e.created_at >= v_from AND e.created_at < v_to
        AND (p_responsible_user_id IS NULL OR EXISTS (
          SELECT 1 FROM public.crm_opportunities o2 WHERE o2.id = e.opportunity_id AND o2.responsible_user_id = p_responsible_user_id
        ))
      ) AS entered_count,
      (SELECT count(*) FROM public.crm_opportunity_events e
        WHERE e.event_type = 'stage_changed'
        AND (e.event_data->>'from_stage_id')::UUID = st.id
        AND e.created_at >= v_from AND e.created_at < v_to
      ) AS exited_count,
      (SELECT count(*) FROM public.crm_opportunities o2
        WHERE o2.stage_id = st.id AND o2.status = 'open'
        AND (p_responsible_user_id IS NULL OR o2.responsible_user_id = p_responsible_user_id)
      ) AS current_count,
      COALESCE((SELECT ROUND(AVG(
        EXTRACT(EASECOND FROM (
          COALESCE(
            (SELECT MIN(e2.created_at) FROM public.crm_opportunity_events e2
              WHERE e2.opportunity_id = e.opportunity_id AND e2.event_type = 'stage_changed'
              AND (e2.event_data->>'from_stage_id')::UUID = st.id),
            (SELECT MAX(e2.created_at) FROM public.crm_opportunity_events e2
              WHERE e2.opportunity_id = e.opportunity_id AND e2.event_type IN ('marked_won','marked_lost'))
          )
        - e.created_at
      )) / 86400.0), 1)
      FROM public.crm_opportunity_events e
      WHERE e.event_type = 'stage_changed'
      AND (e.event_data->>'to_stage_id')::UUID = st.id
      AND e.created_at >= v_from AND e.created_at < v_to
      ), 0) AS avg_duration_days
    FROM public.crm_stages st
    WHERE st.pipeline_id = v_pipeline_id AND st.active = true
    ORDER BY st.position
  ) sm;

  -- Loss reasons
  SELECT COALESCE(jsonb_agg(row_to_json(lr)), '[]'::jsonb) INTO v_loss_reasons
  FROM (
    SELECT
      COALESCE(lr2.id, '00000000-0000-0000-0000-000000000000'::UUID) AS reason_id,
      COALESCE(lr2.name, o2.lost_reason, 'Não informado') AS reason_name,
      count(*) AS count,
      COALESCE(sum(o2.value), 0) AS value,
      CASE WHEN (SELECT count(*) FROM public.crm_opportunities o3
        WHERE o3.pipeline_id = v_pipeline_id AND o3.status = 'lost'
        AND o3.lost_at >= v_from AND o3.lost_at < v_to) > 0
      THEN ROUND((count(*)::NUMERIC / (SELECT count(*) FROM public.crm_opportunities o3
        WHERE o3.pipeline_id = v_pipeline_id AND o3.status = 'lost'
        AND o3.lost_at >= v_from AND o3.lost_at < v_to)) * 100, 1)
      ELSE 0 END AS percentage
    FROM public.crm_opportunities o2
    LEFT JOIN public.crm_loss_reasons lr2 ON lr2.id = o2.lost_reason_id
    WHERE o2.pipeline_id = v_pipeline_id AND o2.status = 'lost'
    AND o2.lost_at >= v_from AND o2.lost_at < v_to
    AND (p_responsible_user_id IS NULL OR o2.responsible_user_id = p_responsible_user_id)
    GROUP BY lr2.id, lr2.name, o2.lost_reason
    ORDER BY count(*) DESC
  ) lr;

  -- Forecast by month
  SELECT COALESCE(jsonb_agg(row_to_json(f)), '[]'::jsonb) INTO v_forecast
  FROM (
    SELECT
      to_char(d, 'YYYY-MM') AS month,
      to_char(d, 'Mon YYYY') AS month_label,
      COALESCE(SUM(CASE WHEN o2.status = 'open' AND o2.expected_close_date >= d AND o2.expected_close_date < d + interval '1 month'
        THEN o2.value ELSE 0 END), 0) AS total_value,
      COALESCE(SUM(CASE WHEN o2.status = 'open' AND o2.expected_close_date >= d AND o2.expected_close_date < d + interval '1 month'
        THEN o2.value * o2.probability / 100.0 ELSE 0 END), 0) AS weighted_value,
      count(CASE WHEN o2.status = 'open' AND o2.expected_close_date >= d AND o2.expected_close_date < d + interval '1 month'
        THEN 1 END) AS opportunity_count
    FROM generate_series(date_trunc('month', now()), date_trunc('month', now()) + interval '5 months', interval '1 month') d
    LEFT JOIN public.crm_opportunities o2 ON o2.pipeline_id = v_pipeline_id
    AND (p_responsible_user_id IS NULL OR o2.responsible_user_id = p_responsible_user_id)
    GROUP BY d
    ORDER BY d
  ) f;

  v_result := jsonb_build_object(
    'totals', v_total,
    'conversion', v_conversion,
    'stage_metrics', v_stage_metrics,
    'loss_reasons', v_loss_reasons,
    'forecast', v_forecast
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_crm_pipeline_analytics TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_crm_pipeline_analytics FROM PUBLIC, anon;

-- ============================================================
-- 6. RLS: crm_loss_reasons admin write only
-- ============================================================
DROP POLICY IF EXISTS "Admin write crm_loss_reasons" ON public.crm_loss_reasons;

CREATE POLICY "Admin write crm_loss_reasons"
  ON public.crm_loss_reasons FOR ALL
  TO authenticated
  USING ( EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND active = true) )
  WITH CHECK ( EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND active = true) );

-- ============================================================
-- 7. Index for aging queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_crm_opps_stage_entered
  ON public.crm_opportunities(stage_entered_at);

CREATE INDEX IF NOT EXISTS idx_crm_opps_expected_close
  ON public.crm_opportunities(expected_close_date);

CREATE INDEX IF NOT EXISTS idx_crm_opps_status_pipeline
  ON public.crm_opportunities(status, pipeline_id);
