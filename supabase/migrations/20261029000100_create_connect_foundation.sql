begin;

-- EfetivaConnect Foundation: independent domain, explicit organization scope,
-- sector authorization and append-only foundation audit.

create table public.connect_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint connect_organizations_name_chk check (char_length(btrim(name)) between 2 and 160),
  constraint connect_organizations_slug_chk check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.connect_organization_members (
  organization_id uuid not null references public.connect_organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (organization_id, profile_id),
  unique (organization_id, profile_id)
);

create table public.connect_sectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.connect_organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  data_classification text not null default 'STANDARD',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint connect_sectors_name_chk check (char_length(btrim(name)) between 2 and 120),
  constraint connect_sectors_slug_chk check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint connect_sectors_classification_chk check (data_classification in ('STANDARD', 'SENSITIVE')),
  unique (organization_id, slug),
  unique (organization_id, id)
);

create table public.connect_profile_sectors (
  organization_id uuid not null references public.connect_organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sector_id uuid not null,
  can_view boolean not null default true,
  can_assign boolean not null default false,
  can_transfer boolean not null default false,
  can_manage boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (profile_id, sector_id),
  constraint connect_profile_sectors_sector_fk
    foreign key (organization_id, sector_id)
    references public.connect_sectors (organization_id, id)
    on delete cascade,
  constraint connect_profile_sectors_membership_fk
    foreign key (organization_id, profile_id)
    references public.connect_organization_members (organization_id, profile_id)
    on delete cascade
);

create table public.connect_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.connect_organizations(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  sector_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint connect_audit_logs_action_chk check (char_length(btrim(action)) between 2 and 120),
  constraint connect_audit_logs_entity_type_chk check (char_length(btrim(entity_type)) between 2 and 120),
  constraint connect_audit_logs_sector_fk
    foreign key (organization_id, sector_id)
    references public.connect_sectors (organization_id, id)
    on delete restrict
);

create table public.connect_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.connect_organizations(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (organization_id, id),
  constraint connect_contacts_display_name_chk check (display_name is null or char_length(btrim(display_name)) between 1 and 160)
);

create table public.connect_contact_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.connect_organizations(id) on delete cascade,
  contact_id uuid not null references public.connect_contacts(id) on delete cascade,
  channel_type text not null,
  raw_value text,
  normalized_e164 text,
  country_code text,
  provider_contact_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint connect_contact_channels_type_chk check (channel_type ~ '^[A-Z][A-Z0-9_]{1,40}$'),
  constraint connect_contact_channels_contact_fk
    foreign key (organization_id, contact_id)
    references public.connect_contacts (organization_id, id)
    on delete cascade
);

create table public.connect_integration_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.connect_organizations(id) on delete cascade,
  local_entity_type text not null,
  local_entity_id uuid not null,
  external_system text not null,
  external_entity_type text not null,
  external_entity_id text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint connect_integration_links_local_type_chk check (char_length(btrim(local_entity_type)) between 2 and 80),
  constraint connect_integration_links_external_system_chk check (char_length(btrim(external_system)) between 2 and 80),
  constraint connect_integration_links_external_type_chk check (char_length(btrim(external_entity_type)) between 2 and 80),
  constraint connect_integration_links_external_id_chk check (char_length(btrim(external_entity_id)) between 1 and 240),
  unique (organization_id, local_entity_type, local_entity_id, external_system, external_entity_type),
  unique (organization_id, external_system, external_entity_type, external_entity_id)
);

create index idx_connect_members_profile on public.connect_organization_members(profile_id, active);
create index idx_connect_sectors_org_active on public.connect_sectors(organization_id, active, sort_order);
create index idx_connect_profile_sectors_org_sector on public.connect_profile_sectors(organization_id, sector_id);
create index idx_connect_audit_logs_org_created on public.connect_audit_logs(organization_id, created_at desc);
create index idx_connect_audit_logs_entity on public.connect_audit_logs(organization_id, entity_type, entity_id);
create index idx_connect_contact_channels_contact on public.connect_contact_channels(organization_id, contact_id, active);
create index idx_connect_contact_channels_phone on public.connect_contact_channels(organization_id, normalized_e164)
  where normalized_e164 is not null;
