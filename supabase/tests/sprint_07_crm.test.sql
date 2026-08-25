begin;

create extension if not exists pgtap with schema extensions;

select plan(55);

-- Structure, grants, RLS and function posture.
select enum_has_labels(
  'public', 'client_type', array['company', 'individual'],
  'client_type has only company and individual'
);
select enum_has_labels(
  'public', 'client_status', array['active', 'inactive'],
  'client_status has only active and inactive'
);
select has_table('public', 'clients', 'clients table exists');
select has_table('public', 'client_contacts', 'client_contacts table exists');
select columns_are(
  'public', 'client_contacts',
  array[
    'id','client_id','name','role','department','email','phone','whatsapp',
    'is_primary','notes','status','created_at','created_by','updated_at','updated_by'
  ],
  'client_contacts has the approved conceptual and audit fields'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.clients'::regclass)
    and (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.client_contacts'::regclass),
  'RLS is enabled and forced on both CRM tables'
);
select policies_are(
  'public', 'clients',
  array['clients_insert_internal','clients_select_internal','clients_update_internal'],
  'clients has no DELETE policy'
);
select policies_are(
  'public', 'client_contacts',
  array['client_contacts_insert_internal','client_contacts_select_internal','client_contacts_update_internal'],
  'client_contacts has no DELETE policy'
);
select table_privs_are(
  'public', 'clients', 'authenticated', array['INSERT','SELECT','UPDATE'],
  'authenticated has logical CRUD only on clients'
);
select table_privs_are(
  'public', 'client_contacts', 'authenticated', array['INSERT','SELECT','UPDATE'],
  'authenticated has logical CRUD only on contacts'
);
select ok(
  not has_table_privilege('anon', 'public.clients', 'SELECT')
    and not has_table_privilege('anon', 'public.client_contacts', 'SELECT'),
  'anon has no CRM table privileges'
);
select ok(
  coalesce((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.client_list_v'::regclass), false)
    and has_table_privilege('authenticated', 'public.client_list_v', 'SELECT')
    and not has_table_privilege('anon', 'public.client_list_v', 'SELECT'),
  'client_list_v is security-invoker and granted only to authenticated'
);
select ok(
  (select not prosecdef and provolatile = 'v' and proconfig @> array['search_path=""']
   from pg_proc where oid = to_regprocedure('public.save_client_contact(uuid,text,uuid,text,text,text,text,text,boolean,text,client_status)'))
    and has_function_privilege(
      'authenticated',
      'public.save_client_contact(uuid,text,uuid,text,text,text,text,text,boolean,text,client_status)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.save_client_contact(uuid,text,uuid,text,text,text,text,text,boolean,text,client_status)',
      'EXECUTE'
    ),
  'contact RPC is volatile SECURITY INVOKER with empty search_path and no anon grant'
);
select ok(
  not has_function_privilege('authenticated', 'public.normalize_client()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.normalize_client_contact()', 'EXECUTE'),
  'normalization trigger helpers are not callable by application roles'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = to_regprocedure('public.is_admin()'))
    and has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.is_admin()', 'EXECUTE'),
  'is_admin preserves hardened SECURITY DEFINER posture and grants'
);
select ok(
  public.is_valid_brazilian_tax_id('52998224725', 'individual')
    and public.is_valid_brazilian_tax_id('11222333000181', 'company'),
  'authoritative validator accepts real valid CPF and CNPJ values'
);

-- Fixed ETAPA 07 Auth fixtures. The Auth trigger creates their profiles.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '70000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'etapa07-admin@test.local', '', now(),
    '{}', '{"full_name":"ETAPA 07 Admin"}', now(), now()
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'etapa07-equipe@test.local', '', now(),
    '{}', '{"full_name":"ETAPA 07 Equipe"}', now(), now()
  ),
  (
    '70000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'etapa07-inactive@test.local', '', now(),
    '{}', '{"full_name":"ETAPA 07 Inactive"}', now(), now()
  ),
  (
    '70000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'etapa07-missing@test.local', '', now(),
    '{}', '{"full_name":"ETAPA 07 Missing"}', now(), now()
  );

update public.profiles set role = 'admin'
where id = '70000000-0000-0000-0000-000000000001';
update public.profiles set active = false
where id = '70000000-0000-0000-0000-000000000003';
delete from public.profiles
where id = '70000000-0000-0000-0000-000000000004';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$
    insert into public.clients (
      id, legal_name, trade_name, tax_id, client_type, email, phone,
      zip_code, city, state, country, notes,
      created_at, created_by, updated_at, updated_by
    ) values (
      '70000000-0000-0000-0000-000000000010',
      '  ACME Saúde Ltda.  ', '  ACME Saúde  ', '11.222.333/0001-81', 'company',
      '  CONTATO@ACME.TEST  ', '(11) 98765-4321', '01310-100',
      '  São Paulo  ', 'sp', '', '   ',
      '2000-01-01', '70000000-0000-0000-0000-000000000002',
      '2000-01-01', '70000000-0000-0000-0000-000000000002'
    )
  $$,
  'Admin creates a company client with valid CNPJ'
);
select ok(
  (
    select legal_name = 'ACME Saúde Ltda.'
      and trade_name = 'ACME Saúde'
      and tax_id = '11222333000181'
      and email = 'contato@acme.test'
      and phone = '11987654321'
      and zip_code = '01310100'
      and city = 'São Paulo'
      and state = 'SP'
      and country = 'Brasil'
      and notes is null
      and created_by = '70000000-0000-0000-0000-000000000001'
      and updated_by = '70000000-0000-0000-0000-000000000001'
      and created_at > now() - interval '1 minute'
    from public.clients
    where id = '70000000-0000-0000-0000-000000000010'
  ),
  'company values normalize, capitalization is preserved, and spoofed audit input is discarded'
);
select lives_ok(
  $$
    insert into public.clients (id, legal_name, tax_id, client_type)
    values (
      '70000000-0000-0000-0000-000000000011',
      'Maria da Silva', '529.982.247-25', 'individual'
    )
  $$,
  'Admin creates an individual client with valid CPF'
);
select ok(
  (
    select tax_id = '52998224725' and client_type = 'individual' and status = 'active'
    from public.clients where id = '70000000-0000-0000-0000-000000000011'
  ),
  'individual CPF is canonical and active by default'
);
select throws_ok(
  $$ insert into public.clients (legal_name, tax_id, client_type) values ('CPF inválido', '52998224724', 'individual') $$,
  '23514', 'new row for relation "clients" violates check constraint "clients_tax_id_valid_chk"',
  'invalid CPF checksum is rejected'
);
select throws_ok(
  $$ insert into public.clients (legal_name, tax_id, client_type) values ('CNPJ inválido', '11222333000180', 'company') $$,
  '23514', 'new row for relation "clients" violates check constraint "clients_tax_id_valid_chk"',
  'invalid CNPJ checksum is rejected'
);
select throws_ok(
  $$ insert into public.clients (legal_name, tax_id, client_type) values ('Tipo PJ inválido', '52998224725', 'company') $$,
  '23514', 'new row for relation "clients" violates check constraint "clients_tax_id_valid_chk"',
  'CPF cannot be registered as company'
);
select throws_ok(
  $$ insert into public.clients (legal_name, tax_id, client_type) values ('Tipo PF inválido', '11222333000181', 'individual') $$,
  '23514', 'new row for relation "clients" violates check constraint "clients_tax_id_valid_chk"',
  'CNPJ cannot be registered as individual'
);
select throws_ok(
  $$ insert into public.clients (legal_name, tax_id, client_type) values ('Duplicado global', '529.982.247-25', 'individual') $$,
  '23505', 'duplicate key value violates unique constraint "clients_tax_id_key"',
  'canonical CPF is globally unique'
);
select throws_ok(
  $$ insert into public.clients (legal_name, tax_id, client_type) values ('CNPJ duplicado global', '11.222.333/0001-81', 'company') $$,
  '23505', 'duplicate key value violates unique constraint "clients_tax_id_key"',
  'canonical CNPJ is globally unique'
);
select throws_ok(
  $$ insert into public.clients (legal_name, tax_id, client_type, email) values ('Email inválido', '11144477735', 'individual', 'sem-arroba') $$,
  '23514', 'new row for relation "clients" violates check constraint "clients_email_chk"',
  'invalid optional email is rejected at the database layer'
);
select lives_ok(
  $$
    update public.clients set status = 'inactive' where id = '70000000-0000-0000-0000-000000000010';
    update public.clients set status = 'active' where id = '70000000-0000-0000-0000-000000000010'
  $$,
  'Admin can inactivate and reactivate a client'
);
select is(
  (select status::text from public.clients where id = '70000000-0000-0000-0000-000000000010'),
  'active',
  'reactivated client remains available without hard deletion'
);
select throws_ok(
  $$ delete from public.clients where id = '70000000-0000-0000-0000-000000000010' $$,
  '42501', 'permission denied for table clients',
  'hard delete is unavailable for clients'
);

