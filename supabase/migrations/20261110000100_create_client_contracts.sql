-- EFETIVAOS CLIENTES-CONTRATOS-01
-- Preparada para homologacao; nao aplicar automaticamente em producao.
begin;

create type public.contract_status as enum ('draft', 'active', 'suspended', 'closed', 'terminated');
create type public.contract_modality as enum ('recurring', 'one_off');
create type public.contract_document_type as enum ('main', 'addendum', 'other');
create type public.contract_event_type as enum ('created', 'updated', 'renewal', 'addendum', 'status_change', 'archived');

create table public.client_contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  contract_number text not null,
  title text not null,
  contract_type text not null,
  description text,
  contracted_services text,
  commercial_owner text,
  contracted_value numeric(14,2),
  modality public.contract_modality not null,
  billing_period text,
  payment_terms text,
  first_billing_date date,
  signed_at date,
  starts_at date not null,
  ends_at date,
  auto_renewal boolean not null default false,
  notice_period_days integer,
  status public.contract_status not null default 'draft',
  internal_notes text,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint client_contracts_number_chk check (char_length(btrim(contract_number)) between 1 and 80),
  constraint client_contracts_title_chk check (char_length(btrim(title)) between 2 and 180),
  constraint client_contracts_type_chk check (char_length(btrim(contract_type)) between 2 and 100),
  constraint client_contracts_value_chk check (contracted_value is null or contracted_value >= 0),
  constraint client_contracts_dates_chk check (ends_at is null or ends_at >= starts_at),
  constraint client_contracts_notice_chk check (notice_period_days is null or notice_period_days >= 0),
  constraint client_contracts_recurring_period_chk check (modality = 'one_off' or billing_period is not null)
);

create table public.client_contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.client_contracts(id) on delete restrict,
  document_type public.contract_document_type not null,
  name text not null,
  storage_bucket text not null default 'client-contracts',
  storage_path text not null unique,
  mime_type text not null default 'application/pdf',
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint client_contract_documents_pdf_chk check (mime_type = 'application/pdf'),
  constraint client_contract_documents_size_chk check (size_bytes between 1 and 10485760),
  constraint client_contract_documents_path_chk check (storage_path = contract_id::text || '/' || id::text || '.pdf')
);

create table public.client_contract_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.client_contracts(id) on delete restrict,
  event_type public.contract_event_type not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index idx_client_contracts_client on public.client_contracts(client_id, archived_at, starts_at desc);
create index idx_client_contract_documents_contract on public.client_contract_documents(contract_id, created_at desc);
create index idx_client_contract_events_contract on public.client_contract_events(contract_id, created_at desc);

create or replace function public.prevent_client_contract_reparent()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    raise exception 'O contrato nao pode ser movido para outro cliente.' using errcode = '23514';
  end if;
  return new;
end; $$;
revoke all on function public.prevent_client_contract_reparent() from public, anon, authenticated;
create trigger trg_client_contracts_client_immutable before update on public.client_contracts
for each row execute function public.prevent_client_contract_reparent();

create or replace function public.prevent_contract_document_reparent()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.contract_id is distinct from old.contract_id then
    raise exception 'O documento nao pode ser movido para outro contrato.' using errcode = '23514';
  end if;
  return new;
end; $$;
revoke all on function public.prevent_contract_document_reparent() from public, anon, authenticated;
create trigger trg_client_contract_documents_contract_immutable before update on public.client_contract_documents
for each row execute function public.prevent_contract_document_reparent();

create trigger trg_client_contracts_audit before insert or update on public.client_contracts
for each row execute function public.set_audit_fields();

create or replace function public.record_client_contract_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.client_contract_events(contract_id, event_type, summary, details, created_by)
  values (new.id, case when tg_op = 'INSERT' then 'created'::public.contract_event_type else 'updated'::public.contract_event_type end,
          case when tg_op = 'INSERT' then 'Contrato criado' else 'Contrato atualizado' end,
          jsonb_build_object('status', new.status, 'revision_at', new.updated_at), auth.uid());
  return new;
