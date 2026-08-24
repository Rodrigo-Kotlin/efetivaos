begin;

create extension if not exists pgtap with schema extensions;

select plan(40);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'admin@test.local', '', now(),
    '{}', '{"full_name":"Admin Teste"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'equipe@test.local', '', now(),
    '{}', '{"full_name":"Equipe Teste"}', now(), now()
  );

update public.profiles
set role = 'admin'
where id = '00000000-0000-0000-0000-000000000001';

insert into public.suppliers (id, name)
values
  ('00000000-0000-0000-0000-000000000010', 'Fornecedor A'),
  ('00000000-0000-0000-0000-000000000011', 'Fornecedor B');

insert into public.catalog_categories (id, name)
values
  ('00000000-0000-0000-0000-000000000020', 'Categoria A'),
  ('00000000-0000-0000-0000-000000000021', 'Categoria B');

insert into public.catalog_items (id, code, name, category_id, unit)
values
  ('00000000-0000-0000-0000-000000000030', 'ITEM-1', 'Item com regra propria', '00000000-0000-0000-0000-000000000020', 'un'),
  ('00000000-0000-0000-0000-000000000031', 'ITEM-2', 'Item com regra global', '00000000-0000-0000-0000-000000000021', 'un'),
  ('00000000-0000-0000-0000-000000000032', 'ITEM-3', 'Item para teste sem regra', '00000000-0000-0000-0000-000000000021', 'un'),
  ('00000000-0000-0000-0000-000000000033', 'ITEM-4', 'Item com regra de categoria', '00000000-0000-0000-0000-000000000020', 'un'),
  ('00000000-0000-0000-0000-000000000034', 'ITEM-5', 'Item do fluxo Equipe', '00000000-0000-0000-0000-000000000021', 'un'),
  ('00000000-0000-0000-0000-000000000035', 'ITEM-6', 'Item de fornecedor inativo', '00000000-0000-0000-0000-000000000021', 'un');

insert into public.margin_rules (id, scope_type, category_id, catalog_item_id, calculation_type, value)
values
  ('00000000-0000-0000-0000-000000000060', 'global', null, null, 'percentage', 30),
  ('00000000-0000-0000-0000-000000000061', 'category', '00000000-0000-0000-0000-000000000020', null, 'percentage', 20),
  ('00000000-0000-0000-0000-000000000062', 'item', null, '00000000-0000-0000-0000-000000000030', 'fixed', 25);

insert into public.quotations (id, supplier_id, received_at, valid_until)
values
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000010', current_date - 5, current_date + 30),
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000010', current_date - 4, current_date + 20),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000010', current_date - 10, current_date - 1),
  ('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000010', current_date - 3, null),
  ('00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000010', current_date - 2, current_date),
  ('00000000-0000-0000-0000-000000000045', '00000000-0000-0000-0000-000000000010', current_date - 2, current_date + 15),
  ('00000000-0000-0000-0000-000000000046', '00000000-0000-0000-0000-000000000011', current_date - 2, current_date + 15);

insert into public.quotation_items (id, quotation_id, catalog_item_id, unit_price)
values
  ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000030', 100),
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000030', 90),
  ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000030', 80),
  ('00000000-0000-0000-0000-000000000053', '00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000030', 95),
  ('00000000-0000-0000-0000-000000000054', '00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000031', 100),
  ('00000000-0000-0000-0000-000000000055', '00000000-0000-0000-0000-000000000045', '00000000-0000-0000-0000-000000000032', 50),
  ('00000000-0000-0000-0000-000000000056', '00000000-0000-0000-0000-000000000046', '00000000-0000-0000-0000-000000000035', 40);

update public.quotations
set status = 'active'
where id between '00000000-0000-0000-0000-000000000040' and '00000000-0000-0000-0000-000000000046';

select is(
  (select unit_price from public.best_quote_per_item_v where catalog_item_id = '00000000-0000-0000-0000-000000000030'),
  90.00::numeric,
  'T-DB-01: a menor de duas cotacoes vigentes e selecionada'
);

select ok(
  (select not is_eligible from public.quotation_item_candidates_v where quotation_item_id = '00000000-0000-0000-0000-000000000052')
  and exists (select 1 from public.quotation_items where id = '00000000-0000-0000-0000-000000000052'),
  'T-DB-02: oferta vencida nao disputa e permanece no historico'
);