select lives_ok(
  $$
    insert into public.client_contacts (
      id, client_id, name, role, department, email, phone, whatsapp,
      is_primary, notes, created_at, created_by
    ) values (
      '70000000-0000-0000-0000-000000000020',
      '70000000-0000-0000-0000-000000000010',
      '  Ana Souza  ', '  Diretora  ', '  Compras  ', '  ANA@ACME.TEST  ',
      '(11) 3333-4444', '(11) 99999-0000', true, '   ',
      '2000-01-01', '70000000-0000-0000-0000-000000000002'
    )
  $$,
  'Admin creates a primary client contact'
);
select ok(
  (
    select name = 'Ana Souza' and role = 'Diretora' and department = 'Compras'
      and email = 'ana@acme.test' and phone = '1133334444'
      and whatsapp = '11999990000' and notes is null
      and created_by = '70000000-0000-0000-0000-000000000001'
      and created_at > now() - interval '1 minute'
    from public.client_contacts
    where id = '70000000-0000-0000-0000-000000000020'
  ),
  'contact normalization and creator audit resist spoofing'
);
select ok(
  (
    select primary_contact_id = '70000000-0000-0000-0000-000000000020'
      and primary_contact_name = 'Ana Souza'
      and primary_contact_email = 'ana@acme.test'
      and contact_count = 1 and active_contact_count = 1
    from public.client_list_v
    where id = '70000000-0000-0000-0000-000000000010'
  ),
  'client list returns one row with consolidated primary contact and counts'
);