end; $$;
revoke all on function public.record_client_contract_history() from public, anon, authenticated;
create trigger trg_client_contracts_history after insert or update on public.client_contracts
for each row execute function public.record_client_contract_history();

create or replace function public.record_client_contract_event(
  p_contract_id uuid, p_event_type public.contract_event_type, p_summary text, p_details jsonb default '{}'::jsonb
) returns public.client_contract_events language plpgsql security invoker set search_path = '' as $$
declare v_event public.client_contract_events;
begin
  if not coalesce(public.is_internal_user(), false) then raise exception 'Usuario interno ativo obrigatorio.' using errcode = '42501'; end if;
  if not exists (select 1 from public.client_contracts where id = p_contract_id and archived_at is null) then raise exception 'Contrato nao encontrado.' using errcode = 'P0002'; end if;
  insert into public.client_contract_events(contract_id, event_type, summary, details, created_by)
  values (p_contract_id, p_event_type, btrim(p_summary), coalesce(p_details, '{}'::jsonb), auth.uid()) returning * into v_event;
  return v_event;
end; $$;
revoke all on function public.record_client_contract_event(uuid, public.contract_event_type, text, jsonb) from public, anon;
grant execute on function public.record_client_contract_event(uuid, public.contract_event_type, text, jsonb) to authenticated;

create or replace function public.archive_client_contract(p_contract_id uuid)
returns public.client_contracts language plpgsql security invoker set search_path = '' as $$
declare v_contract public.client_contracts;
begin
  if not coalesce(public.is_internal_user(), false) then raise exception 'Usuario interno ativo obrigatorio.' using errcode = '42501'; end if;
  update public.client_contracts set archived_at = now(), archived_by = auth.uid() where id = p_contract_id and archived_at is null returning * into v_contract;
  if not found then raise exception 'Contrato nao encontrado ou ja arquivado.' using errcode = 'P0002'; end if;
  return v_contract;
end; $$;
revoke all on function public.archive_client_contract(uuid) from public, anon;
grant execute on function public.archive_client_contract(uuid) to authenticated;

alter table public.client_contracts enable row level security; alter table public.client_contracts force row level security;
alter table public.client_contract_documents enable row level security; alter table public.client_contract_documents force row level security;
alter table public.client_contract_events enable row level security; alter table public.client_contract_events force row level security;

create policy client_contracts_internal on public.client_contracts for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
create policy client_contract_documents_internal on public.client_contract_documents for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user());
create policy client_contract_events_internal on public.client_contract_events for select to authenticated using (public.is_internal_user());
create policy client_contract_events_insert_internal on public.client_contract_events for insert to authenticated with check (public.is_internal_user());
revoke all on public.client_contracts, public.client_contract_documents, public.client_contract_events from public, anon, authenticated;
grant select, insert, update on public.client_contracts to authenticated;
grant select, insert on public.client_contract_documents to authenticated;
grant select on public.client_contract_events to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('client-contracts', 'client-contracts', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

create policy client_contract_files_select on storage.objects for select to authenticated using (
  bucket_id = 'client-contracts' and public.is_internal_user() and exists (select 1 from public.client_contract_documents d where d.storage_path = name)
);
create policy client_contract_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'client-contracts' and public.is_internal_user() and exists (select 1 from public.client_contract_documents d where d.storage_path = name)
);
create policy client_contract_files_update on storage.objects for update to authenticated using (bucket_id = 'client-contracts' and public.is_internal_user() and exists (select 1 from public.client_contract_documents d where d.storage_path = name)) with check (bucket_id = 'client-contracts' and public.is_internal_user() and exists (select 1 from public.client_contract_documents d where d.storage_path = name));
create policy client_contract_files_delete_admin on storage.objects for delete to authenticated using (bucket_id = 'client-contracts' and public.is_admin());
commit;
