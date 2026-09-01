begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into public.catalog_categories (id, name)
values ('19000000-0000-0000-0000-000000000001', 'Categoria de Teste');

select has_sequence('public', 'catalog_item_code_seq', 'Sequence de codigo do catalogo existe');

select lives_ok(
  $$ insert into public.catalog_items (id, name, category_id, unit)
     values ('19000000-0000-0000-0000-000000000010', 'Item automatico 1', '19000000-0000-0000-0000-000000000001', 'unidade') $$,
  'Insert sem code usa o default do banco'
);

select matches(
  (select code from public.catalog_items where id = '19000000-0000-0000-0000-000000000010'),
  '^ITEM-[0-9]{6}$',
  'Codigo automatico segue ITEM-000001'
);

insert into public.catalog_items (id, name, category_id, unit)
values ('19000000-0000-0000-0000-000000000011', 'Item automatico 2', '19000000-0000-0000-0000-000000000001', 'unidade');

select is(
  substring((select code from public.catalog_items where id = '19000000-0000-0000-0000-000000000011') from 6)::bigint,
  substring((select code from public.catalog_items where id = '19000000-0000-0000-0000-000000000010') from 6)::bigint + 1,
  'Codigos incrementam pela sequence'
);

select throws_ok(
  $$ insert into public.catalog_items (code, name, category_id, unit)
     select code, 'Codigo duplicado', '19000000-0000-0000-0000-000000000001', 'unidade'
     from public.catalog_items where id = '19000000-0000-0000-0000-000000000010' $$,
  '23505',
  'duplicate key value violates unique constraint "uq_catalog_items_code_ci"',
  'Codigo permanece unico'
);

select throws_ok(
  $$ insert into public.catalog_items (code, name, category_id, unit)
     values (null, 'Codigo nulo', '19000000-0000-0000-0000-000000000001', 'unidade') $$,
  '23502',
  'null value in column "code" of relation "catalog_items" violates not-null constraint',
  'Codigo permanece NOT NULL'
);

select throws_ok(
  $$ update public.catalog_items set code = 'ITEM-999999'
     where id = '19000000-0000-0000-0000-000000000010' $$,
  'P0001',
  'O codigo do item do catalogo nao pode ser alterado.',
  'Codigo e imutavel'
);

insert into public.catalog_items (name, category_id, unit)
select 'Item em lote ' || value, '19000000-0000-0000-0000-000000000001', 'unidade'
from generate_series(1, 50) value;

select is(
  (select count(distinct code) from public.catalog_items where name like 'Item em lote %'),
  50::bigint,
  'Insert em lote nao duplica codigos'
);

insert into public.catalog_items (id, name, category_id, unit)
values ('19000000-0000-0000-0000-000000000012', 'Item removido', '19000000-0000-0000-0000-000000000001', 'unidade');

create temporary table deleted_catalog_code as
select code from public.catalog_items where id = '19000000-0000-0000-0000-000000000012';

delete from public.catalog_items where id = '19000000-0000-0000-0000-000000000012';

insert into public.catalog_items (id, name, category_id, unit)
values ('19000000-0000-0000-0000-000000000013', 'Item posterior', '19000000-0000-0000-0000-000000000001', 'unidade');

select ok(
  substring((select code from public.catalog_items where id = '19000000-0000-0000-0000-000000000013') from 6)::bigint
    > substring((select code from deleted_catalog_code) from 6)::bigint,
  'Exclusao nao reutiliza codigo em operacao normal'
);

select throws_ok(
  $$ insert into public.catalog_categories (name) values ('  categoria de teste  ') $$,
  '23505',
  'duplicate key value violates unique constraint "uq_catalog_categories_name_ci"',
  'Categoria e unica com trim e sem diferenciar caixa'
);

select is(
  (select column_default::text from information_schema.columns where table_schema = 'public' and table_name = 'catalog_items' and column_name = 'code'),
  'generate_catalog_item_code()'::text,
  'Coluna code usa a funcao geradora como default'
);

select * from finish();

rollback;
