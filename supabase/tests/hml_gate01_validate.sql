-- ==========================================================================
-- FINANCE HOMOLOGATION GATE 01 — Validation
-- ==========================================================================

-- SCENARIO A: Cash Revenue
SELECT 'SCENARIO_A' as step, status, version,
  (SELECT rv.open_amount FROM public.financial_receivables_v rv WHERE rv.transaction_id=ft.id) as ar_open,
  (SELECT pv.open_amount FROM public.financial_payables_v pv WHERE pv.transaction_id=ft.id) as ap_open
FROM public.financial_transactions ft
WHERE description='HML-FIN-001 Receita a vista';

-- SCENARIO B: Cash Expense
SELECT 'SCENARIO_B' as step, status,
  (SELECT rv.open_amount FROM public.financial_receivables_v rv WHERE rv.transaction_id=ft.id) as ar_open,
  (SELECT pv.open_amount FROM public.financial_payables_v pv WHERE pv.transaction_id=ft.id) as ap_open
FROM public.financial_transactions ft
WHERE description='HML-FIN-002 Despesa a vista';

-- SCENARIO C: Credit Revenue (settled after edit 500->550)
SELECT 'SCENARIO_C' as step, status, amount, version,
  (SELECT rv.open_amount FROM public.financial_receivables_v rv WHERE rv.transaction_id=ft.id) as ar_open,
  (SELECT count(*) FROM public.financial_journal_entries je WHERE je.transaction_id=ft.id) as journal_count
FROM public.financial_transactions ft
WHERE description='HML-FIN-003 Receita a prazo';

-- SCENARIO D: Credit Expense (settled after edit 300->325)
SELECT 'SCENARIO_D' as step, status, amount,
  (SELECT pv.open_amount FROM public.financial_payables_v pv WHERE pv.transaction_id=ft.id) as ap_open,
  (SELECT count(*) FROM public.financial_journal_entries je WHERE je.transaction_id=ft.id) as journal_count
FROM public.financial_transactions ft
WHERE description='HML-FIN-004 Despesa a prazo';

-- SCENARIO E: Cancelled pending
SELECT 'SCENARIO_E' as step, status,
  (SELECT rv.open_amount FROM public.financial_receivables_v rv WHERE rv.transaction_id=ft.id) as ar_open,
  (SELECT count(*) FROM public.financial_journal_entries je WHERE je.transaction_id=ft.id) as journal_count
FROM public.financial_transactions ft
WHERE description='HML-FIN-005 Receita pending para cancelar';

-- E: DRE net should be 0
SELECT 'SCENARIO_E_DRE' as step,
  coalesce(sum(case when ca.nature='CREDITO' then jl.credit-jl.debit else jl.debit-jl.credit end),0) as dre_net
