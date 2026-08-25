-- Efetiva OS - ETAPA 07 CRM Light: clients and client contacts only.
begin;

create type public.client_type as enum ('company', 'individual');
create type public.client_status as enum ('active', 'inactive');

create or replace function public.is_valid_brazilian_tax_id(
  p_tax_id text,
  p_client_type public.client_type
)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  v_sum integer := 0;
  v_digit_1 integer;
  v_digit_2 integer;
  v_i integer;
  v_weights integer[];
begin
  if p_tax_id !~ '^[0-9]+$'
    or p_tax_id = repeat(substr(p_tax_id, 1, 1), length(p_tax_id)) then
    return false;
  end if;

  if p_client_type = 'individual' then
    if length(p_tax_id) <> 11 then
      return false;
    end if;

    for v_i in 1..9 loop
      v_sum := v_sum + substr(p_tax_id, v_i, 1)::integer * (11 - v_i);
    end loop;
    v_digit_1 := (v_sum * 10) % 11;
    if v_digit_1 = 10 then v_digit_1 := 0; end if;

    v_sum := 0;
    for v_i in 1..10 loop
      v_sum := v_sum + substr(p_tax_id, v_i, 1)::integer * (12 - v_i);
    end loop;
    v_digit_2 := (v_sum * 10) % 11;
    if v_digit_2 = 10 then v_digit_2 := 0; end if;

    return v_digit_1 = substr(p_tax_id, 10, 1)::integer
      and v_digit_2 = substr(p_tax_id, 11, 1)::integer;
  end if;

  if length(p_tax_id) <> 14 then
    return false;
  end if;

  v_weights := array[5,4,3,2,9,8,7,6,5,4,3,2];
  v_sum := 0;
  for v_i in 1..12 loop
    v_sum := v_sum + substr(p_tax_id, v_i, 1)::integer * v_weights[v_i];
  end loop;
  v_digit_1 := 11 - (v_sum % 11);
  if v_digit_1 >= 10 then v_digit_1 := 0; end if;

  v_weights := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  v_sum := 0;
  for v_i in 1..13 loop
    v_sum := v_sum + substr(p_tax_id, v_i, 1)::integer * v_weights[v_i];
  end loop;
  v_digit_2 := 11 - (v_sum % 11);
  if v_digit_2 >= 10 then v_digit_2 := 0; end if;

  return v_digit_1 = substr(p_tax_id, 13, 1)::integer
    and v_digit_2 = substr(p_tax_id, 14, 1)::integer;
end;
$$;

revoke execute on function public.is_valid_brazilian_tax_id(text, public.client_type) from public, anon;
grant execute on function public.is_valid_brazilian_tax_id(text, public.client_type) to authenticated;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  tax_id text not null,
  client_type public.client_type not null,
  status public.client_status not null default 'active',
  email text,
  phone text,
  website text,
  zip_code text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  country text not null default 'Brasil',
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint clients_legal_name_length_chk check (char_length(legal_name) between 2 and 160),
  constraint clients_trade_name_length_chk check (trade_name is null or char_length(trade_name) between 2 and 160),
  constraint clients_tax_id_format_chk check (tax_id ~ '^[0-9]+$'),
  constraint clients_tax_id_valid_chk check (public.is_valid_brazilian_tax_id(tax_id, client_type)),
  constraint clients_email_chk check (
    email is null or (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ),
  constraint clients_phone_chk check (phone is null or (phone ~ '^[0-9]+$' and char_length(phone) between 10 and 15)),
  constraint clients_website_length_chk check (website is null or char_length(website) <= 2048),
  constraint clients_zip_code_chk check (zip_code is null or (zip_code ~ '^[0-9]{8}$')),
  constraint clients_address_lengths_chk check (
    (street is null or char_length(street) <= 160)
    and (number is null or char_length(number) <= 30)
    and (complement is null or char_length(complement) <= 120)
    and (district is null or char_length(district) <= 120)
    and (city is null or char_length(city) <= 120)
    and (state is null or char_length(state) = 2)
    and char_length(country) between 2 and 80
  ),
  constraint clients_notes_length_chk check (notes is null or char_length(notes) <= 4000),
  constraint clients_tax_id_key unique (tax_id)
);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null,
  role text,
  department text,
  email text,
  phone text,
  whatsapp text,
  is_primary boolean not null default false,
  notes text,
  status public.client_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint client_contacts_name_length_chk check (char_length(name) between 2 and 120),
  constraint client_contacts_role_length_chk check (role is null or char_length(role) <= 120),
  constraint client_contacts_department_length_chk check (department is null or char_length(department) <= 120),
  constraint client_contacts_email_chk check (
    email is null or (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ),
  constraint client_contacts_phone_chk check (phone is null or (phone ~ '^[0-9]+$' and char_length(phone) between 10 and 15)),
  constraint client_contacts_whatsapp_chk check (whatsapp is null or (whatsapp ~ '^[0-9]+$' and char_length(whatsapp) between 10 and 15)),
  constraint client_contacts_primary_status_chk check (not is_primary or status = 'active'),
  constraint client_contacts_notes_length_chk check (notes is null or char_length(notes) <= 4000)
);

