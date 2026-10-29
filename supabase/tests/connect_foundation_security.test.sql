begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'connect-admin@test.local', '', now(), '{}', '{"full_name":"Connect Admin"}', now(), now()),
  ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'connect-team@test.local', '', now(), '{}', '{"full_name":"Connect Team"}', now(), now()),
  ('c1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'connect-inactive@test.local', '', now(), '{}', '{"full_name":"Connect Inactive"}', now(), now());

update public.profiles set role = 'admin' where id = 'c1000000-0000-0000-0000-000000000001';
update public.profiles set active = false where id = 'c1000000-0000-0000-0000-000000000003';

insert into public.connect_organization_members (organization_id, profile_id, active)
select id, 'c1000000-0000-0000-0000-000000000001', true
from public.connect_organizations where slug = 'efetiva';
insert into public.connect_organization_members (organization_id, profile_id, active)
select id, 'c1000000-0000-0000-0000-000000000002', true
from public.connect_organizations where slug = 'efetiva';
insert into public.connect_organization_members (organization_id, profile_id, active)
select id, 'c1000000-0000-0000-0000-000000000003', true
from public.connect_organizations where slug = 'efetiva';

insert into public.connect_profile_sectors (organization_id, profile_id, sector_id, can_view)
select s.organization_id, 'c1000000-0000-0000-0000-000000000002', s.id, true
from public.connect_sectors s where s.slug = 'comercial';

insert into public.connect_organizations (id, name, slug) values
  ('c1000000-0000-0000-0000-000000000010', 'Connect Test Organization', 'connect-test-org');
insert into public.connect_sectors (organization_id, name, slug, sort_order)
values ('c1000000-0000-0000-0000-000000000010', 'Test Sector', 'test-sector', 1);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-000000000002', true);

select is((select count(*)::integer from public.connect_organizations), 1, 'team sees only its organization');
select is((select count(*)::integer from public.connect_sectors), 1, 'team sees only its assigned sector');
select is((select count(*)::integer from public.connect_sectors where data_classification = 'SENSITIVE'), 0, 'team cannot see unassigned sensitive sector');
select is((select count(*)::integer from public.connect_sectors where slug = 'test-sector'), 0, 'team cannot see another organization sector');

select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.connect_organizations), 1, 'admin sees only its organization');
select ok(
  (select has_table_privilege('authenticated', 'public.connect_audit_logs', 'SELECT')
    and not has_table_privilege('authenticated', 'public.connect_audit_logs', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.connect_audit_logs', 'DELETE')),
  'audit log is append-only for authenticated clients'
);
select lives_ok($$insert into public.connect_profile_sectors (organization_id, profile_id, sector_id, can_view) select s.organization_id, 'c1000000-0000-0000-0000-000000000002', s.id, true from public.connect_sectors s where s.slug = 'clinica'$$, 'admin can assign a sensitive sector');

select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.connect_sectors where data_classification = 'SENSITIVE'), 1, 'assigned team can see sensitive sector');
select is((select count(*)::integer from public.connect_audit_logs where action = 'USER_ADDED_TO_SECTOR'), 2, 'sector assignments are audited');

select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.connect_organizations), 0, 'inactive profile cannot see organization');
select is((select count(*)::integer from public.connect_sectors), 0, 'inactive profile cannot see sectors');
select is((select count(*)::integer from public.connect_profile_sectors), 0, 'inactive profile cannot see sector memberships');

select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-000000000001', true);
select ok(
  (select count(*) >= 1 from public.connect_audit_logs where organization_id = (select id from public.connect_organizations where slug = 'efetiva')),
  'foundation administration produced audit records'
);
select ok(
  (select count(*) = 0 from public.connect_integration_links),
  'integration links remain empty until a future integration'
);

select * from finish();
rollback;
