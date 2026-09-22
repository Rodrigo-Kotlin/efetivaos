begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  seq bigint generated always as identity primary key,
  result text not null
) on commit drop;

grant insert, select on pg_temp.tap_results to authenticated, anon;
grant usage, select on sequence pg_temp.tap_results_seq_seq to authenticated, anon;

insert into pg_temp.tap_results (result)
select plan(31);

-- Fixtures are transaction-local and use fixed IDs to keep failures readable.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'fase2b-admin@test.local', '', now(),
    '{}', '{"full_name":"Fase 2B Admin"}', now(), now()
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'fase2b-equipe@test.local', '', now(),
    '{}', '{"full_name":"Fase 2B Equipe"}', now(), now()
  );

update public.profiles set role = 'admin'
where id = '50000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

insert into public.catalog_categories (id, name)
values ('50000000-0000-0000-0000-000000000020', 'Categoria Fase 2B');

insert into public.catalog_items (id, name, category_id, unit, sourcing_type)
values
  ('50000000-0000-0000-0000-000000000030', 'Servico proprio A', '50000000-0000-0000-0000-000000000020', 'un', 'own'),
  ('50000000-0000-0000-0000-000000000031', 'Servico proprio B', '50000000-0000-0000-0000-000000000020', 'un', 'own'),
  ('50000000-0000-0000-0000-000000000032', 'Servico proprio C', '50000000-0000-0000-0000-000000000020', 'un', 'own');

-- Propostas pendentes submetidas pela Equipe.
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);

insert into public.own_price_proposals (
  id, catalog_item_id, sale_price, internal_cost
)
values
  ('50000000-0000-0000-0000-0000000000A0', '50000000-0000-0000-0000-000000000030', 55.00, 20.00),
  ('50000000-0000-0000-0000-0000000000B0', '50000000-0000-0000-0000-000000000031', 90.00, 45.00),
  ('50000000-0000-0000-0000-0000000000C0', '50000000-0000-0000-0000-000000000032', 70.00, 30.00);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

-- ===========================================================================
-- A. ESTRUTURA E GRANTS
-- ===========================================================================
insert into pg_temp.tap_results (result)
select ok(
  to_regprocedure('public.approve_own_price_proposal(uuid,text)') is not null,
  '2B: RPC approve_own_price_proposal existe'
);

insert into pg_temp.tap_results (result)
select ok(
  to_regprocedure('public.inactivate_own_price_proposal(uuid,text,text)') is not null,
  '2B: RPC inactivate_own_price_proposal existe'
);

insert into pg_temp.tap_results (result)
select ok(
  to_regprocedure('public.own_price_decision_token(uuid)') is not null,
  '2B: token de decisao de preco proprio existe'
);

insert into pg_temp.tap_results (result)
select ok(
  has_function_privilege('authenticated', 'public.approve_own_price_proposal(uuid,text)', 'EXECUTE'),
  '2B: authenticated pode executar a aprovacao'
);

insert into pg_temp.tap_results (result)
select ok(
  has_function_privilege('authenticated', 'public.inactivate_own_price_proposal(uuid,text,text)', 'EXECUTE'),
  '2B: authenticated pode executar a inativacao'
);

insert into pg_temp.tap_results (result)
select ok(
  has_function_privilege('authenticated', 'public.own_price_decision_token(uuid)', 'EXECUTE'),
  '2B: authenticated pode computar o token'
);

insert into pg_temp.tap_results (result)
select ok(
  not has_function_privilege('anon', 'public.approve_own_price_proposal(uuid,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.inactivate_own_price_proposal(uuid,text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.own_price_decision_token(uuid)', 'EXECUTE'),
  '2B: anon nao executa nenhuma RPC de decisao'
);

insert into pg_temp.tap_results (result)
select ok(
  (select public.own_price_decision_token('50000000-0000-0000-0000-0000000000A0') is not null)
    and (select public.own_price_decision_token('00000000-0000-0000-0000-000000000000') is null),
  '2B: token existe para proposta real e e nulo para proposta inexistente'
);

