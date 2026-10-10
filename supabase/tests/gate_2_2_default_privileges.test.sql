-- Gate 2.2: catalog and temporary-object checks for future public objects.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE TEMPORARY TABLE tap_results (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  result text NOT NULL
) ON COMMIT DROP;

INSERT INTO pg_temp.tap_results (result) SELECT plan(21);

-- The application owner defaults are hardened; service_role remains present.
INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole = 'postgres'::regrole
      AND n.nspname = 'public'
      AND d.defaclobjtype IN ('r', 'S', 'f')
      AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
  ),
  'postgres/public defaults do not grant anon or authenticated access'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  (SELECT count(DISTINCT d.defaclobjtype) = 3
   FROM pg_default_acl d
   JOIN pg_namespace n ON n.oid = d.defaclnamespace
   CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE d.defaclrole = 'postgres'::regrole
     AND n.nspname = 'public'
     AND d.defaclobjtype IN ('r', 'S', 'f')
     AND a.grantee = 'service_role'::regrole),
  'postgres/public defaults preserve service_role for tables, sequences and functions'
);

-- Platform-managed storage defaults are intentionally outside this migration.
INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  EXISTS (SELECT 1 FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace
          WHERE d.defaclrole = 'postgres'::regrole AND n.nspname = 'storage' AND d.defaclobjtype = 'r')
    AND EXISTS (SELECT 1 FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace
          WHERE d.defaclrole = 'postgres'::regrole AND n.nspname = 'storage' AND d.defaclobjtype = 'S')
    AND EXISTS (SELECT 1 FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace
          WHERE d.defaclrole = 'postgres'::regrole AND n.nspname = 'storage' AND d.defaclobjtype = 'f'),
  'storage defaults remain present and untouched'
);

CREATE TABLE public."TMP_ACL_GATE22_TABLE" (id integer);
CREATE SEQUENCE public."TMP_ACL_GATE22_SEQUENCE";
CREATE FUNCTION public."TMP_ACL_GATE22_FUNCTION"()
RETURNS integer LANGUAGE sql AS 'SELECT 1';

-- Literal ACLs contain no automatic anon/authenticated grants.
INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (
  SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
  WHERE c.oid = 'public."TMP_ACL_GATE22_TABLE"'::regclass
    AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
), 'temporary table has no anon/authenticated ACL entries');

INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (
  SELECT 1 FROM aclexplode(coalesce(s.relacl, acldefault('S', s.relowner))) a
  WHERE s.oid = 'public."TMP_ACL_GATE22_SEQUENCE"'::regclass
    AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
), 'temporary sequence has no anon/authenticated ACL entries');

INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (
  SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  WHERE p.oid = 'public."TMP_ACL_GATE22_FUNCTION"()'::regprocedure
    AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
), 'temporary function has no anon/authenticated ACL entries');

-- Effective table, sequence and function privileges are denied to public roles
-- and kept for service_role. The function checks prove global default denial;
-- the explicit grant check proves intentional RPC exposure still works.
INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT has_table_privilege('public', 'public."TMP_ACL_GATE22_TABLE"', 'SELECT'), 'PUBLIC cannot select temporary table');
INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT has_table_privilege('anon', 'public."TMP_ACL_GATE22_TABLE"', 'SELECT'), 'anon cannot select temporary table');
INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT has_table_privilege('authenticated', 'public."TMP_ACL_GATE22_TABLE"', 'SELECT'), 'authenticated cannot select temporary table');
INSERT INTO pg_temp.tap_results (result)
SELECT ok(has_table_privilege('service_role', 'public."TMP_ACL_GATE22_TABLE"', 'SELECT'), 'service_role can select temporary table');

INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT has_sequence_privilege('public', 'public."TMP_ACL_GATE22_SEQUENCE"', 'USAGE'), 'PUBLIC cannot use temporary sequence');
INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT has_sequence_privilege('anon', 'public."TMP_ACL_GATE22_SEQUENCE"', 'USAGE'), 'anon cannot use temporary sequence');
INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT has_sequence_privilege('authenticated', 'public."TMP_ACL_GATE22_SEQUENCE"', 'USAGE'), 'authenticated cannot use temporary sequence');
INSERT INTO pg_temp.tap_results (result)
SELECT ok(has_sequence_privilege('service_role', 'public."TMP_ACL_GATE22_SEQUENCE"', 'USAGE'), 'service_role can use temporary sequence');

INSERT INTO pg_temp.tap_results (result)
SELECT ok(has_function_privilege('service_role', 'public."TMP_ACL_GATE22_FUNCTION"()', 'EXECUTE'), 'service_role can execute temporary function');
INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT has_function_privilege('public', 'public."TMP_ACL_GATE22_FUNCTION"()', 'EXECUTE'), 'PUBLIC cannot execute temporary function');
INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT has_function_privilege('anon', 'public."TMP_ACL_GATE22_FUNCTION"()', 'EXECUTE'), 'anon cannot execute temporary function');
INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT has_function_privilege('authenticated', 'public."TMP_ACL_GATE22_FUNCTION"()', 'EXECUTE'), 'authenticated has no generic function EXECUTE');

GRANT EXECUTE ON FUNCTION public."TMP_ACL_GATE22_FUNCTION"() TO authenticated;

INSERT INTO pg_temp.tap_results (result)
SELECT ok(has_function_privilege('authenticated', 'public."TMP_ACL_GATE22_FUNCTION"()', 'EXECUTE')
  AND NOT has_function_privilege('public', 'public."TMP_ACL_GATE22_FUNCTION"()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public."TMP_ACL_GATE22_FUNCTION"()', 'EXECUTE'),
  'explicit authenticated function grant works without public or anon access');

DROP FUNCTION public."TMP_ACL_GATE22_FUNCTION"();
DROP SEQUENCE public."TMP_ACL_GATE22_SEQUENCE";
DROP TABLE public."TMP_ACL_GATE22_TABLE";

INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_class WHERE relname IN ('TMP_ACL_GATE22_TABLE', 'TMP_ACL_GATE22_SEQUENCE')), 'temporary table and sequence cleaned up');
INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'TMP_ACL_GATE22_FUNCTION'), 'temporary function cleaned up');

SELECT result AS tap_line FROM pg_temp.tap_results ORDER BY seq;
ROLLBACK;
