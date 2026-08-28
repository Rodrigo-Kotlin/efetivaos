-- ETAPA 08B.1 — Microgate: Event Security Hardening + SQL Coverage
-- REVOKE INSERT on crm_opportunity_events from authenticated (events only via SECURITY DEFINER RPCs)

-- 1. REVOKE direct INSERT on events
REVOKE INSERT ON public.crm_opportunity_events FROM authenticated;

-- 2. Keep SELECT for authenticated
-- (GRANT SELECT already exists, no change needed)

-- 3. Verify: authenticated can SELECT but not INSERT/UPDATE/DELETE
-- This is enforced by: REVOKE INSERT (this migration) + REVOKE UPDATE, DELETE (08B migration)
