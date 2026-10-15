-- FIN-FIX-DVA-1: reconcile value added distribution with the canonical DRE.
-- This changes report calculation only; no ledger or operational data is touched.

CREATE OR REPLACE FUNCTION public.get_value_added_statement(
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
  v_receitas numeric(15,2);
  v_insumos numeric(15,2);
  v_bruto numeric(15,2);
  v_retencoes numeric(15,2);
  v_liquido numeric(15,2);
  v_transferencias numeric(15,2);
  v_total_distribuir numeric(15,2);
  v_pessoal numeric(15,2);
  v_governo numeric(15,2);
  v_capital_terceiros numeric(15,2);
  v_capital_proprio numeric(15,2);
  v_total_distribuido numeric(15,2);
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_internal_user() IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_from := COALESCE(p_from, '2026-01-01');
  v_to := COALESCE(p_to, current_date);

  -- DVA values use the natural balance of each account.
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_receitas
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'RECEITAS' AND ca.active = true
    AND je.competence_date BETWEEN v_from AND v_to
    AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_insumos
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'INSUMOS_TERCEIROS' AND ca.active = true
    AND je.competence_date BETWEEN v_from AND v_to
    AND je.status <> 'cancelled';

  v_bruto := v_receitas - v_insumos;

  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_retencoes
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'RETENCOES' AND ca.active = true
    AND je.competence_date BETWEEN v_from AND v_to
    AND je.status <> 'cancelled';

  v_liquido := v_bruto - v_retencoes;

  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_transferencias
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'VALOR_RECEBIDO_TRANSFERENCIA' AND ca.active = true
    AND je.competence_date BETWEEN v_from AND v_to
    AND je.status <> 'cancelled';

  v_total_distribuir := v_liquido + v_transferencias;

  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_pessoal
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'PESSOAL' AND ca.active = true
    AND je.competence_date BETWEEN v_from AND v_to
    AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_governo
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'TRIBUTOS' AND ca.active = true
    AND je.competence_date BETWEEN v_from AND v_to
    AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_capital_terceiros
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'CAPITAL_TERCEIROS' AND ca.active = true
    AND je.competence_date BETWEEN v_from AND v_to
    AND je.status <> 'cancelled';

  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'DEBITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'CREDITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_capital_proprio
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'CAPITAL_PROPRIO' AND ca.active = true
    AND je.competence_date BETWEEN v_from AND v_to
    AND je.status <> 'cancelled';

  -- Retained result is the own-capital distribution component.
  v_capital_proprio := v_capital_proprio + COALESCE((
    SELECT dre.amount
    FROM public.get_income_statement(v_from, v_to, null, null) AS dre
    WHERE dre.row_code = 'RESULTADO_LIQUIDO'
  ), 0);

  v_total_distribuido := v_pessoal + v_governo + v_capital_terceiros + v_capital_proprio;

  row_label := 'Receitas'; amount := v_receitas; sort_order := 1; RETURN NEXT;
  row_label := '(-) Insumos Adquiridos de Terceiros'; amount := -v_insumos; sort_order := 2; RETURN NEXT;
  row_label := '= Valor Adicionado Bruto'; amount := v_bruto; sort_order := 3; RETURN NEXT;
  row_label := '(-) Retencoes (Depreciacao/Amortizacao)'; amount := -v_retencoes; sort_order := 4; RETURN NEXT;
  row_label := '= Valor Adicionado Liquido Produzido'; amount := v_liquido; sort_order := 5; RETURN NEXT;
  row_label := '(+) Valor Adicionado Recebido em Transferencia'; amount := v_transferencias; sort_order := 6; RETURN NEXT;
  row_label := '= Valor Adicionado Total a Distribuir'; amount := v_total_distribuir; sort_order := 7; RETURN NEXT;
  row_label := 'Distribuicao - Pessoal'; amount := v_pessoal; sort_order := 8; RETURN NEXT;
  row_label := 'Distribuicao - Governo / Tributos'; amount := v_governo; sort_order := 9; RETURN NEXT;
  row_label := 'Distribuicao - Capital de Terceiros'; amount := v_capital_terceiros; sort_order := 10; RETURN NEXT;
  row_label := 'Distribuicao - Capital Proprio / Lucros'; amount := v_capital_proprio; sort_order := 11; RETURN NEXT;
  row_label := '= Total Distribuido'; amount := v_total_distribuido; sort_order := 12; RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_value_added_statement(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_value_added_statement(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_value_added_statement(date, date) TO authenticated;
