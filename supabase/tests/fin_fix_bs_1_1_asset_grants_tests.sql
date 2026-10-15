-- FIN-FIX-BS-1.1: financial_assets ACL/RLS regression.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE TEMPORARY TABLE tap_results (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  result text NOT NULL
) ON COMMIT DROP;

GRANT INSERT, SELECT ON pg_temp.tap_results TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE pg_temp.tap_results_seq_seq TO authenticated, anon;

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.plan(13);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.financial_assets', 'SELECT'),
  'anon: no SELECT on financial_assets'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.financial_assets', 'INSERT'),
  'anon: no INSERT on financial_assets'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.financial_assets', 'UPDATE'),
  'anon: no UPDATE on financial_assets'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.financial_assets', 'DELETE'),
  'anon: no DELETE on financial_assets'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  NOT has_table_privilege('public', 'public.financial_assets', 'SELECT')
    AND NOT has_table_privilege('public', 'public.financial_assets', 'INSERT')
    AND NOT has_table_privilege('public', 'public.financial_assets', 'UPDATE')
    AND NOT has_table_privilege('public', 'public.financial_assets', 'DELETE'),
  'PUBLIC: no direct privileges on financial_assets'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.financial_assets', 'SELECT'),
  'authenticated: SELECT preserved'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.financial_assets', 'INSERT'),
  'authenticated: INSERT preserved'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.financial_assets', 'UPDATE'),
  'authenticated: UPDATE preserved'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.financial_assets', 'DELETE'),
  'authenticated: DELETE preserved'
);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  c.relrowsecurity,
  'RLS: enabled on financial_assets'
)
FROM pg_class c
WHERE c.oid = 'public.financial_assets'::regclass;

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.ok(
  NOT c.relforcerowsecurity,
  'RLS: FORCE RLS remains unchanged in this gate'
)
FROM pg_class c
WHERE c.oid = 'public.financial_assets'::regclass;

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.is(
  (SELECT roles::text
   FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'financial_assets'
     AND policyname = 'assets_select_authenticated'),
  '{authenticated}'::text,
  'policy: asset SELECT remains restricted to authenticated'
);

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);

INSERT INTO pg_temp.tap_results (result)
SELECT extensions.lives_ok(
  $sql$SELECT count(*) FROM public.financial_assets$sql$,
  'authenticated: existing asset read flow remains executable'
);

SELECT result AS tap_line FROM pg_temp.tap_results ORDER BY seq;

ROLLBACK;
