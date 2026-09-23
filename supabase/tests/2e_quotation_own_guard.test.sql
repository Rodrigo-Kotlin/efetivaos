-- ============================================================================
-- EFETIVA OS - Fase 2E: testes de integridade entre servicos proprios e cotacoes
--
-- Cobertura obrigatoria:
--   1) cotacao de item terceirizado permitida;
--   2) cotacao de item proprio rejeitada;
--   3) atualizacao de quotation_item para item proprio rejeitada;
--   4) alteracao incompativel de origem rejeitada (nos dois sentidos);
--   5) historico existente preservado;
--   6) aprovacao de preco proprio preservada (inclui reajuste);
--   7) aprovacao de preco terceirizado preservada;
--   8) usuario sem autorizacao continua bloqueado.
--
-- Transacao com ROLLBACK ao final; fixtures isoladas com IDs fixos
-- (prefixo 60000000-...), zero impacto nos dados operacionais do DEV.
-- ============================================================================

begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  seq bigint generated always as identity primary key,
  result text not null
) on commit drop;

grant insert, select on pg_temp.tap_results to authenticated, anon;
grant usage, select on sequence pg_temp.tap_results_seq_seq to authenticated, anon;

insert into pg_temp.tap_results (result)
select plan(21);

-- ---------------------------------------------------------------------------
-- Fixtures (transacao local, IDs fixos sem precedentes em DEV)
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '60000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'fase2e-admin@test.local', '', now(),
    '{}', '{"full_name":"Fase 2E Admin"}', now(), now()
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'fase2e-equipe@test.local', '', now(),
    '{}', '{"full_name":"Fase 2E Equipe"}', now(), now()
  );

update public.profiles set role = 'admin'
where id = '60000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);

insert into public.suppliers (id, name)
values ('60000000-0000-0000-0000-000000000010', 'Fornecedor Fase 2E');

insert into public.catalog_categories (id, name)
values ('60000000-0000-0000-0000-000000000020', 'Categoria Fase 2E');

insert into public.catalog_items (id, name, category_id, unit, sourcing_type)
values
  ('60000000-0000-0000-0000-000000000030', 'Servico terceirizado 2E', '60000000-0000-0000-0000-000000000020', 'un', 'outsourced'),
  ('60000000-0000-0000-0000-000000000031', 'Servico proprio 2E',      '60000000-0000-0000-0000-000000000020', 'un', 'own'),
  ('60000000-0000-0000-0000-000000000032', 'Servico proprio 2E (sem historico)', '60000000-0000-0000-0000-000000000020', 'un', 'own');

insert into public.margin_rules (
  id, scope_type, catalog_item_id, calculation_type, value
)
values ('60000000-0000-0000-0000-000000000060', 'global', null, 'percentage', 12.5000);

insert into public.quotations (
  id, supplier_id, reference_number, received_at, valid_until
)
values
  ('60000000-0000-0000-0000-000000000040', '60000000-0000-0000-0000-000000000010', '2E-EXT', current_date - 5, current_date + 30),
  ('60000000-0000-0000-0000-000000000041', '60000000-0000-0000-0000-000000000010', '2E-OWN', current_date - 5, current_date + 30);

-- ===========================================================================
-- A. ESTRUTURA: funcao e triggers presentes e ativos
-- ===========================================================================
insert into pg_temp.tap_results (result)
select ok(
  to_regprocedure('public.enforce_quotation_item_draft_only()') is not null,
  '2E: funcao de guarda de quotation_items existe'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (select 1 from pg_trigger
           where tgname = 'trg_quotation_items_draft_only'
             and tgrelid = 'public.quotation_items'::regclass
             and tgenabled = 'O'),
  '2E: trigger trg_quotation_items_draft_only ativo em quotation_items'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (select 1 from pg_trigger
           where tgname = 'trg_catalog_items_sourcing_history_guard'
             and tgrelid = 'public.catalog_items'::regclass
             and tgenabled = 'O'),
  '2E: trigger de historico de origem ativo em catalog_items'
);

-- ===========================================================================
-- B. ITEM TERCEIRIZADO PODE RECEBER COTACAO
-- ===========================================================================
insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into public.quotation_items (
       id, quotation_id, catalog_item_id, supplier_description, unit_price
     ) values (
       '60000000-0000-0000-0000-000000000050', '60000000-0000-0000-0000-000000000040',
       '60000000-0000-0000-0000-000000000030', 'Oferta terceirizado 2E', 10.01
     ) $$,
  '2E: cotacao de item outsourced permitida'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (select 1 from public.quotation_items
           where id = '60000000-0000-0000-0000-000000000050'
             and catalog_item_id = '60000000-0000-0000-0000-000000000030'),
  '2E: item outsourced vinculado a cotacao com sucesso'
);

-- ===========================================================================
-- C. ITEM PROPRIO REJEITADO EM COTACAO (INSERT E UPDATE, independente da UI)
-- ===========================================================================
insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotation_items (
       id, quotation_id, catalog_item_id, supplier_description, unit_price
     ) values (
       '60000000-0000-0000-0000-000000000051', '60000000-0000-0000-0000-000000000041',
       '60000000-0000-0000-0000-000000000031', 'Item proprio em cotacao', 99.00
     ) $$,
  'P0001',
  'Servicos proprios da Efetiva nao podem ser incluidos em cotacoes de fornecedores.',
  '2E: cotacao de item proprio (own) rejeitada'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotation_items
        set catalog_item_id = '60000000-0000-0000-0000-000000000031'
      where id = '60000000-0000-0000-0000-000000000050' $$,
  'P0001',
  'Servicos proprios da Efetiva nao podem ser incluidos em cotacoes de fornecedores.',
  '2E: update de quotation_item para item proprio rejeitado'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (select 1 from public.quotation_items
           where id = '60000000-0000-0000-0000-000000000050'
             and catalog_item_id = '60000000-0000-0000-0000-000000000030'),
  '2E: linha original de cotacao preservada apos rejeicao'
);

