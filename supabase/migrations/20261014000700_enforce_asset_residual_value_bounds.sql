-- FIN-FIX-3.2.1: reject impossible residual values instead of normalizing them.
-- No historical assets, transactions, or journal rows are modified.

begin;

create or replace function public.normalize_financial_asset()
returns trigger
language plpgsql
as $$
begin
  new.asset_code := upper(btrim(new.asset_code));
  new.name := btrim(new.name);
  if new.description is not null then new.description := btrim(new.description); end if;
  if new.category is not null then new.category := btrim(new.category); end if;
  if new.location is not null then new.location := btrim(new.location); end if;
  if new.responsible is not null then new.responsible := btrim(new.responsible); end if;
  if new.serial_number is not null then new.serial_number := btrim(new.serial_number); end if;
  if new.patrimony_number is not null then new.patrimony_number := btrim(new.patrimony_number); end if;
  if new.depreciation_start_date is null then
    new.depreciation_start_date := new.acquisition_date;
  end if;
  return new;
end;
$$;

do $$
begin
  alter table public.financial_assets
    add constraint chk_residual_lte_acquisition
    check (residual_value <= acquisition_value);
exception when duplicate_object then
  null;
end $$;

commit;
