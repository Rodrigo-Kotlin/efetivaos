begin;

-- Close the rollout window under a table lock and preserve any sequence values
-- already consumed by successful or rolled-back transactions.
lock table public.catalog_items in share row exclusive mode;

do $$
declare
  v_max_code bigint;
  v_last_value bigint;
  v_is_called boolean;
begin
  select max(substring(code from 6)::bigint)
  into v_max_code
  from public.catalog_items
  where code ~ '^ITEM-[0-9]{6,}$';

  select last_value, is_called
  into v_last_value, v_is_called
  from public.catalog_item_code_seq;

  if v_max_code is not null and (not v_is_called or v_max_code > v_last_value) then
    perform setval('public.catalog_item_code_seq', v_max_code, true);
  end if;
end;
$$;

create or replace function public.generate_catalog_item_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_internal_user() then
    raise exception 'Usuario interno ativo obrigatorio.' using errcode = '42501';
  end if;

  return 'ITEM-' || lpad(nextval('public.catalog_item_code_seq')::text, 6, '0');
end;
$$;

revoke all on function public.generate_catalog_item_code() from public, anon;
grant execute on function public.generate_catalog_item_code() to authenticated;

commit;
