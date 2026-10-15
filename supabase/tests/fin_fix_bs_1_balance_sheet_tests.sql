-- FIN-FIX-BS-1: balance-sheet result, date filtering and security regression.
-- All fixtures are created through the authorized posting RPC and rolled back.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE TEMPORARY TABLE tap_results (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  result text NOT NULL
) ON COMMIT DROP;

GRANT INSERT, SELECT ON pg_temp.tap_results TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE pg_temp.tap_results_seq_seq TO authenticated, anon;

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.plan(17);

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);

CREATE TEMPORARY TABLE bs_baseline ON COMMIT DROP AS
SELECT
  (SELECT amount FROM public.get_balance_sheet(date '2026-01-31') WHERE row_code = '1.1.01.002') AS cash,
  (SELECT amount FROM public.get_balance_sheet(date '2026-01-31') WHERE row_code = 'RE') AS result,
  (SELECT amount FROM public.get_income_statement(date '2026-01-01', date '2026-01-31', NULL, NULL) WHERE row_code = 'RESULTADO_LIQUIDO') AS january_result,
  (SELECT amount FROM public.get_income_statement(date '2020-01-01', date '2026-01-31', NULL, NULL) WHERE row_code = 'RESULTADO_LIQUIDO') AS cumulative_result;

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.is(
  (SELECT cash FROM bs_baseline),
  2313.24::numeric,
  'post-saneamento: Banco Cora is R$ 2,313.24'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.is(
  (SELECT result FROM bs_baseline),
  (SELECT cumulative_result FROM bs_baseline),
  'baseline: balance-sheet result equals cumulative DRE'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.is(
  (SELECT january_result FROM bs_baseline),
  11185.79::numeric,
  'post-saneamento: January DRE result is R$ 11,185.79'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.get_balance_sheet(date)'::regprocedure),
  'security: get_balance_sheet remains SECURITY DEFINER'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = 'public.get_balance_sheet(date)'::regprocedure
      AND proconfig @> ARRAY['search_path=""']::text[]
  ),
  'security: get_balance_sheet keeps empty search_path'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.get_balance_sheet(date)', 'EXECUTE'),
  'security: authenticated retains EXECUTE'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.get_balance_sheet(date)', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.get_balance_sheet(date)', 'EXECUTE'),
  'security: anon and PUBLIC have no EXECUTE'
);

DO $$
DECLARE
  v_cash_id uuid;
  v_revenue_id uuid;
  v_entry_id uuid;
  v_transaction_id uuid;
BEGIN
  SELECT id INTO v_cash_id
  FROM public.financial_chart_accounts
  WHERE code = '1.1.01.002' AND active = true;

  SELECT id INTO v_revenue_id
  FROM public.financial_chart_accounts
  WHERE code = '3.1.01.001' AND active = true;

  IF v_cash_id IS NULL OR v_revenue_id IS NULL THEN
    RAISE EXCEPTION 'FIN-FIX-BS-1 fixture accounts are missing';
  END IF;

  PERFORM public.create_manual_journal_adjustment(
    date '2025-12-31', date '2025-12-31', 'FIN-FIX-BS-1 prior fixture',
    format('[{"chart_account_id":"%s","debit":10,"credit":0},{"chart_account_id":"%s","debit":0,"credit":10}]', v_cash_id, v_revenue_id)::jsonb,
    'FIN-FIX-BS-1-PRIOR', NULL, NULL, NULL, 'Rollback-only period fixture'
  );

  PERFORM public.create_manual_journal_adjustment(
    date '2026-01-15', date '2026-01-15', 'FIN-FIX-BS-1 in-period fixture',
    format('[{"chart_account_id":"%s","debit":20,"credit":0},{"chart_account_id":"%s","debit":0,"credit":20}]', v_cash_id, v_revenue_id)::jsonb,
    'FIN-FIX-BS-1-IN-PERIOD', NULL, NULL, NULL, 'Rollback-only period fixture'
  );

  PERFORM public.create_manual_journal_adjustment(
    date '2026-02-01', date '2026-02-01', 'FIN-FIX-BS-1 posterior fixture',
    format('[{"chart_account_id":"%s","debit":40,"credit":0},{"chart_account_id":"%s","debit":0,"credit":40}]', v_cash_id, v_revenue_id)::jsonb,
    'FIN-FIX-BS-1-POSTERIOR', NULL, NULL, NULL, 'Rollback-only period fixture'
  );

  v_entry_id := public.create_manual_journal_adjustment(
    date '2026-01-20', date '2026-01-20', 'FIN-FIX-BS-1 cancelled fixture',
    format('[{"chart_account_id":"%s","debit":50,"credit":0},{"chart_account_id":"%s","debit":0,"credit":50}]', v_cash_id, v_revenue_id)::jsonb,
    'FIN-FIX-BS-1-CANCELLED', NULL, NULL, NULL, 'Rollback-only cancelled fixture'
  );

  SELECT transaction_id INTO v_transaction_id
  FROM public.financial_journal_entries
  WHERE id = v_entry_id;

  PERFORM public.cancel_financial_transaction(v_transaction_id, 'FIN-FIX-BS-1 cancelled fixture');
