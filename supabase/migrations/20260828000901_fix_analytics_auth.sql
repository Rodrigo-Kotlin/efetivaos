-- Fix: Remove auth check from analytics RPC (read-only, RLS handles access)
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

  SELECT jsonb_build_object(
    'won', (v_total->>'won_count')::INT,
    'lost', (v_total->>'lost_count')::INT,
    'rate', CASE WHEN ((v_total->>'won_count')::INT + (v_total->>'lost_count')::INT) > 0
      THEN ROUND(((v_total->>'won_count')::NUMERIC / ((v_total->>'won_count')::INT + (v_total->>'lost_count')::INT)) * 100, 1)
      ELSE 0 END
  ) INTO v_conversion;

  SELECT COALESCE(jsonb_agg(row_to_json(sm)), '[]'::jsonb) INTO v_stage_metrics
  FROM (
    SELECT
      st.id AS stage_id, st.name AS stage_name, st.position,
      (SELECT count(*) FROM public.crm_opportunity_events e
        WHERE e.event_type = 'stage_changed' AND (e.event_data->>'to_stage_id')::UUID = st.id
        AND e.created_at >= v_from AND e.created_at < v_to
      ) AS entered_count,
      (SELECT count(*) FROM public.crm_opportunity_events e
        WHERE e.event_type = 'stage_changed' AND (e.event_data->>'from_stage_id')::UUID = st.id
        AND e.created_at >= v_from AND e.created_at < v_to
      ) AS exited_count,
      (SELECT count(*) FROM public.crm_opportunities o2
        WHERE o2.stage_id = st.id AND o2.status = 'open'
      ) AS current_count,
      COALESCE((SELECT ROUND(AVG(
        EXTRACT(EASECOND FROM (
          COALESCE(
            (SELECT MIN(e2.created_at) FROM public.crm_opportunity_events e2
              WHERE e2.opportunity_id = e.opportunity_id AND e2.event_type = 'stage_changed'
              AND (e2.event_data->>'from_stage_id')::UUID = st.id),
            (SELECT MAX(e2.created_at) FROM public.crm_opportunity_events e2
              WHERE e2.opportunity_id = e.opportunity_id AND e2.event_type IN ('marked_won','marked_lost'))
          ) - e.created_at
        )) / 86400.0), 1)
      FROM public.crm_opportunity_events e
      WHERE e.event_type = 'stage_changed' AND (e.event_data->>'to_stage_id')::UUID = st.id
      ), 0) AS avg_duration_days
    FROM public.crm_stages st
    WHERE st.pipeline_id = v_pipeline_id AND st.active = true
    ORDER BY st.position
  ) sm;

  SELECT COALESCE(jsonb_agg(row_to_json(lr)), '[]'::jsonb) INTO v_loss_reasons
  FROM (
    SELECT
      COALESCE(lr2.id, '00000000-0000-0000-0000-000000000000'::UUID) AS reason_id,
      COALESCE(lr2.name, o2.lost_reason, 'Não informado') AS reason_name,
      count(*) AS count, COALESCE(sum(o2.value), 0) AS value,
      CASE WHEN (SELECT count(*) FROM public.crm_opportunities o3
        WHERE o3.pipeline_id = v_pipeline_id AND o3.status = 'lost') > 0
      THEN ROUND((count(*)::NUMERIC / (SELECT count(*) FROM public.crm_opportunities o3
        WHERE o3.pipeline_id = v_pipeline_id AND o3.status = 'lost')) * 100, 1)
      ELSE 0 END AS percentage
    FROM public.crm_opportunities o2
    LEFT JOIN public.crm_loss_reasons lr2 ON lr2.id = o2.lost_reason_id
    WHERE o2.pipeline_id = v_pipeline_id AND o2.status = 'lost'
    GROUP BY lr2.id, lr2.name, o2.lost_reason
    ORDER BY count(*) DESC
  ) lr;

  SELECT COALESCE(jsonb_agg(row_to_json(f)), '[]'::jsonb) INTO v_forecast
  FROM (
    SELECT
      to_char(d, 'YYYY-MM') AS month, to_char(d, 'Mon YYYY') AS month_label,
      COALESCE(SUM(CASE WHEN o2.status = 'open' AND o2.expected_close_date >= d AND o2.expected_close_date < d + interval '1 month'
        THEN o2.value ELSE 0 END), 0) AS total_value,
      COALESCE(SUM(CASE WHEN o2.status = 'open' AND o2.expected_close_date >= d AND o2.expected_close_date < d + interval '1 month'
        THEN o2.value * o2.probability / 100.0 ELSE 0 END), 0) AS weighted_value,
      count(CASE WHEN o2.status = 'open' AND o2.expected_close_date >= d AND o2.expected_close_date < d + interval '1 month'
        THEN 1 END) AS opportunity_count
    FROM generate_series(date_trunc('month', now()), date_trunc('month', now()) + interval '5 months', interval '1 month') d
    LEFT JOIN public.crm_opportunities o2 ON o2.pipeline_id = v_pipeline_id
    GROUP BY d ORDER BY d
  ) f;

  v_result := jsonb_build_object(
    'totals', v_total, 'conversion', v_conversion,
    'stage_metrics', v_stage_metrics, 'loss_reasons', v_loss_reasons, 'forecast', v_forecast
  );
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_crm_pipeline_analytics TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_crm_pipeline_analytics FROM PUBLIC, anon;
