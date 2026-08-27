-- ============================================================================
-- MICROGATE 08E.1 — Corrective Migration: DRE Permissions + Security
--
-- Changes:
--   1. Replace is_admin() guard with is_internal_user() (admin OR equipe)
--   2. Add search_path = 'public, pg_temp' to prevent search_path hijacking
--   3. Ensure REVOKE ALL from PUBLIC and anon (idempotent)
--   4. SECURITY DEFINER so internal guard runs with owner privileges
-- ============================================================================

-- ── 1. Function: get_income_statement ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_income_statement(
  p_from             date DEFAULT NULL,
  p_to               date DEFAULT NULL,
  p_cost_center_id   uuid DEFAULT NULL,
  p_service_line_id  uuid DEFAULT NULL
)
RETURNS TABLE (
  row_code   text,
  label      text,
  row_type   text,
  amount     numeric,
  sort_order int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
BEGIN
  -- Internal guard: admin OR active equipe (CLI tests bypass via auth.uid() IS NULL)
  IF auth.uid() IS NOT NULL AND NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Acesso negado: usuário inativo ou sem permissão.';
  END IF;

  RETURN QUERY
  WITH params AS (
  SELECT
    p_from,
    p_to,
    p_cost_center_id,
    p_service_line_id
),
line_values AS (
  SELECT
    jl.chart_account_id,
    ca.nature,
    ca.dre_class,
    (CASE WHEN ca.nature = 'DEBITO'
          THEN jl.debit - jl.credit
          ELSE jl.credit - jl.debit
     END)::numeric AS natural_value
  FROM public.financial_journal_entries je
  JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  JOIN public.financial_transactions ft ON ft.id = je.transaction_id
  WHERE je.status = 'settled'
    AND ca.class IN ('RECEITA','CUSTO','DESPESA')
    AND ca.dre_class <> ''
    AND (p_from IS NULL OR je.competence_date >= p_from)
    AND (p_to   IS NULL OR je.competence_date <= p_to)
    AND (p_cost_center_id  IS NULL OR ft.cost_center_id  = p_cost_center_id)
    AND (p_service_line_id IS NULL OR ft.service_line_id = p_service_line_id)
),
totals AS (
  SELECT
    COALESCE(SUM(CASE WHEN dre_class = 'RECEITA_BRUTA'            THEN natural_value ELSE 0 END), 0) AS receita_bruta,
    COALESCE(SUM(CASE WHEN dre_class = 'DEDUCAO_RECEITA'           THEN natural_value ELSE 0 END), 0) AS deducoes,
    COALESCE(SUM(CASE WHEN dre_class = 'CUSTO_SERVICO'             THEN natural_value ELSE 0 END), 0) AS csp,
    COALESCE(SUM(CASE WHEN dre_class = 'DESPESA_OPERACIONAL'       THEN natural_value ELSE 0 END), 0) AS despesas_op,
    COALESCE(SUM(CASE WHEN dre_class = 'DEPRECIACAO_AMORTIZACAO'   THEN natural_value ELSE 0 END), 0) AS da,
    COALESCE(SUM(CASE WHEN dre_class = 'RECEITA_FINANCEIRA'        THEN natural_value ELSE 0 END), 0) AS receita_financeira,
    COALESCE(SUM(CASE WHEN dre_class = 'DESPESA_FINANCEIRA'        THEN natural_value ELSE 0 END), 0) AS despesa_financeira,
    COALESCE(SUM(CASE WHEN dre_class = 'OUTRAS_RECEITAS'           THEN natural_value ELSE 0 END), 0) AS outras_receitas,
    COALESCE(SUM(CASE WHEN dre_class = 'OUTRAS_DESPESAS'           THEN natural_value ELSE 0 END), 0) AS outras_despesas,
    COALESCE(SUM(CASE WHEN dre_class = 'IMPOSTO_RESULTADO'         THEN natural_value ELSE 0 END), 0) AS imposto
  FROM line_values
),
s AS (
  SELECT
    receita_bruta,
    deducoes,
    receita_bruta - deducoes                                     AS receita_liquida,
    csp,
    receita_bruta - deducoes - csp                               AS lucro_bruto,
    despesas_op,
    receita_bruta - deducoes - csp - despesas_op                 AS ebitda,
    da,
    receita_bruta - deducoes - csp - despesas_op - da            AS ebit,
    (receita_financeira - despesa_financeira)                    AS resultado_financeiro,
    (outras_receitas - outras_despesas)                          AS outros_resultados,
    receita_bruta - deducoes - csp - despesas_op - da
      + (receita_financeira - despesa_financeira)
      + (outras_receitas - outras_despesas)                      AS antes_imposto,
    imposto,
    receita_bruta - deducoes - csp - despesas_op - da
      + (receita_financeira - despesa_financeira)
      + (outras_receitas - outras_despesas)
      - imposto                                                   AS resultado_liquido
  FROM totals
)
SELECT dre_rows.row_code, dre_rows.label, dre_rows.row_type, dre_rows.amount, dre_rows.sort_order FROM (
  SELECT 'RECEITA_BRUTA'           AS row_code, 'Receita Bruta'                         AS label, 'SUBTOTAL' AS row_type, receita_bruta                                            AS amount, 10 AS sort_order FROM s
  UNION ALL
  SELECT 'DEDUCOES'                AS row_code, '(-) Deduções da Receita'               AS label, 'DETAIL'   AS row_type, -deducoes                                                AS amount, 20 FROM s
  UNION ALL
  SELECT 'RECEITA_LIQUIDA'         AS row_code, 'Receita Líquida'                       AS label, 'SUBTOTAL' AS row_type, receita_liquida                                          AS amount, 30 FROM s
  UNION ALL
  SELECT 'CUSTOS'                  AS row_code, '(-) Custos dos Serviços Prestados'     AS label, 'DETAIL'   AS row_type, -csp                                                     AS amount, 40 FROM s
  UNION ALL
  SELECT 'LUCRO_BRUTO'             AS row_code, 'Lucro Bruto / Margem de Contribuição'  AS label, 'SUBTOTAL' AS row_type, lucro_bruto                                              AS amount, 50 FROM s
  UNION ALL
  SELECT 'DESPESAS_OPERACIONAIS'   AS row_code, '(-) Despesas Operacionais'             AS label, 'DETAIL'   AS row_type, -despesas_op                                             AS amount, 60 FROM s
  UNION ALL
  SELECT 'EBITDA'                  AS row_code, 'EBITDA Gerencial'                      AS label, 'SUBTOTAL' AS row_type, ebitda                                                   AS amount, 70 FROM s
  UNION ALL
  SELECT 'DEPRECIACAO'             AS row_code, '(-) Depreciação e Amortização'         AS label, 'DETAIL'   AS row_type, -da                                                      AS amount, 80 FROM s
  UNION ALL
  SELECT 'EBIT'                    AS row_code, 'Resultado Operacional (EBIT)'          AS label, 'SUBTOTAL' AS row_type, ebit                                                     AS amount, 90 FROM s
  UNION ALL
  SELECT 'RESULTADO_FINANCEIRO'    AS row_code, 'Resultado Financeiro'                  AS label, 'DETAIL'   AS row_type, resultado_financeiro                                     AS amount, 100 FROM s
  UNION ALL
  SELECT 'OUTROS_RESULTADOS'       AS row_code, 'Outros Resultados'                     AS label, 'DETAIL'   AS row_type, outros_resultados                                       AS amount, 110 FROM s
  UNION ALL
  SELECT 'ANTES_IMPOSTOS'          AS row_code, 'Resultado antes dos Tributos sobre Lucro' AS label, 'SUBTOTAL' AS row_type, antes_imposto                                        AS amount, 120 FROM s
  UNION ALL
  SELECT 'IMPOSTOS'                AS row_code, '(-) Tributos sobre Resultado'          AS label, 'DETAIL'   AS row_type, -imposto                                                AS amount, 130 FROM s
  UNION ALL
  SELECT 'RESULTADO_LIQUIDO'       AS row_code, 'RESULTADO LÍQUIDO'                     AS label, 'TOTAL'    AS row_type, resultado_liquido                                       AS amount, 140 FROM s
) dre_rows
ORDER BY sort_order;
END;
$$;

-- ── 2. Grants ────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.get_income_statement(
  date, date, uuid, uuid
) TO authenticated;

DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.get_income_statement(
    date, date, uuid, uuid
  ) FROM PUBLIC;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.get_income_statement(
    date, date, uuid, uuid
  ) FROM anon;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ── 3. Comments ─────────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.get_income_statement(
  date, date, uuid, uuid
) IS 'ETAPA 08E (MICROGATE 08E.1) — DRE Gerencial. Regime de competência. Admin + Equipe ativa = leitura. SECURITY DEFINER.';
