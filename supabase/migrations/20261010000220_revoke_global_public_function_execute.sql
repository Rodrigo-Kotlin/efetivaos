-- Gate 2.2.2: remove PUBLIC EXECUTE from future postgres-owned functions.
-- This is global for the owner by design; do not add IN SCHEMA here.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
