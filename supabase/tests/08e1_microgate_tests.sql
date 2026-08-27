-- ============================================================================
-- MICROGATE 08E.1 — DRE Security + Validation Tests (UNION ALL format)
-- 15 checks focused on permissions, competence, integrity, formulas
-- ============================================================================

SELECT * FROM (
  -- 1. security_definer
  SELECT 'security_definer' AS test_name,
         (SELECT p.prosecdef FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'get_income_statement') = true AS passed

  UNION ALL

  -- 2. search_path_set
  SELECT 'search_path_set',
         (SELECT p.proconfig FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'get_income_statement')
         @> ARRAY['search_path=public, pg_temp']

  UNION ALL

  -- 3. public_no_execute
  SELECT 'public_no_execute',
         (SELECT p.proacl::text FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'get_income_statement')
         NOT LIKE '%=X/public%'

  UNION ALL

  -- 4. anon_no_execute
  SELECT 'anon_no_execute',
         (SELECT p.proacl::text FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'get_income_statement')
         NOT LIKE '%=X/anon%'

  UNION ALL

  -- 5. authenticated_has_execute
  SELECT 'authenticated_has_execute',
         (SELECT p.proacl::text FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'get_income_statement')
         LIKE '%authenticated%'

  UNION ALL

  -- 6. is_internal_user_definer
  SELECT 'is_internal_user_definer',
         (SELECT p.prosecdef FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'is_internal_user') = true

  UNION ALL

  -- 7. dre_returns_14_rows
  SELECT 'dre_returns_14_rows',
         (SELECT count(*) FROM public.get_income_statement(NULL, NULL, NULL, NULL)) = 14

  UNION ALL

  -- 8. formula_receita_liquida: RL = RB - DED
  SELECT 'formula_receita_liquida',
         (SELECT count(*) = 0 FROM (
           SELECT rb.amount - ded.amount - rl.amount AS diff
           FROM public.get_income_statement(NULL, NULL, NULL, NULL) rb
           JOIN public.get_income_statement(NULL, NULL, NULL, NULL) ded ON ded.row_code = 'DEDUCOES'
           JOIN public.get_income_statement(NULL, NULL, NULL, NULL) rl ON rl.row_code = 'RECEITA_LIQUIDA'
           WHERE rb.row_code = 'RECEITA_BRUTA'
         ) t WHERE t.diff != 0)

  UNION ALL

  -- 9. formula_ebitda: EBITDA = LUCRO_BRUTO - DESPESAS_OPERACIONAIS
  SELECT 'formula_ebitda',
         (SELECT count(*) = 0 FROM (
           SELECT lb.amount - d.amount - e.amount AS diff
           FROM public.get_income_statement(NULL, NULL, NULL, NULL) lb
           JOIN public.get_income_statement(NULL, NULL, NULL, NULL) d ON d.row_code = 'DESPESAS_OPERACIONAIS'
           JOIN public.get_income_statement(NULL, NULL, NULL, NULL) e ON e.row_code = 'EBITDA'
           WHERE lb.row_code = 'LUCRO_BRUTO'
         ) t WHERE t.diff != 0)

  UNION ALL

  -- 10. formula_resultado_liquido: RL = ANTES_IMPOSTOS + IMPOSTOS (IMPOSTOS is negative)
  SELECT 'formula_resultado_liquido',
         (SELECT count(*) = 0 FROM (
           SELECT ai.amount + imp.amount - rl.amount AS diff
           FROM public.get_income_statement(NULL, NULL, NULL, NULL) ai
           JOIN public.get_income_statement(NULL, NULL, NULL, NULL) imp ON imp.row_code = 'IMPOSTOS'
           JOIN public.get_income_statement(NULL, NULL, NULL, NULL) rl ON rl.row_code = 'RESULTADO_LIQUIDO'
           WHERE ai.row_code = 'ANTES_IMPOSTOS'
         ) t WHERE t.diff != 0)

  UNION ALL

  -- 11. no_result_accounts_without_dre_class
  SELECT 'no_result_accounts_without_dre_class',
         (SELECT count(*) = 0 FROM public.financial_chart_accounts
          WHERE class IN ('RECEITA','CUSTO','DESPESA')
            AND (dre_class IS NULL OR dre_class = ''))

  UNION ALL

  -- 12. no_invalid_dre_class
  SELECT 'no_invalid_dre_class',
         (SELECT count(*) = 0 FROM public.financial_chart_accounts
          WHERE dre_class IS NOT NULL AND dre_class <> ''
            AND dre_class NOT IN (
              'RECEITA_BRUTA','DEDUCAO_RECEITA','RECEITA_FINANCEIRA','OUTRAS_RECEITAS',
              'CUSTO_SERVICO','DESPESA_OPERACIONAL','DEPRECIACAO_AMORTIZACAO',
              'DESPESA_FINANCEIRA','OUTRAS_DESPESAS','IMPOSTO_RESULTADO'
            ))

  UNION ALL

  -- 13. unbalanced_journals_zero
  SELECT 'unbalanced_journals_zero',
         COALESCE((SELECT count(*) = 0 FROM public.financial_journal_entries je
          JOIN public.financial_journal_lines jl ON je.id = jl.entry_id
          GROUP BY je.id HAVING sum(jl.debit) - sum(jl.credit) != 0), true)

  UNION ALL

  -- 14. orphan_lines_zero
  SELECT 'orphan_lines_zero',
         (SELECT count(*) = 0 FROM public.financial_journal_lines jl
          WHERE NOT EXISTS (
            SELECT 1 FROM public.financial_journal_entries je WHERE je.id = jl.entry_id
          ))

  UNION ALL

  -- 15. null_filters_no_error
  SELECT 'null_filters_no_error',
         (SELECT count(*) >= 0 FROM public.get_income_statement(NULL, NULL, NULL, NULL))
) all_tests
ORDER BY test_name;
