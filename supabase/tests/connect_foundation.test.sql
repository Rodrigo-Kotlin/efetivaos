begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

select has_table('public', 'connect_organizations', 'Connect organizations table exists');
select has_table('public', 'connect_organization_members', 'Connect organization members table exists');
select has_table('public', 'connect_sectors', 'Connect sectors table exists');
select has_table('public', 'connect_profile_sectors', 'Connect profile sectors table exists');
select has_table('public', 'connect_audit_logs', 'Connect audit logs table exists');
select has_table('public', 'connect_contacts', 'Connect contacts table exists');
select has_table('public', 'connect_contact_channels', 'Connect contact channels table exists');
select has_table('public', 'connect_integration_links', 'Connect integration links table exists');

select col_is_pk('public', 'connect_organizations', 'id', 'organization id is primary key');
select col_not_null('public', 'connect_organizations', 'slug', 'organization slug is required');
select col_not_null('public', 'connect_sectors', 'organization_id', 'sector organization is required');
select col_not_null('public', 'connect_profile_sectors', 'organization_id', 'profile sector organization is required');
select col_not_null('public', 'connect_audit_logs', 'organization_id', 'audit organization is required');
select col_not_null('public', 'connect_integration_links', 'local_entity_id', 'integration local id is required');

select ok(
  (select count(*) = 1 from public.connect_organizations where slug = 'efetiva' and name = 'Efetiva'),
  'Efetiva organization seed exists'
);
select ok(
  (select count(*) = 7 from public.connect_sectors where organization_id = (select id from public.connect_organizations where slug = 'efetiva')),
  'seven foundation sectors are seeded'
);
select ok(
  (select data_classification = 'SENSITIVE' from public.connect_sectors where slug = 'clinica' and organization_id = (select id from public.connect_organizations where slug = 'efetiva')),
  'clinical sector is sensitive'
);

select ok((select relrowsecurity from pg_class where oid = 'public.connect_organizations'::regclass), 'organizations RLS is enabled');
select ok((select relforcerowsecurity from pg_class where oid = 'public.connect_organizations'::regclass), 'organizations RLS is forced');
select ok((select relrowsecurity from pg_class where oid = 'public.connect_sectors'::regclass), 'sectors RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.connect_profile_sectors'::regclass), 'profile sectors RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.connect_audit_logs'::regclass), 'audit RLS is enabled');

select ok((select count(*) = 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'connect_is_org_member'), 'organization membership helper exists');
select ok((select count(*) = 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'connect_is_org_admin'), 'organization admin helper exists');
select ok((select count(*) = 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'connect_can_view_sector'), 'sector view helper exists');
select ok((select count(*) = 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'connect_can_manage_sector'), 'sector manage helper exists');

select policies_are(
  'public',
  'connect_organizations',
  array['connect_organizations_select_member', 'connect_organizations_update_admin'],
  'organizations policies are scoped'
);
select policies_are(
  'public',
  'connect_sectors',
  array['connect_sectors_select_allowed', 'connect_sectors_insert_manager', 'connect_sectors_update_manager'],
  'sector policies are scoped'
);
select policies_are(
  'public',
  'connect_profile_sectors',
  array['connect_profile_sectors_select_self_or_admin', 'connect_profile_sectors_insert_manager', 'connect_profile_sectors_update_manager', 'connect_profile_sectors_delete_manager'],
  'profile sector policies are scoped'
);

select table_privs_are(
  'public', 'connect_audit_logs', 'authenticated', array['SELECT'],
  'authenticated users can only read audit logs directly'
);
select table_privs_are(
  'public', 'connect_audit_logs', 'anon', array[]::text[],
  'anonymous users have no audit access'
);

select ok(
  (select count(*) = 4 from pg_trigger where tgrelid in (
    'public.connect_sectors'::regclass,
    'public.connect_organization_members'::regclass,
    'public.connect_profile_sectors'::regclass
  ) and not tgisinternal),
  'foundation audit triggers exist'
);

select * from finish();
rollback;
