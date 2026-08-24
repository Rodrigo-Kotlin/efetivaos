begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  seq bigint generated always as identity primary key,
  result text not null
) on commit drop;

grant insert, select on pg_temp.tap_results to authenticated, anon;
grant usage, select on sequence pg_temp.tap_results_seq_seq to authenticated, anon;

insert into pg_temp.tap_results (result)
select plan(28);

-- ----------------------------------------------------------------------------
-- Fixtures: 1 admin + 1 equipe user created inside the transaction
-- ----------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sprint04-admin@test.local', '', now(),
    '{}', '{"full_name":"Sprint 04 Admin"}', now(), now()
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sprint04-equipe@test.local', '', now(),
    '{}', '{"full_name":"Sprint 04 Equipe"}', now(), now()
  );

update public.profiles set role = 'admin'  where id = '40000000-0000-0000-0000-000000000001';
update public.profiles set role = 'equipe' where id = '40000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);

-- ----------------------------------------------------------------------------
-- Catalog and suppliers (3 items in 2 categories)
-- ----------------------------------------------------------------------------
insert into public.suppliers (id, name, active)
values
  ('40000000-0000-0000-0000-000000000010', 'Fornecedor A Regras', true),
  ('40000000-0000-0000-0000-000000000011', 'Fornecedor B Regras', true);

insert into public.catalog_categories (id, name)
values
  ('40000000-0000-0000-0000-000000000020', 'Categoria Regras A'),
  ('40000000-0000-0000-0000-000000000021', 'Categoria Regras B');

insert into public.catalog_items (id, code, name, category_id, unit, active)
values
  ('40000000-0000-0000-0000-000000000030', 'S04-ITEM-A', 'Item Categoria A', '40000000-0000-0000-0000-000000000020', 'un', true),
  ('40000000-0000-0000-0000-000000000031', 'S04-ITEM-B', 'Item Categoria B', '40000000-0000-0000-0000-000000000021', 'un', true),
  ('40000000-0000-0000-0000-000000000032', 'S04-ITEM-NORULE', 'Item sem regra', '40000000-0000-0000-0000-000000000020', 'un', true),
  ('40000000-0000-0000-0000-000000000033', 'S04-ITEM-FRACTION', 'Item Fracao', '40000000-0000-0000-0000-000000000021', 'un', true);

-- Cotacoes: cada item tem uma oferta ativa com custo especifico
insert into public.quotations (id, supplier_id, received_at, valid_until, status)
values
  ('40000000-0000-0000-0000-000000000040', '40000000-0000-0000-0000-000000000010', '2026-08-20', '2099-12-31', 'draft'),
  ('40000000-0000-0000-0000-000000000041', '40000000-0000-0000-0000-000000000011', '2026-08-21', '2099-12-31', 'draft'),
  ('40000000-0000-0000-0000-000000000042', '40000000-0000-0000-0000-000000000010', '2026-08-22', '2099-12-31', 'draft'),
  ('40000000-0000-0000-0000-000000000043', '40000000-0000-0000-0000-000000000010', '2026-08-23', '2099-12-31', 'draft');

insert into public.quotation_items (id, quotation_id, catalog_item_id, supplier_description, supplier_item_code, unit_price)
values
  ('40000000-0000-0000-0000-000000000050', '40000000-0000-0000-0000-000000000040', '40000000-0000-0000-0000-000000000030', 'A1', 'A1', 100.00),
  ('40000000-0000-0000-0000-000000000051', '40000000-0000-0000-0000-000000000041', '40000000-0000-0000-0000-000000000031', 'B1', 'B1', 100.00),
  ('40000000-0000-0000-0000-000000000052', '40000000-0000-0000-0000-000000000042', '40000000-0000-0000-0000-000000000032', 'NR1', 'NR1', 100.00),
  -- Cenario 11: custo 6.70 + 30% = 8.71 (item dedicado)
  ('40000000-0000-0000-0000-000000000053', '40000000-0000-0000-0000-000000000043', '40000000-0000-0000-0000-000000000033', 'C1', 'C1', 6.70);

