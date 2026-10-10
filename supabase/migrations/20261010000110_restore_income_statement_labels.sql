-- Preserve the existing DRE labels while keeping the Gate 2.1 guard.
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
    SELECT receita_bruta, deducoes, receita_bruta - deducoes AS receita_liquida,
      csp, receita_bruta - deducoes - csp AS lucro_bruto, despesas_op,
      receita_bruta - deducoes - csp - despesas_op AS ebitda, da,
      receita_bruta - deducoes - csp - despesas_op - da AS ebit,
      receita_financeira - despesa_financeira AS resultado_financeiro,
      outras_receitas - outras_despesas AS outros_resultados,
      receita_bruta - deducoes - csp - despesas_op - da + receita_financeira - despesa_financeira + outras_receitas - outras_despesas AS antes_imposto,
      imposto,
      receita_bruta - deducoes - csp - despesas_op - da + receita_financeira - despesa_financeira + outras_receitas - outras_despesas - imposto AS resultado_liquido
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

GRANT EXECUTE ON FUNCTION public.get_income_statement(date, date, uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_income_statement(date, date, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_income_statement(date, date, uuid, uuid) FROM anon;
