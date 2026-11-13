-- Isolated HML only, after target migration. No application writes.
begin read only;
do $$
declare f record;
begin
  if exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'client_contract_documents'
      and has_column_privilege('authenticated', 'public.client_contract_documents', c.column_name, 'UPDATE')
  ) then raise exception 'authenticated retains document UPDATE privileges'; end if;
  for f in
    select p.oid, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) as owner
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('finalize_client_contract_document', 'mark_client_contract_document_failed')
  loop
    if not f.prosecdef or f.owner <> 'postgres' or not ('search_path=""' = any(f.proconfig)) then
      raise exception 'Unsafe RPC configuration: %', f.oid::regprocedure;
    end if;
    if has_function_privilege('anon', f.oid, 'EXECUTE') or not has_function_privilege('authenticated', f.oid, 'EXECUTE') then
      raise exception 'Unsafe RPC grants: %', f.oid::regprocedure;
    end if;
    if exists (select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = f.oid and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
      raise exception 'PUBLIC can execute RPC: %', f.oid::regprocedure;
    end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('finalize_client_contract_document', 'mark_client_contract_document_failed')) <> 2 then
    raise exception 'Missing RPC or unexpected overload';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'client_contract_documents' and (not c.relrowsecurity or not c.relforcerowsecurity)) then
    raise exception 'Document RLS must be enabled and forced';
  end if;
end $$;
rollback;
