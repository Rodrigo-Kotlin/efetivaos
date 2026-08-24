select
  p.oid::regprocedure::text as function_signature,
  pg_get_userbyid(p.proowner) as owner,
  p.proconfig as configuration,
  p.proacl as access_control,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by function_signature;
