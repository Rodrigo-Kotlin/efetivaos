begin read only;
do $$
declare f record;
begin
  if has_table_privilege('authenticated','public.client_contract_documents','DELETE') then raise exception 'Direct metadata DELETE granted'; end if;
  if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and cmd in ('ALL','DELETE','UPDATE')
    and (coalesce(qual,'') ilike '%client-contracts%' or coalesce(with_check,'') ilike '%client-contracts%')) then
    raise exception 'Contract Storage mutation policy still present';
  end if;
  for f in select p.*, pg_get_userbyid(p.proowner) as owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('begin_client_contract_document_discard','finish_client_contract_document_discard',
      'guard_client_contract_storage_insert','prevent_discarded_contract_document_reuse','can_insert_client_contract_object')
  loop
    if f.owner <> 'postgres' or not f.prosecdef or not ('search_path=""'=any(f.proconfig))
      or has_function_privilege('anon',f.oid,'EXECUTE') then raise exception 'Unsafe discard function %',f.proname; end if;
    if f.proname <> 'can_insert_client_contract_object' and has_function_privilege('authenticated',f.oid,'EXECUTE') then
      raise exception 'Privileged helper callable by authenticated: %', f.proname;
    end if;
    if exists(select 1 from aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') then
      raise exception 'PUBLIC executes %',f.proname;
    end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('begin_client_contract_document_discard','finish_client_contract_document_discard','guard_client_contract_storage_insert','prevent_discarded_contract_document_reuse','can_insert_client_contract_object')) <> 5 then
    raise exception 'Missing discard helpers';
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_client_contract_storage_insert' and tgenabled='O') then raise exception 'Final Storage INSERT unguarded'; end if;
  if has_table_privilege('authenticated','public.client_contract_document_discards','UPDATE')
    or has_table_privilege('authenticated','public.client_contract_document_discard_attempts','INSERT') then raise exception 'Audit grants unsafe'; end if;
end $$;
rollback;
select true as cc16_security_catalog_pass;