update public.quotations set status = 'active' where id in (
  '40000000-0000-0000-0000-000000000040',
  '40000000-0000-0000-0000-000000000041',
  '40000000-0000-0000-0000-000000000042',
  '40000000-0000-0000-0000-000000000043'
);

-- ============================================================================
-- Sanity da infraestrutura
-- ============================================================================
insert into pg_temp.tap_results (result)
select ok(
  (select count(*) = 0 from public.resolve_margin_rule('40000000-0000-0000-0000-000000000030')),
  'Sem regra: resolve_margin_rule retorna vazio'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pricing_comparison_v' and column_name = 'suggested_price'
  ),
  'pricing_comparison_v expoe coluna suggested_price'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pricing_comparison_v' and column_name = 'resolved_margin_rule_id'
  ),
  'pricing_comparison_v expoe coluna resolved_margin_rule_id'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pricing_comparison_v' and column_name = 'effective_status'
  ),
  'pricing_comparison_v expoe coluna effective_status'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'margin_rules' and indexname = 'uq_margin_rules_global_active'
  ),
  'Indice parcial uq_margin_rules_global_active existe'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'margin_rules' and indexname = 'uq_margin_rules_category_active'
  ),
  'Indice parcial uq_margin_rules_category_active existe'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'margin_rules' and indexname = 'uq_margin_rules_item_active'
  ),
  'Indice parcial uq_margin_rules_item_active existe'
);

-- ============================================================================
-- Cenario 1: somente regra global
-- ============================================================================
insert into public.margin_rules (scope_type, calculation_type, value, active)
values ('global', 'percentage', 20.00, true);

