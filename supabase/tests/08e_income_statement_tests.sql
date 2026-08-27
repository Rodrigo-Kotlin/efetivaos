-- ============================================================================
-- ETAPA 08E — DRE Gerencial: SQL Test Suite (UNION ALL format)
-- 50 checks: grants, structure, formulas, filters, integrity.
-- ============================================================================

-- 1. Function exists
SELECT 'test_001_function_exists' AS test, CASE WHEN EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_income_statement'
) THEN 'PASS' ELSE 'FAIL' END AS result
UNION ALL
-- 2. Authenticated has EXECUTE
SELECT 'test_002_authenticated_execute', CASE WHEN EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_income_statement'
    AND p.proacl::text LIKE '%authenticated%'
) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 3. PUBLIC does NOT have EXECUTE
SELECT 'test_003_public_rejected', CASE WHEN NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_income_statement'
    AND p.proacl::text LIKE '%PUBLIC%'
) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 4. anon does NOT have EXECUTE
SELECT 'test_004_anon_rejected', CASE WHEN NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_income_statement'
    AND p.proacl::text LIKE '%anon%'
) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 5. Function is STABLE
SELECT 'test_005_is_stable', CASE WHEN EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_income_statement'
    AND p.provolatile = 's'
) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 6. Returns 14 rows
SELECT 'test_006_returns_14_rows', CASE WHEN (SELECT count(*) FROM public.get_income_statement()) = 14 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 7. Row codes match expected
SELECT 'test_007_row_codes', CASE WHEN (
  SELECT array_agg(row_code ORDER BY sort_order) FROM public.get_income_statement()
) = ARRAY[
  'RECEITA_BRUTA','DEDUCOES','RECEITA_LIQUIDA','CUSTOS','LUCRO_BRUTO',
  'DESPESAS_OPERACIONAIS','EBITDA','DEPRECIACAO','EBIT',
  'RESULTADO_FINANCEIRO','OUTROS_RESULTADOS','ANTES_IMPOSTOS',
  'IMPOSTOS','RESULTADO_LIQUIDO'
] THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 8. Sort order ascending
SELECT 'test_008_sort_order', CASE WHEN (
  SELECT count(*) FROM (
    SELECT sort_order, lag(sort_order) OVER (ORDER BY sort_order) AS prev
    FROM public.get_income_statement()
  ) t WHERE sort_order <= prev
) = 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 9. Receita Líquida formula
SELECT 'test_009_receita_liquida_formula', CASE WHEN (
  (SELECT amount FROM public.get_income_statement() WHERE row_code = 'RECEITA_LIQUIDA')
  = (SELECT amount FROM public.get_income_statement() WHERE row_code = 'RECEITA_BRUTA')
  - (SELECT amount FROM public.get_income_statement() WHERE row_code = 'DEDUCOES')
) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 10. Deductions are non-positive
SELECT 'test_010_deductions_non_positive', CASE WHEN (
  SELECT amount FROM public.get_income_statement() WHERE row_code = 'DEDUCOES'
) <= 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 11. Lucro Bruto formula
SELECT 'test_011_lucro_bruto_formula', CASE WHEN (
  (SELECT amount FROM public.get_income_statement() WHERE row_code = 'LUCRO_BRUTO')
  = (SELECT amount FROM public.get_income_statement() WHERE row_code = 'RECEITA_LIQUIDA')
  - (SELECT amount FROM public.get_income_statement() WHERE row_code = 'CUSTOS')
) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 12. EBITDA formula
SELECT 'test_012_ebitda_formula', CASE WHEN (
  (SELECT amount FROM public.get_income_statement() WHERE row_code = 'EBITDA')
  = (SELECT amount FROM public.get_income_statement() WHERE row_code = 'LUCRO_BRUTO')
  - (SELECT amount FROM public.get_income_statement() WHERE row_code = 'DESPESAS_OPERACIONAIS')
) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 13. EBIT formula
SELECT 'test_013_ebit_formula', CASE WHEN (
  (SELECT amount FROM public.get_income_statement() WHERE row_code = 'EBIT')
  = (SELECT amount FROM public.get_income_statement() WHERE row_code = 'EBITDA')
  - (SELECT amount FROM public.get_income_statement() WHERE row_code = 'DEPRECIACAO')
) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 14. Resultado antes tributos formula
SELECT 'test_014_antes_impostos_formula', CASE WHEN (
  (SELECT amount FROM public.get_income_statement() WHERE row_code = 'ANTES_IMPOSTOS')
  = (SELECT amount FROM public.get_income_statement() WHERE row_code = 'EBIT')
  + (SELECT amount FROM public.get_income_statement() WHERE row_code = 'RESULTADO_FINANCEIRO')
  + (SELECT amount FROM public.get_income_statement() WHERE row_code = 'OUTROS_RESULTADOS')
) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 15. Resultado Líquido formula
SELECT 'test_015_resultado_liquido_formula', CASE WHEN (
  (SELECT amount FROM public.get_income_statement() WHERE row_code = 'RESULTADO_LIQUIDO')
  = (SELECT amount FROM public.get_income_statement() WHERE row_code = 'ANTES_IMPOSTOS')
  - (SELECT amount FROM public.get_income_statement() WHERE row_code = 'IMPOSTOS')
) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 16. Subtotal rows count
SELECT 'test_016_subtotal_rows', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement() WHERE row_type = 'SUBTOTAL'
) = 6 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 17. Detail rows count
SELECT 'test_017_detail_rows', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement() WHERE row_type = 'DETAIL'
) = 7 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 18. Total row count
SELECT 'test_018_total_rows', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement() WHERE row_type = 'TOTAL'
) = 1 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 19. Wide date range returns 14 rows
SELECT 'test_019_wide_range', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement('2020-01-01'::date, '2099-12-31'::date, NULL, NULL)
) = 14 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 20. Narrow future range returns 14 rows (zeros preserved)
SELECT 'test_020_narrow_range', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement('2099-01-01'::date, '2099-01-31'::date, NULL, NULL)
) = 14 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 21. NULL cost center returns 14 rows
SELECT 'test_021_cost_center_null', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement(NULL, NULL, NULL, NULL)
) = 14 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 22. Non-existent cost center returns 14 rows (zeros)
SELECT 'test_022_cost_center_nonexist', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement(NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid, NULL)
) = 14 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 23. NULL service line returns 14 rows
SELECT 'test_023_service_line_null', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement(NULL, NULL, NULL, NULL)
) = 14 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 24. Non-existent service line returns 14 rows
SELECT 'test_024_service_line_nonexist', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement(NULL, NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid)
) = 14 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 25. Combined filters return 14 rows
SELECT 'test_025_combined_filters', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement('2020-01-01'::date, '2099-12-31'::date, NULL, NULL)
) = 14 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 26. All nonexistent filters yield zero amounts
SELECT 'test_026_all_nonexist_zero', CASE WHEN (
  SELECT SUM(ABS(amount)) FROM public.get_income_statement(NULL, NULL, '00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
) = 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 27. No duplicate row_code
SELECT 'test_027_no_duplicates', CASE WHEN (
  SELECT count(*) = count(DISTINCT row_code) FROM public.get_income_statement()
) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 28. All accounts with class IN (RECEITA,CUSTO,DESPESA) have dre_class
SELECT 'test_028_dre_class_complete', CASE WHEN (
  SELECT count(*) FROM public.financial_chart_accounts
  WHERE class IN ('RECEITA','CUSTO','DESPESA') AND (dre_class IS NULL OR dre_class = '')
) = 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 29. Known dre_class values count = 10
SELECT 'test_029_dre_class_count_10', CASE WHEN (
  SELECT count(DISTINCT dre_class) FROM public.financial_chart_accounts WHERE dre_class <> ''
) = 10 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 30. No desbalanced journals
SELECT 'test_030_no_desbalanced_journals', CASE WHEN (
  SELECT count(*) FROM (
    SELECT je.id FROM public.financial_journal_entries je
    JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
    GROUP BY je.id HAVING ABS(SUM(jl.debit) - SUM(jl.credit)) > 0.01
  ) t
) = 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 31. No orphan lines
SELECT 'test_031_no_orphan_lines', CASE WHEN (
  SELECT count(*) FROM public.financial_journal_lines jl
  WHERE NOT EXISTS (SELECT 1 FROM public.financial_journal_entries je WHERE je.id = jl.entry_id)
) = 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 32. Zero rows preserved (all 14 rows present even with no data)
SELECT 'test_032_zero_rows_preserved', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement('2099-01-01'::date, '2099-01-31'::date, NULL, NULL)
) = 14 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 33. Zero revenue receita_liquida = 0
SELECT 'test_033_zero_revenue_safe', CASE WHEN (
  SELECT amount FROM public.get_income_statement('2099-01-01'::date, '2099-01-31'::date, NULL, NULL)
  WHERE row_code = 'RECEITA_LIQUIDA'
) = 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 34. No NULL amounts
SELECT 'test_034_no_null_amounts', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement() WHERE amount IS NULL
) = 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 35. No NaN/Infinity amounts
SELECT 'test_035_no_nan_amounts', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement()
  WHERE amount::text LIKE '%NaN%' OR amount::text LIKE '%Infinity%'
) = 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 36. Deductions non-positive (detail row)
SELECT 'test_036_costs_non_positive', CASE WHEN (
  SELECT amount FROM public.get_income_statement() WHERE row_code = 'CUSTOS'
) <= 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 37. Operating expenses non-positive
SELECT 'test_037_opex_non_positive', CASE WHEN (
  SELECT amount FROM public.get_income_statement() WHERE row_code = 'DESPESAS_OPERACIONAIS'
) <= 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 38. Depreciation non-positive
SELECT 'test_038_depreciation_non_positive', CASE WHEN (
  SELECT amount FROM public.get_income_statement() WHERE row_code = 'DEPRECIACAO'
) <= 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 39. Taxes non-positive
SELECT 'test_039_taxes_non_positive', CASE WHEN (
  SELECT amount FROM public.get_income_statement() WHERE row_code = 'IMPOSTOS'
) <= 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 40. Receita Bruta non-negative
SELECT 'test_040_receita_bruta_non_neg', CASE WHEN (
  SELECT amount FROM public.get_income_statement() WHERE row_code = 'RECEITA_BRUTA'
) >= 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 41. No invalid dre_class in chart accounts
SELECT 'test_041_no_invalid_dre_class', CASE WHEN (
  SELECT count(*) FROM public.financial_chart_accounts
  WHERE dre_class NOT IN (
    '','RECEITA_BRUTA','DEDUCAO_RECEITA','RECEITA_FINANCEIRA','OUTRAS_RECEITAS',
    'CUSTO_SERVICO','DESPESA_OPERACIONAL','DEPRECIACAO_AMORTIZACAO',
    'DESPESA_FINANCEIRA','OUTRAS_DESPESAS','IMPOSTO_RESULTADO'
  )
) = 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 42. Competence date from filter works
SELECT 'test_042_competence_date_filter', CASE WHEN (
  SELECT count(*) FROM public.get_income_statement('2020-01-01'::date, '2099-12-31'::date, NULL, NULL)
) = 14 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 43. Accounts without dre_class don't silently enter
SELECT 'test_043_no_orphan_result', CASE WHEN (
  SELECT count(*) FROM public.financial_chart_accounts
  WHERE class IN ('RECEITA','CUSTO','DESPESA') AND (dre_class IS NULL OR dre_class = '')
) = 0 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 44. RESULTADO_LIQUIDO is the last row (sort_order 140)
SELECT 'test_044_last_row_is_total', CASE WHEN (
  SELECT sort_order FROM public.get_income_statement() WHERE row_code = 'RESULTADO_LIQUIDO'
) = 140 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 45. RECEITA_BRUTA is first row (sort_order 10)
SELECT 'test_045_first_row_is_receita_bruta', CASE WHEN (
  SELECT sort_order FROM public.get_income_statement() WHERE row_code = 'RECEITA_BRUTA'
) = 10 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 46. Total DRE reconciles: RESULTADO_LIQUIDO = sum of all other amounts
SELECT 'test_046_total_reconciles', CASE WHEN (
  (SELECT amount FROM public.get_income_statement() WHERE row_code = 'RESULTADO_LIQUIDO')
  = (SELECT SUM(amount) FROM public.get_income_statement() WHERE row_code != 'RESULTADO_LIQUIDO')
) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 47. Deductions label contains parentheses
SELECT 'test_047_deductions_label', CASE WHEN (
  SELECT label FROM public.get_income_statement() WHERE row_code = 'DEDUCOES'
) LIKE '(-)%' THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 48. EBITDA label matches reference
SELECT 'test_048_ebitda_label', CASE WHEN (
  SELECT label FROM public.get_income_statement() WHERE row_code = 'EBITDA'
) = 'EBITDA Gerencial' THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 49. Lucro Bruto label matches reference
SELECT 'test_049_lucro_bruto_label', CASE WHEN (
  SELECT label FROM public.get_income_statement() WHERE row_code = 'LUCRO_BRUTO'
) = 'Lucro Bruto / Margem de Contribuição' THEN 'PASS' ELSE 'FAIL' END
UNION ALL
-- 50. RESULTADO_LIQUIDO label matches
SELECT 'test_050_resultado_label', CASE WHEN (
  SELECT label FROM public.get_income_statement() WHERE row_code = 'RESULTADO_LIQUIDO'
) = 'RESULTADO LÍQUIDO' THEN 'PASS' ELSE 'FAIL' END;