-- ===========================================================================
-- B. APROVACAO POR ADMIN
-- ===========================================================================
insert into pg_temp.tap_results (result)
select lives_ok(
  $$ select public.approve_own_price_proposal(
       '50000000-0000-0000-0000-0000000000A0',
       (select public.own_price_decision_token('50000000-0000-0000-0000-0000000000A0'))
     ) $$,
  '2B: Admin aprova proposta pendente pela RPC'
);

insert into pg_temp.tap_results (result)
select ok(
  (select status = 'approved'
      and approved_by = '50000000-0000-0000-0000-000000000001'
      and approved_at is not null
      and revision = 1
    from public.own_price_proposals
    where id = '50000000-0000-0000-0000-0000000000A0'),
  '2B: aprovacao registra status, aprovador, data e preserva a revisao'
);

insert into pg_temp.tap_results (result)
select ok(
  (select price_origin = 'own'
      and own_price_proposal_id = '50000000-0000-0000-0000-0000000000A0'
      and final_price = 55.00
      and status = 'approved'
      and cost_price is null
      and source_quotation_item_id is null
    from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'),
  '2B: aprovacao cria preco vigente com origem own referenciando a proposta'
);

insert into pg_temp.tap_results (result)
select ok(
  (select effective_status = 'approved'
      and persisted_status = 'approved'
      and price_origin = 'own'
    from public.pricing_comparison_v
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'),
  '2B: comparacao de precos apresenta preco proprio aprovado como vigente'
);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.own_price_proposals
     set sale_price = 30.00
     where id = '50000000-0000-0000-0000-0000000000A0' $$,
  'P0001',
  'Proposta decidida e imutavel; reajuste exige nova proposta.',
  '2B: preco de proposta aprovada e imutavel'
);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.approve_own_price_proposal(
       '50000000-0000-0000-0000-0000000000A0',
       (select public.own_price_decision_token('50000000-0000-0000-0000-0000000000A0'))
     ) $$,
  'P0001',
  'Somente propostas pendentes podem ser aprovadas.',
  '2B: aprovar proposta ja decidida e rejeitado'
);

insert into pg_temp.tap_results (result)
select ok(
  current_setting('efetiva_os.own_price_approval') <> 'on',
  '2B: RPC restaura a GUC de aprovacao apos decidir'
);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.approve_own_price_proposal(
       '50000000-0000-0000-0000-0000000000B0',
       (select public.own_price_decision_token('50000000-0000-0000-0000-0000000000B0'))
     ) $$,
  'P0001',
  'Apenas Admin pode aprovar ou inativar proposta de preco proprio.',
  '2B: Equipe nao pode aprovar proposta (regra no banco, nao so na UI)'
);

-- ===========================================================================
-- C. TELA OBSOLETA (token desatualizado) + CAS
-- ===========================================================================
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select set_config('test.pw_old_token', (select public.own_price_decision_token('50000000-0000-0000-0000-0000000000B0')), true);

-- Enquanto o Admin visualizava, a Equipe reajustou a proposta pendente.
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
update public.own_price_proposals
set sale_price = 95.00
where id = '50000000-0000-0000-0000-0000000000B0';

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.approve_own_price_proposal(
       '50000000-0000-0000-0000-0000000000B0',
       current_setting('test.pw_old_token')
     ) $$,
  'P0001',
  'Decisao de preco proprio desatualizada: a proposta mudou. Recarregue antes de continuar.',
  '2B: token obsoleto bloqueia aprovacao de proposta reajustada'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ select public.approve_own_price_proposal(
       '50000000-0000-0000-0000-0000000000B0',
       (select public.own_price_decision_token('50000000-0000-0000-0000-0000000000B0'))
     ) $$,
  '2B: token atual aprovou a proposta reajustada'
);

insert into pg_temp.tap_results (result)
select ok(
  (select final_price = 95.00
      and own_price_proposal_id = '50000000-0000-0000-0000-0000000000B0'
      and price_origin = 'own'
    from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000031'),
  '2B: preco vigente reflete o valor reajustado aprovado'
);

-- ===========================================================================
-- D. REJEICAO (inativar proposta pendente)
-- ===========================================================================
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ select public.inactivate_own_price_proposal(
       '50000000-0000-0000-0000-0000000000C0',
       (select public.own_price_decision_token('50000000-0000-0000-0000-0000000000C0')),
       'Preco acima do cenario'
     ) $$,
  '2B: Admin rejeita proposta pendente pela RPC'
);