create index idx_connect_integration_links_external on public.connect_integration_links(organization_id, external_system, external_entity_type, external_entity_id);

create or replace function public.connect_is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.connect_organization_members m
    join public.profiles p on p.id = m.profile_id
    where m.organization_id = p_organization_id
      and m.profile_id = (select auth.uid())
      and m.active = true
      and p.active = true
  );
$$;

create or replace function public.connect_is_org_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.connect_is_org_member(p_organization_id)
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and p.active = true
    );
$$;

create or replace function public.connect_can_view_sector(p_sector_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.connect_sectors s
    where s.id = p_sector_id
      and s.active = true
      and (
        public.connect_is_org_admin(s.organization_id)
        or exists (
          select 1
          from public.connect_profile_sectors ps
          where ps.organization_id = s.organization_id
            and ps.profile_id = (select auth.uid())
            and ps.sector_id = s.id
            and ps.can_view = true
        )
      )
  );
$$;

create or replace function public.connect_can_manage_sector(p_sector_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.connect_sectors s
    where s.id = p_sector_id
      and (
        public.connect_is_org_admin(s.organization_id)
        or exists (
          select 1
          from public.connect_profile_sectors ps
          where ps.organization_id = s.organization_id
            and ps.profile_id = (select auth.uid())
            and ps.sector_id = s.id
            and ps.can_manage = true
        )
      )
  );
$$;

revoke all on function public.connect_is_org_member(uuid) from public, anon;
revoke all on function public.connect_is_org_admin(uuid) from public, anon;
revoke all on function public.connect_can_view_sector(uuid) from public, anon;
revoke all on function public.connect_can_manage_sector(uuid) from public, anon;
grant execute on function public.connect_is_org_member(uuid) to authenticated;
grant execute on function public.connect_is_org_admin(uuid) to authenticated;
grant execute on function public.connect_can_view_sector(uuid) to authenticated;
grant execute on function public.connect_can_manage_sector(uuid) to authenticated;

create or replace function public.connect_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

create trigger connect_organizations_set_updated_at
before update on public.connect_organizations
for each row execute function public.connect_set_updated_at();

create trigger connect_sectors_set_updated_at
before update on public.connect_sectors
for each row execute function public.connect_set_updated_at();

create trigger connect_contacts_set_updated_at
before update on public.connect_contacts
for each row execute function public.connect_set_updated_at();

create trigger connect_contact_channels_set_updated_at
before update on public.connect_contact_channels
for each row execute function public.connect_set_updated_at();

create trigger connect_integration_links_set_updated_at
before update on public.connect_integration_links
for each row execute function public.connect_set_updated_at();

create or replace function public.connect_record_foundation_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
  v_entity_id uuid;
  v_sector_id uuid;
  v_action text;
  v_entity_type text;
