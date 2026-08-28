CREATE OR REPLACE FUNCTION public.get_financial_dashboard(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_as_of_date date DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_service_line_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_as_of date := COALESCE(p_as_of_date, current_date);
  v_from date := COALESCE(p_from, date_trunc('month', current_date)::date);
  v_to date := COALESCE(p_to, current_date);
  v_cashopening numeric(15,2);
  v_cashclosing numeric(15,2);
  v_cashrin numeric(15,2);
  v_cashrout numeric(15,2);
  v_cashpin numeric(15,2);
  v_cashpout numeric(15,2);
  v_cashpb numeric(15,2);
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Apenas usuarios internos podem acessar o dashboard financeiro';
  END IF;

  SELECT opening_balance, closing_balance, realized_inflows, realized_outflows,
         projected_inflows, projected_outflows, projected_balance
  INTO v_cashopening, v_cashclosing, v_cashrin, v_cashrout, v_cashpin, v_cashpout, v_cashpb
  FROM public.cashflow_summary(v_from, v_to, NULL, p_cost_center_id, p_service_line_id);

  v_result := jsonb_build_object(
    'period', jsonb_build_object('from', v_from, 'to', v_to, 'as_of_date', v_as_of),
    'cashflow', jsonb_build_object(
      'opening_balance', COALESCE(v_cashopening, 0), 'closing_balance', COALESCE(v_cashclosing, 0),
      'realized_inflows', COALESCE(v_cashrin, 0), 'realized_outflows', COALESCE(v_cashrout, 0),
      'projected_inflows', COALESCE(v_cashpin, 0), 'projected_outflows', COALESCE(v_cashpout, 0),
      'projected_balance', COALESCE(v_cashpb, 0)
    ),
    'receivables', (
      SELECT jsonb_build_object(
        'open', COALESCE(SUM(CASE WHEN status = 'pending' THEN open_amount ELSE 0 END), 0),
        'overdue', COALESCE(SUM(CASE WHEN overdue THEN open_amount ELSE 0 END), 0),
        'due_in_7_days', COALESCE(SUM(CASE WHEN status = 'pending' AND due_date BETWEEN current_date AND current_date + INTERVAL '7 days' THEN open_amount ELSE 0 END), 0),
        'due_in_30_days', COALESCE(SUM(CASE WHEN status = 'pending' AND due_date BETWEEN current_date AND current_date + INTERVAL '30 days' THEN open_amount ELSE 0 END), 0)
      ) FROM public.financial_receivables_v
      WHERE (p_cost_center_id IS NULL OR cost_center_id = p_cost_center_id)
        AND (p_service_line_id IS NULL OR service_line_id = p_service_line_id)
    ),
    'payables', (
      SELECT jsonb_build_object(
        'open', COALESCE(SUM(CASE WHEN status = 'pending' THEN open_amount ELSE 0 END), 0),
        'overdue', COALESCE(SUM(CASE WHEN overdue THEN open_amount ELSE 0 END), 0),
        'due_in_7_days', COALESCE(SUM(CASE WHEN status = 'pending' AND due_date BETWEEN current_date AND current_date + INTERVAL '7 days' THEN open_amount ELSE 0 END), 0),
        'due_in_30_days', COALESCE(SUM(CASE WHEN status = 'pending' AND due_date BETWEEN current_date AND current_date + INTERVAL '30 days' THEN open_amount ELSE 0 END), 0)
      ) FROM public.financial_payables_v
      WHERE (p_cost_center_id IS NULL OR cost_center_id = p_cost_center_id)
        AND (p_service_line_id IS NULL OR service_line_id = p_service_line_id)
    ),
    'income_statement', (
      SELECT jsonb_build_object(
        'revenue', COALESCE(SUM(CASE WHEN row_code = 'RECEITA_BRUTA' THEN amount ELSE 0 END), 0),
        'revenue_deductions', COALESCE(SUM(CASE WHEN row_code = 'DEDUCOES' THEN amount ELSE 0 END), 0),
        'net_revenue', COALESCE(SUM(CASE WHEN row_code = 'RECEITA_LIQUIDA' THEN amount ELSE 0 END), 0),
        'cogs', COALESCE(SUM(CASE WHEN row_code = 'CUSTOS' THEN amount ELSE 0 END), 0),
        'gross_profit', COALESCE(SUM(CASE WHEN row_code = 'LUCRO_BRUTO' THEN amount ELSE 0 END), 0),
        'opex', COALESCE(SUM(CASE WHEN row_code = 'DESPESAS_OPERACIONAIS' THEN amount ELSE 0 END), 0),
        'depreciation', COALESCE(SUM(CASE WHEN row_code = 'DEPRECIACAO' THEN amount ELSE 0 END), 0),
        'ebitda', COALESCE(SUM(CASE WHEN row_code = 'EBITDA' THEN amount ELSE 0 END), 0),
        'financial_result', COALESCE(SUM(CASE WHEN row_code = 'RESULTADO_FINANCEIRO' THEN amount ELSE 0 END), 0),
        'other_income', COALESCE(SUM(CASE WHEN row_code = 'OUTROS_RESULTADOS' THEN amount ELSE 0 END), 0),
        'other_expense', COALESCE(0, 0),
        'tax', COALESCE(SUM(CASE WHEN row_code = 'IMPOSTOS' THEN amount ELSE 0 END), 0),
        'net_result', COALESCE(SUM(CASE WHEN row_code = 'RESULTADO_LIQUIDO' THEN amount ELSE 0 END), 0),
        'margin_ebitda', CASE WHEN COALESCE(SUM(CASE WHEN row_code = 'RECEITA_LIQUIDA' THEN amount ELSE 0 END), 0) <> 0
          THEN round(COALESCE(SUM(CASE WHEN row_code = 'EBITDA' THEN amount ELSE 0 END), 0) / SUM(CASE WHEN row_code = 'RECEITA_LIQUIDA' THEN amount ELSE 0 END) * 100, 2) ELSE 0 END,
        'margin_net', CASE WHEN COALESCE(SUM(CASE WHEN row_code = 'RECEITA_LIQUIDA' THEN amount ELSE 0 END), 0) <> 0
          THEN round(COALESCE(SUM(CASE WHEN row_code = 'RESULTADO_LIQUIDO' THEN amount ELSE 0 END), 0) / SUM(CASE WHEN row_code = 'RECEITA_LIQUIDA' THEN amount ELSE 0 END) * 100, 2) ELSE 0 END
      ) FROM public.get_income_statement(v_from, v_to, p_cost_center_id, p_service_line_id)
    ),
    'balance_sheet', (
      SELECT jsonb_build_object(
        'total_assets', COALESCE(SUM(CASE WHEN class = 'ATIVO' THEN amount * presentation_sign ELSE 0 END), 0),
        'current_assets', COALESCE(SUM(CASE WHEN class = 'ATIVO' AND group_name = 'CIRCULANTE' THEN amount * presentation_sign ELSE 0 END), 0),
        'current_liabilities', COALESCE(SUM(CASE WHEN class = 'PASSIVO' AND group_name = 'CIRCULANTE' THEN amount * presentation_sign ELSE 0 END), 0),
        'non_current_liabilities', COALESCE(SUM(CASE WHEN class = 'PASSIVO' AND group_name = 'NAO_CIRCULANTE' THEN amount * presentation_sign ELSE 0 END), 0),
        'total_liabilities', COALESCE(SUM(CASE WHEN class = 'PASSIVO' THEN amount * presentation_sign ELSE 0 END), 0),
        'equity', COALESCE(SUM(CASE WHEN class = 'PL' THEN amount * presentation_sign ELSE 0 END), 0)
      ) FROM public.get_balance_sheet(v_as_of)
    )
  );

  v_result := v_result || jsonb_build_object(
    'balance_sheet', (v_result->'balance_sheet') || jsonb_build_object(
      'working_capital', (v_result->'balance_sheet'->>'current_assets')::numeric
        - (v_result->'balance_sheet'->>'current_liabilities')::numeric,
      'current_ratio', CASE WHEN (v_result->'balance_sheet'->>'current_liabilities')::numeric > 0
        THEN round((v_result->'balance_sheet'->>'current_assets')::numeric
          / (v_result->'balance_sheet'->>'current_liabilities')::numeric, 2) ELSE 0 END,
      'leverage', CASE WHEN (v_result->'balance_sheet'->>'equity')::numeric <> 0
        THEN round((v_result->'balance_sheet'->>'total_liabilities')::numeric / (v_result->'balance_sheet'->>'equity')::numeric, 2) ELSE 0 END
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_dashboard(date, date, date, uuid, uuid) TO authenticated;
DO $$ BEGIN REVOKE ALL ON FUNCTION public.get_financial_dashboard(date, date, date, uuid, uuid) FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_financial_dashboard(date, date, date, uuid, uuid) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;