insert into public.client_contacts (id, client_id, name)
values (
  '70000000-0000-0000-0000-000000000021',
  '70000000-0000-0000-0000-000000000010',
  'Bruno Lima'
);

select lives_ok(
  $$
    select public.save_client_contact(
      p_client_id => '70000000-0000-0000-0000-000000000010',
      p_name => 'Bruno Lima',
      p_contact_id => '70000000-0000-0000-0000-000000000021',
      p_email => 'bruno@acme.test',
      p_is_primary => true,
      p_status => 'active'
    )
  $$,
  'RPC atomically replaces the active primary contact'
);
select ok(
  not (select is_primary from public.client_contacts where id = '70000000-0000-0000-0000-000000000020')
    and (select is_primary from public.client_contacts where id = '70000000-0000-0000-0000-000000000021'),
  'previous primary is unset and requested primary is set'
);
select lives_ok(
  $$
    select public.save_client_contact(
      p_client_id => '70000000-0000-0000-0000-000000000010',
      p_name => 'Bruno Lima',
      p_contact_id => '70000000-0000-0000-0000-000000000021',
      p_is_primary => true,
      p_status => 'inactive'
    )
  $$,
  'RPC can inactivate the primary contact'
);
select ok(
  (
    select status = 'inactive' and not is_primary
    from public.client_contacts
    where id = '70000000-0000-0000-0000-000000000021'
  ) and (
    select primary_contact_id is null and contact_count = 2 and active_contact_count = 1
    from public.client_list_v
    where id = '70000000-0000-0000-0000-000000000010'
  ),
  'inactive contact is never primary and list aggregates remain correct'
);