insert into pg_temp.tap_results (result)
select ok(
  (select status = 'inactive'
      and approved_by = '50000000-0000-0000-0000-000000000001'
      and approved_at is not null
      and decision_notes = 'Preco acima do cenario'
    from public.own_price_proposals
    where id = '50000000-0000-0000-0000-0000000000C0'),
  '2B: rejeicao registra aprovador, data e observacao'
);

insert into pg_temp.tap_results (result)
select ok(
  not exists (
    select 1 from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000032'
  ),
  '2B: proposta rejeitada nao gera preco vigente'
);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into public.own_price_proposals (id, catalog_item_id, sale_price, internal_cost)
     values ('50000000-0000-0000-0000-0000000000E0', '50000000-0000-0000-0000-000000000032', 75.00, 35.00) $$,
  '2B: rejeicao libera nova proposta pendente para o mesmo item'
);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.inactivate_own_price_proposal(
       '50000000-0000-0000-0000-0000000000C0',
       null
     ) $$,
  'P0001',
  'Somente propostas pendentes ou aprovadas podem ser inativadas.',
  '2B: inativar proposta ja inativa e rejeitado'
);

-- ===========================================================================
-- E. APOSENTADORIA DO PRECO VIGENTE (inativar proposta aprovada)
-- ===========================================================================
insert into pg_temp.tap_results (result)
select lives_ok(
  $$ select public.inactivate_own_price_proposal(
       '50000000-0000-0000-0000-0000000000A0',
       (select public.own_price_decision_token('50000000-0000-0000-0000-0000000000A0'))
     ) $$,
  '2B: Admin aposenta preco proprio aprovado pela RPC'
);

insert into pg_temp.tap_results (result)
select ok(
  (select status = 'inactive'
      and approved_by = '50000000-0000-0000-0000-000000000001'
      and approved_at is not null
    from public.own_price_proposals
    where id = '50000000-0000-0000-0000-0000000000A0')
    and (select status = 'inactive'
           and own_price_proposal_id = '50000000-0000-0000-0000-0000000000A0'
         from public.price_list
         where catalog_item_id = '50000000-0000-0000-0000-000000000030'),
  '2B: aposentadoria inativa a proposta e o preco vigente correspondente'
);

insert into pg_temp.tap_results (result)
select ok(
  (select effective_status = 'inactive'
    from public.pricing_comparison_v
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'),
  '2B: comparacao apresenta preco proprio aposentado como inativo'
);

-- ===========================================================================
-- F. REAJUSTE (proposta nova aprovada substitui o preco vigente)
-- ===========================================================================
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into public.own_price_proposals (id, catalog_item_id, sale_price, internal_cost)
     values ('50000000-0000-0000-0000-0000000000D0', '50000000-0000-0000-0000-000000000030', 60.00, 25.00) $$,
  '2B: proposta aposentada libera reajuste com nova proposta para o item'
);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ select public.approve_own_price_proposal(
       '50000000-0000-0000-0000-0000000000D0',
       (select public.own_price_decision_token('50000000-0000-0000-0000-0000000000D0'))
     ) $$,
  '2B: Admin aprova o reajuste como nova proposta'
);

insert into pg_temp.tap_results (result)
select ok(
  (select price_origin = 'own'
      and own_price_proposal_id = '50000000-0000-0000-0000-0000000000D0'
      and final_price = 60.00
      and status = 'approved'
    from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000030')
    and (select status = 'inactive'
         from public.own_price_proposals
         where id = '50000000-0000-0000-0000-0000000000A0'),
  '2B: reajuste aprovado substitui o preco vigente sem alterar a proposta antiga'
);

insert into pg_temp.tap_results (result)
select ok(
  (select effective_status = 'approved'
    from public.pricing_comparison_v
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'),
  '2B: reajustado, o preco proprio volta a constar como aprovado'
);

-- Emit one ordered TAP stream; rollback removes fixtures, extension and temp data.
do $$
declare
  tap text;
begin
  select string_agg(result, E'\n' order by seq)
  into tap
  from pg_temp.tap_results;

  raise notice '%', tap;
end $$;

select result as tap_line from pg_temp.tap_results order by seq;

rollback;