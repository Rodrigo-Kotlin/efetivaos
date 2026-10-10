-- Gate 2.1: close the authorization guards for the three confirmed RPCs.
-- Keep the existing signatures, SECURITY DEFINER configuration, search_path,
-- grants, and functional SQL unchanged apart from the guards.

CREATE OR REPLACE FUNCTION public.get_income_statement(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_service_line_id uuid DEFAULT NULL
)
RETURNS TABLE (row_code text, label text, row_type text, amount numeric, sort_order integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: usuario nao autenticado.';
  END IF;

  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Acesso negado: usuario inativo ou sem permissao.';
  END IF;

  RETURN QUERY
  WITH line_values AS (
    SELECT ca.dre_class,
      (CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit ELSE jl.credit - jl.debit END)::numeric AS natural_value
    FROM public.financial_journal_entries je
    JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
    JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
    JOIN public.financial_transactions ft ON ft.id = je.transaction_id
    WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
      AND nullif(ca.dre_class, '') IS NOT NULL
      AND (p_from IS NULL OR je.competence_date >= p_from)
      AND (p_to IS NULL OR je.competence_date <= p_to)
      AND (p_cost_center_id IS NULL OR ft.cost_center_id = p_cost_center_id)
      AND (p_service_line_id IS NULL OR ft.service_line_id = p_service_line_id)
  ),
  totals AS (
    SELECT
      coalesce(sum(CASE WHEN dre_class = 'RECEITA_BRUTA' THEN natural_value ELSE 0 END), 0) AS receita_bruta,
      coalesce(sum(CASE WHEN dre_class = 'DEDUCAO_RECEITA' THEN natural_value ELSE 0 END), 0) AS deducoes,
      coalesce(sum(CASE WHEN dre_class = 'CUSTO_SERVICO' THEN natural_value ELSE 0 END), 0) AS csp,
      coalesce(sum(CASE WHEN dre_class = 'DESPESA_OPERACIONAL' THEN natural_value ELSE 0 END), 0) AS despesas_op,
      coalesce(sum(CASE WHEN dre_class = 'DEPRECIACAO_AMORTIZACAO' THEN natural_value ELSE 0 END), 0) AS da,
      coalesce(sum(CASE WHEN dre_class = 'RECEITA_FINANCEIRA' THEN natural_value ELSE 0 END), 0) AS receita_financeira,
      coalesce(sum(CASE WHEN dre_class = 'DESPESA_FINANCEIRA' THEN natural_value ELSE 0 END), 0) AS despesa_financeira,
      coalesce(sum(CASE WHEN dre_class = 'OUTRAS_RECEITAS' THEN natural_value ELSE 0 END), 0) AS outras_receitas,
      coalesce(sum(CASE WHEN dre_class = 'OUTRAS_DESPESAS' THEN natural_value ELSE 0 END), 0) AS outras_despesas,
      coalesce(sum(CASE WHEN dre_class = 'IMPOSTO_RESULTADO' THEN natural_value ELSE 0 END), 0) AS imposto
    FROM line_values
  ),
  s AS (
    SELECT receita_bruta, deducoes,
      receita_bruta - deducoes AS receita_liquida,
      csp,
      receita_bruta - deducoes - csp AS lucro_bruto,
      despesas_op,
      receita_bruta - deducoes - csp - despesas_op AS ebitda,
      da,
      receita_bruta - deducoes - csp - despesas_op - da AS ebit,
      receita_financeira - despesa_financeira AS resultado_financeiro,
      outras_receitas - outras_despesas AS outros_resultados,
      receita_bruta - deducoes - csp - despesas_op - da
        + receita_financeira - despesa_financeira
        + outras_receitas - outras_despesas AS antes_imposto,
      imposto,
      receita_bruta - deducoes - csp - despesas_op - da
        + receita_financeira - despesa_financeira
        + outras_receitas - outras_despesas - imposto AS resultado_liquido
    FROM totals
  )
  SELECT rows.row_code, rows.label, rows.row_type, rows.amount, rows.sort_order
  FROM (
    SELECT 'RECEITA_BRUTA', 'Receita Bruta', 'SUBTOTAL', receita_bruta, 10 FROM s
    UNION ALL SELECT 'DEDUCOES', '(-) Deduções da Receita', 'DETAIL', -deducoes, 20 FROM s
    UNION ALL SELECT 'RECEITA_LIQUIDA', 'Receita Líquida', 'SUBTOTAL', receita_liquida, 30 FROM s
    UNION ALL SELECT 'CUSTOS', '(-) Custos dos Serviços Prestados', 'DETAIL', -csp, 40 FROM s
    UNION ALL SELECT 'LUCRO_BRUTO', 'Lucro Bruto / Margem de Contribuição', 'SUBTOTAL', lucro_bruto, 50 FROM s
    UNION ALL SELECT 'DESPESAS_OPERACIONAIS', '(-) Despesas Operacionais', 'DETAIL', -despesas_op, 60 FROM s
    UNION ALL SELECT 'EBITDA', 'EBITDA Gerencial', 'SUBTOTAL', ebitda, 70 FROM s
    UNION ALL SELECT 'DEPRECIACAO', '(-) Depreciação e Amortização', 'DETAIL', -da, 80 FROM s
    UNION ALL SELECT 'EBIT', 'Resultado Operacional (EBIT)', 'SUBTOTAL', ebit, 90 FROM s
    UNION ALL SELECT 'RESULTADO_FINANCEIRO', 'Resultado Financeiro', 'DETAIL', resultado_financeiro, 100 FROM s
    UNION ALL SELECT 'OUTROS_RESULTADOS', 'Outros Resultados', 'DETAIL', outros_resultados, 110 FROM s
    UNION ALL SELECT 'ANTES_IMPOSTOS', 'Resultado antes dos Tributos sobre Lucro', 'SUBTOTAL', antes_imposto, 120 FROM s
    UNION ALL SELECT 'IMPOSTOS', '(-) Tributos sobre Resultado', 'DETAIL', -imposto, 130 FROM s
    UNION ALL SELECT 'RESULTADO_LIQUIDO', 'RESULTADO LÍQUIDO', 'TOTAL', resultado_liquido, 140 FROM s
  ) AS rows(row_code, label, row_type, amount, sort_order)
  ORDER BY rows.sort_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_financial_dashboard(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_as_of_date date DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_service_line_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_result jsonb;
  v_as_of date := coalesce(p_as_of_date, current_date);
  v_from date := coalesce(p_from, date_trunc('month', current_date)::date);
  v_to date := coalesce(p_to, current_date);
  v_cashopening numeric(15,2);
  v_cashclosing numeric(15,2);
  v_cashrin numeric(15,2);
  v_cashrout numeric(15,2);
  v_cashpin numeric(15,2);
  v_cashpout numeric(15,2);
  v_cashpb numeric(15,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: usuario nao autenticado.';
  END IF;

  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Apenas usuarios internos podem acessar o dashboard financeiro';
  END IF;

  SELECT opening_balance, closing_balance, realized_inflows, realized_outflows,
         projected_inflows, projected_outflows, projected_balance
  INTO v_cashopening, v_cashclosing, v_cashrin, v_cashrout, v_cashpin, v_cashpout, v_cashpb
  FROM public.cashflow_summary(v_from, v_to, NULL, p_cost_center_id, p_service_line_id);

  v_result := jsonb_build_object(
    'period', jsonb_build_object('from', v_from, 'to', v_to, 'as_of_date', v_as_of),
    'cashflow', jsonb_build_object(
      'opening_balance', coalesce(v_cashopening, 0), 'closing_balance', coalesce(v_cashclosing, 0),
      'realized_inflows', coalesce(v_cashrin, 0), 'realized_outflows', coalesce(v_cashrout, 0),
      'projected_inflows', coalesce(v_cashpin, 0), 'projected_outflows', coalesce(v_cashpout, 0),
      'projected_balance', coalesce(v_cashpb, 0)
    ),
    'receivables', (
      SELECT jsonb_build_object(
        'open', coalesce(sum(CASE WHEN status = 'pending' THEN open_amount ELSE 0 END), 0),
        'overdue', coalesce(sum(CASE WHEN overdue THEN open_amount ELSE 0 END), 0),
        'due_in_7_days', coalesce(sum(CASE WHEN status = 'pending' AND due_date BETWEEN current_date AND current_date + INTERVAL '7 days' THEN open_amount ELSE 0 END), 0),
        'due_in_30_days', coalesce(sum(CASE WHEN status = 'pending' AND due_date BETWEEN current_date AND current_date + INTERVAL '30 days' THEN open_amount ELSE 0 END), 0)
      ) FROM public.financial_receivables_v
      WHERE (p_cost_center_id IS NULL OR cost_center_id = p_cost_center_id)
        AND (p_service_line_id IS NULL OR service_line_id = p_service_line_id)
    ),
    'payables', (
      SELECT jsonb_build_object(
        'open', coalesce(sum(CASE WHEN status = 'pending' THEN open_amount ELSE 0 END), 0),
        'overdue', coalesce(sum(CASE WHEN overdue THEN open_amount ELSE 0 END), 0),
        'due_in_7_days', coalesce(sum(CASE WHEN status = 'pending' AND due_date BETWEEN current_date AND current_date + INTERVAL '7 days' THEN open_amount ELSE 0 END), 0),
        'due_in_30_days', coalesce(sum(CASE WHEN status = 'pending' AND due_date BETWEEN current_date AND current_date + INTERVAL '30 days' THEN open_amount ELSE 0 END), 0)
      ) FROM public.financial_payables_v
      WHERE (p_cost_center_id IS NULL OR cost_center_id = p_cost_center_id)
        AND (p_service_line_id IS NULL OR service_line_id = p_service_line_id)
    ),
    'income_statement', (
      SELECT jsonb_build_object(
        'revenue', coalesce(sum(CASE WHEN row_code = 'RECEITA_BRUTA' THEN amount ELSE 0 END), 0),
        'revenue_deductions', coalesce(sum(CASE WHEN row_code = 'DEDUCOES' THEN amount ELSE 0 END), 0),
        'net_revenue', coalesce(sum(CASE WHEN row_code = 'RECEITA_LIQUIDA' THEN amount ELSE 0 END), 0),
        'cogs', coalesce(sum(CASE WHEN row_code = 'CUSTOS' THEN amount ELSE 0 END), 0),
        'gross_profit', coalesce(sum(CASE WHEN row_code = 'LUCRO_BRUTO' THEN amount ELSE 0 END), 0),
        'opex', coalesce(sum(CASE WHEN row_code = 'DESPESAS_OPERACIONAIS' THEN amount ELSE 0 END), 0),
        'depreciation', coalesce(sum(CASE WHEN row_code = 'DEPRECIACAO' THEN amount ELSE 0 END), 0),
        'ebitda', coalesce(sum(CASE WHEN row_code = 'EBITDA' THEN amount ELSE 0 END), 0),
        'financial_result', coalesce(sum(CASE WHEN row_code = 'RESULTADO_FINANCEIRO' THEN amount ELSE 0 END), 0),
        'other_income', coalesce(sum(CASE WHEN row_code = 'OUTROS_RESULTADOS' THEN amount ELSE 0 END), 0),
        'other_expense', 0,
        'tax', coalesce(sum(CASE WHEN row_code = 'IMPOSTOS' THEN amount ELSE 0 END), 0),
        'net_result', coalesce(sum(CASE WHEN row_code = 'RESULTADO_LIQUIDO' THEN amount ELSE 0 END), 0),
        'margin_ebitda', CASE WHEN coalesce(sum(CASE WHEN row_code = 'RECEITA_LIQUIDA' THEN amount ELSE 0 END), 0) <> 0 THEN round(coalesce(sum(CASE WHEN row_code = 'EBITDA' THEN amount ELSE 0 END), 0) / sum(CASE WHEN row_code = 'RECEITA_LIQUIDA' THEN amount ELSE 0 END) * 100, 2) ELSE 0 END,
        'margin_net', CASE WHEN coalesce(sum(CASE WHEN row_code = 'RECEITA_LIQUIDA' THEN amount ELSE 0 END), 0) <> 0 THEN round(coalesce(sum(CASE WHEN row_code = 'RESULTADO_LIQUIDO' THEN amount ELSE 0 END), 0) / sum(CASE WHEN row_code = 'RECEITA_LIQUIDA' THEN amount ELSE 0 END) * 100, 2) ELSE 0 END
      ) FROM public.get_income_statement(v_from, v_to, p_cost_center_id, p_service_line_id)
    ),
    'balance_sheet', (
      SELECT jsonb_build_object(
        'total_assets', coalesce(sum(CASE WHEN class = 'ATIVO' THEN amount * presentation_sign ELSE 0 END), 0),
        'current_assets', coalesce(sum(CASE WHEN class = 'ATIVO' AND group_name = 'CIRCULANTE' THEN amount * presentation_sign ELSE 0 END), 0),
        'current_liabilities', coalesce(sum(CASE WHEN class = 'PASSIVO' AND group_name = 'CIRCULANTE' THEN amount * presentation_sign ELSE 0 END), 0),
        'non_current_liabilities', coalesce(sum(CASE WHEN class = 'PASSIVO' AND group_name = 'NAO_CIRCULANTE' THEN amount * presentation_sign ELSE 0 END), 0),
        'total_liabilities', coalesce(sum(CASE WHEN class = 'PASSIVO' THEN amount * presentation_sign ELSE 0 END), 0),
        'equity', coalesce(sum(CASE WHEN class = 'PL' THEN amount * presentation_sign ELSE 0 END), 0)
      ) FROM public.get_balance_sheet(v_as_of)
    )
  );

  v_result := v_result || jsonb_build_object(
    'balance_sheet', (v_result->'balance_sheet') || jsonb_build_object(
      'working_capital', (v_result->'balance_sheet'->>'current_assets')::numeric - (v_result->'balance_sheet'->>'current_liabilities')::numeric,
      'current_ratio', CASE WHEN (v_result->'balance_sheet'->>'current_liabilities')::numeric > 0 THEN round((v_result->'balance_sheet'->>'current_assets')::numeric / (v_result->'balance_sheet'->>'current_liabilities')::numeric, 2) ELSE 0 END,
      'leverage', CASE WHEN (v_result->'balance_sheet'->>'equity')::numeric <> 0 THEN round((v_result->'balance_sheet'->>'total_liabilities')::numeric / (v_result->'balance_sheet'->>'equity')::numeric, 2) ELSE 0 END
    )
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_manual_journal_adjustment(
  p_entry_date date,
  p_competence_date date,
  p_description text,
  p_lines jsonb,
  p_reference text DEFAULT NULL,
  p_cost_center_id uuid DEFAULT NULL,
  p_service_line_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL,
  p_justification text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_entry_id uuid;
  v_transaction_id uuid;
  v_line jsonb;
  v_total_debit numeric(15,2) := 0;
  v_total_credit numeric(15,2) := 0;
  v_line_count integer := 0;
  v_idempotency uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Apenas administradores podem criar ajustes contabeis';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem criar ajustes contabeis';
  END IF;

  v_idempotency := coalesce(p_idempotency_key, pg_catalog.gen_random_uuid());

  IF EXISTS (SELECT 1 FROM public.financial_journal_entries WHERE idempotency_key = v_idempotency::text) THEN
    SELECT id INTO v_entry_id FROM public.financial_journal_entries WHERE idempotency_key = v_idempotency::text;
    RETURN v_entry_id;
  END IF;

  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Ajuste deve ter pelo menos 2 linhas';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_total_debit := v_total_debit + coalesce((v_line->>'debit')::numeric, 0);
    v_total_credit := v_total_credit + coalesce((v_line->>'credit')::numeric, 0);
    v_line_count := v_line_count + 1;
  END LOOP;

  IF abs(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Ajuste desbalanceado: debitos (%) != creditos (%)', v_total_debit, v_total_credit;
  END IF;

  INSERT INTO public.financial_transactions (description, transaction_date, competence_date, movement_type, amount, status)
  VALUES (p_description, p_entry_date, p_competence_date, 'AJUSTE', v_total_debit, 'settled')
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, idempotency_key)
  VALUES (v_transaction_id, 'ajuste', p_entry_date, p_competence_date, p_description, 'settled', v_idempotency::text)
  RETURNING id INTO v_entry_id;

  INSERT INTO public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
  SELECT v_entry_id, (elem->>'chart_account_id')::uuid,
    coalesce((elem->>'debit')::numeric, 0), coalesce((elem->>'credit')::numeric, 0), coalesce(elem->>'description', '')
  FROM jsonb_array_elements(p_lines) AS elem;

  IF p_justification IS NOT NULL AND p_justification <> '' THEN
    INSERT INTO public.financial_notes (note_type, title, body, reference_date, journal_entry_id, report_type)
    VALUES ('AJUSTE', 'Ajuste: ' || p_description, p_justification, p_entry_date, v_entry_id, 'AJUSTE');
  END IF;

  RETURN v_entry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_income_statement(date, date, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_dashboard(date, date, date, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_manual_journal_adjustment(date, date, text, jsonb, text, uuid, uuid, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_income_statement(date, date, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_income_statement(date, date, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_financial_dashboard(date, date, date, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_financial_dashboard(date, date, date, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.create_manual_journal_adjustment(date, date, text, jsonb, text, uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_manual_journal_adjustment(date, date, text, jsonb, text, uuid, uuid, uuid, text) FROM anon;
