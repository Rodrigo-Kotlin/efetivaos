-- Gate 2.2.1: future application functions must not be executable by PUBLIC.
-- Scope is limited to functions created by postgres in public.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
