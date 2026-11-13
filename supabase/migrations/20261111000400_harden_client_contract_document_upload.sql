-- CLIENTES-CONTRATOS-11
-- Controla o ciclo de vida do documento sem conceder DELETE geral.
-- PREPARADA PARA REVISAO: nao aplicar automaticamente.
begin;

create type public.client_contract_document_upload_status as enum ('pending', 'ready', 'failed');

alter table public.client_contract_documents
  add column upload_status public.client_contract_document_upload_status not null default 'pending',
  add column uploaded_at timestamptz,
  add column upload_error text;

-- Registros legados somente ficam prontos quando o objeto correspondente existe.
update public.client_contract_documents d
set upload_status = 'ready', uploaded_at = coalesce(d.created_at, now()), upload_error = null
where exists (
  select 1
  from storage.objects o
  where o.bucket_id = d.storage_bucket
    and o.name = d.storage_path
);

update public.client_contract_documents
set upload_status = 'failed', upload_error = 'Registro legado sem objeto correspondente no Storage.'
where upload_status = 'pending';

alter table public.client_contract_documents
  add constraint client_contract_documents_upload_state_chk check (
    (upload_status = 'ready' and uploaded_at is not null and upload_error is null)
    or (upload_status = 'pending' and uploaded_at is null and upload_error is null)
    or (upload_status = 'failed' and uploaded_at is null and upload_error is not null)
  );

drop policy if exists client_contract_documents_internal on public.client_contract_documents;
create policy client_contract_documents_select_ready_or_own_incomplete
on public.client_contract_documents for select to authenticated
using (
  public.is_internal_user()
  and (
    upload_status = 'ready'
    or (upload_status in ('pending', 'failed') and created_by = (select auth.uid()))
  )
);

create policy client_contract_documents_insert_pending
on public.client_contract_documents for insert to authenticated
with check (
  public.is_internal_user()
  and upload_status = 'pending'
  and created_by = (select auth.uid())
  and storage_bucket = 'client-contracts'
  and exists (
    select 1 from public.client_contracts c
    where c.id = contract_id
      and c.archived_at is null
  )
);

create policy client_contract_documents_delete_incomplete
on public.client_contract_documents for delete to authenticated
using (
  public.is_internal_user()
  and upload_status in ('pending', 'failed')
  and created_by = (select auth.uid())
);

revoke update on public.client_contract_documents from authenticated, anon, public;
grant select, insert, delete on public.client_contract_documents to authenticated;

drop policy if exists client_contract_files_select on storage.objects;
create policy client_contract_files_select
on storage.objects for select to authenticated using (
  bucket_id = 'client-contracts'
  and public.is_internal_user()
  and exists (
    select 1 from public.client_contract_documents d
    where d.storage_path = storage.objects.name
      and d.storage_bucket = storage.objects.bucket_id
      and d.upload_status = 'ready'
  )
);

drop policy if exists client_contract_files_insert on storage.objects;
create policy client_contract_files_insert
on storage.objects for insert to authenticated with check (
  bucket_id = 'client-contracts'
  and public.is_internal_user()
  and exists (
    select 1 from public.client_contract_documents d
    where d.storage_path = storage.objects.name
      and d.storage_bucket = storage.objects.bucket_id
      and d.upload_status = 'pending'
      and d.created_by = (select auth.uid())
  )
);

-- Do not recreate an UPDATE policy here. A ready object must be immutable:
-- UPDATE covers content replacement and metadata changes, and Storage move/copy
-- flows are composed from INSERT/UPDATE/DELETE operations on storage.objects.
drop policy if exists client_contract_files_update on storage.objects;

drop policy if exists client_contract_files_delete_admin on storage.objects;
create policy client_contract_files_delete_incomplete
on storage.objects for delete to authenticated using (
  bucket_id = 'client-contracts'
  and public.is_internal_user()
  and exists (
    select 1 from public.client_contract_documents d
    where d.storage_path = storage.objects.name
      and d.storage_bucket = storage.objects.bucket_id
      and d.upload_status in ('pending', 'failed')
      and d.created_by = (select auth.uid())
  )
);

create or replace function public.finalize_client_contract_document(p_document_id uuid)
returns public.client_contract_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.client_contract_documents;
begin
  if (select auth.uid()) is null or not coalesce(public.is_internal_user(), false) then
    raise exception 'Usuario interno ativo obrigatorio.' using errcode = '42501';
  end if;

  select d.* into v_document
  from public.client_contract_documents d
  join public.client_contracts c on c.id = d.contract_id
  where d.id = p_document_id
    and d.created_by = (select auth.uid())
    and d.upload_status in ('pending', 'ready')
    and c.archived_at is null
  for update;

  if not found then
    raise exception 'Documento pendente nao encontrado.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = v_document.storage_bucket
      and o.name = v_document.storage_path
  ) then
    raise exception 'Objeto do documento nao encontrado no Storage.' using errcode = 'P0002';
  end if;

  update public.client_contract_documents
  set upload_status = 'ready', uploaded_at = coalesce(uploaded_at, now()), upload_error = null
  where id = p_document_id
  returning * into v_document;

  return v_document;
end;
$$;

alter function public.finalize_client_contract_document(uuid) owner to postgres;
revoke all on function public.finalize_client_contract_document(uuid) from public, anon, authenticated;
grant execute on function public.finalize_client_contract_document(uuid) to authenticated;

create or replace function public.mark_client_contract_document_failed(p_document_id uuid, p_reason text)
returns public.client_contract_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.client_contract_documents;
begin
  if (select auth.uid()) is null or not coalesce(public.is_internal_user(), false) then
    raise exception 'Usuario interno ativo obrigatorio.' using errcode = '42501';
  end if;

  update public.client_contract_documents
  set upload_status = 'failed', uploaded_at = null,
      upload_error = left(coalesce(nullif(btrim(p_reason), ''), 'Falha no upload.'), 500)
  where id = p_document_id
    and created_by = (select auth.uid())
    and upload_status = 'pending'
    and exists (
      select 1
      from public.client_contracts c
      where c.id = client_contract_documents.contract_id
        and c.archived_at is null
    )
  returning * into v_document;

  if not found then
    raise exception 'Documento pendente nao encontrado.' using errcode = 'P0002';
  end if;
  return v_document;
end;
$$;

alter function public.mark_client_contract_document_failed(uuid, text) owner to postgres;
revoke all on function public.mark_client_contract_document_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_client_contract_document_failed(uuid, text) to authenticated;

commit;
