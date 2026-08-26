-- ============================================================================
-- ETAPA 08D: Fluxo de Caixa, Projecao 13 Semanas e DFC
-- Migration: 20260826000400_create_cashflow_dfc_views.sql
--
-- Regime de caixa. Nao cria novo ledger. Deriva de journal_entries + lines.
-- DFC classificacao via categories.cash_flow_class com fallback.
-- Transferencias internas neutralizadas no consolidado.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. financial_cashflow_realized_v
--    Fluxo de caixa realizado: cada entry que toca conta de caixa.
--    Consolidado por entry (transferencias = 0 liquido).
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.financial_cashflow_realized_v AS
WITH cash_lines AS (
  SELECT
    je.id                                                          AS entry_id,
    je.transaction_id,
    je.entry_date,
    je.entry_type,
    je.description                                                 AS entry_description,
    je.competence_date,
    je.status,
    je.created_at,
    jl.id                                                          AS line_id,
    jl.chart_account_id,
    ca.code                                                        AS chart_account_code,
    ca.name                                                        AS chart_account_name,
    jl.debit,
    jl.credit,
    t.description                                                  AS transaction_description,
    t.movement_type,
    t.amount                                                       AS transaction_amount,
    t.category_id,
    cat.name                                                       AS category_name,
    cat.cash_flow_class                                            AS category_dfc_class,
    t.cost_center_id,
    cc.name                                                        AS cost_center_name,
    t.service_line_id,
    sl.name                                                        AS service_line_name,
    t.party_id,
    p.name                                                         AS party_name,
    t.origin_account_id,
    t.destination_account_id,
    t.payment_method_id,
    pm.name                                                        AS payment_method_name,
    t.notes                                                        AS transaction_notes
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
    entry_id,
    transaction_id,
    entry_date,
    entry_type,
    entry_description,
    competence_date,
    status,
    created_at,
    transaction_description,
    movement_type,
    transaction_amount,
    category_id,
    category_name,
    category_dfc_class,
    cost_center_id,
    cost_center_name,
    service_line_id,
    service_line_name,
    party_id,
    party_name,
    origin_account_id,
    destination_account_id,
    payment_method_id,
    payment_method_name,
    transaction_notes,
    SUM(debit)  AS total_debit,
    SUM(credit) AS total_credit,
    SUM(debit - credit) AS cash_effect,
    COUNT(*)    AS line_count,
    STRING_AGG(DISTINCT chart_account_code, ', ' ORDER BY chart_account_code) AS cash_accounts
  FROM cash_lines
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
  entry_id,
  transaction_id,
  entry_date,
  entry_description,
  competence_date,
  status,
  created_at,
  transaction_description,
  movement_type,
  transaction_amount,
  category_id,
  category_name,
  cost_center_id,
  cost_center_name,
  service_line_id,
  service_line_name,
  party_id,
  party_name,
  payment_method_id,
  payment_method_name,
  cash_accounts,
  cash_effect,
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

-- ────────────────────────────────────────────────────────────────────────────
-- 2. financial_cashflow_forecast_v
--    Fluxo projetado: titulos pending com open_amount > 0.
--    Fonte: financial_receivables_v + financial_payables_v.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.financial_cashflow_forecast_v AS
SELECT
  transaction_id,
  description,
  movement_type,
  status,
  due_date,
  original_amount,
  open_amount,
  CASE
    WHEN movement_type = 'RECEITA' THEN 'INFLOW'
    ELSE 'OUTFLOW'
  END AS direction,
  CASE
    WHEN movement_type = 'RECEITA' THEN open_amount
    ELSE 0
  END AS projected_inflow,
  CASE
    WHEN movement_type IN ('DESPESA','IMOBILIZADO') THEN open_amount
    ELSE 0
  END AS projected_outflow,
  party_name,
  category_name,
  cost_center_id,
  cost_center_name,
  service_line_id,
  service_line_name,
  overdue,
  days_overdue,
  CASE
    WHEN overdue THEN 'VENCIDO'::text
    WHEN due_date <= current_date + interval '7 days' THEN '7 dias'::text
    WHEN due_date <= current_date + interval '14 days' THEN '14 dias'::text
    WHEN due_date <= current_date + interval '30 days' THEN '30 dias'::text
    ELSE 'Posteriores'::text
  END AS due_bucket
FROM (
  SELECT
    rv.transaction_id,
    rv.description,
    rv.movement_type,
    rv.status,
    rv.due_date,
    rv.original_amount,
    rv.open_amount,
    rv.party_name,
    rv.category_name,
    rv.cost_center_id,
    rv.cost_center_name,
    rv.service_line_id,
    rv.service_line_name,
    rv.overdue,
    rv.days_overdue
  FROM public.financial_receivables_v rv
  WHERE rv.status = 'pending' AND rv.open_amount > 0

  UNION ALL

  SELECT
    pv.transaction_id,
    pv.description,
    pv.movement_type,
    pv.status,
    pv.due_date,
    pv.original_amount,
    pv.open_amount,
    pv.party_name,
    pv.category_name,
    pv.cost_center_id,
    pv.cost_center_name,
    pv.service_line_id,
    pv.service_line_name,
    pv.overdue,
    pv.days_overdue
  FROM public.financial_payables_v pv
  WHERE pv.status = 'pending' AND pv.open_amount > 0
) forecast
ORDER BY due_date NULLS LAST, description;

COMMENT ON VIEW public.financial_cashflow_forecast_v IS
  'Fluxo projetado: titulos pending com open_amount > 0. Regime de caixa.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. cashflow_13_week_projection(p_from date)
--    Projecao de 13 semanas com buckets semanais.
--    Segunda a domingo. Saldo propagado.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cashflow_13_week_projection(p_from date DEFAULT current_date)
RETURNS TABLE (
  week_number     integer,
  week_start      date,
  week_end        date,
  week_label      text,
  opening_balance numeric(15,2),
  inflows         numeric(15,2),
  outflows        numeric(15,2),
  closing_balance numeric(15,2)
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_base_monday date;
  v_opening     numeric(15,2);
  w             integer;
  w_start       date;
  w_end         date;
BEGIN
  -- Find the Monday of the week containing p_from
  v_base_monday := p_from - (extract(dow from p_from)::integer + 6) % 7;

  -- Opening balance: cumulative cash effect of all entries BEFORE v_base_monday
  SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
  INTO v_opening
  FROM public.financial_journal_entries je
  JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.is_cash = true
    AND je.entry_date < v_base_monday;

  -- Generate 13 weekly buckets
  FOR w IN 0 .. 12 LOOP
    w_start := v_base_monday + (w * 7);
    w_end   := w_start + 6;

    week_number     := w + 1;
    week_start      := w_start;
    week_end        := w_end;
    week_label      := to_char(w_start, 'DD/MM') || ' - ' || to_char(w_end, 'DD/MM');
    opening_balance := v_opening;

    -- Inflows: settled entries in this week
    SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
    INTO inflows
    FROM public.financial_journal_entries je
    JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
    JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
    WHERE ca.is_cash = true
      AND je.entry_date BETWEEN w_start AND w_end
      AND jl.debit > jl.credit;

    -- Outflows: settled entries in this week
    SELECT COALESCE(SUM(jl.credit - jl.debit), 0)
    INTO outflows
    FROM public.financial_journal_entries je
    JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
    JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
    WHERE ca.is_cash = true
      AND je.entry_date BETWEEN w_start AND w_end
      AND jl.credit > jl.debit;

    closing_balance := v_opening + inflows - outflows;
    v_opening       := closing_balance;

    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.cashflow_13_week_projection(date) IS
  'Projecao de 13 semanas (seg-dom). Saldo propagado. Regime de caixa.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. financial_cashflow_statement_v
--    DFC: Demonstracao dos Fluxos de Caixa (Metodo Direto Gerencial).
--    Agrega realizado por DFC class.
-- ────────────────────────────────────────────────────────────────────────────

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
  WHERE ca.is_cash = true
    AND je.entry_date < current_date
),
classes(dfc_class, dfc_class_label, sort_order) AS (
  VALUES
    ('OPERACIONAL'::text,    'Atividades Operacionais'::text,     1),
    ('INVESTIMENTO'::text,   'Atividades de Investimento'::text,  2),
    ('FINANCIAMENTO'::text,  'Atividades de Financiamento'::text, 3)
)
SELECT
  c.dfc_class,
  c.dfc_class_label,
  COALESCE(a.inflows, 0)    AS inflows,
  COALESCE(a.outflows, 0)   AS outflows,
  COALESCE(a.net_amount, 0) AS net_amount,
  o.opening_balance,
  c.sort_order
FROM classes c
CROSS JOIN opening o
LEFT JOIN agg a ON a.dfc_class = c.dfc_class

UNION ALL

SELECT
  'SALDO_INICIAL'::text,
  'Saldo Inicial de Caixa'::text,
  o.opening_balance,
  0,
  o.opening_balance,
  o.opening_balance,
  4
FROM opening o

UNION ALL

SELECT
  'VARIACAO'::text,
  'Variacao Liquida de Caixa'::text,
  0,
  0,
  COALESCE((SELECT SUM(net_amount) FROM agg), 0),
  o.opening_balance,
  5
FROM opening o

UNION ALL

SELECT
  'SALDO_FINAL'::text,
  'Saldo Final de Caixa'::text,
  0,
  0,
  o.opening_balance + COALESCE((SELECT SUM(net_amount) FROM agg), 0),
  o.opening_balance,
  6
FROM opening o

ORDER BY sort_order;

COMMENT ON VIEW public.financial_cashflow_statement_v IS
  'DFC - Demonstracao dos Fluxos de Caixa. Metodo Direto Gerencial. Regime de caixa.';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Grants (padrao 08C: SELECT para authenticated + public)
-- ────────────────────────────────────────────────────────────────────────────

GRANT SELECT ON public.financial_cashflow_realized_v  TO authenticated;
GRANT SELECT ON public.financial_cashflow_realized_v  TO public;
GRANT SELECT ON public.financial_cashflow_forecast_v  TO authenticated;
GRANT SELECT ON public.financial_cashflow_forecast_v  TO public;
GRANT SELECT ON public.financial_cashflow_statement_v TO authenticated;
GRANT SELECT ON public.financial_cashflow_statement_v TO public;
GRANT EXECUTE ON FUNCTION public.cashflow_13_week_projection(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cashflow_13_week_projection(date) TO public;
