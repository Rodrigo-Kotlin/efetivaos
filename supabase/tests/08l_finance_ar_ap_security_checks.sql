begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  seq bigint generated always as identity primary key,
  result text not null
) on commit drop;

grant insert, select on pg_temp.tap_results to authenticated, anon;
grant usage, select on sequence pg_temp.tap_results_seq_seq to authenticated, anon;

insert into pg_temp.tap_results (result) select plan(28);

-- Auth fixtures. The auth trigger creates profiles for all four users.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '8c100000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', '08l-admin@test.local', '', now(),
    '{}', '{"full_name":"08L Admin"}', now(), now()
  ),
  (
    '8c100000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', '08l-equipe@test.local', '', now(),
    '{}', '{"full_name":"08L Equipe"}', now(), now()
  ),
  (
    '8c100000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', '08l-inactive@test.local', '', now(),
    '{}', '{"full_name":"08L Inactive"}', now(), now()
  ),
  (
    '8c100000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', '08l-no-profile@test.local', '', now(),
    '{}', '{"full_name":"08L No Profile"}', now(), now()
  );

update public.profiles
set role = 'admin'
where id = '8c100000-0000-0000-0000-000000000001';

update public.profiles
set active = false
where id = '8c100000-0000-0000-0000-000000000003';

delete from public.profiles
where id = '8c100000-0000-0000-0000-000000000004';

-- Controlled transaction fixtures. No journal mutation is needed to test the
-- operational classification contract of these views.
insert into public.financial_transactions (
  id, description, transaction_date, competence_date, movement_type, amount,
  status, due_date
)
values
  ('8c110000-0000-0000-0000-000000000001', '08L Receita', current_date - 10, current_date - 10, 'RECEITA', 100, 'pending', current_date + 10),
  ('8c110000-0000-0000-0000-000000000002', '08L Despesa', current_date - 10, current_date - 10, 'DESPESA', 200, 'pending', current_date + 10),
  ('8c110000-0000-0000-0000-000000000003', '08L Imobilizado', current_date - 10, current_date - 10, 'IMOBILIZADO', 300, 'pending', current_date + 10),
  ('8c110000-0000-0000-0000-000000000004', '08L Transferencia', current_date - 10, current_date - 10, 'TRANSFERENCIA', 400, 'pending', current_date + 10),
  ('8c110000-0000-0000-0000-000000000005', '08L Emprestimo recebido', current_date - 10, current_date - 10, 'EMPRESTIMO_RECEBIDO', 500, 'pending', current_date + 10),
  ('8c110000-0000-0000-0000-000000000006', '08L Emprestimo pago', current_date - 10, current_date - 10, 'EMPRESTIMO_PAGO', 600, 'pending', current_date + 10),
  ('8c110000-0000-0000-0000-000000000007', '08L Aporte', current_date - 10, current_date - 10, 'APORTE', 700, 'pending', current_date + 10),
  ('8c110000-0000-0000-0000-000000000008', '08L Retirada', current_date - 10, current_date - 10, 'RETIRADA', 800, 'pending', current_date + 10),
  ('8c110000-0000-0000-0000-000000000009', '08L Saldo inicial', current_date - 10, current_date - 10, 'SALDO_INICIAL', 900, 'pending', current_date + 10),
  ('8c110000-0000-0000-0000-000000000010', '08L Ajuste', current_date - 10, current_date - 10, 'AJUSTE', 1000, 'pending', current_date + 10),
  ('8c110000-0000-0000-0000-000000000011', '08L Depreciacao', current_date - 10, current_date - 10, 'DEPRECIACAO', 1100, 'pending', current_date + 10),
  ('8c110000-0000-0000-0000-000000000012', '08L Receita cancelada', current_date - 10, current_date - 10, 'RECEITA', 1200, 'cancelled', current_date - 1);

-- Structure and privilege checks.
insert into pg_temp.tap_results (result)
select has_view('public', 'financial_receivables_v', 'financial_receivables_v exists');

insert into pg_temp.tap_results (result)
select has_view('public', 'financial_payables_v', 'financial_payables_v exists');

