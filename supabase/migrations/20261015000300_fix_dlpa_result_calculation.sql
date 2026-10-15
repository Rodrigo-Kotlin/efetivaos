-- FIN-FIX-DLPA-1: reconcile retained earnings with the canonical DRE/BP model.
-- This changes report calculation only; no ledger or operational data is touched.

CREATE OR REPLACE FUNCTION public.get_retained_earnings_statement(
  p_from date DEFAULT NULL,
  p_to date DEFAULT current_date
)
RETURNS TABLE (
  row_label text,
  amount numeric(15,2),
  sort_order int
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_from date;
  v_to date;
  v_open_lp numeric(15,2);
  v_open_aje numeric(15,2);
  v_mov_lp numeric(15,2);
  v_mov_aje numeric(15,2);
  v_dre_result numeric(15,2);
  v_distribuicoes numeric(15,2);
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_internal_user() IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_from := COALESCE(p_from, '2026-01-01');
  v_to := COALESCE(p_to, current_date);

  -- Actual accumulated-profit accounts are separate from the dynamic RE row.
  SELECT COALESCE(SUM(
    (CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
          WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
          ELSE 0 END) * ca.presentation_sign
  ), 0)
  INTO v_open_lp
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Resultados Acumulados'
    AND ca.name NOT LIKE '%Ajustes%' AND ca.active = true
    AND je.competence_date < v_from AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    (CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
          WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
          ELSE 0 END) * ca.presentation_sign
  ), 0)
  INTO v_open_aje
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Resultados Acumulados'
    AND ca.name LIKE '%Ajustes%' AND ca.active = true
    AND je.competence_date < v_from AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    (CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
          WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
          ELSE 0 END) * ca.presentation_sign
  ), 0)
  INTO v_mov_lp
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Resultados Acumulados'
    AND ca.name NOT LIKE '%Ajustes%' AND ca.active = true
    AND je.competence_date BETWEEN v_from AND v_to
    AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    (CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
          WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
          ELSE 0 END) * ca.presentation_sign
  ), 0)
  INTO v_mov_aje
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Resultados Acumulados'
    AND ca.name LIKE '%Ajustes%' AND ca.active = true
    AND je.competence_date BETWEEN v_from AND v_to
    AND je.status <> 'cancelled';

  -- Result is the canonical economic result used by DRE and dynamic BP RE.
  SELECT COALESCE((
    SELECT dre.amount
    FROM public.get_income_statement(v_from, v_to, null, null) AS dre
    WHERE dre.row_code = 'RESULTADO_LIQUIDO'
  ), 0)
  INTO v_dre_result;

  -- Distribution accounts are represented as positive economic amounts here.
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_distribuicoes
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Distribuicoes'
    AND ca.active = true AND je.competence_date BETWEEN v_from AND v_to
    AND je.status <> 'cancelled';

  row_label := 'Saldo Inicial de Lucros/Prejuizos Acumulados';
  amount := v_open_lp; sort_order := 1; RETURN NEXT;
  row_label := '(+) Ajustes de Exercicios Anteriores';
  amount := v_open_aje; sort_order := 2; RETURN NEXT;
  row_label := '(+) Resultado Liquido do Periodo';
  amount := v_dre_result; sort_order := 3; RETURN NEXT;
  row_label := '(-) Dividendos / Distribuicoes / Retiradas';
  amount := -v_distribuicoes; sort_order := 4; RETURN NEXT;
  row_label := '(+) Ajustes do Periodo';
  amount := v_mov_aje; sort_order := 5; RETURN NEXT;
  row_label := '= Saldo Final';
  amount := v_open_lp + v_open_aje + v_dre_result - v_distribuicoes + v_mov_aje + v_mov_lp;
  sort_order := 6; RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_retained_earnings_statement(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_retained_earnings_statement(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_retained_earnings_statement(date, date) TO authenticated;
