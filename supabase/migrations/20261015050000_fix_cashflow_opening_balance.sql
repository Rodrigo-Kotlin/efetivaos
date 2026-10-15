-- FIN-FIX-DFC-1: treat an explicit opening balance on the period start as
-- opening cash, without classifying it as a period cash flow.

CREATE OR REPLACE FUNCTION public.cashflow_opening_balance(
  p_date date DEFAULT current_date,
  p_account_id uuid DEFAULT NULL
)
RETURNS TABLE (opening_balance numeric(15,2))
LANGUAGE sql
STABLE
AS $$
  WITH cash_accounts AS (
    SELECT ca.id
    FROM public.financial_chart_accounts ca
    WHERE ca.is_cash = true
      AND (p_account_id IS NULL OR ca.id = p_account_id)
  ),
  prior_balance AS (
    SELECT jl.chart_account_id, SUM(jl.debit - jl.credit) AS amount
    FROM public.financial_journal_entries je
    JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
    JOIN cash_accounts ca ON ca.id = jl.chart_account_id
    WHERE je.entry_date < p_date
    GROUP BY jl.chart_account_id
  ),
  explicit_opening AS (
    SELECT jl.chart_account_id, SUM(jl.debit - jl.credit) AS amount
    FROM public.financial_journal_entries je
    JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
    JOIN public.financial_transactions t ON t.id = je.transaction_id
    JOIN cash_accounts ca ON ca.id = jl.chart_account_id
    WHERE je.entry_date = p_date
      AND t.movement_type = 'SALDO_INICIAL'
    GROUP BY jl.chart_account_id
  )
  SELECT COALESCE(SUM(COALESCE(eo.amount, pb.amount, 0)), 0)::numeric(15,2)
  FROM cash_accounts ca
  LEFT JOIN prior_balance pb ON pb.chart_account_id = ca.id
  LEFT JOIN explicit_opening eo ON eo.chart_account_id = ca.id;
$$;

COMMENT ON FUNCTION public.cashflow_opening_balance(date, uuid) IS
  'Saldo de caixa anterior a p_date, substituido por SALDO_INICIAL explicito na data inicial por conta.';

GRANT EXECUTE ON FUNCTION public.cashflow_opening_balance(date, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cashflow_opening_balance(date, uuid) FROM PUBLIC;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.cashflow_opening_balance(date, uuid) FROM anon;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.cashflow_summary(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_financial_account_id uuid DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_service_line_id uuid DEFAULT NULL
)
RETURNS TABLE (
  opening_balance numeric(15,2),
  realized_inflows numeric(15,2),
  realized_outflows numeric(15,2),
  closing_balance numeric(15,2),
  projected_inflows numeric(15,2),
  projected_outflows numeric(15,2),
  projected_balance numeric(15,2)
)
LANGUAGE sql
STABLE
AS $$
  WITH period AS (
    SELECT
      COALESCE(p_from, '1900-01-01'::date) AS p_from,
      COALESCE(p_to, current_date) AS p_to
  ),
  ob AS (
    SELECT public.cashflow_opening_balance(
      pb.p_from,
      (SELECT fa.chart_account_id
       FROM public.financial_accounts fa
       WHERE fa.id = p_financial_account_id)
    ) AS v
    FROM period pb
  ),
  realized AS (
    SELECT
      SUM(CASE WHEN r.direction = 'INFLOW' THEN r.amount ELSE 0 END) AS inflows,
      SUM(CASE WHEN r.direction = 'OUTFLOW' THEN r.amount ELSE 0 END) AS outflows
    FROM public.financial_cashflow_realized_v r, period pb
    WHERE r.entry_date >= pb.p_from
      AND r.entry_date <= pb.p_to
      AND r.dfc_class IN ('OPERACIONAL', 'INVESTIMENTO', 'FINANCIAMENTO')
      AND (p_financial_account_id IS NULL OR EXISTS (
        SELECT 1
        FROM public.financial_accounts fa
        WHERE fa.id = p_financial_account_id
          AND fa.chart_account_id = ANY(r.chart_account_ids)
      ))
      AND (p_cost_center_id IS NULL OR r.cost_center_id = p_cost_center_id)
      AND (p_service_line_id IS NULL OR r.service_line_id = p_service_line_id)
  ),
  proj AS (
    SELECT
      SUM(CASE WHEN f.direction = 'INFLOW' THEN f.projected_inflow ELSE 0 END) AS inflows,
      SUM(CASE WHEN f.direction = 'OUTFLOW' THEN f.projected_outflow ELSE 0 END) AS outflows
    FROM public.financial_cashflow_forecast_v f
    WHERE (p_cost_center_id IS NULL OR f.cost_center_id = p_cost_center_id)
      AND (p_service_line_id IS NULL OR f.service_line_id = p_service_line_id)
  )
  SELECT
    ob.v AS opening_balance,
    COALESCE(r.inflows, 0) AS realized_inflows,
    COALESCE(r.outflows, 0) AS realized_outflows,
    ob.v + COALESCE(r.inflows, 0) - COALESCE(r.outflows, 0) AS closing_balance,
    COALESCE(p.inflows, 0) AS projected_inflows,
    COALESCE(p.outflows, 0) AS projected_outflows,
    ob.v + COALESCE(r.inflows, 0) - COALESCE(r.outflows, 0)
      + COALESCE(p.inflows, 0) - COALESCE(p.outflows, 0) AS projected_balance
  FROM ob, realized r, proj p;
$$;

COMMENT ON FUNCTION public.cashflow_summary(date, date, uuid, uuid, uuid) IS
  'Resumo do fluxo de caixa: saldo inicial, realizado, projetado, saldo final, sem SALDO_INICIAL como fluxo.';

GRANT EXECUTE ON FUNCTION public.cashflow_summary(date, date, uuid, uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cashflow_summary(date, date, uuid, uuid, uuid) FROM PUBLIC;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.cashflow_summary(date, date, uuid, uuid, uuid) FROM anon;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
