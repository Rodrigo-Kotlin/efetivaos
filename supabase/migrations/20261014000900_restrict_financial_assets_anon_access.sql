-- FIN-FIX-BS-1.1: remove direct table privileges from the anonymous role.
-- RLS policies and authenticated access remain unchanged.

REVOKE ALL PRIVILEGES ON TABLE public.financial_assets FROM anon, PUBLIC;