END $$;

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.is(
  (SELECT amount FROM public.get_balance_sheet(date '2026-01-31') WHERE row_code = '1.1.01.002'),
  (SELECT cash + 30 FROM bs_baseline),
  'period: prior and in-period entries included; posterior entry excluded'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.is(
  (SELECT count(*) FROM public.financial_journal_entries WHERE description LIKE 'FIN-FIX-BS-1 % fixture'),
  4::bigint,
  'fixture: four rollback-only entries were created'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.is(
  (SELECT count(*)
   FROM public.financial_transactions
   WHERE description = 'FIN-FIX-BS-1 cancelled fixture' AND status = 'cancelled'),
  1::bigint,
  'period: cancelled entry is marked cancelled'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.is(
  (SELECT amount FROM public.get_income_statement(date '2020-01-01', date '2026-01-31', NULL, NULL) WHERE row_code = 'RESULTADO_LIQUIDO'),
  (SELECT cumulative_result + 30 FROM bs_baseline),
  'period: cumulative DRE includes only entries through as-of date'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.is(
  (SELECT amount FROM public.get_balance_sheet(date '2026-01-31') WHERE row_code = 'RE'),
  (SELECT amount FROM public.get_income_statement(date '2020-01-01', date '2026-01-31', NULL, NULL) WHERE row_code = 'RESULTADO_LIQUIDO'),
  'consistency: balance-sheet result equals DRE result after fixtures'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.is(
  ABS(
    (SELECT COALESCE(SUM(amount), 0) FROM public.get_balance_sheet(date '2026-01-31') WHERE class = 'ATIVO')
    - (
      (SELECT COALESCE(SUM(amount), 0) FROM public.get_balance_sheet(date '2026-01-31') WHERE class = 'PASSIVO')
      + (SELECT COALESCE(SUM(amount), 0) FROM public.get_balance_sheet(date '2026-01-31') WHERE class = 'PL')
    )
  ),
  0::numeric,
  'equation: ATIVO = PASSIVO + PL after fixtures'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.is(
  (SELECT amount FROM public.get_balance_sheet(date '2026-01-31') WHERE row_code = '1.1.01.002')
    - (SELECT amount FROM public.get_balance_sheet(date '2026-02-28') WHERE row_code = '1.1.01.002'),
  (-40)::numeric,
  'period: posterior entry appears only after its competence date'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM public.get_balance_sheet(date '2026-01-31')
    WHERE row_code = 'NON_EXISTENT_ZERO_ACCOUNT'
  ),
  'presentation: zero accounts are not introduced as phantom rows'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.is(
  (SELECT amount FROM public.get_balance_sheet(date '2026-01-31') WHERE row_code = '2.3.99.001'),
  4386.45::numeric,
  'equity: opening-balance counterpart remains R$ 4,386.45'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.is(
  (SELECT amount FROM public.get_balance_sheet(date '2026-01-31') WHERE row_code = '2.1.06.001'),
  (-10000)::numeric,
  'liability: loan presentation sign remains -R$ 10,000.00'
);

SELECT result AS tap_line FROM pg_temp.tap_results ORDER BY seq;

ROLLBACK;
