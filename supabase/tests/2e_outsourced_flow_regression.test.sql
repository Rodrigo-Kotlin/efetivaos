-- ============================================================================
-- EFETIVA OS - Fase 2E: regressao do fluxo tradicional de cotacoes
--
-- Objetivo: comprovar que o fluxo terceirizado permanece intacto apos a
-- ampliacao da guarda de quotation_items (Fase 2E):
--   - ciclo de vida draft -> active -> cancelled preservado;
--   - regra de draft (itens somente em rascunho) preservada;
--   - comparacao usa a menor fonte vigente (vencida excluida);
--   - aprovacao automatica, selecao manual e inativacao preservadas.
--
-- Obs.: quotation_items tem FORCE RLS; fora de draft o UPDATE/DELETE de itens
-- e silenciosamente ignorado (0 linhas). A guarda DB so dispara quando a
-- linha e efetivamente alterada (INSERT sempre; UPDATE/DELETE em draft).
-- Fixures compativeis com os grants atuais (2A): itens de catalogo SEM coluna
-- code, transacao com ROLLBACK, IDs prefixo 6AB0.
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
select plan(14);

-- Fixtures
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '6AB00000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'fase2e-trad-admin@test.local', '', now(),
    '{}', '{"full_name":"Fase 2E Trad Admin"}', now(), now()
  );

update public.profiles set role = 'admin'
where id = '6AB00000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '6AB00000-0000-0000-0000-000000000001', true);

insert into public.suppliers (id, name)
values
  ('6AB00000-0000-0000-0000-000000000010', 'Fornecedor Trad A'),
  ('6AB00000-0000-0000-0000-000000000011', 'Fornecedor Trad B');

insert into public.catalog_categories (id, name)
values ('6AB00000-0000-0000-0000-000000000020', 'Categoria Trad');

insert into public.catalog_items (id, name, category_id, unit, sourcing_type)
values
  ('6AB00000-0000-0000-0000-000000000030', 'Item terceirizado trad', '6AB00000-0000-0000-0000-000000000020', 'un', 'outsourced');

insert into public.margin_rules (
  id, scope_type, catalog_item_id, calculation_type, value
)
values ('6AB00000-0000-0000-0000-000000000060', 'global', null, 'percentage', 10.0000);

-- Cotacao 040: vencida; 041: ciclo de vida; 042: draft descartavel; 043: draft vazio; 044: vigente elegivel.
insert into public.quotations (
  id, supplier_id, reference_number, received_at, valid_until
)
values
  ('6AB00000-0000-0000-0000-000000000040', '6AB00000-0000-0000-0000-000000000011', 'TRAD-EXPIRED', current_date - 20, current_date - 10),
  ('6AB00000-0000-0000-0000-000000000041', '6AB00000-0000-0000-0000-000000000010', 'TRAD-LIFECYCLE', current_date - 5, current_date + 15),
  ('6AB00000-0000-0000-0000-000000000042', '6AB00000-0000-0000-0000-000000000011', 'TRAD-DRAFT',   current_date - 1,  current_date + 10),
  ('6AB00000-0000-0000-0000-000000000043', '6AB00000-0000-0000-0000-000000000010', 'TRAD-EMPTY',   current_date - 1,  current_date + 10),
  ('6AB00000-0000-0000-0000-000000000044', '6AB00000-0000-0000-0000-000000000010', 'TRAD-BEST',    current_date - 3,  current_date + 14);

insert into public.quotation_items (
  id, quotation_id, catalog_item_id, supplier_description, unit_price
)
values
  ('6AB00000-0000-0000-0000-000000000050', '6AB00000-0000-0000-0000-000000000040', '6AB00000-0000-0000-0000-000000000030', 'Vencida', 5.00),
  ('6AB00000-0000-0000-0000-000000000051', '6AB00000-0000-0000-0000-000000000041', '6AB00000-0000-0000-0000-000000000030', 'Vida 12',  12.00),
  ('6AB00000-0000-0000-0000-000000000052', '6AB00000-0000-0000-0000-000000000044', '6AB00000-0000-0000-0000-000000000030', 'Vigente', 12.00);

-- Cotacao 044: fonte vigente elegivel deve ser ativada ainda no setup.
update public.quotations set status = 'active'
where id = '6AB00000-0000-0000-0000-000000000044';

