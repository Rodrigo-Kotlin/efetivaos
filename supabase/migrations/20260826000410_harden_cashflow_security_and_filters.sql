-- ============================================================================
-- ETAPA 08D.1 — Corrective migration: security hardening + summary RPCs
-- Migration: 20260826000410_harden_cashflow_security_and_filters.sql
--
-- Revokes PUBLIC/ANON on 08D objects.
-- Creates parameterized RPCs for cashflow summary and DFC statement.
-- Original views remain for backward compatibility.
-- ============================================================================

-- 1. Revoke PUBLIC and ANON on 08D views
REVOKE SELECT ON public.financial_cashflow_realized_v  FROM PUBLIC;
REVOKE SELECT ON public.financial_cashflow_forecast_v  FROM PUBLIC;
REVOKE SELECT ON public.financial_cashflow_statement_v FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cashflow_13_week_projection(date) FROM PUBLIC;

-- Revoke explicit anon grants (Postgres 'anon' role if present)
DO $$
BEGIN
  REVOKE SELECT ON public.financial_cashflow_realized_v  FROM anon;
  REVOKE SELECT ON public.financial_cashflow_forecast_v  FROM anon;
  REVOKE SELECT ON public.financial_cashflow_statement_v FROM anon;
  REVOKE EXECUTE ON FUNCTION public.cashflow_13_week_projection(date) FROM anon;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- 2. cashflow_opening_balance(p_date, p_account_id)
--    Returns the opening balance of cash accounts before p_date.
--    If p_account_id is provided, only that account is considered.
CREATE OR REPLACE FUNCTION public.cashflow_opening_balance(
  p_date date DEFAULT current_date,
  p_account_id uuid DEFAULT NULL
)
RETURNS TABLE (opening_balance numeric(15,2))
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(SUM(jl.debit - jl.credit), 0)::numeric(15,2)
  FROM public.financial_journal_entries je
  JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.is_cash = true
    AND je.entry_date < p_date
    AND (p_account_id IS NULL OR ca.id = p_account_id);
$$;

COMMENT ON FUNCTION public.cashflow_opening_balance(date, uuid) IS
  'Saldo de caixa anterior a p_date. Filtro opcional por conta.';

