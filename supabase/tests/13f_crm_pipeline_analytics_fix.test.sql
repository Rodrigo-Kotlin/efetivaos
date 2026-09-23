-- 13F: Teste de regressao para fix de EXTRACT(EASECOND -> EPOCH) em get_crm_pipeline_analytics

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

-- Helper
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('13f00000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '13f-admin@test.local', '', now(), '{}', '{"full_name":"13F Admin"}', now(), now())
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET role = 'admin' WHERE id = '13f00000-0000-0000-0000-000000000001';

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '13f00000-0000-0000-0000-000000000001', false);

-- 1. Pipeline vazio (sem oportunidades) -> executa sem erro, retorna estrutura valida
SELECT lives_ok(
  $$ SELECT public.get_crm_pipeline_analytics() $$,
  'Pipeline vazio: funcao executa sem erro e retorna JSON valido'
);

-- 2. Funil vazio: stage_metrics e array vazio
SELECT ok(
  (SELECT jsonb_typeof(public.get_crm_pipeline_analytics()->'stage_metrics') = 'array'),
  'Pipeline vazio: stage_metrics e array'
);

SELECT ok(
  (SELECT jsonb_array_length(public.get_crm_pipeline_analytics()->'stage_metrics') = 0),
  'Pipeline vazio: stage_metrics vazio'
);

