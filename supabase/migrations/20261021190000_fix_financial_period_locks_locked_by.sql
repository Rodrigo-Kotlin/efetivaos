-- FIN-IMPORT-5.5 — repair the legacy audit trigger for financial_period_locks.
-- No financial transaction, journal, or period-lock data is created here.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- financial_period_locks has locked_by/locked_at and intentionally does not
  -- have the created_by/updated_by audit columns used by other master tables.
  IF TG_TABLE_NAME = 'financial_period_locks' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.created_at := coalesce(NEW.created_at, now());
      NEW.locked_at := coalesce(NEW.locked_at, now());
      NEW.locked_by := coalesce((select auth.uid()), NEW.locked_by);
    ELSE
      NEW.created_at := OLD.created_at;
      NEW.locked_at := OLD.locked_at;
      NEW.locked_by := OLD.locked_by;
    END IF;
    RETURN NEW;
  END IF;

  -- Preserve the established audit behavior for every other table using this
  -- shared trigger function.
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := coalesce(NEW.created_at, now());
    NEW.created_by := coalesce((select auth.uid()), NEW.created_by);
  ELSE
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
  END IF;

  NEW.updated_at := now();
  NEW.updated_by := coalesce((select auth.uid()), NEW.updated_by);
  RETURN NEW;
END;
$$;

COMMIT;