GRANT EXECUTE ON FUNCTION public.cashflow_opening_balance(date, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cashflow_opening_balance(date, uuid) FROM PUBLIC;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.cashflow_opening_balance(date, uuid) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- 3. get_cash_flow_statement(p_from, p_to, p_cost_center_id, p_service_line_id)
--    Returns the 6-row DFC statement for the given period.
--    opening = cash balance before p_from
--    activities = realized cash movements in [p_from, p_to]
--    variation = sum of class net amounts
--    closing = opening + variation
CREATE OR REPLACE FUNCTION public.get_cash_flow_statement(
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL,
  p_cost_center_id   uuid DEFAULT NULL,
  p_service_line_id  uuid DEFAULT NULL
)
RETURNS TABLE (
  dfc_class       text,
  dfc_class_label text,
  inflows         numeric(15,2),
  outflows        numeric(15,2),
  net_amount      numeric(15,2),
  opening_balance numeric(15,2),
  sort_order      integer
)
LANGUAGE sql STABLE
AS $$
  WITH period_bounds AS (
    SELECT
      COALESCE(p_from, '1900-01-01'::date) AS p_from,
      COALESCE(p_to, current_date)          AS p_to
  ),
  opening AS (
    SELECT public.cashflow_opening_balance(pb.p_from, NULL) AS ob
    FROM period_bounds pb
  ),
  cf AS (
    SELECT r.dfc_class::text AS dfc_class, r.direction, r.amount
    FROM public.financial_cashflow_realized_v r, period_bounds pb
    WHERE r.entry_date >= pb.p_from
      AND r.entry_date <= pb.p_to
      AND r.dfc_class IN ('OPERACIONAL','INVESTIMENTO','FINANCIAMENTO')
      AND (p_cost_center_id IS NULL OR r.cost_center_id = p_cost_center_id)
      AND (p_service_line_id IS NULL OR r.service_line_id = p_service_line_id)
  ),
  agg AS (
    SELECT
      dfc_class,
      SUM(CASE WHEN direction = 'INFLOW'  THEN amount ELSE 0 END) AS inflows,
      SUM(CASE WHEN direction = 'OUTFLOW' THEN amount ELSE 0 END) AS outflows,
      SUM(CASE WHEN direction = 'INFLOW'  THEN amount ELSE -amount END) AS net_amount
    FROM cf
    GROUP BY dfc_class
  ),
  classes(dfc_class, dfc_class_label, sort_order) AS (
    VALUES
      ('OPERACIONAL'::text,   'Atividades Operacionais'::text,    1),
      ('INVESTIMENTO'::text,  'Atividades de Investimento'::text, 2),
      ('FINANCIAMENTO'::text, 'Atividades de Financiamento'::text,3)
  )
  SELECT c.dfc_class, c.dfc_class_label,
    COALESCE(a.inflows, 0) AS inflows, COALESCE(a.outflows, 0) AS outflows,
    COALESCE(a.net_amount, 0) AS net_amount, o.ob AS opening_balance, c.sort_order
  FROM classes c CROSS JOIN opening o
  LEFT JOIN agg a ON a.dfc_class = c.dfc_class

  UNION ALL
  SELECT 'SALDO_INICIAL'::text, 'Saldo Inicial de Caixa'::text,
    o.ob, 0, o.ob, o.ob, 4 FROM opening o

  UNION ALL
  SELECT 'VARIACAO'::text, 'Variacao Liquida de Caixa'::text,
    0, 0, COALESCE((SELECT SUM(net_amount) FROM agg), 0), o.ob, 5 FROM opening o

  UNION ALL
  SELECT 'SALDO_FINAL'::text, 'Saldo Final de Caixa'::text,
    0, 0, o.ob + COALESCE((SELECT SUM(net_amount) FROM agg), 0),
    o.ob, 6 FROM opening o

  ORDER BY sort_order;
$$;

COMMENT ON FUNCTION public.get_cash_flow_statement(date, date, uuid, uuid) IS
  'DFC com filtros reais. Parametros: periodo, centro de custo, linha de servico.';

GRANT EXECUTE ON FUNCTION public.get_cash_flow_statement(date, date, uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_cash_flow_statement(date, date, uuid, uuid) FROM PUBLIC;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_cash_flow_statement(date, date, uuid, uuid) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- 4. Update realized view to include chart_account_ids (array of UUIDs for account filtering)
-- Must drop statement view first (depends on realized view)
DROP VIEW IF EXISTS public.financial_cashflow_statement_v;
DROP VIEW IF EXISTS public.financial_cashflow_realized_v;
CREATE OR REPLACE VIEW public.financial_cashflow_realized_v AS
WITH cash_lines AS (
  SELECT
    je.id AS entry_id, je.transaction_id, je.entry_date, je.entry_type,
    je.description AS entry_description, je.competence_date, je.status, je.created_at,
    jl.id AS line_id, jl.chart_account_id,
    ca.code AS chart_account_code, ca.name AS chart_account_name,
    jl.debit, jl.credit,
    t.description AS transaction_description, t.movement_type,
    t.amount AS transaction_amount, t.category_id, cat.name AS category_name,
    cat.cash_flow_class AS category_dfc_class,
    t.cost_center_id, cc.name AS cost_center_name,
    t.service_line_id, sl.name AS service_line_name,
    t.party_id, p.name AS party_name,
    t.origin_account_id, t.destination_account_id,
    t.payment_method_id, pm.name AS payment_method_name,
    t.notes AS transaction_notes
  FROM public.financial_journal_entries je
  JOIN public.financial_journal_lines jl       ON jl.entry_id = je.id
  JOIN public.financial_chart_accounts ca      ON ca.id = jl.chart_account_id
  JOIN public.financial_transactions t         ON t.id = je.transaction_id
  LEFT JOIN public.financial_categories cat    ON cat.id = t.category_id
  LEFT JOIN public.financial_cost_centers cc   ON cc.id = t.cost_center_id
  LEFT JOIN public.financial_service_lines sl  ON sl.id = t.service_line_id
  LEFT JOIN public.financial_parties p         ON p.id = t.party_id
  LEFT JOIN public.financial_payment_methods pm ON pm.id = t.payment_method_id
  WHERE ca.is_cash = true
),
entry_agg AS (
  SELECT
    entry_id, transaction_id, entry_date, entry_type, entry_description,
    competence_date, status, created_at,
    transaction_description, movement_type, transaction_amount,
    category_id, category_name, category_dfc_class,
    cost_center_id, cost_center_name,
    service_line_id, service_line_name,
    party_id, party_name,
    origin_account_id, destination_account_id,
    payment_method_id, payment_method_name, transaction_notes,
    SUM(debit)  AS total_debit,
    SUM(credit) AS total_credit,
    SUM(debit - credit) AS cash_effect,
    COUNT(*)    AS line_count,
    STRING_AGG(DISTINCT chart_account_code, ', ' ORDER BY chart_account_code) AS cash_accounts,
    ARRAY_AGG(DISTINCT jl.chart_account_id) AS chart_account_ids
  FROM cash_lines jl
  GROUP BY
    entry_id, transaction_id, entry_date, entry_type, entry_description,
    competence_date, status, created_at, transaction_description,
    movement_type, transaction_amount, category_id, category_name,
    category_dfc_class, cost_center_id, cost_center_name,
    service_line_id, service_line_name, party_id, party_name,
    origin_account_id, destination_account_id, payment_method_id,
    payment_method_name, transaction_notes
)
SELECT
  entry_id, transaction_id, entry_date, entry_description,
  competence_date, status, created_at,
  transaction_description, movement_type, transaction_amount,
  category_id, category_name,
  cost_center_id, cost_center_name,
  service_line_id, service_line_name,
  party_id, party_name,
  payment_method_id, payment_method_name,
  cash_accounts, cash_effect,
  chart_account_ids,
  CASE WHEN cash_effect > 0 THEN 'INFLOW' ELSE 'OUTFLOW' END AS direction,
  CASE
    WHEN movement_type = 'TRANSFERENCIA' THEN 'TRANSFERENCIA'::public.financial_dfc_class
    WHEN movement_type IN ('EMPRESTIMO_RECEBIDO','EMPRESTIMO_PAGO','APORTE','RETIRADA')
      THEN 'FINANCIAMENTO'::public.financial_dfc_class
    WHEN movement_type = 'IMOBILIZADO'
      THEN 'INVESTIMENTO'::public.financial_dfc_class
    WHEN movement_type = 'SALDO_INICIAL'
      THEN 'NAO_CAIXA'::public.financial_dfc_class
    WHEN category_dfc_class IS NOT NULL
      THEN category_dfc_class
    ELSE 'OPERACIONAL'::public.financial_dfc_class
  END AS dfc_class,
  ABS(cash_effect) AS amount
FROM entry_agg
WHERE ABS(cash_effect) > 0.005;

COMMENT ON VIEW public.financial_cashflow_realized_v IS
  'Fluxo de caixa realizado por entry. Regime de caixa. Consolidado: transferencias = 0.';

GRANT SELECT ON public.financial_cashflow_realized_v TO authenticated;
DO $$ BEGIN REVOKE SELECT ON public.financial_cashflow_realized_v FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- 4b. Recreate statement view (depends on realized view)
CREATE OR REPLACE VIEW public.financial_cashflow_statement_v AS
WITH cf AS (
  SELECT * FROM public.financial_cashflow_realized_v
),
agg AS (
  SELECT
    dfc_class::text AS dfc_class,
    SUM(CASE WHEN direction = 'INFLOW'  THEN amount ELSE 0 END) AS inflows,
    SUM(CASE WHEN direction = 'OUTFLOW' THEN amount ELSE 0 END) AS outflows,
    SUM(CASE WHEN direction = 'INFLOW'  THEN amount ELSE -amount END) AS net_amount
  FROM cf
  WHERE dfc_class IN ('OPERACIONAL','INVESTIMENTO','FINANCIAMENTO')
  GROUP BY dfc_class
),
opening AS (
  SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS opening_balance
  FROM public.financial_journal_entries je
  JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.is_cash = true AND je.entry_date < current_date
),
classes(dfc_class, dfc_class_label, sort_order) AS (
  VALUES
    ('OPERACIONAL'::text,    'Atividades Operacionais'::text,     1),
    ('INVESTIMENTO'::text,   'Atividades de Investimento'::text,  2),
    ('FINANCIAMENTO'::text,  'Atividades de Financiamento'::text, 3)
)
SELECT c.dfc_class, c.dfc_class_label,
  COALESCE(a.inflows, 0) AS inflows, COALESCE(a.outflows, 0) AS outflows,
  COALESCE(a.net_amount, 0) AS net_amount, o.opening_balance, c.sort_order
FROM classes c CROSS JOIN opening o
LEFT JOIN agg a ON a.dfc_class = c.dfc_class

UNION ALL
SELECT 'SALDO_INICIAL'::text, 'Saldo Inicial de Caixa'::text,
  o.opening_balance, 0, o.opening_balance, o.opening_balance, 4 FROM opening o

UNION ALL
SELECT 'VARIACAO'::text, 'Variacao Liquida de Caixa'::text,
  0, 0, COALESCE((SELECT SUM(net_amount) FROM agg), 0), o.opening_balance, 5 FROM opening o

UNION ALL
SELECT 'SALDO_FINAL'::text, 'Saldo Final de Caixa'::text,
  0, 0, o.opening_balance + COALESCE((SELECT SUM(net_amount) FROM agg), 0),
  o.opening_balance, 6 FROM opening o

ORDER BY sort_order;

COMMENT ON VIEW public.financial_cashflow_statement_v IS
  'DFC - Demonstracao dos Fluxos de Caixa. Metodo Direto Gerencial. Regime de caixa.';

GRANT SELECT ON public.financial_cashflow_statement_v TO authenticated;
DO $$ BEGIN REVOKE SELECT ON public.financial_cashflow_statement_v FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- 5. cashflow_summary: KPI summary with opening, realized, closing, projected
CREATE OR REPLACE FUNCTION public.cashflow_summary(
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL,
  p_account_id      uuid DEFAULT NULL,
  p_cost_center_id  uuid DEFAULT NULL,
  p_service_line_id uuid DEFAULT NULL
)
RETURNS TABLE (
  opening_balance    numeric(15,2),
  realized_inflows   numeric(15,2),
  realized_outflows  numeric(15,2),
  closing_balance    numeric(15,2),
  projected_inflows  numeric(15,2),
  projected_outflows numeric(15,2),
  projected_balance  numeric(15,2)
)
LANGUAGE sql STABLE
AS $$
  WITH period AS (
    SELECT
      COALESCE(p_from, '1900-01-01'::date) AS p_from,
      COALESCE(p_to, current_date)          AS p_to
  ),
  ob AS (
    SELECT public.cashflow_opening_balance(pb.p_from, p_account_id) AS v
    FROM period pb
  ),
  realized AS (
    SELECT
      SUM(CASE WHEN r.direction = 'INFLOW'  THEN r.amount ELSE 0 END) AS inflows,
      SUM(CASE WHEN r.direction = 'OUTFLOW' THEN r.amount ELSE 0 END) AS outflows
    FROM public.financial_cashflow_realized_v r, period pb
    WHERE r.entry_date >= pb.p_from
      AND r.entry_date <= pb.p_to
      AND (p_account_id IS NULL OR p_account_id = ANY(r.chart_account_ids))
      AND (p_cost_center_id IS NULL OR r.cost_center_id = p_cost_center_id)
      AND (p_service_line_id IS NULL OR r.service_line_id = p_service_line_id)
  ),
  proj AS (
    SELECT
      SUM(CASE WHEN f.direction = 'INFLOW'  THEN f.projected_inflow ELSE 0 END) AS inflows,
      SUM(CASE WHEN f.direction = 'OUTFLOW' THEN f.projected_outflow ELSE 0 END) AS outflows
    FROM public.financial_cashflow_forecast_v f
    WHERE (p_cost_center_id IS NULL OR f.cost_center_id = p_cost_center_id)
      AND (p_service_line_id IS NULL OR f.service_line_id = p_service_line_id)
  )
  SELECT
    ob.v AS opening_balance,
    COALESCE(r.inflows, 0)  AS realized_inflows,
    COALESCE(r.outflows, 0) AS realized_outflows,
    ob.v + COALESCE(r.inflows, 0) - COALESCE(r.outflows, 0) AS closing_balance,
    COALESCE(p.inflows, 0)  AS projected_inflows,
    COALESCE(p.outflows, 0) AS projected_outflows,
    ob.v + COALESCE(r.inflows, 0) - COALESCE(r.outflows, 0)
      + COALESCE(p.inflows, 0) - COALESCE(p.outflows, 0) AS projected_balance
  FROM ob, realized r, proj p;
$$;

COMMENT ON FUNCTION public.cashflow_summary(date, date, uuid, uuid, uuid) IS
  'Resumo do fluxo de caixa: saldo inicial, realizado, projetado, saldo final.';

GRANT EXECUTE ON FUNCTION public.cashflow_summary(date, date, uuid, uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cashflow_summary(date, date, uuid, uuid, uuid) FROM PUBLIC;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.cashflow_summary(date, date, uuid, uuid, uuid) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;