FROM public.financial_journal_entries je
JOIN public.financial_journal_lines jl ON jl.entry_id=je.id
JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id
WHERE je.transaction_id = (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-005 Receita pending para cancelar')
AND ca.class in ('RECEITA','CUSTO','DESPESA');

-- SCENARIO F: Cash reversal
SELECT 'SCENARIO_F' as step, status,
  (SELECT count(*) FROM public.financial_journal_entries je WHERE je.transaction_id=ft.id) as journal_count
FROM public.financial_transactions ft
WHERE description='HML-FIN-006 Receita a vista para estornar';

SELECT 'SCENARIO_F_DRE' as step,
  coalesce(sum(case when ca.nature='CREDITO' then jl.credit-jl.debit else jl.debit-jl.credit end),0) as dre_net
FROM public.financial_journal_entries je
JOIN public.financial_journal_lines jl ON jl.entry_id=je.id
JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id
WHERE je.transaction_id = (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-006 Receita a vista para estornar')
AND ca.class in ('RECEITA','CUSTO','DESPESA');

-- SCENARIO G: Credit settled reversal
SELECT 'SCENARIO_G' as step, status,
  (SELECT rv.open_amount FROM public.financial_receivables_v rv WHERE rv.transaction_id=ft.id) as ar_open,
  (SELECT count(*) FROM public.financial_journal_entries je WHERE je.transaction_id=ft.id) as journal_count
FROM public.financial_transactions ft
WHERE description='HML-FIN-007 Receita a prazo para estornar';

SELECT 'SCENARIO_G_DRE' as step,
  coalesce(sum(case when ca.nature='CREDITO' then jl.credit-jl.debit else jl.debit-jl.credit end),0) as dre_net
FROM public.financial_journal_entries je
JOIN public.financial_journal_lines jl ON jl.entry_id=je.id
JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id
WHERE je.transaction_id = (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-007 Receita a prazo para estornar')
AND ca.class in ('RECEITA','CUSTO','DESPESA');

-- SCENARIO 17: Different account
SELECT 'SCENARIO_17' as step, status, description
FROM public.financial_transactions ft
WHERE description='HML-FIN-008 Receita conta B';

-- ==========================================================================
-- VIEWS VALIDATION
-- ==========================================================================
SELECT 'AR_VIEW' as step,
  (SELECT count(*) FROM public.financial_receivables_v WHERE open_amount > 0 AND status='pending') as pending_ar,
  (SELECT count(*) FROM public.financial_receivables_v WHERE status='cancelled' AND open_amount <> 0) as cancelled_ar_nonzero,
  (SELECT count(*) FROM public.financial_receivables_v WHERE open_amount < 0) as negative_ar;

SELECT 'AP_VIEW' as step,
  (SELECT count(*) FROM public.financial_payables_v WHERE open_amount > 0 AND status='pending') as pending_ap,
  (SELECT count(*) FROM public.financial_payables_v WHERE status='cancelled' AND open_amount <> 0) as cancelled_ap_nonzero,
  (SELECT count(*) FROM public.financial_payables_v WHERE open_amount < 0) as negative_ap;

SELECT 'FORECAST' as step,
  (SELECT count(*) FROM public.financial_cashflow_forecast_v WHERE status='cancelled') as cancelled_in_forecast,
  (SELECT count(*) FROM public.financial_cashflow_forecast_v WHERE status='settled') as settled_in_forecast;

-- Overlap
SELECT 'OVERLAP' as step,
  (SELECT count(*) FROM
    (SELECT transaction_id FROM public.financial_receivables_v WHERE open_amount > 0
     INTERSECT
     SELECT transaction_id FROM public.financial_payables_v WHERE open_amount > 0) x) as overlap_count;

-- Cashflow
SELECT 'CASHFLOW_TODAY' as step, * FROM public.cashflow_summary(current_date, current_date, null, null, null);

-- Ledger integrity
SELECT 'LEDGER_INTEGRITY' as step,
  (SELECT count(*) FROM (
    SELECT je.id
    FROM public.financial_journal_entries je
    JOIN public.financial_journal_lines jl ON jl.entry_id=je.id
    WHERE je.transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'HML-FIN-%')
    GROUP BY je.id
    HAVING abs(sum(jl.debit) - sum(jl.credit)) > 0.005
  ) x) as unbalanced,
  (SELECT count(*) FROM public.financial_journal_lines jl
   LEFT JOIN public.financial_journal_entries je ON je.id=jl.entry_id
   WHERE je.id IS NULL) as orphan_lines;

-- BP: Assets = Liabilities + Equity + Result
SELECT 'BP_EQUATION' as step,
  (SELECT coalesce(sum(jl.debit-jl.credit),0) FROM public.financial_journal_entries je
   JOIN public.financial_journal_lines jl ON jl.entry_id=je.id
   JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id
   WHERE je.transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'HML-FIN-%')
   AND ca.class='ATIVO') as assets,
  (SELECT coalesce(sum(jl.credit-jl.debit),0) FROM public.financial_journal_entries je
   JOIN public.financial_journal_lines jl ON jl.entry_id=je.id
   JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id
   WHERE je.transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'HML-FIN-%')
   AND ca.class='PASSIVO') as liabilities,
  (SELECT coalesce(sum(jl.credit-jl.debit),0) FROM public.financial_journal_entries je
   JOIN public.financial_journal_lines jl ON jl.entry_id=je.id
   JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id
   WHERE je.transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'HML-FIN-%')
   AND ca.class='PL') as equity,
  (SELECT coalesce(sum(jl.credit-jl.debit),0) FROM public.financial_journal_entries je
   JOIN public.financial_journal_lines jl ON jl.entry_id=je.id
   JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id
   WHERE je.transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'HML-FIN-%')
   AND ca.class='RECEITA') as revenue,
  (SELECT coalesce(sum(jl.debit-jl.credit),0) FROM public.financial_journal_entries je
   JOIN public.financial_journal_lines jl ON jl.entry_id=je.id
   JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id
   WHERE je.transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'HML-FIN-%')
   AND ca.class in ('CUSTO','DESPESA')) as expenses;

SELECT 'VALIDATION_COMPLETE' as status;
