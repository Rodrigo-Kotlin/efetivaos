begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sprint01-admin@test.local', '', now(),
    '{}', '{"full_name":"Sprint 01 Admin"}', now(), now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sprint01-equipe@test.local', '', now(),
    '{}', '{"full_name":"Sprint 01 Equipe"}', now(), now()
  );

update public.profiles
set role = 'admin'
where id = '10000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ insert into public.suppliers (id, name, legal_name, tax_id, category, contact_name, email, phone, notes)
     values ('10000000-0000-0000-0000-000000000010', 'Fornecedor Admin', 'Fornecedor Admin Ltda.', '00.000.000/0001-00', 'Laboratorio', 'Contato Admin', 'admin@fornecedor.test', '11999990000', 'Fixture transacional') $$,
  'Admin insere fornecedor'
);

select lives_ok(
  $$ insert into public.catalog_categories (id, name)
     values ('10000000-0000-0000-0000-000000000020', 'Categoria Admin') $$,
  'Admin insere categoria'
);

select lives_ok(
  $$ insert into public.catalog_items (id, code, name, category_id, unit, description)
     values ('10000000-0000-0000-0000-000000000030', 'ADM-001', 'Item Admin', '10000000-0000-0000-0000-000000000020', 'servico', 'Fixture transacional') $$,
  'Admin insere item do catalogo'
);

select is(
  (select name from public.suppliers where id = '10000000-0000-0000-0000-000000000010'),
  'Fornecedor Admin',
  'Admin le fornecedor'
);

select lives_ok(
  $$ update public.suppliers set name = 'Fornecedor Admin Atualizado' where id = '10000000-0000-0000-0000-000000000010' $$,
  'Admin atualiza fornecedor'
);

select lives_ok(
  $$ update public.catalog_categories set name = 'Categoria Admin Atualizada' where id = '10000000-0000-0000-0000-000000000020' $$,
  'Admin atualiza categoria'
);

select lives_ok(
  $$ update public.catalog_items set name = 'Item Admin Atualizado' where id = '10000000-0000-0000-0000-000000000030' $$,
  'Admin atualiza item'
);

select lives_ok(
  $$ update public.suppliers set active = false where id = '10000000-0000-0000-0000-000000000010';
     update public.catalog_categories set active = false where id = '10000000-0000-0000-0000-000000000020';
     update public.catalog_items set active = false where id = '10000000-0000-0000-0000-000000000030' $$,
  'Admin inativa os tres cadastros'
);

select ok(
  not (select active from public.suppliers where id = '10000000-0000-0000-0000-000000000010')
  and not (select active from public.catalog_categories where id = '10000000-0000-0000-0000-000000000020')
  and not (select active from public.catalog_items where id = '10000000-0000-0000-0000-000000000030'),
  'Admin consulta status inativo persistido'
);

select lives_ok(
  $$ update public.suppliers set active = true where id = '10000000-0000-0000-0000-000000000010';
     update public.catalog_categories set active = true where id = '10000000-0000-0000-0000-000000000020';
     update public.catalog_items set active = true where id = '10000000-0000-0000-0000-000000000030' $$,
  'Admin reativa os tres cadastros'
);

select ok(
  (select active from public.suppliers where id = '10000000-0000-0000-0000-000000000010')
  and (select active from public.catalog_categories where id = '10000000-0000-0000-0000-000000000020')
  and (select active from public.catalog_items where id = '10000000-0000-0000-0000-000000000030'),
  'Admin consulta status reativado persistido'
);

