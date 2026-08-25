select
  (select count(*) from public.clients) as clients,
  (select count(*) from public.client_contacts) as client_contacts,
  (
    select count(*)
    from auth.users
    where id::text like '70000000-0000-0000-0000-%'
       or email like 'etapa07-%@test.local'
  ) as etapa07_auth_users,
  (
    select count(*)
    from public.profiles
    where id::text like '70000000-0000-0000-0000-%'
  ) as etapa07_profiles,
  (select count(*) from pg_extension where extname = 'pgtap') as pgtap_extensions,
  (to_regtype('public.client_type') is not null) as has_client_type,
  (to_regtype('public.client_status') is not null) as has_client_status,
  (to_regclass('public.clients') is not null) as has_clients,
  (to_regclass('public.client_contacts') is not null) as has_client_contacts,
  (to_regclass('public.client_list_v') is not null) as has_client_list_view,
  (
    to_regprocedure(
      'public.save_client_contact(uuid,text,uuid,text,text,text,text,text,boolean,text,public.client_status)'
    ) is not null
  ) as has_save_client_contact;