create or replace function public.normalize_client()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.legal_name := btrim(new.legal_name);
  new.trade_name := nullif(btrim(new.trade_name), '');
  new.tax_id := regexp_replace(coalesce(new.tax_id, ''), '[^0-9]', '', 'g');
  new.email := nullif(lower(btrim(new.email)), '');
  new.phone := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
  new.website := nullif(btrim(new.website), '');
  new.zip_code := nullif(regexp_replace(coalesce(new.zip_code, ''), '[^0-9]', '', 'g'), '');
  new.street := nullif(btrim(new.street), '');
  new.number := nullif(btrim(new.number), '');
  new.complement := nullif(btrim(new.complement), '');
  new.district := nullif(btrim(new.district), '');
  new.city := nullif(btrim(new.city), '');
  new.state := nullif(upper(btrim(new.state)), '');
  new.country := coalesce(nullif(btrim(new.country), ''), 'Brasil');
  new.notes := nullif(btrim(new.notes), '');

  if tg_op = 'INSERT' then
    new.created_at := null;
    new.created_by := null;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := null;
  new.updated_by := null;
  return new;
end;
$$;

create or replace function public.normalize_client_contact()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'O contato nao pode ser movido para outro cliente.' using errcode = '23514';
  end if;

  new.name := btrim(new.name);
  new.role := nullif(btrim(new.role), '');
  new.department := nullif(btrim(new.department), '');
  new.email := nullif(lower(btrim(new.email)), '');
  new.phone := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
  new.whatsapp := nullif(regexp_replace(coalesce(new.whatsapp, ''), '[^0-9]', '', 'g'), '');
  new.notes := nullif(btrim(new.notes), '');
  if new.status = 'inactive' then
    new.is_primary := false;
  end if;

  if tg_op = 'INSERT' then
    new.created_at := null;
    new.created_by := null;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := null;
  new.updated_by := null;
  return new;
end;
$$;

revoke execute on function public.normalize_client() from public, anon, authenticated;
revoke execute on function public.normalize_client_contact() from public, anon, authenticated;

create trigger trg_clients_00_normalize
before insert or update on public.clients
for each row execute function public.normalize_client();

create trigger trg_clients_audit
before insert or update on public.clients
for each row execute function public.set_audit_fields();

create trigger trg_client_contacts_00_normalize
before insert or update on public.client_contacts
for each row execute function public.normalize_client_contact();

create trigger trg_client_contacts_audit
before insert or update on public.client_contacts
for each row execute function public.set_audit_fields();

create index idx_clients_legal_name on public.clients (lower(legal_name));
create index idx_clients_trade_name on public.clients (lower(trade_name)) where trade_name is not null;
create index idx_clients_status_state on public.clients (status, state);
create index idx_client_contacts_client on public.client_contacts (client_id, status, lower(name));
create unique index uq_client_contacts_active_primary
  on public.client_contacts (client_id)
  where is_primary = true and status = 'active';

alter table public.clients enable row level security;
alter table public.clients force row level security;
alter table public.client_contacts enable row level security;
alter table public.client_contacts force row level security;

create policy clients_select_internal on public.clients
for select to authenticated
using ((select public.is_internal_user()));

create policy clients_insert_internal on public.clients
for insert to authenticated
with check ((select public.is_internal_user()));

create policy clients_update_internal on public.clients
for update to authenticated
using ((select public.is_internal_user()))
with check ((select public.is_internal_user()));

create policy client_contacts_select_internal on public.client_contacts
for select to authenticated
using ((select public.is_internal_user()));

create policy client_contacts_insert_internal on public.client_contacts
for insert to authenticated
with check ((select public.is_internal_user()));

