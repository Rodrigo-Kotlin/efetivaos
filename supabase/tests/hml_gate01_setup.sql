-- ==========================================================================
-- FINANCE HOMOLOGATION GATE 01 — Fixture Setup
-- ==========================================================================

SELECT 'INITIAL_STATE' as step,
  (SELECT count(*) FROM public.financial_transactions) as tx_count,
  (SELECT count(*) FROM public.financial_journal_entries) as je_count,
  (SELECT count(*) FROM public.financial_journal_lines) as jl_count;

-- SCENARIO A — Cash Revenue
SELECT public.create_financial_transaction(
  'HML-FIN-001 Receita a vista'::text, current_date, current_date,
  'RECEITA'::public.financial_movement_type, 1000::numeric,
  (SELECT id FROM public.financial_categories WHERE movement_type='RECEITA' AND active=true LIMIT 1),
  (SELECT id FROM public.financial_accounts WHERE name ILIKE '%cora%' AND active=true LIMIT 1),
  NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
  NULL::date, current_date, NULL::text, NULL::numeric, NULL::numeric,
  'HML-FIN-001'::text);

-- SCENARIO B — Cash Expense
SELECT public.create_financial_transaction(
  'HML-FIN-002 Despesa a vista'::text, current_date, current_date,
  'DESPESA'::public.financial_movement_type, 200::numeric,
  (SELECT id FROM public.financial_categories WHERE movement_type='DESPESA' AND active=true LIMIT 1),
  NULL::uuid,
  (SELECT id FROM public.financial_accounts WHERE name ILIKE '%cora%' AND active=true LIMIT 1),
  NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
  NULL::date, current_date, NULL::text, NULL::numeric, NULL::numeric,
  'HML-FIN-002'::text);

-- SCENARIO C — Credit Revenue (A prazo)
SELECT public.create_financial_transaction(
  'HML-FIN-003 Receita a prazo'::text, current_date, current_date,
  'RECEITA'::public.financial_movement_type, 500::numeric,
  (SELECT id FROM public.financial_categories WHERE movement_type='RECEITA' AND active=true LIMIT 1),
  (SELECT id FROM public.financial_accounts WHERE name ILIKE '%cora%' AND active=true LIMIT 1),
  NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
  (current_date + interval '30 days')::date, NULL::date, NULL::text, NULL::numeric, NULL::numeric,
  'HML-FIN-003'::text);

-- SCENARIO C.1 — Edit pending 500 -> 550
-- new overload: (uuid, int, text, date, date, mvt_type, numeric, uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric)
SELECT public.update_financial_transaction(
  (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-003 Receita a prazo'),
  1::integer, NULL::text, NULL::date, NULL::date, NULL::public.financial_movement_type,
  550::numeric,
  NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
  NULL::date, NULL::text, NULL::numeric, NULL::numeric);

-- SCENARIO C.2 — Settle (receive)
SELECT public.settle_financial_transaction(
  (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-003 Receita a prazo'),
  current_date,
  (SELECT id FROM public.financial_accounts WHERE name ILIKE '%cora%' AND active=true LIMIT 1),
  NULL::uuid);

-- SCENARIO D — Credit Expense (A prazo)
SELECT public.create_financial_transaction(
  'HML-FIN-004 Despesa a prazo'::text, current_date, current_date,
  'DESPESA'::public.financial_movement_type, 300::numeric,
  (SELECT id FROM public.financial_categories WHERE movement_type='DESPESA' AND active=true LIMIT 1),
  NULL::uuid,
  (SELECT id FROM public.financial_accounts WHERE name ILIKE '%cora%' AND active=true LIMIT 1),
  NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
  (current_date + interval '15 days')::date, NULL::date, NULL::text, NULL::numeric, NULL::numeric,
  'HML-FIN-004'::text);

-- SCENARIO D.1 — Edit 300 -> 325
SELECT public.update_financial_transaction(
  (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-004 Despesa a prazo'),
  1::integer, NULL::text, NULL::date, NULL::date, NULL::public.financial_movement_type,
  325::numeric,
  NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
  NULL::date, NULL::text, NULL::numeric, NULL::numeric);

-- SCENARIO D.2 — Settle (pay)
SELECT public.settle_financial_transaction(
  (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-004 Despesa a prazo'),
  current_date,
  (SELECT id FROM public.financial_accounts WHERE name ILIKE '%cora%' AND active=true LIMIT 1),
  NULL::uuid);

-- SCENARIO E — Cancel pending revenue
SELECT public.create_financial_transaction(
  'HML-FIN-005 Receita pending para cancelar'::text, current_date, current_date,
  'RECEITA'::public.financial_movement_type, 400::numeric,
  (SELECT id FROM public.financial_categories WHERE movement_type='RECEITA' AND active=true LIMIT 1),
  (SELECT id FROM public.financial_accounts WHERE name ILIKE '%cora%' AND active=true LIMIT 1),
  NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
  (current_date + interval '10 days')::date, NULL::date, NULL::text, NULL::numeric, NULL::numeric,
  'HML-FIN-005'::text);

SELECT public.cancel_financial_transaction(
  (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-005 Receita pending para cancelar'),
  'Homologation test cancel'::text);

-- SCENARIO F — Cash Reversal
SELECT public.create_financial_transaction(
  'HML-FIN-006 Receita a vista para estornar'::text, current_date, current_date,
  'RECEITA'::public.financial_movement_type, 250::numeric,
  (SELECT id FROM public.financial_categories WHERE movement_type='RECEITA' AND active=true LIMIT 1),
  (SELECT id FROM public.financial_accounts WHERE name ILIKE '%cora%' AND active=true LIMIT 1),
  NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
  NULL::date, current_date, NULL::text, NULL::numeric, NULL::numeric,
  'HML-FIN-006'::text);

SELECT public.cancel_financial_transaction(
  (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-006 Receita a vista para estornar'),
  'Homologation test cash reversal'::text);

-- SCENARIO G — Credit Settled Reversal
SELECT public.create_financial_transaction(
  'HML-FIN-007 Receita a prazo para estornar'::text, current_date, current_date,
  'RECEITA'::public.financial_movement_type, 600::numeric,
  (SELECT id FROM public.financial_categories WHERE movement_type='RECEITA' AND active=true LIMIT 1),
  (SELECT id FROM public.financial_accounts WHERE name ILIKE '%cora%' AND active=true LIMIT 1),
  NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
  (current_date + interval '20 days')::date, NULL::date, NULL::text, NULL::numeric, NULL::numeric,
  'HML-FIN-007'::text);

SELECT public.settle_financial_transaction(
  (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-007 Receita a prazo para estornar'),
  current_date,
  (SELECT id FROM public.financial_accounts WHERE name ILIKE '%cora%' AND active=true LIMIT 1),
  NULL::uuid);

SELECT public.cancel_financial_transaction(
  (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-007 Receita a prazo para estornar'),
  'Homologation test settled reversal'::text);

-- SCENARIO 17 — Different financial account
SELECT public.create_financial_transaction(
  'HML-FIN-008 Receita conta B'::text, current_date, current_date,
  'RECEITA'::public.financial_movement_type, 150::numeric,
  (SELECT id FROM public.financial_categories WHERE movement_type='RECEITA' AND active=true LIMIT 1),
  (SELECT id FROM public.financial_accounts WHERE name ILIKE '%nu%' AND active=true LIMIT 1),
  NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
  NULL::date, current_date, NULL::text, NULL::numeric, NULL::numeric,
  'HML-FIN-008'::text);

SELECT 'FIXTURES_CREATED' as status;