select is(
  (select created_by from public.suppliers where id = '10000000-0000-0000-0000-000000000010'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Auditoria registra o Admin criador'
);

select throws_ok(
  $$ delete from public.suppliers where id = '10000000-0000-0000-0000-000000000010' $$,
  '42501', 'permission denied for table suppliers',
  'Admin nao possui hard delete em fornecedores'
);

select throws_ok(
  $$ delete from public.catalog_categories where id = '10000000-0000-0000-0000-000000000020' $$,
  '42501', 'permission denied for table catalog_categories',
  'Admin nao possui hard delete em categorias'
);

select throws_ok(
  $$ delete from public.catalog_items where id = '10000000-0000-0000-0000-000000000030' $$,
  '42501', 'permission denied for table catalog_items',
  'Admin nao possui hard delete em itens'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$ insert into public.suppliers (id, name)
     values ('10000000-0000-0000-0000-000000000011', 'Fornecedor Equipe') $$,
  'Equipe insere fornecedor'
);

select lives_ok(
  $$ insert into public.catalog_categories (id, name)
     values ('10000000-0000-0000-0000-000000000021', 'Categoria Equipe') $$,
  'Equipe insere categoria'
);

select lives_ok(
  $$ insert into public.catalog_items (id, code, name, category_id, unit)
     values ('10000000-0000-0000-0000-000000000031', 'EQP-001', 'Item Equipe', '10000000-0000-0000-0000-000000000021', 'unidade') $$,
  'Equipe insere item do catalogo'
);

select is(
  (select count(*) from public.catalog_items where id in ('10000000-0000-0000-0000-000000000030', '10000000-0000-0000-0000-000000000031')),
  2::bigint,
  'Equipe le itens cadastrados'
);

select lives_ok(
  $$ update public.suppliers set name = 'Fornecedor Equipe Atualizado' where id = '10000000-0000-0000-0000-000000000011';
     update public.catalog_categories set name = 'Categoria Equipe Atualizada' where id = '10000000-0000-0000-0000-000000000021';
     update public.catalog_items set name = 'Item Equipe Atualizado' where id = '10000000-0000-0000-0000-000000000031' $$,
  'Equipe atualiza os tres cadastros'
);

select lives_ok(
  $$ update public.suppliers set active = false where id = '10000000-0000-0000-0000-000000000011';
     update public.catalog_categories set active = false where id = '10000000-0000-0000-0000-000000000021';
     update public.catalog_items set active = false where id = '10000000-0000-0000-0000-000000000031' $$,
  'Equipe inativa os tres cadastros'
);

select lives_ok(
  $$ update public.suppliers set active = true where id = '10000000-0000-0000-0000-000000000011';
     update public.catalog_categories set active = true where id = '10000000-0000-0000-0000-000000000021';
     update public.catalog_items set active = true where id = '10000000-0000-0000-0000-000000000031' $$,
  'Equipe reativa os tres cadastros'
);

select is(
  concat_ws(' | ',
    (select name from public.suppliers where id = '10000000-0000-0000-0000-000000000011'),
    (select name from public.catalog_categories where id = '10000000-0000-0000-0000-000000000021'),
    (select name from public.catalog_items where id = '10000000-0000-0000-0000-000000000031')
  ),
  'Fornecedor Equipe Atualizado | Categoria Equipe Atualizada | Item Equipe Atualizado',
  'Updates da Equipe afetaram as tres linhas'
);

select ok(
  (select active from public.suppliers where id = '10000000-0000-0000-0000-000000000011')
  and (select active from public.catalog_categories where id = '10000000-0000-0000-0000-000000000021')
  and (select active from public.catalog_items where id = '10000000-0000-0000-0000-000000000031'),
  'Reativacao da Equipe persistiu nas tres linhas'
);

select is(
  (select updated_by from public.catalog_items where id = '10000000-0000-0000-0000-000000000031'),
  '10000000-0000-0000-0000-000000000002'::uuid,
  'Auditoria registra a Equipe que atualizou'
);

select throws_ok(
  $$ delete from public.suppliers where id = '10000000-0000-0000-0000-000000000011' $$,
  '42501', 'permission denied for table suppliers',
  'Equipe nao possui hard delete em fornecedores'
);

select throws_ok(
  $$ delete from public.catalog_categories where id = '10000000-0000-0000-0000-000000000021' $$,
  '42501', 'permission denied for table catalog_categories',
  'Equipe nao possui hard delete em categorias'
);

select throws_ok(
  $$ delete from public.catalog_items where id = '10000000-0000-0000-0000-000000000031' $$,
  '42501', 'permission denied for table catalog_items',
  'Equipe nao possui hard delete em itens'
);

set local role postgres;

select throws_ok(
  $$ insert into public.catalog_items (code, name, category_id, unit)
     values ('adm-001', 'Codigo duplicado', '10000000-0000-0000-0000-000000000020', 'servico') $$,
  '23505', 'duplicate key value violates unique constraint "uq_catalog_items_code_ci"',
  'Codigo do item e unico sem diferenciar caixa'
);

select throws_ok(
  $$ insert into public.catalog_categories (name) values ('categoria admin atualizada') $$,
  '23505', 'duplicate key value violates unique constraint "uq_catalog_categories_name_ci"',
  'Nome da categoria e unico sem diferenciar caixa'
);

select throws_ok(
  $$ insert into public.catalog_items (code, name, category_id, unit)
     values ('FK-001', 'Categoria inexistente', '10000000-0000-0000-0000-000000000099', 'servico') $$,
  '23503', 'insert or update on table "catalog_items" violates foreign key constraint "catalog_items_category_id_fkey"',
  'Item exige categoria existente'
);

select throws_ok(
  $$ insert into public.catalog_items (code, name, category_id, unit)
     values ('NULL-001', 'Categoria obrigatoria', null, 'servico') $$,
  '23502', 'null value in column "category_id" of relation "catalog_items" violates not-null constraint',
  'Categoria do item e obrigatoria'
);

set local role anon;

select throws_ok(
  $$ select count(*) from public.suppliers $$,
  '42501', 'permission denied for table suppliers',
  'Anonimo nao le fornecedores'
);

select throws_ok(
  $$ select count(*) from public.catalog_categories $$,
  '42501', 'permission denied for table catalog_categories',
  'Anonimo nao le categorias'
);

select throws_ok(
  $$ select count(*) from public.catalog_items $$,
  '42501', 'permission denied for table catalog_items',
  'Anonimo nao le itens'
);

set local role postgres;
select * from finish();
rollback;
