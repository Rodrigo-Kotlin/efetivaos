-- CLIENTES-CONTRATOS-16. Storage API deletion is NOT a PostgreSQL transaction.
begin;

alter table public.client_contract_documents add column discard_started_at timestamptz;

-- Durable tombstone: no FK to the document, which is removed only after API verification.
create table public.client_contract_document_discards (
  document_id uuid primary key,
  operation_id uuid not null unique default gen_random_uuid(),
  contract_id uuid not null references public.client_contracts(id) on delete restrict,
  created_by uuid not null,
  storage_bucket text not null check (storage_bucket = 'client-contracts'),
  storage_path text not null unique,
  state text not null default 'discarding' check (state in ('discarding', 'api_absent')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  started_at timestamptz not null default now(),
  api_absence_confirmed_at timestamptz,
  check (storage_path = contract_id::text || '/' || document_id::text || '.pdf'),
  check ((state = 'discarding' and api_absence_confirmed_at is null)
      or (state = 'api_absent' and api_absence_confirmed_at is not null))
);
create index idx_contract_document_discards_contract on public.client_contract_document_discards(contract_id);
create table public.client_contract_document_discard_attempts (
  id uuid primary key,
  document_id uuid not null references public.client_contract_document_discards(document_id) on delete restrict,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null default 'started' check (outcome in ('started', 'api_absent', 'retry_required')),
  error_code text
);
create index idx_contract_discard_attempts_document on public.client_contract_document_discard_attempts(document_id);
alter table public.client_contract_document_discards enable row level security;
alter table public.client_contract_document_discards force row level security;
alter table public.client_contract_document_discard_attempts enable row level security;
alter table public.client_contract_document_discard_attempts force row level security;
revoke all on public.client_contract_document_discards, public.client_contract_document_discard_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.client_contract_document_discards, public.client_contract_document_discard_attempts to service_role;

drop policy client_contract_documents_delete_incomplete on public.client_contract_documents;
revoke delete on public.client_contract_documents from public, anon, authenticated;
drop policy client_contract_files_delete_incomplete on storage.objects;

-- No resurrection: a stale upload can never attach to a reused discarded UUID.
create function public.prevent_discarded_contract_document_reuse()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.discard_started_at is not null or exists (
    select 1 from public.client_contract_document_discards where document_id = new.id
  ) then raise exception 'Documento em descarte ou ja descartado.' using errcode = '23514'; end if;
  return new;
end $$;
revoke all on function public.prevent_discarded_contract_document_reuse() from public, anon, authenticated;
create trigger trg_contract_document_no_discard_reuse before insert on public.client_contract_documents
for each row execute function public.prevent_discarded_contract_document_reuse();

-- RLS helper locks the document until the Storage INSERT transaction commits.
-- This serializes IN-FLIGHT uploads with reservation, not only subsequent uploads.
create function public.can_insert_client_contract_object(p_bucket text, p_path text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_bucket <> 'client-contracts' or auth.uid() is null or public.is_internal_user() is not true then return false; end if;
  select d.id into v_id from public.client_contract_documents d
  join public.client_contracts c on c.id = d.contract_id
  where d.storage_bucket = p_bucket and d.storage_path = p_path
    and d.storage_path = d.contract_id::text || '/' || d.id::text || '.pdf'
    and d.created_by = auth.uid() and d.upload_status = 'pending'
    and d.discard_started_at is null and c.archived_at is null
  for update of d;
  return found;
end $$;
revoke all on function public.can_insert_client_contract_object(text,text) from public, anon, authenticated;
grant execute on function public.can_insert_client_contract_object(text,text) to authenticated;
drop policy client_contract_files_insert on storage.objects;
create policy client_contract_files_insert on storage.objects for insert to authenticated
with check (bucket_id = 'client-contracts' and public.can_insert_client_contract_object(bucket_id, name));

-- Storage may probe caller policies in a rolled-back savepoint and then write
-- as its internal role. Enforce the lock at the ACTUAL metadata INSERT too.
-- Do not modify any other bucket and never DELETE storage.objects through SQL.
create function public.guard_client_contract_storage_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if new.bucket_id <> 'client-contracts' then return new; end if;
  select d.id into v_id from public.client_contract_documents d
  where d.storage_bucket=new.bucket_id and d.storage_path=new.name
    and d.upload_status='pending' and d.discard_started_at is null
  for update;
  if not found then raise exception 'Upload sem documento pendente ou em descarte.' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function public.guard_client_contract_storage_insert() from public, anon, authenticated;
create trigger trg_client_contract_storage_insert before insert on storage.objects
for each row execute function public.guard_client_contract_storage_insert();

create or replace function public.finalize_client_contract_document(p_document_id uuid)
returns public.client_contract_documents language plpgsql security definer set search_path = '' as $$
declare v_document public.client_contract_documents;
begin
  if auth.uid() is null or public.is_internal_user() is not true then
    raise exception 'Usuario interno ativo obrigatorio.' using errcode = '42501';
  end if;
  select d.* into v_document from public.client_contract_documents d
  join public.client_contracts c on c.id = d.contract_id
  where d.id = p_document_id and d.created_by = auth.uid()
    and d.upload_status in ('pending','ready') and d.discard_started_at is null
    and c.archived_at is null for update of d;
  if not found then raise exception 'Documento pendente nao encontrado.' using errcode = 'P0002'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id=v_document.storage_bucket and o.name=v_document.storage_path) then
    raise exception 'Objeto do documento nao encontrado no Storage.' using errcode = 'P0002';
  end if;
  update public.client_contract_documents set upload_status='ready', uploaded_at=coalesce(uploaded_at,now()), upload_error=null
  where id=p_document_id returning * into v_document;
  return v_document;
end $$;
revoke all on function public.finalize_client_contract_document(uuid) from public, anon, authenticated;
grant execute on function public.finalize_client_contract_document(uuid) to authenticated;

create or replace function public.mark_client_contract_document_failed(p_document_id uuid, p_reason text)
returns public.client_contract_documents language plpgsql security definer set search_path = '' as $$
declare v_document public.client_contract_documents;
begin
  if auth.uid() is null or public.is_internal_user() is not true then
    raise exception 'Usuario interno ativo obrigatorio.' using errcode = '42501';
  end if;
  update public.client_contract_documents set upload_status='failed', uploaded_at=null,
    upload_error=left(coalesce(nullif(btrim(p_reason),''),'Falha no upload.'),500)
  where id=p_document_id and created_by=auth.uid() and upload_status='pending' and discard_started_at is null
    and exists(select 1 from public.client_contracts c where c.id=client_contract_documents.contract_id and c.archived_at is null)
  returning * into v_document;
  if not found then raise exception 'Documento pendente nao encontrado.' using errcode='P0002'; end if;
  return v_document;
end $$;
revoke all on function public.mark_client_contract_document_failed(uuid,text) from public, anon, authenticated;
grant execute on function public.mark_client_contract_document_failed(uuid,text) to authenticated;

-- Service-only boundary. p_actor is taken by the backend from Auth.getUser(jwt),
-- NEVER from the HTTP body. Active profile and original owner checked in SQL too.
create function public.begin_client_contract_document_discard(p_actor uuid, p_contract_id uuid, p_document_id uuid, p_attempt_id uuid)
returns public.client_contract_document_discards language plpgsql security definer set search_path = '' as $$
declare d public.client_contract_documents; j public.client_contract_document_discards;
begin
  if p_actor is null or not exists(select 1 from public.profiles where id=p_actor and active and role in ('admin','equipe')) then
    raise exception 'Usuario interno ativo obrigatorio.' using errcode='42501';
  end if;
  -- Consistent lock order everywhere: document first, then tombstone.
  select * into d from public.client_contract_documents where id=p_document_id for update;
  select * into j from public.client_contract_document_discards where document_id=p_document_id for update;
  if j.document_id is null then
    if d.id is null or d.contract_id <> p_contract_id or d.created_by is distinct from p_actor then
      raise exception 'Documento nao encontrado.' using errcode='P0002';
    end if;
    if d.upload_status not in ('pending','failed') then raise exception 'Documento finalizado protegido.' using errcode='23514'; end if;
    if d.storage_bucket <> 'client-contracts' or d.storage_path <> d.contract_id::text || '/' || d.id::text || '.pdf'
      or not exists(select 1 from public.client_contracts where id=p_contract_id) then
      raise exception 'Vinculo do documento invalido.' using errcode='23514';
    end if;
    update public.client_contract_documents set discard_started_at=now() where id=d.id;
    insert into public.client_contract_document_discards(document_id,contract_id,created_by,storage_bucket,storage_path)
    values(d.id,d.contract_id,d.created_by,'client-contracts',d.storage_path) returning * into j;
  elsif j.contract_id <> p_contract_id or j.created_by <> p_actor then
    raise exception 'Documento nao encontrado.' using errcode='P0002';
  end if;
  insert into public.client_contract_document_discard_attempts(id,document_id) values(p_attempt_id,p_document_id);
  update public.client_contract_document_discards set attempts=attempts+1 where document_id=p_document_id returning * into j;
  return j;
end $$;

create function public.finish_client_contract_document_discard(p_actor uuid, p_document_id uuid, p_operation_id uuid, p_attempt_id uuid, p_error_code text default null)
returns public.client_contract_document_discards language plpgsql security definer set search_path = '' as $$
declare d public.client_contract_documents; j public.client_contract_document_discards;
begin
  if p_actor is null or not exists(select 1 from public.profiles where id=p_actor and active and role in ('admin','equipe')) then
    raise exception 'Usuario interno ativo obrigatorio.' using errcode='42501';
  end if;
  select * into d from public.client_contract_documents where id=p_document_id for update;
  select * into j from public.client_contract_document_discards where document_id=p_document_id for update;
  if j.document_id is null or j.operation_id <> p_operation_id or j.created_by <> p_actor
    or not exists(select 1 from public.client_contract_document_discard_attempts where id=p_attempt_id and document_id=p_document_id)
  then raise exception 'Operacao nao encontrada.' using errcode='P0002'; end if;
  if p_error_code is not null then
    if p_error_code not in ('storage_api_failed','verification_failed','interrupted') then raise exception 'Codigo invalido.' using errcode='22023'; end if;
    update public.client_contract_document_discard_attempts set finished_at=now(),outcome='retry_required',error_code=p_error_code where id=p_attempt_id;
    update public.client_contract_document_discards set last_error=p_error_code where document_id=p_document_id returning * into j;
    return j;
  end if;
  if exists(select 1 from storage.objects where bucket_id=j.storage_bucket and name=j.storage_path) then
    raise exception 'Storage ainda possui metadado do objeto.' using errcode='23514';
  end if;
  if d.id is not null then
    if d.upload_status not in ('pending','failed') or d.discard_started_at is null
      or d.created_by is distinct from j.created_by or d.contract_id <> j.contract_id or d.storage_path <> j.storage_path
    then raise exception 'Estado de descarte inconsistente.' using errcode='23514'; end if;
    delete from public.client_contract_documents where id=p_document_id;
  end if;
  update public.client_contract_document_discard_attempts set finished_at=now(),outcome='api_absent',error_code=null where id=p_attempt_id;
  update public.client_contract_document_discards set state='api_absent',last_error=null,api_absence_confirmed_at=coalesce(api_absence_confirmed_at,now())
  where document_id=p_document_id returning * into j;
  return j;
end $$;

alter function public.prevent_discarded_contract_document_reuse() owner to postgres;
alter function public.can_insert_client_contract_object(text,text) owner to postgres;
alter function public.guard_client_contract_storage_insert() owner to postgres;
alter function public.finalize_client_contract_document(uuid) owner to postgres;
alter function public.mark_client_contract_document_failed(uuid,text) owner to postgres;
alter function public.begin_client_contract_document_discard(uuid,uuid,uuid,uuid) owner to postgres;
alter function public.finish_client_contract_document_discard(uuid,uuid,uuid,uuid,text) owner to postgres;
revoke all on function public.begin_client_contract_document_discard(uuid,uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.finish_client_contract_document_discard(uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.begin_client_contract_document_discard(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.finish_client_contract_document_discard(uuid,uuid,uuid,uuid,text) to service_role;
commit;