select ok(
  (select is_eligible and validity_not_informed from public.quotation_item_candidates_v where quotation_item_id = '00000000-0000-0000-0000-000000000053'),
  'T-DB-03: oferta sem validade e elegivel com alerta'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$
    select (public.resolve_margin_rule(id)).scope_type::text
    from public.catalog_items
    where id in (
      '00000000-0000-0000-0000-000000000030',
      '00000000-0000-0000-0000-000000000031',
      '00000000-0000-0000-0000-000000000033'
    )
    order by id
  $$,
  $$ values ('item'), ('global'), ('category') $$,
  'T-DB-04: prioridade item, categoria e global e deterministica'
);

set local role postgres;
update public.margin_rules set active = false where id = '00000000-0000-0000-0000-000000000060';
set local role authenticated;

select throws_ok(
  $$
    select public.approve_price(
      '00000000-0000-0000-0000-000000000032',
      public.price_decision_token('00000000-0000-0000-0000-000000000032')
    )
  $$,
  'P0001',
  'Defina uma regra de acrescimo antes de aprovar este preco.',
  'T-DB-05: aprovacao falha claramente quando nao ha regra'
);

set local role postgres;
update public.margin_rules set active = true where id = '00000000-0000-0000-0000-000000000060';
set local role authenticated;

select lives_ok(
  $$
    select public.approve_price(
      '00000000-0000-0000-0000-000000000031',
      public.price_decision_token('00000000-0000-0000-0000-000000000031')
    )
  $$,
  'T-DB-06a: aprovacao percentual e calculada no servidor'
);
select is(
  (select final_price from public.price_list where catalog_item_id = '00000000-0000-0000-0000-000000000031'),
  130.00::numeric,
  'T-DB-06b: custo 100 mais 30 por cento resulta em 130'
);
select lives_ok(
  $$
    select public.approve_price(
      '00000000-0000-0000-0000-000000000030',
      public.price_decision_token('00000000-0000-0000-0000-000000000030')
    )
  $$,
  'T-DB-06c: aprovacao por acrescimo fixo e calculada no servidor'
);
select is(
  (select final_price from public.price_list where catalog_item_id = '00000000-0000-0000-0000-000000000030'),
  115.00::numeric,
  'T-DB-06d: custo 90 mais 25 fixo resulta em 115'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$
    insert into public.margin_rules (scope_type, catalog_item_id, calculation_type, value)
    values ('item', '00000000-0000-0000-0000-000000000031', 'fixed', 1)
  $$,
  '42501',
  'new row violates row-level security policy for table "margin_rules"',
  'T-DB-07a: Equipe nao insere regra comercial'
);
select throws_ok(
  $$ insert into public.price_list (catalog_item_id) values ('00000000-0000-0000-0000-000000000031') $$,
  '42501',
  'permission denied for table price_list',
  'T-DB-07b: escrita direta em price_list nao e concedida'
);
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000002' $$,
  '42501',
  'permission denied for table profiles',
  'T-DB-07c: Equipe nao consegue promover o proprio profile'
);
select is(
  public.current_app_role()::text,
  'equipe',
  'T-DB-07d: role efetiva permanece Equipe apos autopromocao negada'
);
select throws_ok(
  $$ select public.set_user_role('00000000-0000-0000-0000-000000000002', 'admin') $$,
  '42501',
  'Only admins can change user roles',
  'T-DB-07e: Equipe nao altera role pela RPC administrativa'
);
select throws_ok(
  $$
    select public.approve_price(
      '00000000-0000-0000-0000-000000000031',
      public.price_decision_token('00000000-0000-0000-0000-000000000031')
    )
  $$,
  'P0001',
  'Apenas Admin pode aprovar ou atualizar preco comercial.',
  'T-DB-07f: Equipe nao executa aprovacao comercial'
);
select throws_ok(
  $$
    select public.inactivate_price(
      '00000000-0000-0000-0000-000000000031',
      public.price_decision_token('00000000-0000-0000-0000-000000000031')
    )
  $$,
  'P0001',
  'Apenas Admin pode inativar preco comercial.',
  'T-DB-07g: Equipe nao inativa preco comercial'
);

