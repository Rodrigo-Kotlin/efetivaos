-- FIN-FIX-DVA-1: rollback-only DVA reconciliation and period tests.
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
  (SELECT amount FROM public.get_value_added_statement('2026-01-01', '2026-01-31')
   WHERE row_label = '= Valor Adicionado Total a Distribuir'),
  33167.98::numeric,
  'January post-saneamento total added value to distribute is canonical'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_value_added_statement('2026-01-01', '2026-01-31')
   WHERE row_label = '= Total Distribuido'),
  33167.98::numeric,
  'January post-saneamento total distributed equals canonical total'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_value_added_statement('2026-01-01', '2026-01-31')
   WHERE row_label = '= Valor Adicionado Total a Distribuir')
  - (SELECT amount FROM public.get_value_added_statement('2026-01-01', '2026-01-31')
   WHERE row_label = '= Total Distribuido'),
  0::numeric,
  'DVA distribution equation closes'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_value_added_statement('2026-01-01', '2026-01-31')
   WHERE row_label = 'Distribuicao - Capital Proprio / Lucros'),
  (SELECT amount FROM public.get_income_statement('2026-01-01', '2026-01-31', null, null)
   WHERE row_code = 'RESULTADO_LIQUIDO'),
  'DVA own capital component equals DRE net result'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_income_statement('2026-01-01', '2026-01-31', null, null)
   WHERE row_code = 'RESULTADO_LIQUIDO'),
  11185.79::numeric,
  'post-saneamento DRE net result is January reference'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT count(*) FROM public.get_value_added_statement('2026-01-01', '2026-01-31')),
  12::bigint,
  'DVA keeps the existing 12-row return structure'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  (SELECT amount FROM public.get_value_added_statement('2026-01-01', '2026-01-31')
   WHERE row_label = '= Total Distribuido') >= 0,
  'DVA distributed total has the economic sign'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_value_added_statement('2099-01-01', '2099-01-31')
   WHERE row_label = '= Valor Adicionado Total a Distribuir'),
  (SELECT amount FROM public.get_value_added_statement('2099-01-01', '2099-01-31')
   WHERE row_label = '= Total Distribuido'),
  'empty period still satisfies the DVA equation'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  has_function_privilege('authenticated', 'public.get_value_added_statement(date,date)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_value_added_statement(date,date)', 'EXECUTE')
  AND NOT has_function_privilege('public', 'public.get_value_added_statement(date,date)', 'EXECUTE'),
  'DVA grants remain restricted'
);

SELECT result AS tap_line FROM pg_temp.tap_results ORDER BY seq;

ROLLBACK;
