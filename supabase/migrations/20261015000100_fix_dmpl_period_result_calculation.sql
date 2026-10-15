-- FIN-FIX-DMPL-1: align DMPL period result with the canonical DRE signs.
-- This changes function logic only; no ledger or operational data is touched.

CREATE OR REPLACE FUNCTION public.get_statement_of_changes_in_equity(
  p_from date DEFAULT NULL,
  p_to date DEFAULT current_date
)
RETURNS TABLE (
  row_label text,
  capital_social numeric(15,2),
  reservas numeric(15,2),
  lucros_prejuizos_acumulados numeric(15,2),
  resultado_exercicio numeric(15,2),
  outros_componentes numeric(15,2),
  total_pl numeric(15,2),
  sort_order int
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_from date;
  v_capital_open numeric(15,2);
  v_reservas_open numeric(15,2);
  v_lp_open numeric(15,2);
  v_result_open numeric(15,2);
  v_outros_open numeric(15,2);
  v_capital_mov numeric(15,2);
  v_reservas_mov numeric(15,2);
  v_lp_mov numeric(15,2);
  v_result_mov numeric(15,2);
  v_outros_mov numeric(15,2);
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_internal_user() IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_from := COALESCE(p_from, '2026-01-01');

  SELECT COALESCE(SUM(
    (CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
          WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
          ELSE 0 END) * ca.presentation_sign
  ), 0)
  INTO v_capital_open
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Capital Social'
    AND ca.active = true AND je.competence_date < v_from
    AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    (CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
          WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
          ELSE 0 END) * ca.presentation_sign
  ), 0)
  INTO v_reservas_open
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Reservas'
    AND ca.active = true AND je.competence_date < v_from
    AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    (CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
          WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
          ELSE 0 END) * ca.presentation_sign
  ), 0)
  INTO v_lp_open
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Resultados Acumulados'
    AND ca.name NOT LIKE '%Ajustes%' AND ca.active = true
    AND je.competence_date < v_from AND je.status <> 'cancelled';

  -- Use the same semantic sign convention as the DRE and balance sheet.
  SELECT COALESCE(SUM(
    CASE
      WHEN ca.dre_class IN ('RECEITA_BRUTA', 'RECEITA_FINANCEIRA', 'OUTRAS_RECEITAS')
        THEN CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit ELSE jl.credit - jl.debit END
      WHEN ca.dre_class IN (
        'DEDUCAO_RECEITA', 'CUSTO_SERVICO', 'DESPESA_OPERACIONAL',
        'DEPRECIACAO_AMORTIZACAO', 'DESPESA_FINANCEIRA',
        'OUTRAS_DESPESAS', 'IMPOSTO_RESULTADO'
      )
        THEN -CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit ELSE jl.credit - jl.debit END
      ELSE 0
    END
  ), 0)
  INTO v_result_open
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND NULLIF(ca.dre_class, '') IS NOT NULL AND ca.active = true
    AND je.competence_date < v_from AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    (CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
          WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
          ELSE 0 END) * ca.presentation_sign
  ), 0)
  INTO v_outros_open
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL'
    AND (
      ca.bp_group IN ('Distribuicoes', 'Saldos Iniciais')
      OR (ca.bp_group = 'Resultados Acumulados' AND ca.name LIKE '%Ajustes%')
    )
    AND ca.active = true
    AND je.competence_date < v_from AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    (CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
          WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
          ELSE 0 END) * ca.presentation_sign
  ), 0)
  INTO v_capital_mov
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Capital Social'
    AND ca.active = true AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    (CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
          WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
          ELSE 0 END) * ca.presentation_sign
  ), 0)
  INTO v_reservas_mov
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Reservas'
    AND ca.active = true AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    (CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
          WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
          ELSE 0 END) * ca.presentation_sign
  ), 0)
  INTO v_lp_mov
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Resultados Acumulados'
    AND ca.name NOT LIKE '%Ajustes%' AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    CASE
      WHEN ca.dre_class IN ('RECEITA_BRUTA', 'RECEITA_FINANCEIRA', 'OUTRAS_RECEITAS')
        THEN CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit ELSE jl.credit - jl.debit END
      WHEN ca.dre_class IN (
        'DEDUCAO_RECEITA', 'CUSTO_SERVICO', 'DESPESA_OPERACIONAL',
        'DEPRECIACAO_AMORTIZACAO', 'DESPESA_FINANCEIRA',
        'OUTRAS_DESPESAS', 'IMPOSTO_RESULTADO'
      )
        THEN -CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit ELSE jl.credit - jl.debit END
      ELSE 0
    END
  ), 0)
  INTO v_result_mov
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND NULLIF(ca.dre_class, '') IS NOT NULL AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    (CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
          WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
          ELSE 0 END) * ca.presentation_sign
  ), 0)
  INTO v_outros_mov
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL'
    AND (
      ca.bp_group IN ('Distribuicoes', 'Saldos Iniciais')
      OR (ca.bp_group = 'Resultados Acumulados' AND ca.name LIKE '%Ajustes%')
    )
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  row_label := 'Saldo Inicial'; capital_social := v_capital_open; reservas := v_reservas_open;
  lucros_prejuizos_acumulados := v_lp_open; resultado_exercicio := v_result_open;
  outros_componentes := v_outros_open; total_pl := v_capital_open + v_reservas_open + v_lp_open + v_result_open + v_outros_open;
  sort_order := 1; RETURN NEXT;

  row_label := 'Aportes de Capital'; capital_social := v_capital_mov; reservas := 0;
  lucros_prejuizos_acumulados := 0; resultado_exercicio := 0; outros_componentes := 0;
  total_pl := v_capital_mov; sort_order := 2; RETURN NEXT;

  row_label := 'Ajustes de Exercicios Anteriores'; capital_social := 0; reservas := 0;
  lucros_prejuizos_acumulados := 0; resultado_exercicio := 0; outros_componentes := v_outros_mov;
  total_pl := v_outros_mov; sort_order := 3; RETURN NEXT;

  row_label := 'Resultado do Periodo'; capital_social := 0; reservas := 0;
  lucros_prejuizos_acumulados := 0; resultado_exercicio := v_result_mov; outros_componentes := 0;
  total_pl := v_result_mov; sort_order := 4; RETURN NEXT;

  row_label := 'Distribuicoes / Retiradas'; capital_social := 0; reservas := 0;
  lucros_prejuizos_acumulados := 0; resultado_exercicio := 0; outros_componentes := -v_lp_mov;
  total_pl := -v_lp_mov; sort_order := 5; RETURN NEXT;

  row_label := 'Transferencias Internas do PL'; capital_social := 0; reservas := v_reservas_mov;
  lucros_prejuizos_acumulados := 0; resultado_exercicio := 0; outros_componentes := 0;
  total_pl := v_reservas_mov; sort_order := 6; RETURN NEXT;

  row_label := 'Saldo Final'; capital_social := v_capital_open + v_capital_mov;
  reservas := v_reservas_open + v_reservas_mov; lucros_prejuizos_acumulados := v_lp_open + v_lp_mov;
  resultado_exercicio := v_result_open + v_result_mov; outros_componentes := v_outros_open + v_outros_mov;
  total_pl := (v_capital_open + v_capital_mov) + (v_reservas_open + v_reservas_mov) +
              (v_lp_open + v_lp_mov) + (v_result_open + v_result_mov) + (v_outros_open + v_outros_mov);
  sort_order := 7; RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_statement_of_changes_in_equity(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_statement_of_changes_in_equity(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_statement_of_changes_in_equity(date, date) TO authenticated;