-- ===========================================================================
-- D. ALTERACAO INCOMPATIVEL DE ORIGEM REJEITADA (nos dois sentidos)
-- ===========================================================================
insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.catalog_items
        set sourcing_type = 'outsourced'
      where id = '60000000-0000-0000-0000-000000000032' $$,
  '2E: own -> outsourced permitido quando nao ha historico'
);

-- Cria historico para o item propio 031 (proposta pendente) antes de tentar trocar.
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000002', true);

insert into public.own_price_proposals (
  id, catalog_item_id, sale_price, internal_cost
)
values (
  '60000000-0000-0000-0000-0000000000A0', '60000000-0000-0000-0000-000000000031', 55.00, 20.00
);

select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.catalog_items
        set sourcing_type = 'outsourced'
      where id = '60000000-0000-0000-0000-000000000031' $$,
  'P0001',
  'A origem do item nao pode mudar depois que o item participa de cotacao, proposta de preco proprio ou precificacao vigente.',
  '2E: own -> outsourced com proposta pendente rejeitada'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.catalog_items
        set sourcing_type = 'own'
      where id = '60000000-0000-0000-0000-000000000030' $$,
  'P0001',
  'A origem do item nao pode mudar depois que o item participa de cotacao, proposta de preco proprio ou precificacao vigente.',
  '2E: outsourced -> own com cotacao existente rejeitada'
);

insert into pg_temp.tap_results (result)
select ok(
  (select sourcing_type = 'outsourced' from public.catalog_items where id = '60000000-0000-0000-0000-000000000030')
    and (select sourcing_type = 'own' from public.catalog_items where id = '60000000-0000-0000-0000-000000000031')
    and (select sourcing_type = 'outsourced' from public.catalog_items where id = '60000000-0000-0000-0000-000000000032'),
  '2E: origens preservadas apos rejeicoes'
);

-- ===========================================================================
-- E. FLUXO PROPRIO PRESERVADO (aprovacao + reajuste)
-- ===========================================================================
insert into pg_temp.tap_results (result)
select lives_ok(
  $$ select public.approve_own_price_proposal(
       '60000000-0000-0000-0000-0000000000A0',
       (select public.own_price_decision_token('60000000-0000-0000-0000-0000000000A0'))
     ) $$,
  '2E: aprovação de preco proprio preservada'
);

insert into pg_temp.tap_results (result)
select ok(
  (select price_origin = 'own'
      and status = 'approved'
      and final_price = 55.00
      and own_price_proposal_id = '60000000-0000-0000-0000-0000000000A0'
    from public.price_list
    where catalog_item_id = '60000000-0000-0000-0000-000000000031'),
  '2E: preco proprio aprovado publicado em price_list'
);

-- Reajuste: equipe cria nova proposta pendente para o mesmo item.
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into public.own_price_proposals (
       id, catalog_item_id, sale_price, internal_cost
     ) values (
       '60000000-0000-0000-0000-0000000000D0', '60000000-0000-0000-0000-000000000031', 60.00, 25.00
     ) $$,
  '2E: reajuste (nova proposta pendente) preservado'
);

-- ===========================================================================
-- F. USUARIO SEM AUTORIZACAO CONTINUA BLOQUEADO
-- ===========================================================================
insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.approve_own_price_proposal(
       '60000000-0000-0000-0000-0000000000D0',
       (select public.own_price_decision_token('60000000-0000-0000-0000-0000000000D0'))
     ) $$,
  'P0001',
  'Apenas Admin pode aprovar ou inativar proposta de preco proprio.',
  '2E: Equipe nao pode aprovar proposta (regra no banco, nao so na UI)'
);

-- Anon bloqueado: nem proposta propria nem quotation_item.
set local role anon;

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.own_price_proposals (
       id, catalog_item_id, sale_price, internal_cost
     ) values (
       '60000000-0000-0000-0000-0000000000E0', '60000000-0000-0000-0000-000000000031', 40.00, 10.00
     ) $$,
  '42501',
  NULL,
  '2E: anon bloqueado no insert de proposta propria'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.catalog_items
        set sourcing_type = 'outsourced'
      where id = '60000000-0000-0000-0000-000000000031' $$,
  '42501',
  NULL,
  '2E: anon bloqueado na alteracao de origem'
);

-- ===========================================================================
-- G. FLUXO TERCEIRIZADO PRESERVADO (aprovacao comercial + tabela)
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations set status = 'active'
      where id = '60000000-0000-0000-0000-000000000040' $$,
  '2E: ativacao de cotacao de item outsourced preservada'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ select public.approve_price(
       '60000000-0000-0000-0000-000000000030',
       public.price_decision_token('60000000-0000-0000-0000-000000000030')
     ) $$,
  '2E: aprovacao comercial de item outsourced preservada'
);

insert into pg_temp.tap_results (result)
select ok(
  (select price_origin = 'quotation'
      and status = 'approved'
      and source_quotation_item_id = '60000000-0000-0000-0000-000000000050'
      and cost_price = 10.01
      and final_price = 11.26
    from public.price_list
    where catalog_item_id = '60000000-0000-0000-0000-000000000030'),
  '2E: preco terceirizado aprovado publicado na tabela comercial'
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