update public.client_contacts
set is_primary = true
where id = '70000000-0000-0000-0000-000000000020';
select throws_ok(
  $$
    insert into public.client_contacts (id, client_id, name, is_primary)
    values (
      '70000000-0000-0000-0000-000000000022',
      '70000000-0000-0000-0000-000000000010', 'Terceiro Principal', true
    )
  $$,
  '23505', 'duplicate key value violates unique constraint "uq_client_contacts_active_primary"',
  'partial unique index prevents two active primary contacts'
);
select throws_ok(
  $$
    insert into public.client_contacts (client_id, name)
    values ('70000000-0000-0000-0000-000000000099', 'Cliente inexistente')
  $$,
  '23503', 'insert or update on table "client_contacts" violates foreign key constraint "client_contacts_client_id_fkey"',
  'contact foreign key rejects an invalid client'
);
select throws_ok(
  $$
    select public.save_client_contact(
      '70000000-0000-0000-0000-000000000099', 'Sem cliente'
    )
  $$,
  'P0002', 'Cliente nao encontrado.',
  'RPC rejects a nonexistent parent client'
);
select throws_ok(
  $$
    select public.save_client_contact(
      p_client_id => '70000000-0000-0000-0000-000000000010',
      p_name => 'Sem contato',
      p_contact_id => '70000000-0000-0000-0000-000000000099'
    )
  $$,
  'P0002', 'Contato nao encontrado.',
  'RPC update rejects a nonexistent contact'
);
select throws_ok(
  $$
    update public.client_contacts
    set client_id = '70000000-0000-0000-0000-000000000011'
    where id = '70000000-0000-0000-0000-000000000020'
  $$,
  '23514', 'O contato nao pode ser movido para outro cliente.',
  'direct update cannot reassign a contact to another client'
);
select throws_ok(
  $$
    select public.save_client_contact(
      p_client_id => '70000000-0000-0000-0000-000000000011',
      p_name => 'Tentativa IDOR',
      p_contact_id => '70000000-0000-0000-0000-000000000020'
    )
  $$,
  '23514', 'O contato nao pode ser movido para outro cliente.',
  'RPC blocks contact reassignment and IDOR across clients'
);

select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$
    insert into public.clients (id, legal_name, tax_id, client_type)
    values (
      '70000000-0000-0000-0000-000000000012',
      'Cliente da Equipe', '123.456.789-09', 'individual'
    )
  $$,
  'Equipe has the same logical create access'
);
select lives_ok(
  $$
    update public.clients
    set trade_name = 'Atualizado pela Equipe',
        created_at = '1990-01-01',
        created_by = '70000000-0000-0000-0000-000000000003',
        updated_at = '1990-01-01',
        updated_by = '70000000-0000-0000-0000-000000000003'
    where id = '70000000-0000-0000-0000-000000000010'
  $$,
  'Equipe can update a shared client'
);
select ok(
  (
    select created_by = '70000000-0000-0000-0000-000000000001'
      and created_at > now() - interval '1 minute'
      and updated_by = '70000000-0000-0000-0000-000000000002'
      and updated_at > now() - interval '1 minute'
    from public.clients
    where id = '70000000-0000-0000-0000-000000000010'
  ),
  'audit preserves creator and records updater despite spoofed update fields'
);
select throws_ok(
  $$ delete from public.client_contacts where id = '70000000-0000-0000-0000-000000000020' $$,
  '42501', 'permission denied for table client_contacts',
  'hard delete is unavailable for contacts'
);

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$ select count(*) from public.clients $$,
  '42501', 'permission denied for table clients',
  'anon cannot read clients'
);
select throws_ok(
  $$ select count(*) from public.client_list_v $$,
  '42501', 'permission denied for view client_list_v',
  'anon cannot read the client list view'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000003', true);
select ok(public.is_admin() is false, 'is_admin returns false, never NULL, for an inactive profile');
select is(
  (select count(*) from public.clients), 0::bigint,
  'inactive profile reads no CRM rows through RLS'
);
select throws_ok(
  $$ insert into public.clients (legal_name, tax_id, client_type) values ('Bloqueado inativo', '11144477735', 'individual') $$,
  '42501', 'new row violates row-level security policy for table "clients"',
  'inactive profile cannot insert clients'
);

select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000004', true);
select ok(public.is_admin() is false, 'is_admin returns false, never NULL, when the profile is missing');
select throws_ok(
  $$ select public.set_user_role('70000000-0000-0000-0000-000000000002', 'admin') $$,
  '42501', 'Only admins can change user roles',
  'missing profile cannot bypass set_user_role authorization'
);

set local role postgres;
select is(
  (select role::text from public.profiles where id = '70000000-0000-0000-0000-000000000002'),
  'equipe',
  'denied set_user_role call has no effect'
);

select * from finish();
rollback;
