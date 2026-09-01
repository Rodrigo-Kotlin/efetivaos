begin;

-- New catalog items receive a neutral, database-generated identifier. Existing
-- codes are preserved and only ITEM-* values participate in sequence syncing.
create sequence public.catalog_item_code_seq;

do $$
declare
  v_last_value bigint;
begin
  select max(substring(code from 6)::bigint)
  into v_last_value
  from public.catalog_items
  where code ~ '^ITEM-[0-9]{6,}$';

  if v_last_value is null then
    perform setval('public.catalog_item_code_seq', 1, false);
  else
    perform setval('public.catalog_item_code_seq', v_last_value, true);
  end if;
end;
$$;

create function public.generate_catalog_item_code()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'ITEM-' || lpad(nextval('public.catalog_item_code_seq')::text, 6, '0');
$$;

revoke all on function public.generate_catalog_item_code() from public, anon;
grant execute on function public.generate_catalog_item_code() to authenticated;

alter table public.catalog_items
  alter column code set default public.generate_catalog_item_code();

-- Authenticated clients may insert catalog data, but cannot override the
-- canonical code. PostgreSQL still supports explicit values for migrations.
revoke insert on public.catalog_items from authenticated;
grant insert (
  id, name, category_id, unit, description, active,
  created_at, created_by, updated_at, updated_by
) on public.catalog_items to authenticated;

create function public.prevent_catalog_item_code_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'O codigo do item do catalogo nao pode ser alterado.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_catalog_item_code_change() from public, anon, authenticated;

create trigger trg_catalog_items_code_immutable
before update on public.catalog_items
for each row execute function public.prevent_catalog_item_code_change();

-- Category names are compared after trimming and without case sensitivity.
-- This keeps preset and custom creation safe under concurrent inserts.
drop index public.uq_catalog_categories_name_ci;

create unique index uq_catalog_categories_name_ci
  on public.catalog_categories (lower(btrim(name)));

commit;