insert into pg_temp.tap_results (result)
select ok(
  (select best_cost = 100.00::numeric and suggested_price = 120.00::numeric
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 1: global 20% em 100 = 120,00'
);

insert into pg_temp.tap_results (result)
select ok(
  (select resolved_rule_scope = 'global' and resolved_adjustment_value = 20.00
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 1: origem da regra = global'
);

-- ============================================================================
-- Cenario 2: global + categoria; categoria vence
-- ============================================================================
insert into public.margin_rules (scope_type, category_id, calculation_type, value, active)
values ('category', '40000000-0000-0000-0000-000000000020', 'percentage', 30.00, true);

insert into pg_temp.tap_results (result)
select ok(
  (select suggested_price = 130.00::numeric and resolved_rule_scope = 'category'
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 2: categoria 30% substitui global 20% em 100 = 130,00'
);

insert into pg_temp.tap_results (result)
select ok(
  (select resolved_adjustment_value = 30.00
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 2: valor da regra = 30,00'
);

-- ============================================================================
-- Cenario 3: global + categoria + item; item vence
-- ============================================================================
insert into public.margin_rules (scope_type, catalog_item_id, calculation_type, value, active)
values ('item', '40000000-0000-0000-0000-000000000030', 'percentage', 35.00, true);

insert into pg_temp.tap_results (result)
select ok(
  (select suggested_price = 135.00::numeric and resolved_rule_scope = 'item'
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 3: item 35% substitui categoria 30% em 100 = 135,00'
);

-- ============================================================================
-- Cenario 4: item inativada -> categoria assume
-- ============================================================================
update public.margin_rules
   set active = false
 where scope_type = 'item' and catalog_item_id = '40000000-0000-0000-0000-000000000030';

insert into pg_temp.tap_results (result)
select ok(
  (select suggested_price = 130.00::numeric and resolved_rule_scope = 'category'
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 4: item inativada -> categoria 30% assume (130,00)'
);

-- ============================================================================
-- Cenario 5: categoria inativada -> global assume
-- ============================================================================
update public.margin_rules
   set active = false
 where scope_type = 'category' and category_id = '40000000-0000-0000-0000-000000000020';

insert into pg_temp.tap_results (result)
select ok(
  (select suggested_price = 120.00::numeric and resolved_rule_scope = 'global'
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 5: categoria inativada -> global 20% assume (120,00)'
);

-- ============================================================================
-- Cenario 6: nenhuma regra -> sem regra
-- ============================================================================
update public.margin_rules set active = false where scope_type = 'global';

insert into pg_temp.tap_results (result)
select ok(
  (select suggested_price is null and resolved_margin_rule_id is null
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 6: nenhuma regra -> suggested_price nulo e resolved_margin_rule_id nulo'
);

-- ============================================================================
-- Cenario 7: regra 0% percentual -> preco = custo
-- ============================================================================
insert into public.margin_rules (scope_type, calculation_type, value, active)
values ('global', 'percentage', 0.00, true);

insert into pg_temp.tap_results (result)
select ok(
  (select suggested_price = 100.00::numeric
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 7: 0% percentual -> preco = custo (100,00)'
);

-- ============================================================================
-- Cenario 8: regra fixa R$ 0,00 -> preco = custo
-- ============================================================================
update public.margin_rules set calculation_type = 'fixed', value = 0.00 where scope_type = 'global' and active = true;

insert into pg_temp.tap_results (result)
select ok(
  (select suggested_price = 100.00::numeric
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 8: R$ 0,00 fixo -> preco = custo (100,00)'
);

-- ============================================================================
-- Cenario 9: percentual 30% em 100 -> 130,00
-- ============================================================================
update public.margin_rules set calculation_type = 'percentage', value = 30.00 where scope_type = 'global' and active = true;

insert into pg_temp.tap_results (result)
select ok(
  (select suggested_price = 130.00::numeric
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 9: 30% percentual em 100 = 130,00'
);

-- ============================================================================
-- Cenario 10: fixo R$ 25 em 100 -> 125,00
-- ============================================================================
update public.margin_rules set calculation_type = 'fixed', value = 25.00 where scope_type = 'global' and active = true;

insert into pg_temp.tap_results (result)
select ok(
  (select suggested_price = 125.00::numeric
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 10: fixo 25 em 100 = 125,00'
);

-- ============================================================================
-- Cenario 11: custo 6,70 + 30% = 8,71 (item 033 dedicado)
-- ============================================================================
update public.margin_rules set active = false where active = true;  -- limpa todas
insert into public.margin_rules (scope_type, catalog_item_id, calculation_type, value, active)
values ('item', '40000000-0000-0000-0000-000000000033', 'percentage', 30.00, true);

insert into pg_temp.tap_results (result)
select ok(
  (select suggested_price = 8.71::numeric
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000033'),
  'Cenario 11: 6,70 + 30% = 8,71 (arredondamento deterministico)'
);

-- ============================================================================
-- Cenario 12: alteracao do menor custo recalcula
-- Criar uma nova cotacao ativa para item 033 com custo 5,00 (menor que 6,70)
-- e verificar que o preco sugerido recalcula.
-- ============================================================================
insert into public.quotations (id, supplier_id, received_at, valid_until, status)
values ('40000000-0000-0000-0000-000000000044', '40000000-0000-0000-0000-000000000011', '2026-08-24', '2099-12-31', 'draft');

insert into public.quotation_items (id, quotation_id, catalog_item_id, supplier_description, supplier_item_code, unit_price)
values ('40000000-0000-0000-0000-000000000054', '40000000-0000-0000-0000-000000000044', '40000000-0000-0000-0000-000000000033', 'C2', 'C2', 5.00);

update public.quotations set status = 'active' where id = '40000000-0000-0000-0000-000000000044';

insert into pg_temp.tap_results (result)
select ok(
  (select best_cost = 5.00::numeric and suggested_price = 6.50::numeric
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000033'),
  'Cenario 12: nova cotacao ativa recalcula o melhor custo (5,00 * 1,30 = 6,50)'
);

-- ============================================================================
-- Cenario 13: regra de item substitui categoria
-- Recriar regra de categoria e verificar que item ainda vence
-- ============================================================================
update public.margin_rules set active = false where active = true;  -- limpa
insert into public.margin_rules (scope_type, category_id, calculation_type, value, active)
values ('category', '40000000-0000-0000-0000-000000000020', 'percentage', 30.00, true);
insert into public.margin_rules (scope_type, catalog_item_id, calculation_type, value, active)
values ('item', '40000000-0000-0000-0000-000000000030', 'percentage', 50.00, true);

insert into pg_temp.tap_results (result)
select ok(
  (select resolved_rule_scope = 'item' and suggested_price = 150.00::numeric
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 13: item 50% sobrepoe categoria 30% (150,00)'
);

-- ============================================================================
-- Cenario 14: conflito de regra ativa e impedido
-- Tentar inserir segunda regra ativa global deve falhar pelo indice parcial
-- ============================================================================
update public.margin_rules set active = false where active = true;  -- limpa
insert into public.margin_rules (scope_type, calculation_type, value, active)
values ('global', 'percentage', 20.00, true);

do $$
begin
  begin
    insert into public.margin_rules (scope_type, calculation_type, value, active)
    values ('global', 'percentage', 30.00, true);
    raise exception 'Conflito: deveria ter sido bloqueado pelo indice parcial';
  exception
    when unique_violation then
      raise notice 'Conflito bloqueado como esperado';
  end;
end $$;

insert into pg_temp.tap_results (result)
select ok(
  (select count(*) = 1 from public.margin_rules where scope_type = 'global' and active = true),
  'Cenario 14: conflito de regra ativa global e bloqueado pelo indice parcial'
);

-- ============================================================================
-- Cenario 15: Equipe nao consegue alterar regra
-- (ja validado por RLS, mas a funcao SECURITY DEFINER resolve_margin_rule
--  deve continuar acessivel)
-- ============================================================================
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);

do $$
declare
  v_count int;
  v_err text;
begin
  begin
    insert into public.margin_rules (scope_type, calculation_type, value, active)
    values ('category', '40000000-0000-0000-0000-000000000020', 'percentage', 50.00, true);
    v_count := 0;
  exception
    when others then
      v_err := sqlerrm;
      v_count := 1;
  end;
  raise notice 'Equipe insert result: count=% err=%', v_count, v_err;
end $$;

insert into pg_temp.tap_results (result)
select ok(
  (select count(*) = 0
   from public.margin_rules
   where scope_type = 'category' and category_id = '40000000-0000-0000-0000-000000000020' and active = true and value = 50.00),
  'Cenario 15: Equipe nao consegue inserir regra (RLS bloqueia)'
);

-- Equipe pode chamar resolve_margin_rule (SECURITY DEFINER com is_internal_user)
insert into pg_temp.tap_results (result)
select ok(
  (select count(*) >= 1
   from public.resolve_margin_rule('40000000-0000-0000-0000-000000000030')),
  'Cenario 15: Equipe ainda pode chamar resolve_margin_rule para o calculo'
);

-- Equipe pode ler a view pricing_comparison_v (security_invoker)
insert into pg_temp.tap_results (result)
select ok(
  (select best_cost is not null and suggested_price is not null
   from public.pricing_comparison_v
   where catalog_item_id = '40000000-0000-0000-0000-000000000030'),
  'Cenario 15: Equipe le pricing_comparison_v com regra resolvida'
);

-- ============================================================================
-- Cenario 16: anon bloqueado
-- ============================================================================
set local role anon;

-- anon nao tem grant SELECT em pricing_comparison_v (ja validado em DEC-027)
-- mas tambem nao tem grant em margin_rules
do $$
declare
  v_can_select bool;
begin
  select has_table_privilege('anon', 'public.margin_rules', 'SELECT') into v_can_select;
  raise notice 'anon margin_rules select: %', v_can_select;
end $$;

insert into pg_temp.tap_results (result)
select ok(
  not has_table_privilege('anon', 'public.margin_rules', 'SELECT'),
  'Cenario 16: anon nao possui SELECT em margin_rules'
);

insert into pg_temp.tap_results (result)
select ok(
  not has_table_privilege('anon', 'public.pricing_comparison_v', 'SELECT'),
  'Cenario 16: anon nao possui SELECT em pricing_comparison_v'
);

-- ============================================================================
-- Emite TAP consolidado
-- ============================================================================
do $$
declare
  tap text;
begin
  select string_agg(result, E'\n' order by seq) into tap from pg_temp.tap_results;
  raise notice '%', tap;
end $$;

select result as tap_line from pg_temp.tap_results order by seq;

rollback;
