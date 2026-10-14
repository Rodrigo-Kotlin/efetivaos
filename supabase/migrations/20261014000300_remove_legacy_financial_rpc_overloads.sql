-- FIN-FIX-1: remove unsafe legacy overloads from the financial transaction API.
-- The current signatures remain unchanged and are used by the frontend.

begin;

drop function if exists public.settle_financial_transaction(uuid, date, uuid);

drop function if exists public.update_financial_transaction(
  uuid,
  text,
  date,
  date,
  public.financial_movement_type,
  numeric,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  date,
  text,
  numeric,
  numeric,
  integer
);

commit;
