select pg_sleep(2);

begin;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);

update public.margin_rules
set value = 20
where id = '51000000-0000-0000-0000-000000000060';

commit;

select 'pricing_rule_changed' as session_b_result;
