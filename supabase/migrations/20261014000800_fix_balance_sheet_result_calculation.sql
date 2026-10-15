-- FIN-FIX-BS-1: restore the balance-sheet equation without changing ledger data.
-- Keep the existing get_balance_sheet contract and authorization boundary.

CREATE OR REPLACE FUNCTION public.get_balance_sheet(p_as_of_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  row_code text,
  label text,
  class text,
  group_name text,
  amount numeric,
  sort_order integer,
  level integer,
  row_type text,
  presentation_sign smallint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
#variable_conflict use_column
BEGIN
  IF public.is_internal_user() IS NOT TRUE THEN
    RAISE EXCEPTION 'Apenas usuarios internos podem consultar o balanco patrimonial';
  END IF;

  RETURN QUERY
  WITH valid_journal_lines AS (
    SELECT
      jl.chart_account_id,
      ca.class,
      ca.nature,
      ca.dre_class,
      jl.debit,
      jl.credit
    FROM public.financial_journal_lines jl
    INNER JOIN public.financial_journal_entries je ON je.id = jl.entry_id
    INNER JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
    WHERE je.competence_date <= p_as_of_date
      AND je.status <> 'cancelled'
  ),
  account_totals AS (
    SELECT
      chart_account_id,
      COALESCE(SUM(debit), 0) AS total_debit,
      COALESCE(SUM(credit), 0) AS total_credit
    FROM valid_journal_lines
    GROUP BY chart_account_id
  ),
  account_balances AS (
    SELECT
      ca.id,
      ca.code,
      ca.name,
      ca.class,
      ca.nature,
      ca.current_class,
      ca.bp_group,
      ca.presentation_sign,
      ca.is_cash,
      COALESCE(at.total_debit, 0) AS total_debit,
      COALESCE(at.total_credit, 0) AS total_credit
    FROM public.financial_chart_accounts ca
    LEFT JOIN account_totals at ON at.chart_account_id = ca.id
    WHERE ca.class IN ('ATIVO', 'PASSIVO', 'PL')
      AND ca.active = true
  ),
  normalized AS (
    SELECT
      ab.*,
      CASE
        WHEN ab.nature = 'DEBITO' THEN ab.total_debit - ab.total_credit
        WHEN ab.nature = 'CREDITO' THEN ab.total_credit - ab.total_debit
        ELSE 0
      END AS balance
    FROM account_balances ab
  ),
  dre_result AS (
    SELECT COALESCE(SUM(
      CASE
        WHEN vjl.dre_class IN ('RECEITA_BRUTA', 'RECEITA_FINANCEIRA', 'OUTRAS_RECEITAS')
          THEN CASE WHEN vjl.nature = 'DEBITO' THEN vjl.debit - vjl.credit ELSE vjl.credit - vjl.debit END
        WHEN vjl.dre_class IN (
          'DEDUCAO_RECEITA',
          'CUSTO_SERVICO',
          'DESPESA_OPERACIONAL',
          'DEPRECIACAO_AMORTIZACAO',
          'DESPESA_FINANCEIRA',
          'OUTRAS_DESPESAS',
          'IMPOSTO_RESULTADO'
        )
          THEN -CASE WHEN vjl.nature = 'DEBITO' THEN vjl.debit - vjl.credit ELSE vjl.credit - vjl.debit END
        ELSE 0
      END
    ), 0) AS resultado
    FROM valid_journal_lines vjl
    WHERE vjl.class IN ('RECEITA', 'CUSTO', 'DESPESA')
      AND NULLIF(vjl.dre_class, '') IS NOT NULL
  ),
  all_rows AS (
    SELECT
      code,
      name,
      'ATIVO' AS cls,
      COALESCE(NULLIF(bp_group, ''), current_class::text, 'Ativo') AS grp,
      balance * presentation_sign AS amt,
      code AS sc,
      CASE WHEN bp_group = '' AND current_class IS NOT NULL THEN 1 WHEN bp_group <> '' THEN 2 ELSE 3 END AS rl,
      CASE WHEN bp_group = '' AND current_class IS NOT NULL THEN 'SUBTOTAL' ELSE 'DETAIL' END AS rt,
      presentation_sign AS ps,
      1 AS sort_seq
    FROM normalized
    WHERE class = 'ATIVO' AND balance <> 0

    UNION ALL

    SELECT
      code,
      name,
      'PASSIVO',
      COALESCE(NULLIF(bp_group, ''), current_class::text, 'Passivo'),
      balance * presentation_sign,
      code,
      CASE WHEN bp_group = '' AND current_class IS NOT NULL THEN 1 WHEN bp_group <> '' THEN 2 ELSE 3 END,
      CASE WHEN bp_group = '' AND current_class IS NOT NULL THEN 'SUBTOTAL' ELSE 'DETAIL' END,
      presentation_sign,
      2
    FROM normalized
    WHERE class = 'PASSIVO' AND balance <> 0

    UNION ALL

    SELECT
      code,
      name,
      'PL',
      COALESCE(NULLIF(bp_group, ''), 'Patrimonio Liquido'),
      balance * presentation_sign,
      code,
      2,
      'DETAIL',
      presentation_sign,
      3
    FROM normalized
    WHERE class = 'PL' AND balance <> 0

    UNION ALL

    SELECT
      'RE',
      'Resultado do Exercicio',
      'PL',
      'Resultados Acumulados',
      dr.resultado,
      'RE',
      2,
      'DETAIL',
      1::smallint,
      3
    FROM dre_result dr
    WHERE dr.resultado <> 0
  )
  SELECT
    code AS row_code,
    name AS label,
    cls AS class,
    grp AS group_name,
    amt AS amount,
    0::integer AS sort_order,
    rl AS level,
    rt AS row_type,
    ps AS presentation_sign
  FROM all_rows
  ORDER BY sort_seq, sc;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_balance_sheet(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_balance_sheet(date) TO authenticated;