begin
  if tg_table_name = 'connect_sectors' then
    v_organization_id := coalesce(new.organization_id, old.organization_id);
    v_entity_id := coalesce(new.id, old.id);
    v_sector_id := v_entity_id;
    v_entity_type := 'SECTOR';
    v_action := case when tg_op = 'INSERT' then 'SECTOR_CREATED' else 'SECTOR_UPDATED' end;
  elsif tg_table_name = 'connect_organization_members' then
    v_organization_id := coalesce(new.organization_id, old.organization_id);
    v_entity_id := coalesce(new.profile_id, old.profile_id);
    v_entity_type := 'ORGANIZATION_MEMBER';
    v_action := case when tg_op = 'INSERT' then 'USER_ADDED_TO_ORGANIZATION' else 'ORGANIZATION_MEMBER_UPDATED' end;
  elsif tg_table_name = 'connect_profile_sectors' then
    v_organization_id := coalesce(new.organization_id, old.organization_id);
    v_entity_id := coalesce(new.profile_id, old.profile_id);
    v_sector_id := coalesce(new.sector_id, old.sector_id);
    v_entity_type := 'PROFILE_SECTOR';
    v_action := case
      when tg_op = 'INSERT' then 'USER_ADDED_TO_SECTOR'
      when tg_op = 'UPDATE' then 'SECTOR_PERMISSIONS_UPDATED'
      else 'USER_REMOVED_FROM_SECTOR'
    end;
  else
    return coalesce(new, old);
  end if;

  insert into public.connect_audit_logs (
    organization_id, actor_profile_id, action, entity_type, entity_id, sector_id, metadata
  ) values (
    v_organization_id,
    (select auth.uid()),
    v_action,
    v_entity_type,
    v_entity_id,
    v_sector_id,
    jsonb_build_object('operation', tg_op)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger connect_sectors_audit
after insert or update on public.connect_sectors
for each row execute function public.connect_record_foundation_audit();

create trigger connect_members_audit
after insert or update on public.connect_organization_members
for each row execute function public.connect_record_foundation_audit();

create trigger connect_profile_sectors_audit
after insert or update or delete on public.connect_profile_sectors
for each row execute function public.connect_record_foundation_audit();

revoke all on function public.connect_set_updated_at() from public, anon, authenticated;
revoke all on function public.connect_record_foundation_audit() from public, anon, authenticated;

-- Foundation seed. Existing profiles are explicitly attached to the single
-- operating organization; sector permissions remain opt-in for equipe users.
insert into public.connect_organizations (name, slug, active)
values ('Efetiva', 'efetiva', true)
on conflict (slug) do update
set name = excluded.name, active = true, updated_at = now();

insert into public.connect_sectors (organization_id, name, slug, data_classification, sort_order)
select o.id, v.name, v.slug, v.data_classification, v.sort_order
from public.connect_organizations o
cross join (values
  ('Comercial', 'comercial', 'STANDARD', 10),
  ('Clínica', 'clinica', 'SENSITIVE', 20),
  ('Engenharia SST', 'engenharia-sst', 'STANDARD', 30),
  ('Treinamentos', 'treinamentos', 'STANDARD', 40),
  ('Bombeiros', 'bombeiros', 'STANDARD', 50),
  ('Administrativo', 'administrativo', 'STANDARD', 60),
  ('Financeiro', 'financeiro', 'STANDARD', 70)
) as v(name, slug, data_classification, sort_order)
where o.slug = 'efetiva'
on conflict (organization_id, slug) do update
set name = excluded.name,
    data_classification = excluded.data_classification,
    sort_order = excluded.sort_order,
    active = true,
    updated_at = now();

insert into public.connect_organization_members (organization_id, profile_id, active)
select o.id, p.id, p.active
from public.connect_organizations o
cross join public.profiles p
where o.slug = 'efetiva'
on conflict (organization_id, profile_id) do update
set active = excluded.active;

alter table public.connect_organizations enable row level security;
alter table public.connect_organizations force row level security;
alter table public.connect_organization_members enable row level security;
alter table public.connect_organization_members force row level security;
alter table public.connect_sectors enable row level security;
alter table public.connect_sectors force row level security;
alter table public.connect_profile_sectors enable row level security;
alter table public.connect_profile_sectors force row level security;
alter table public.connect_audit_logs enable row level security;
alter table public.connect_audit_logs force row level security;
alter table public.connect_contacts enable row level security;
alter table public.connect_contacts force row level security;
alter table public.connect_contact_channels enable row level security;
alter table public.connect_contact_channels force row level security;
alter table public.connect_integration_links enable row level security;
alter table public.connect_integration_links force row level security;

create policy connect_organizations_select_member on public.connect_organizations
for select to authenticated using (public.connect_is_org_member(id));
create policy connect_organizations_update_admin on public.connect_organizations
for update to authenticated using (public.connect_is_org_admin(id)) with check (public.connect_is_org_admin(id));

create policy connect_members_select_self_or_admin on public.connect_organization_members
for select to authenticated using (
  public.connect_is_org_member(organization_id)
  and (profile_id = (select auth.uid()) or public.connect_is_org_admin(organization_id))
);
create policy connect_members_insert_admin on public.connect_organization_members
for insert to authenticated with check (public.connect_is_org_admin(organization_id));
create policy connect_members_update_admin on public.connect_organization_members
for update to authenticated using (public.connect_is_org_admin(organization_id)) with check (public.connect_is_org_admin(organization_id));
create policy connect_members_delete_admin on public.connect_organization_members
for delete to authenticated using (public.connect_is_org_admin(organization_id));

create policy connect_sectors_select_allowed on public.connect_sectors
for select to authenticated using (public.connect_can_view_sector(id));
create policy connect_sectors_insert_manager on public.connect_sectors
for insert to authenticated with check (public.connect_is_org_admin(organization_id));
create policy connect_sectors_update_manager on public.connect_sectors
for update to authenticated using (public.connect_can_manage_sector(id)) with check (public.connect_can_manage_sector(id));

create policy connect_profile_sectors_select_self_or_admin on public.connect_profile_sectors
for select to authenticated using (
  public.connect_is_org_member(organization_id)
  and (profile_id = (select auth.uid()) or public.connect_is_org_admin(organization_id))
);
create policy connect_profile_sectors_insert_manager on public.connect_profile_sectors
for insert to authenticated with check (public.connect_can_manage_sector(sector_id));
create policy connect_profile_sectors_update_manager on public.connect_profile_sectors
for update to authenticated using (public.connect_can_manage_sector(sector_id)) with check (public.connect_can_manage_sector(sector_id));
create policy connect_profile_sectors_delete_manager on public.connect_profile_sectors
for delete to authenticated using (public.connect_can_manage_sector(sector_id));

create policy connect_audit_select_member on public.connect_audit_logs
for select to authenticated using (public.connect_is_org_member(organization_id));

create policy connect_contacts_select_member on public.connect_contacts
for select to authenticated using (public.connect_is_org_member(organization_id));
create policy connect_contacts_insert_member on public.connect_contacts
for insert to authenticated with check (public.connect_is_org_member(organization_id));
create policy connect_contacts_update_member on public.connect_contacts
for update to authenticated using (public.connect_is_org_member(organization_id)) with check (public.connect_is_org_member(organization_id));

create policy connect_contact_channels_select_member on public.connect_contact_channels
for select to authenticated using (public.connect_is_org_member(organization_id));
create policy connect_contact_channels_insert_member on public.connect_contact_channels
for insert to authenticated with check (public.connect_is_org_member(organization_id));
create policy connect_contact_channels_update_member on public.connect_contact_channels
for update to authenticated using (public.connect_is_org_member(organization_id)) with check (public.connect_is_org_member(organization_id));

create policy connect_integration_links_select_member on public.connect_integration_links
for select to authenticated using (public.connect_is_org_member(organization_id));
create policy connect_integration_links_insert_admin on public.connect_integration_links
for insert to authenticated with check (public.connect_is_org_admin(organization_id));
create policy connect_integration_links_update_admin on public.connect_integration_links
for update to authenticated using (public.connect_is_org_admin(organization_id)) with check (public.connect_is_org_admin(organization_id));

revoke all on table public.connect_organizations from public, anon, authenticated;
revoke all on table public.connect_organization_members from public, anon, authenticated;
revoke all on table public.connect_sectors from public, anon, authenticated;
revoke all on table public.connect_profile_sectors from public, anon, authenticated;
revoke all on table public.connect_audit_logs from public, anon, authenticated;
revoke all on table public.connect_contacts from public, anon, authenticated;
revoke all on table public.connect_contact_channels from public, anon, authenticated;
revoke all on table public.connect_integration_links from public, anon, authenticated;

grant select on public.connect_organizations to authenticated;
grant update on public.connect_organizations to authenticated;
grant select, insert, update, delete on public.connect_organization_members to authenticated;
grant select, insert, update on public.connect_sectors to authenticated;
grant select, insert, update, delete on public.connect_profile_sectors to authenticated;
grant select on public.connect_audit_logs to authenticated;
grant select, insert, update on public.connect_contacts to authenticated;
grant select, insert, update on public.connect_contact_channels to authenticated;
grant select, insert, update on public.connect_integration_links to authenticated;

comment on table public.connect_organizations is 'EfetivaConnect organizations; independent from EfetivaOS master data.';
comment on table public.connect_sectors is 'Connect routing sectors; Clínica is classified as SENSITIVE in the Foundation seed.';
comment on table public.connect_audit_logs is 'Append-only audit trail for Connect Foundation administration.';
comment on table public.connect_integration_links is 'Cross-domain references without foreign keys into EfetivaOS.';

commit;