select lives_ok(
  $$
    insert into public.quotations (id, supplier_id, received_at)
    values ('00000000-0000-0000-0000-000000000047', '00000000-0000-0000-0000-000000000010', current_date)
  $$,
  'T-DB-08a: Equipe cria cotacao em draft'
);
select lives_ok(
  $$
    insert into public.quotation_items (id, quotation_id, unit_price)
    values ('00000000-0000-0000-0000-000000000057', '00000000-0000-0000-0000-000000000047', 10)
  $$,
  'T-DB-08b: Equipe inclui item ainda nao mapeado no draft'
);
select lives_ok(
  $$
    insert into public.quotation_items (id, quotation_id, unit_price)
    values ('00000000-0000-0000-0000-000000000059', '00000000-0000-0000-0000-000000000047', 11);
    delete from public.quotation_items
    where id = '00000000-0000-0000-0000-000000000059'
  $$,
  'T-DB-08c: Equipe pode remover linha enquanto a cotacao esta em draft'
);
select throws_ok(
  $$ update public.quotations set status = 'active' where id = '00000000-0000-0000-0000-000000000047' $$,
  'P0001',
  'Mapeie todos os itens ao Catalogo Efetiva antes de ativar a cotacao.',
  'T-DB-08d: draft com item sem mapa nao pode ser ativado'
);
select lives_ok(
  $$
    update public.quotation_items
    set catalog_item_id = '00000000-0000-0000-0000-000000000034'
    where id = '00000000-0000-0000-0000-000000000057'
  $$,
  'T-DB-08e: Equipe mapeia item do draft'
);
select throws_ok(
  $$
    insert into public.quotation_items (quotation_id, catalog_item_id, unit_price)
    values ('00000000-0000-0000-0000-000000000047', '00000000-0000-0000-0000-000000000034', 12)
  $$,
  '23505',
  'duplicate key value violates unique constraint "uq_quotation_item_catalog_once"',
  'T-DB-08f: item canonico nao pode se repetir na mesma cotacao'
);
select lives_ok(
  $$
    update public.quotations
    set status = 'active'
    where id = '00000000-0000-0000-0000-000000000047'
  $$,
  'T-DB-08g: Equipe ativa cotacao depois do mapeamento'
);

select throws_ok(
  $$ update public.quotations set notes = 'alteracao indevida' where id = '00000000-0000-0000-0000-000000000047' $$,
  'P0001',
  'Cotacao ativa somente pode ser cancelada.',
  'T-DB-09: cotacao ativa e imutavel salvo cancelamento'
);
update public.quotation_items
set unit_price = 12
where id = '00000000-0000-0000-0000-000000000057';
select is(
  (select unit_price from public.quotation_items where id = '00000000-0000-0000-0000-000000000057'),
  10.00::numeric,
  'T-DB-09b: linha de cotacao ativa e imutavel'
);
select lives_ok(
  $$ update public.quotations set status = 'cancelled' where id = '00000000-0000-0000-0000-000000000047' $$,
  'T-DB-09c: cotacao ativa pode ser cancelada explicitamente'
);
select throws_ok(
  $$ update public.quotations set notes = 'alteracao terminal' where id = '00000000-0000-0000-0000-000000000047' $$,
  'P0001',
  'Cotacao cancelada nao pode ser alterada.',
  'T-DB-09d: cotacao cancelada permanece terminal'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$
    select public.approve_price(
      '00000000-0000-0000-0000-000000000030',
      public.price_decision_token('00000000-0000-0000-0000-000000000030'),
      '00000000-0000-0000-0000-000000000050'
    )
  $$,
  'T-DB-10a: Admin pode aprovar uma fonte elegivel alternativa'
);
select ok(
  (
    select manual_source
      and best_cost_at_approval = 90
      and best_quotation_item_id_at_approval = '00000000-0000-0000-0000-000000000051'
    from public.price_list
    where catalog_item_id = '00000000-0000-0000-0000-000000000030'
  ),
  'T-DB-10b: fonte manual preserva snapshot do melhor custo'
);

set local role postgres;
insert into public.quotations (id, supplier_id, received_at, valid_until)
values ('00000000-0000-0000-0000-000000000048', '00000000-0000-0000-0000-000000000010', current_date, current_date + 30);
insert into public.quotation_items (id, quotation_id, catalog_item_id, unit_price)
values ('00000000-0000-0000-0000-000000000058', '00000000-0000-0000-0000-000000000048', '00000000-0000-0000-0000-000000000030', 70);
update public.quotations set status = 'active' where id = '00000000-0000-0000-0000-000000000048';