insert into pg_temp.tap_results (result)
select ok(
  coalesce((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.financial_receivables_v'::regclass), false),
  'receivables uses security_invoker'
);

insert into pg_temp.tap_results (result)
select ok(
  coalesce((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.financial_payables_v'::regclass), false),
  'payables uses security_invoker'
);

insert into pg_temp.tap_results (result)
select ok(
  not exists (
    select 1
    from pg_class c
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
    where c.oid = 'public.financial_receivables_v'::regclass
      and acl.grantee = 0
      and acl.privilege_type = 'SELECT'
  ),
  'PUBLIC has no SELECT grant on receivables'
);

insert into pg_temp.tap_results (result)
select ok(
  not exists (
    select 1
    from pg_class c
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
    where c.oid = 'public.financial_payables_v'::regclass
      and acl.grantee = 0
      and acl.privilege_type = 'SELECT'
  ),
  'PUBLIC has no SELECT grant on payables'
);

insert into pg_temp.tap_results (result)
select ok(not has_table_privilege('anon', 'public.financial_receivables_v', 'SELECT'), 'anon has no SELECT privilege on receivables');

insert into pg_temp.tap_results (result)
select ok(not has_table_privilege('anon', 'public.financial_payables_v', 'SELECT'), 'anon has no SELECT privilege on payables');

insert into pg_temp.tap_results (result)
select ok(
  has_table_privilege('authenticated', 'public.financial_receivables_v', 'SELECT')
    and has_table_privilege('authenticated', 'public.financial_payables_v', 'SELECT'),
  'authenticated has SELECT on both views'
);

-- Functional classification checks as an active Admin.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '8c100000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_receivables_v where transaction_id = '8c110000-0000-0000-0000-000000000001'), 1::bigint, 'revenue appears in AR');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_payables_v where transaction_id = '8c110000-0000-0000-0000-000000000001'), 0::bigint, 'revenue does not appear in AP');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_payables_v where transaction_id = '8c110000-0000-0000-0000-000000000002'), 1::bigint, 'expense appears in AP');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_receivables_v where transaction_id = '8c110000-0000-0000-0000-000000000002'), 0::bigint, 'expense does not appear in AR');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_payables_v where transaction_id = '8c110000-0000-0000-0000-000000000003'), 1::bigint, 'fixed asset purchase appears in AP');

insert into pg_temp.tap_results (result)
select is((select count(*) from public.financial_receivables_v where transaction_id = '8c110000-0000-0000-0000-000000000003'), 0::bigint, 'fixed asset purchase does not appear in AR');

insert into pg_temp.tap_results (result)
select ok(
  not exists (select 1 from public.financial_receivables_v where transaction_id = '8c110000-0000-0000-0000-000000000004')
    and not exists (select 1 from public.financial_payables_v where transaction_id = '8c110000-0000-0000-0000-000000000004'),
  'transfer appears in neither AR nor AP'
);

insert into pg_temp.tap_results (result)
select ok(
  not exists (
    select 1
    from public.financial_receivables_v
    where movement_type <> 'RECEITA'
  )
    and not exists (
      select 1
      from public.financial_payables_v
      where movement_type not in ('DESPESA', 'IMOBILIZADO')
    ),
  'all other canonical movement types are excluded'
);

insert into pg_temp.tap_results (result)
select is(
  (
    select count(*)
    from (
      select transaction_id from public.financial_receivables_v
      intersect
      select transaction_id from public.financial_payables_v
    ) overlap
  ),
  0::bigint,
  'AR and AP transaction overlap is zero'
);

insert into pg_temp.tap_results (result)
select is(
  (select open_amount from public.financial_receivables_v where transaction_id = '8c110000-0000-0000-0000-000000000012'),
  0::numeric,
  'cancelled title has no open amount'
);

insert into pg_temp.tap_results (result)
select is(
  (select count(*) from public.financial_cashflow_forecast_v where transaction_id = '8c110000-0000-0000-0000-000000000012'),
  0::bigint,
  'cancelled title is absent from forecast'
);

insert into pg_temp.tap_results (result)
select ok((select count(*) > 0 from public.financial_receivables_v), 'active Admin reads AR');

insert into pg_temp.tap_results (result)
select ok((select count(*) > 0 from public.financial_payables_v), 'active Admin reads AP');

-- Active Equipe has the same read-only visibility.
select set_config('request.jwt.claim.sub', '8c100000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select ok((select count(*) > 0 from public.financial_receivables_v), 'active Equipe reads AR');

insert into pg_temp.tap_results (result)
select ok((select count(*) > 0 from public.financial_payables_v), 'active Equipe reads AP');

-- Inactive and missing profiles keep the grant but RLS returns no rows.
select set_config('request.jwt.claim.sub', '8c100000-0000-0000-0000-000000000003', true);

insert into pg_temp.tap_results (result)
select ok(
  (select count(*) from public.financial_receivables_v) = 0
    and (select count(*) from public.financial_payables_v) = 0,
  'inactive profile reads neither AR nor AP'
);

select set_config('request.jwt.claim.sub', '8c100000-0000-0000-0000-000000000004', true);

insert into pg_temp.tap_results (result)
select ok(
  (select count(*) from public.financial_receivables_v) = 0
    and (select count(*) from public.financial_payables_v) = 0,
  'missing profile reads neither AR nor AP'
);

-- Anonymous access is denied at the view ACL boundary.
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select count(*) from public.financial_receivables_v $$,
  '42501', 'permission denied for view financial_receivables_v',
  'anon cannot read AR'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select count(*) from public.financial_payables_v $$,
  '42501', 'permission denied for view financial_payables_v',
  'anon cannot read AP'
);

set local role postgres;

do $$
declare
  tap text;
begin
  select string_agg(result, E'\n' order by seq) into tap from pg_temp.tap_results;
  raise notice '%', tap;
end $$;

select result as tap_line from pg_temp.tap_results order by seq;

rollback;
