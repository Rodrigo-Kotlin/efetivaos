-- FIN-FIX-DLPA-1: rollback-only DLPA reconciliation and period tests.
BEGIN;

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE TEMPORARY TABLE tap_results (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  result text NOT NULL
) ON COMMIT DROP;

INSERT INTO pg_temp.tap_results (result) SELECT plan(9);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_retained_earnings_statement('2026-01-01', '2026-01-31')
   WHERE row_label = '(+) Resultado Liquido do Periodo'),
  (SELECT amount FROM public.get_income_statement('2026-01-01', '2026-01-31', null, null)
   WHERE row_code = 'RESULTADO_LIQUIDO'),
  'DLPA result equals January DRE result'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_retained_earnings_statement('2026-01-01', '2026-01-31')
   WHERE row_label = '(+) Resultado Liquido do Periodo'),
  14074.79::numeric,
  'DLPA result is R$ 14,074.79'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_retained_earnings_statement('2026-01-01', '2026-01-31')
   WHERE row_label = '= Saldo Final'),
  (SELECT amount FROM public.get_balance_sheet('2026-01-31') WHERE row_code = 'RE'),
  'DLPA final equals the comparable dynamic BP RE component'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_retained_earnings_statement('2026-01-01', '2026-01-31')
   WHERE row_label = 'Saldo Inicial de Lucros/Prejuizos Acumulados'),
  0::numeric,
  'DLPA opening accumulated-profit balance is separate from initial-balance equity'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_retained_earnings_statement('2026-01-01', '2026-01-31')
   WHERE row_label = '= Saldo Final'),
  14074.79::numeric,
  'DLPA final is R$ 14,074.79'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT count(*) FROM public.get_retained_earnings_statement('2026-01-01', '2026-01-31')),
  6::bigint,
  'DLPA keeps the existing six-row return structure'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_retained_earnings_statement('2099-01-01', '2099-01-31')
   WHERE row_label = '= Saldo Final'),
  0::numeric,
  'empty period has zero DLPA final balance'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  (SELECT amount FROM public.get_retained_earnings_statement('2026-01-01', '2026-01-31')
   WHERE row_label = '(+) Resultado Liquido do Periodo') >= 0,
  'DLPA result keeps the economic sign'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  has_function_privilege('authenticated', 'public.get_retained_earnings_statement(date,date)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_retained_earnings_statement(date,date)', 'EXECUTE')
  AND NOT has_function_privilege('public', 'public.get_retained_earnings_statement(date,date)', 'EXECUTE'),
  'DLPA grants remain restricted'
);

SELECT result AS tap_line FROM pg_temp.tap_results ORDER BY seq;

ROLLBACK;