-- ===========================================================================
-- 1. CICLO DE VIDA (draft -> active -> cancelled) preservado
-- ===========================================================================
insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations set status = 'cancelled'
      where id = '6AB00000-0000-0000-0000-000000000042' $$,
  'TRAD: cotacao em draft pode ser descartada (draft -> cancelled)'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotations set status = 'active'
      where id = '6AB00000-0000-0000-0000-000000000043' $$,
  'P0001',
  'Adicione ao menos um item antes de ativar a cotacao.',
  'TRAD: ativacao de cotacao sem itens rejeitada'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations set status = 'active'
      where id = '6AB00000-0000-0000-0000-000000000041' $$,
  'TRAD: cotacao draft com item mapeado e valido pode ativar'
);

with upd as (
  update public.quotation_items
  set unit_price = 13.00
  where id = '6AB00000-0000-0000-0000-000000000051'
  returning id
)
insert into pg_temp.tap_results (result)
select ok(
  (select not exists (select 1 from upd)),
  'TRAD: item de cotacao ativa nao pode ser alterado (RLS guarda draft: 0 linhas)'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations set status = 'cancelled'
      where id = '6AB00000-0000-0000-0000-000000000041' $$,
  'TRAD: cotacao ativa pode ser cancelada'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotations set status = 'active'
      where id = '6AB00000-0000-0000-0000-000000000041' $$,
  'P0001',
  'Cotacao cancelada nao pode ser alterada.',
  'TRAD: cotacao cancelada e terminal'
);

-- ===========================================================================
-- 2. COMPARACAO: vencida permanece no historico mas nao participa
-- ===========================================================================
insert into pg_temp.tap_results (result)
select ok(
  (select count(*) = 3
     from public.quotation_items qi
     join public.quotations q on q.id = qi.quotation_id
    where qi.catalog_item_id = '6AB00000-0000-0000-0000-000000000030'),
  'TRAD: historico de cotacoes (vencida + ciclo + vigente) preservado'
);

insert into pg_temp.tap_results (result)
select ok(
  (select best_quotation_item_id = '6AB00000-0000-0000-0000-000000000052'
      and best_cost = 12.00
    from public.pricing_comparison_v
    where catalog_item_id = '6AB00000-0000-0000-0000-000000000030'),
  'TRAD: comparacao usa a menor fonte vigente (vencida excluida)'
);

-- ===========================================================================
-- 3. APROVACAO automatica + selecao manual + inativacao preservadas
-- ===========================================================================
insert into pg_temp.tap_results (result)
select lives_ok(
  $$ select public.approve_price(
       '6AB00000-0000-0000-0000-000000000030',
       public.price_decision_token('6AB00000-0000-0000-0000-000000000030')
     ) $$,
  'TRAD: aprovacao automatica pela melhor fonte preservada'
);

insert into pg_temp.tap_results (result)
select ok(
  (select price_origin = 'quotation'
      and source_quotation_item_id = '6AB00000-0000-0000-0000-000000000052'
      and final_price = 13.20
    from public.price_list
    where catalog_item_id = '6AB00000-0000-0000-0000-000000000030'),
  'TRAD: acrescimo percentual calculado no servidor (12.00 + 10%)'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.approve_price(
       '6AB00000-0000-0000-0000-000000000030',
       public.price_decision_token('6AB00000-0000-0000-0000-000000000030'),
       '6AB00000-0000-0000-0000-000000000050'
     ) $$,
  'P0001',
  'A fonte selecionada nao e elegivel para este item.',
  'TRAD: selecao manual de fonte vencida rejeitada'
);

insert into pg_temp.tap_results (result)
select ok(
  (select price_origin = 'quotation'
      and source_quotation_item_id = '6AB00000-0000-0000-0000-000000000052'
      and final_price = 13.20
    from public.price_list
    where catalog_item_id = '6AB00000-0000-0000-0000-000000000030'),
  'TRAD: preco vigente inalterado apos rejeicao da fonte manual'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ select public.inactivate_price(
       '6AB00000-0000-0000-0000-000000000030',
       public.price_decision_token('6AB00000-0000-0000-0000-000000000030')
     ) $$,
  'TRAD: inativacao comercial preservada'
);

insert into pg_temp.tap_results (result)
select ok(
  (select status = 'inactive' from public.price_list
    where catalog_item_id = '6AB00000-0000-0000-0000-000000000030'),
  'TRAD: preco aposentado permanece no historico como inativo'
);

-- Emit one ordered TAP stream; rollback removes all fixtures.
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