select ok(
  (
    select pc.effective_status = 'review_required'
      and pl.final_price = 125
      and pl.source_quotation_item_id = '00000000-0000-0000-0000-000000000050'
    from public.pricing_comparison_v pc
    join public.price_list pl on pl.catalog_item_id = pc.catalog_item_id
    where pc.catalog_item_id = '00000000-0000-0000-0000-000000000030'
  ),
  'T-DB-11: nova melhor oferta exige revisao sem alterar preco aprovado'
);

set constraints all immediate;
alter table public.quotations disable trigger trg_quotations_lifecycle;
update public.quotations
set valid_until = current_date - 1
where id = '00000000-0000-0000-0000-000000000044';
alter table public.quotations enable trigger trg_quotations_lifecycle;
set constraints all deferred;

select is(
  (select effective_status from public.pricing_comparison_v where catalog_item_id = '00000000-0000-0000-0000-000000000031'),
  'review_required',
  'T-DB-12: fonte aprovada vencida exige revisao por data'
);

update public.suppliers
set active = false
where id = '00000000-0000-0000-0000-000000000011';

select ok(
  (select is_eligible from public.quotation_item_candidates_v where quotation_item_id = '00000000-0000-0000-0000-000000000056'),
  'T-DB-13a: fornecedor inativo nao cancela cotacao ativa existente'
);
select throws_ok(
  $$
    insert into public.quotations (supplier_id, received_at)
    values ('00000000-0000-0000-0000-000000000011', current_date)
  $$,
  'P0001',
  'Fornecedor inativo: ative-o antes de registrar a cotacao.',
  'T-DB-13b: fornecedor inativo bloqueia nova cotacao'
);

select throws_ok(
  $$
    update public.catalog_items
    set unit = 'caixa'
    where id = '00000000-0000-0000-0000-000000000030'
  $$,
  'P0001',
  'Categoria e unidade nao podem mudar depois que o item participa de uma cotacao.',
  'DT-03: unidade canonica historica nao pode ser reinterpretada'
);

insert into public.quotations (id, supplier_id, received_at)
values ('00000000-0000-0000-0000-000000000049', '00000000-0000-0000-0000-000000000010', current_date);
insert into public.quotation_items (id, quotation_id, catalog_item_id, unit_price)
values ('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-000000000049', '00000000-0000-0000-0000-000000000033', 20);
update public.catalog_items
set active = false
where id = '00000000-0000-0000-0000-000000000033';

select throws_ok(
  $$ update public.quotations set status = 'active' where id = '00000000-0000-0000-0000-000000000049' $$,
  'P0001',
  'Itens inativos do Catalogo Efetiva nao podem participar de nova cotacao ativa.',
  'DT-08: ativacao rejeita item do catalogo inativado depois do mapeamento'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

update public.suppliers
set created_at = '2000-01-01 00:00:00+00',
    created_by = '00000000-0000-0000-0000-000000000002'
where id = '00000000-0000-0000-0000-000000000010';

select ok(
  (
    select created_at <> '2000-01-01 00:00:00+00'::timestamptz
      and created_by is null
    from public.suppliers
    where id = '00000000-0000-0000-0000-000000000010'
  ),
  'Auditoria: campos de criacao permanecem imutaveis'
);

set local role postgres;

select ok(
  not has_table_privilege('anon', 'public.suppliers', 'select')
  and not has_table_privilege('anon', 'public.catalog_items', 'select')
  and not has_table_privilege('anon', 'public.quotations', 'select')
  and not has_table_privilege('anon', 'public.price_list', 'select'),
  'T-DB-14: anon nao recebe acesso as tabelas do modulo'
);

select ok(
  (
    select public = false
      and file_size_limit = 10485760
      and allowed_mime_types @> array['application/pdf','image/jpeg','image/png','image/webp']::text[]
    from storage.buckets
    where id = 'supplier-quotes'
  ),
  'T-DB-15a: bucket e privado e preserva limites de arquivo aprovados'
);

select ok(
  (
    select count(*) = 4
      and bool_and(
        policyname = any(array[
          'supplier_quotes_files_delete_admin',
          'supplier_quotes_files_insert_internal',
          'supplier_quotes_files_select_internal',
          'supplier_quotes_files_update_internal'
        ])
      )
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'supplier_quotes_files_%'
  ),
  'T-DB-15b: bucket privado possui matriz de policies aprovada'
);

select lives_ok(
  $$ set constraints all immediate $$,
  'Integridade: constraints diferidas validam o estado final da transacao'
);

select * from finish();
rollback;