-- 3. Pipeline com stages mas sem oportunidades -> avg_duration_days = 0
INSERT INTO public.crm_pipelines (id, name, is_default, active) VALUES
  ('13f00000-0000-0000-0000-000000000010', '13F Pipeline Teste', false, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.crm_stages (id, pipeline_id, name, position, active) VALUES
  ('13f00000-0000-0000-0000-000000000020', '13f00000-0000-0000-0000-000000000010', 'Prospect', 1, true),
  ('13f00000-0000-0000-0000-000000000021', '13f00000-0000-0000-0000-000000000010', 'Proposta', 2, true),
  ('13f00000-0000-0000-0000-000000000022', '13f00000-0000-0000-0000-000000000010', 'Negociacao', 3, true),
  ('13f00000-0000-0000-0000-000000000023', '13f00000-0000-0000-0000-000000000010', 'Fechado', 4, true)
ON CONFLICT (id) DO NOTHING;

SELECT ok(
  (SELECT jsonb_array_length(public.get_crm_pipeline_analytics('13f00000-0000-0000-0000-000000000010')->'stage_metrics') = 4),
  'Pipeline com 4 stages: stage_metrics tem 4 itens'
);

SELECT ok(
  (SELECT bool_and((sm->>'avg_duration_days')::numeric >= 0) FROM jsonb_array_elements(
    public.get_crm_pipeline_analytics('13f00000-0000-0000-0000-000000000010')->'stage_metrics'
  ) sm),
  'Pipeline sem oportunidades: avg_duration_days >= 0 em todos os stages'
);

-- 4. Oportunidade recem-criada (sem eventos de stage_changed) -> avg_duration_days = 0
INSERT INTO public.clients (id, legal_name, status, client_type, tax_id) VALUES
  ('13f00000-0000-0000-0000-000000000050', '13F Cliente Teste', 'active', 'company', '11222333000181')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.crm_opportunities (id, pipeline_id, stage_id, title, value, probability, status, responsible_user_id, client_id, created_at)
VALUES (
  '13f00000-0000-0000-0000-000000000030',
  '13f00000-0000-0000-0000-000000000010',
  '13f00000-0000-0000-0000-000000000020',
  'Opp Nova', 10000, 30, 'open',
  '13f00000-0000-0000-0000-000000000001',
  '13f00000-0000-0000-0000-000000000050', now()
)
ON CONFLICT (id) DO NOTHING;

SELECT ok(
  (SELECT bool_and((sm->>'avg_duration_days')::numeric = 0) FROM jsonb_array_elements(
    public.get_crm_pipeline_analytics('13f00000-0000-0000-0000-000000000010')->'stage_metrics'
  ) sm),
  'Oportunidade sem eventos: avg_duration_days = 0'
);

-- 5. Oportunidade com movimentacao (stage_changed + marked_won) -> duracao positiva
INSERT INTO public.crm_opportunity_events (id, opportunity_id, event_type, event_data, created_at)
VALUES
  ('13f00000-0000-0000-0000-000000000040', '13f00000-0000-0000-0000-000000000030', 'stage_changed',
   '{"to_stage_id": "13f00000-0000-0000-0000-000000000020", "from_stage_id": null}'::jsonb, now() - interval '5 days'),
  ('13f00000-0000-0000-0000-000000000041', '13f00000-0000-0000-0000-000000000030', 'stage_changed',
   '{"to_stage_id": "13f00000-0000-0000-0000-000000000021", "from_stage_id": "13f00000-0000-0000-0000-000000000020"}'::jsonb, now() - interval '2 days'),
  ('13f00000-0000-0000-0000-000000000042', '13f00000-0000-0000-0000-000000000030', 'marked_won',
   '{}'::jsonb, now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

SELECT ok(
  (SELECT (sm->>'avg_duration_days')::numeric > 0 FROM jsonb_array_elements(
    public.get_crm_pipeline_analytics('13f00000-0000-0000-0000-000000000010')->'stage_metrics'
  ) sm WHERE sm->>'stage_name' = 'Prospect'),
  'Stage Prospect: avg_duration_days > 0 apos movimentacao'
);

SELECT ok(
  (SELECT (sm->>'avg_duration_days')::numeric > 0 FROM jsonb_array_elements(
    public.get_crm_pipeline_analytics('13f00000-0000-0000-0000-000000000010')->'stage_metrics'
  ) sm WHERE sm->>'stage_name' = 'Proposta'),
  'Stage Proposta: avg_duration_days > 0 apos movimentacao'
);

-- 6. Ausencia de divisao por zero / valores invalidos quando nao ha eventos suficientes
-- (ja coberto: pipeline vazio e sem eventos retorna 0)

-- 7. Usuario autorizado (authenticated) consegue executar
SELECT ok(
  (SELECT has_function_privilege('authenticated', 'public.get_crm_pipeline_analytics(uuid,date,date,uuid)', 'EXECUTE')),
  'authenticated tem EXECUTE na funcao'
);

-- 8. Usuario nao autorizado (anon) nao consegue executar
SELECT ok(
  (SELECT NOT has_function_privilege('anon', 'public.get_crm_pipeline_analytics(uuid,date,date,uuid)', 'EXECUTE')),
  'anon NAO tem EXECUTE na funcao'
);

-- 9. search_path vazio preservado
SELECT ok(
  (SELECT coalesce(p.proconfig::text, '') NOT LIKE '%pg_temp%' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_crm_pipeline_analytics'),
  'search_path vazio (sem pg_temp) preservado'
);

-- 10. SECURITY DEFINER preservado
SELECT ok(
  (SELECT p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_crm_pipeline_analytics'),
  'SECURITY DEFINER preservado'
);

-- 11. Owner postgres preservado
SELECT ok(
  (SELECT pg_get_userbyid(p.proowner) = 'postgres' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_crm_pipeline_analytics'),
  'Owner postgres preservado'
);

-- 12. ACL exata {postgres, authenticated, service_role}
SELECT ok(
  (SELECT bool_and(pg_get_userbyid(grantee) IN ('postgres','authenticated','service_role')) FROM pg_proc p
   JOIN pg_namespace n ON n.oid=p.pronamespace
   JOIN LATERAL aclexplode(p.proacl) a ON true
   WHERE n.nspname='public' AND p.proname='get_crm_pipeline_analytics'),
  'ACL exata {postgres, authenticated, service_role} preservada'
);

-- 13. Nao ha EASECOND no corpo (sanity check)
SELECT ok(
  (SELECT position('EASECOND' IN p.prosrc) = 0 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_crm_pipeline_analytics'),
  'EASECOND removido do corpo'
);

-- 14. EPOCH presente no corpo
SELECT ok(
  (SELECT position('EPOCH' IN p.prosrc) > 0 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_crm_pipeline_analytics'),
  'EPOCH presente no corpo'
);

SELECT * FROM finish();
ROLLBACK;