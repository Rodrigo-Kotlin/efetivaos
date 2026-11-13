-- CLIENTES-CONTRATOS-02: corrige a qualificacao de storage.objects.name.
-- A migration original resolvia "name" como d.name dentro do EXISTS.
begin;

drop policy if exists client_contract_files_select on storage.objects;
create policy client_contract_files_select
on storage.objects for select to authenticated using (
  bucket_id = 'client-contracts'
  and public.is_internal_user()
  and exists (select 1 from public.client_contract_documents d where d.storage_path = storage.objects.name)
);

drop policy if exists client_contract_files_insert on storage.objects;
create policy client_contract_files_insert
on storage.objects for insert to authenticated with check (
  bucket_id = 'client-contracts'
  and public.is_internal_user()
  and exists (select 1 from public.client_contract_documents d where d.storage_path = storage.objects.name)
);

drop policy if exists client_contract_files_update on storage.objects;
create policy client_contract_files_update
on storage.objects for update to authenticated using (
  bucket_id = 'client-contracts'
  and public.is_internal_user()
  and exists (select 1 from public.client_contract_documents d where d.storage_path = storage.objects.name)
) with check (
  bucket_id = 'client-contracts'
  and public.is_internal_user()
  and exists (select 1 from public.client_contract_documents d where d.storage_path = storage.objects.name)
);

commit;
