-- FIN-FIX-DMPL-1: rollback-only DMPL reconciliation and period tests.
BEGIN;

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE TEMPORARY TABLE tap_results (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  result text NOT NULL
) ON COMMIT DROP;

INSERT INTO pg_temp.tap_results (result) SELECT plan(8);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_income_statement('2026-01-01', '2026-01-31', null, null)
   WHERE row_code = 'RESULTADO_LIQUIDO'),
  11185.79::numeric,
  'January post-saneamento DRE net result is canonical'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT resultado_exercicio FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-01-31')
   WHERE row_label = 'Resultado do Periodo'),
  (SELECT amount FROM public.get_income_statement('2026-01-01', '2026-01-31', null, null)
   WHERE row_code = 'RESULTADO_LIQUIDO'),
  'DMPL period result equals January DRE result'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_balance_sheet('2026-01-31')
   WHERE row_code = 'RE'),
  (SELECT resultado_exercicio FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-01-31')
   WHERE row_label = 'Resultado do Periodo'),
  'BP result equals DMPL period result'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT resultado_exercicio FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-01-31')
   WHERE row_label = 'Resultado do Periodo'),
  11185.79::numeric,
  'January post-saneamento DMPL period result is R$ 11,185.79'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  (SELECT resultado_exercicio FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-01-31')
   WHERE row_label = 'Saldo Inicial') = 0,
  'January DMPL opening result has no prior-period result'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  (SELECT total_pl FROM public.get_statement_of_changes_in_equity('2026-01-01', '2026-01-31')
   WHERE row_label = 'Saldo Final') IS NOT NULL,
  'DMPL returns a final PL balance'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  has_function_privilege('authenticated', 'public.get_statement_of_changes_in_equity(date,date)', 'EXECUTE'),
  'authenticated retains DMPL EXECUTE'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_statement_of_changes_in_equity(date,date)', 'EXECUTE')
  AND NOT has_function_privilege('public', 'public.get_statement_of_changes_in_equity(date,date)', 'EXECUTE'),
  'anon and PUBLIC cannot execute DMPL'
);

SELECT result AS tap_line FROM pg_temp.tap_results ORDER BY seq;

ROLLBACK;
