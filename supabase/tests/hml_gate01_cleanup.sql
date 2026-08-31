-- ==========================================================================
-- FINANCE HOMOLOGATION GATE 01 — Cleanup
-- Cancel all HML-FIN-XXX fixtures using canonical cancel
-- ==========================================================================

-- Cancel each fixture that hasn't been cancelled yet
SELECT public.cancel_financial_transaction(
  (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-001 Receita a vista' AND status != 'cancelled'),
  'Homologation cleanup'
) as cleanup_001;

SELECT public.cancel_financial_transaction(
  (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-002 Despesa a vista' AND status != 'cancelled'),
  'Homologation cleanup'
) as cleanup_002;

SELECT public.cancel_financial_transaction(
  (SELECT id FROM public.financial_transactions WHERE description='HML-FIN-008 Receita conta B' AND status != 'cancelled'),
  'Homologation cleanup'
) as cleanup_008;

-- Verify: all HML-FIN should be cancelled
SELECT 'CLEANUP_VERIFY' as step,
  (SELECT count(*) FROM public.financial_transactions WHERE description LIKE 'HML-FIN-%') as total,
  (SELECT count(*) FROM public.financial_transactions WHERE description LIKE 'HML-FIN-%' AND status='cancelled') as cancelled,
  (SELECT count(*) FROM public.financial_transactions WHERE description LIKE 'HML-FIN-%' AND status != 'cancelled') as remaining;

-- Verify DRE net for all fixtures = 0
SELECT 'CLEANUP_DRE' as step,
  coalesce(sum(case when ca.nature='CREDITO' then jl.credit-jl.debit else jl.debit-jl.credit end),0) as dre_net_all_hml
FROM public.financial_journal_entries je
JOIN public.financial_journal_lines jl ON jl.entry_id=je.id
JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id
WHERE je.transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'HML-FIN-%')
AND ca.class in ('RECEITA','CUSTO','DESPESA');

-- Verify AR/AP for cancelled fixtures = 0
SELECT 'CLEANUP_AR_AP' as step,
  (SELECT coalesce(sum(rv.open_amount),0) FROM public.financial_receivables_v rv
   WHERE rv.transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'HML-FIN-%')) as ar_total,
  (SELECT coalesce(sum(pv.open_amount),0) FROM public.financial_payables_v pv
   WHERE pv.transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'HML-FIN-%')) as ap_total;

-- Verify forecast excludes all HML fixtures
SELECT 'CLEANUP_FORECAST' as step,
  (SELECT count(*) FROM public.financial_cashflow_forecast_v
   WHERE transaction_id IN (SELECT id FROM public.financial_transactions WHERE description LIKE 'HML-FIN-%')) as hml_in_forecast;

SELECT 'CLEANUP_COMPLETE' as status;
