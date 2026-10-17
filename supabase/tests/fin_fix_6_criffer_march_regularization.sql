-- FIN-FIX-6 verification queries. Read-only assertions for the DEV database.

DO $test$
DECLARE
  v_correction_id constant text := 'FIN-FIX-6::CRIFFER::2026-03::SOURCE-ROWS-118-119::282.51-274.64';
  v_entry_id uuid;
  v_transaction_id uuid;
  v_asset_account_id uuid;
  v_liability_account_id uuid;
  v_before_asset numeric(15,2);
  v_before_liability numeric(15,2);
  v_bank numeric(15,2);
  v_financial_assets_before bigint;
  v_financial_assets_after bigint;
BEGIN
  SELECT id INTO v_asset_account_id
  FROM public.financial_chart_accounts
  WHERE code = '1.2.99.001';

  SELECT id INTO v_liability_account_id
  FROM public.financial_chart_accounts
  WHERE code = '2.1.09.001';

  IF v_asset_account_id IS NULL OR v_liability_account_id IS NULL THEN
    RAISE EXCEPTION 'FIN-FIX-6 accounts missing';
  END IF;

  SELECT id, transaction_id INTO v_entry_id, v_transaction_id
  FROM public.financial_journal_entries
  WHERE idempotency_key = v_correction_id;

  IF v_entry_id IS NULL OR v_transaction_id IS NULL THEN
    RAISE EXCEPTION 'FIN-FIX-6 regularization not found';
  END IF;

  IF (SELECT count(*) FROM public.financial_journal_entries WHERE idempotency_key = v_correction_id) <> 1
     OR (SELECT count(*) FROM public.financial_transactions WHERE idempotency_key = v_correction_id) <> 1
     OR (SELECT count(*) FROM public.financial_journal_lines WHERE entry_id = v_entry_id) <> 2 THEN
    RAISE EXCEPTION 'FIN-FIX-6 duplicate or incomplete records';
  END IF;

  IF (SELECT coalesce(sum(debit), 0) FROM public.financial_journal_lines WHERE entry_id = v_entry_id) <> 557.15
     OR (SELECT coalesce(sum(credit), 0) FROM public.financial_journal_lines WHERE entry_id = v_entry_id) <> 557.15
     OR NOT EXISTS (SELECT 1 FROM public.financial_journal_lines WHERE entry_id = v_entry_id AND chart_account_id = v_asset_account_id AND debit = 557.15 AND credit = 0)
     OR NOT EXISTS (SELECT 1 FROM public.financial_journal_lines WHERE entry_id = v_entry_id AND chart_account_id = v_liability_account_id AND debit = 0 AND credit = 557.15) THEN
    RAISE EXCEPTION 'FIN-FIX-6 journal lines incorrect';
  END IF;

  SELECT coalesce(sum(jl.debit - jl.credit), 0) INTO v_before_asset
  FROM public.financial_journal_lines jl WHERE jl.chart_account_id = v_asset_account_id;
  SELECT coalesce(sum(jl.debit - jl.credit), 0) INTO v_before_liability
  FROM public.financial_journal_lines jl WHERE jl.chart_account_id = v_liability_account_id;
  SELECT coalesce(sum(jl.debit - jl.credit), 0) INTO v_bank
  FROM public.financial_journal_lines jl
  WHERE jl.chart_account_id = (SELECT id FROM public.financial_chart_accounts WHERE code = '1.1.01.002');

  IF v_before_asset <> 1123.99 OR v_before_liability <> -557.15 OR v_bank <> 2070.12 THEN
    RAISE EXCEPTION 'FIN-FIX-6 post balances incorrect: asset %, liability %, bank %', v_before_asset, v_before_liability, v_bank;
  END IF;

  IF (SELECT count(*) FROM public.financial_journal_lines jl JOIN public.financial_journal_entries je ON je.id = jl.entry_id WHERE je.idempotency_key = v_correction_id AND je.entry_type = 'ajuste') <> 2 THEN
    RAISE EXCEPTION 'FIN-FIX-6 adjustment line count incorrect';
  END IF;

  IF (SELECT movement_type FROM public.financial_transactions WHERE id = v_transaction_id) <> 'AJUSTE'
     OR (SELECT amount FROM public.financial_transactions WHERE id = v_transaction_id) <> 557.15
     OR (SELECT transaction_date FROM public.financial_transactions WHERE id = v_transaction_id) <> date '2026-03-01' THEN
    RAISE EXCEPTION 'FIN-FIX-6 transaction metadata incorrect';
  END IF;

  IF (SELECT count(*)
      FROM public.financial_journal_lines jl
      JOIN public.financial_journal_entries je ON je.id = jl.entry_id
      JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
      WHERE je.idempotency_key = v_correction_id
        AND ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')) <> 0 THEN
    RAISE EXCEPTION 'FIN-FIX-6 must not affect DRE accounts';
  END IF;

  IF (SELECT count(*)
      FROM public.financial_journal_entries
      WHERE idempotency_key = 'FIN-FIX-5::CRIFFER::2026-02::SOURCE-ROWS-101-102::282.18-284.66') <> 1 THEN
    RAISE EXCEPTION 'FIN-FIX-5.1 historical entry was not preserved';
  END IF;

  SELECT count(*) INTO v_financial_assets_before FROM public.financial_assets;
  SELECT count(*) INTO v_financial_assets_after FROM public.financial_assets;
  IF v_financial_assets_after <> v_financial_assets_before THEN
    RAISE EXCEPTION 'FIN-FIX-6 created a financial asset';
  END IF;

  IF (SELECT coalesce(sum(debit), 0) - coalesce(sum(credit), 0) FROM public.financial_journal_lines) <> 0 THEN
    RAISE EXCEPTION 'FIN-FIX-6 ledger is unbalanced';
  END IF;
END;
$test$;

SELECT 'FIN-FIX-6 assertions passed' AS result;
