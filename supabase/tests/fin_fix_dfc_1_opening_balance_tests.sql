-- FIN-FIX-DFC-1: rollback-only DFC opening/closing semantics.
BEGIN;

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE TEMPORARY TABLE tap_results (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  result text NOT NULL
) ON COMMIT DROP;

INSERT INTO pg_temp.tap_results (result) SELECT plan(14);

INSERT INTO pg_temp.tap_results (result)
SELECT is(public.cashflow_opening_balance('2026-01-01', NULL), 4386.45::numeric,
  'January opening includes explicit SALDO_INICIAL on the period start');

INSERT INTO pg_temp.tap_results (result)
SELECT is(public.cashflow_opening_balance('2026-02-01', NULL), 2313.24::numeric,
  'February opening uses the accumulated January cash balance');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT net_amount FROM public.get_cash_flow_statement('2026-01-01', '2026-01-31', NULL, NULL)
           WHERE dfc_class = 'OPERACIONAL'), 7926.79::numeric,
  'January operating cash flow is unchanged');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT net_amount FROM public.get_cash_flow_statement('2026-01-01', '2026-01-31', NULL, NULL)
           WHERE dfc_class = 'INVESTIMENTO'), 0::numeric,
  'January investing cash flow is unchanged');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT net_amount FROM public.get_cash_flow_statement('2026-01-01', '2026-01-31', NULL, NULL)
           WHERE dfc_class = 'FINANCIAMENTO'), -10000::numeric,
  'January financing cash flow is unchanged');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT net_amount FROM public.get_cash_flow_statement('2026-01-01', '2026-01-31', NULL, NULL)
           WHERE dfc_class = 'VARIACAO'), -2073.21::numeric,
  'SALDO_INICIAL is excluded from net change');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT opening_balance FROM public.get_cash_flow_statement('2026-01-01', '2026-01-31', NULL, NULL)
           WHERE dfc_class = 'SALDO_INICIAL'), 4386.45::numeric,
  'DFC opening row exposes the ledger opening balance');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT net_amount FROM public.get_cash_flow_statement('2026-01-01', '2026-01-31', NULL, NULL)
           WHERE dfc_class = 'SALDO_FINAL'), 2313.24::numeric,
  'DFC closing balance reconciles with Banco Cora');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT net_amount FROM public.get_cash_flow_statement('2026-01-01', '2026-01-31', NULL, NULL)
           WHERE dfc_class = 'SALDO_FINAL')
          - ((SELECT opening_balance FROM public.get_cash_flow_statement('2026-01-01', '2026-01-31', NULL, NULL)
              WHERE dfc_class = 'SALDO_INICIAL')
             + (SELECT net_amount FROM public.get_cash_flow_statement('2026-01-01', '2026-01-31', NULL, NULL)
                WHERE dfc_class = 'VARIACAO')), 0::numeric,
  'opening plus net change equals closing');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT realized_inflows - realized_outflows
           FROM public.cashflow_summary('2026-01-01', '2026-01-31', NULL, NULL, NULL)),
          -2073.21::numeric,
  'cashflow summary excludes SALDO_INICIAL from realized flows');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT closing_balance
           FROM public.cashflow_summary('2026-01-01', '2026-01-31', NULL, NULL, NULL)),
          2313.24::numeric,
  'cashflow summary closing balance reconciles with ledger');

DO $$
DECLARE
  v_cash uuid;
  v_revenue uuid;
BEGIN
  SELECT id INTO v_cash
  FROM public.financial_chart_accounts
  WHERE code = '1.1.01.002' AND active = true;

  SELECT id INTO v_revenue
  FROM public.financial_chart_accounts
  WHERE code = '3.1.01.001' AND active = true;

  PERFORM public.create_manual_journal_adjustment(
    date '2026-01-01', date '2026-01-01', 'FIN-FIX-DFC-1 first-day flow fixture',
    jsonb_build_array(
      jsonb_build_object('chart_account_id', v_cash, 'debit', 10, 'credit', 0),
      jsonb_build_object('chart_account_id', v_revenue, 'debit', 0, 'credit', 10)
    ), 'FIN-FIX-DFC-1-FIRST-DAY-FLOW', NULL, NULL,
    'b0000000-0000-0000-0000-000000000001'::uuid,
    'Rollback-only DFC opening semantics fixture'
  );
END $$;

INSERT INTO pg_temp.tap_results (result)
SELECT is(public.cashflow_opening_balance('2026-01-01', NULL), 4386.45::numeric,
  'a normal first-day cash flow does not enter opening balance');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT net_amount FROM public.get_cash_flow_statement('2026-01-01', '2026-01-31', NULL, NULL)
           WHERE dfc_class = 'OPERACIONAL'), 7936.79::numeric,
  'a normal first-day cash flow enters operating activity');

INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (
  SELECT 1
  FROM public.financial_cashflow_realized_v
  WHERE entry_date BETWEEN '2026-01-01' AND '2026-01-31'
    AND movement_type = 'SALDO_INICIAL'
    AND dfc_class <> 'NAO_CAIXA'
), 'SALDO_INICIAL remains classified as NAO_CAIXA');

SELECT result AS tap_line FROM pg_temp.tap_results ORDER BY seq;

ROLLBACK;
