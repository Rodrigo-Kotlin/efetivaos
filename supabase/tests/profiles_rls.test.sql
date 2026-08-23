begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_type('public', 'app_role', 'app_role enum exists');
select enum_has_labels('public', 'app_role', array['admin', 'equipe'], 'roles are restricted');
select has_table('public', 'profiles', 'profiles table exists');
select col_is_pk('public', 'profiles', 'id', 'profiles id is the primary key');
select col_not_null('public', 'profiles', 'role', 'profile role is required');
select policies_are(
  'public',
  'profiles',
  array['profiles_select_self_or_admin', 'profiles_update_self_or_admin'],
  'profiles has only the baseline policies'
);
select function_privs_are(
  'public',
  'set_user_role',
  array['uuid', 'app_role'],
  'authenticated',
  array['EXECUTE'],
  'authenticated can call the role RPC'
);
select table_privs_are(
  'public',
  'profiles',
  'anon',
  array[]::text[],
  'anonymous users have no table privileges'
);

select * from finish();
rollback;