create policy client_contacts_update_internal on public.client_contacts
for update to authenticated
using ((select public.is_internal_user()))
with check ((select public.is_internal_user()));

revoke all on table public.clients from public, anon, authenticated;
revoke all on table public.client_contacts from public, anon, authenticated;
grant select, insert, update on table public.clients to authenticated;
grant select, insert, update on table public.client_contacts to authenticated;

create view public.client_list_v
with (security_invoker = true)
as
select
  cl.id,
  cl.legal_name,
  cl.trade_name,
  cl.tax_id,
  cl.client_type,
  cl.status,
  cl.email,
  cl.phone,
  cl.city,
  cl.state,
  cl.updated_at,
  contact_summary.primary_contact_id,
  contact_summary.primary_contact_name,
  contact_summary.primary_contact_email,
  contact_summary.primary_contact_phone,
  contact_summary.contact_count,
  contact_summary.active_contact_count
from public.clients cl
left join lateral (
  select
    (array_agg(cc.id order by cc.updated_at desc)
      filter (where cc.is_primary and cc.status = 'active'))[1] as primary_contact_id,
    (array_agg(cc.name order by cc.updated_at desc)
      filter (where cc.is_primary and cc.status = 'active'))[1] as primary_contact_name,
    (array_agg(cc.email order by cc.updated_at desc)
      filter (where cc.is_primary and cc.status = 'active'))[1] as primary_contact_email,
    (array_agg(cc.phone order by cc.updated_at desc)
      filter (where cc.is_primary and cc.status = 'active'))[1] as primary_contact_phone,
    count(*)::bigint as contact_count,
    (count(*) filter (where cc.status = 'active'))::bigint as active_contact_count
  from public.client_contacts cc
  where cc.client_id = cl.id
) contact_summary on true;

revoke all on table public.client_list_v from public, anon, authenticated;
grant select on table public.client_list_v to authenticated;

create or replace function public.save_client_contact(
  p_client_id uuid,
  p_name text,
  p_contact_id uuid default null,
  p_role text default null,
  p_department text default null,
  p_email text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_is_primary boolean default false,
  p_notes text default null,
  p_status public.client_status default 'active'
)
returns public.client_contacts
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_contact public.client_contacts;
  v_existing_client_id uuid;
begin
  if not coalesce(public.is_internal_user(), false) then
    raise exception 'Usuario interno ativo obrigatorio.' using errcode = '42501';
  end if;

  perform 1
  from public.clients cl
  where cl.id = p_client_id
  for update;
  if not found then
    raise exception 'Cliente nao encontrado.' using errcode = 'P0002';
  end if;

  if p_contact_id is not null then
    select cc.client_id
    into v_existing_client_id
    from public.client_contacts cc
    where cc.id = p_contact_id
    for update;

    if not found then
      raise exception 'Contato nao encontrado.' using errcode = 'P0002';
    end if;
    if v_existing_client_id is distinct from p_client_id then
      raise exception 'O contato nao pode ser movido para outro cliente.' using errcode = '23514';
    end if;
  end if;

  if coalesce(p_is_primary, false) and coalesce(p_status, 'active') = 'active' then
    update public.client_contacts cc
    set is_primary = false
    where cc.client_id = p_client_id
      and cc.is_primary = true
      and cc.status = 'active'
      and (p_contact_id is null or cc.id <> p_contact_id);
  end if;

  if p_contact_id is null then
    insert into public.client_contacts (
      client_id, name, role, department, email, phone, whatsapp,
      is_primary, notes, status
    ) values (
      p_client_id, p_name, p_role, p_department, p_email, p_phone, p_whatsapp,
      coalesce(p_is_primary, false), p_notes, coalesce(p_status, 'active')
    )
    returning * into v_contact;
  else
    update public.client_contacts cc
    set name = p_name,
        role = p_role,
        department = p_department,
        email = p_email,
        phone = p_phone,
        whatsapp = p_whatsapp,
        is_primary = coalesce(p_is_primary, false),
        notes = p_notes,
        status = coalesce(p_status, 'active')
    where cc.id = p_contact_id
    returning cc.* into v_contact;
  end if;

  return v_contact;
end;
$$;

revoke execute on function public.save_client_contact(
  uuid, text, uuid, text, text, text, text, text, boolean, text, public.client_status
) from public, anon;
grant execute on function public.save_client_contact(
  uuid, text, uuid, text, text, text, text, text, boolean, text, public.client_status
) to authenticated;

commit;
