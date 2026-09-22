begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  seq bigint generated always as identity primary key,
  result text not null
) on commit drop;

grant insert, select on pg_temp.tap_results to authenticated, anon;
grant usage, select on sequence pg_temp.tap_results_seq_seq to authenticated, anon;

insert into pg_temp.tap_results (result)
select plan(53);

-- Fixtures are transaction-local and use fixed IDs to keep failures readable.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'fase2a-admin@test.local', '', now(),
    '{}', '{"full_name":"Fase 2A Admin"}', now(), now()
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'fase2a-equipe@test.local', '', now(),
    '{}', '{"full_name":"Fase 2A Equipe"}', now(), now()
  );

update public.profiles set role = 'admin'
where id = '50000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

insert into public.suppliers (id, name)
values ('50000000-0000-0000-0000-000000000010', 'Fornecedor Fase 2A');

insert into public.catalog_categories (id, name)
values ('50000000-0000-0000-0000-000000000020', 'Categoria Fase 2A');

insert into public.catalog_items (id, name, category_id, unit, sourcing_type)
values
  ('50000000-0000-0000-0000-000000000030', 'Servico proprio', '50000000-0000-0000-0000-000000000020', 'un', 'own'),
  ('50000000-0000-0000-0000-000000000031', 'Item terceirizado', '50000000-0000-0000-0000-000000000020', 'un', 'outsourced'),
  ('50000000-0000-0000-0000-000000000032', 'Item sem historico', '50000000-0000-0000-0000-000000000020', 'un', 'own');

insert into public.margin_rules (
  id, scope_type, catalog_item_id, calculation_type, value
)
values ('50000000-0000-0000-0000-000000000060', 'global', null, 'percentage', 10.0000);

insert into public.quotations (
  id, supplier_id, reference_number, received_at, valid_until
)
values (
  '50000000-0000-0000-0000-000000000040',
  '50000000-0000-0000-0000-000000000010',
  'F2A-OUT-BEST', current_date - 5, current_date + 30
);

insert into public.quotation_items (
  id, quotation_id, catalog_item_id, supplier_description, unit_price
)
values (
  '50000000-0000-0000-0000-000000000050',
  '50000000-0000-0000-0000-000000000040',
  '50000000-0000-0000-0000-000000000031',
  'Oferta terceirizada', 10.00
);

update public.quotations set status = 'active'
where id = '50000000-0000-0000-0000-000000000040';

-- Propostas pendentes: uma para o item proprio (F2A-OWN) e outra para o item
-- sem historico (F2A-FREE). Submetidas pela Equipe.
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);

insert into public.own_price_proposals (
  id, catalog_item_id, sale_price, internal_cost
)
values
  ('50000000-0000-0000-0000-0000000000A0', '50000000-0000-0000-0000-000000000030', 50.00, 20.00),
  ('50000000-0000-0000-0000-0000000000B0', '50000000-0000-0000-0000-000000000032', 90.00, 45.00);

-- ===========================================================================
-- A. ESTRUTURA
-- ===========================================================================
insert into pg_temp.tap_results (result)
select has_type('public', 'pricing_sourcing_type', '2A: enum pricing_sourcing_type existe');

insert into pg_temp.tap_results (result)
select has_type('public', 'price_origin', '2A: enum price_origin existe');

insert into pg_temp.tap_results (result)
select has_type('public', 'own_price_status', '2A: enum own_price_status existe');

insert into pg_temp.tap_results (result)
select has_column('public', 'catalog_items', 'sourcing_type', '2A: catalog_items tem sourcing_type');

insert into pg_temp.tap_results (result)
select ok(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'catalog_items' and column_name = 'sourcing_type')
  = '''outsourced''::pricing_sourcing_type',
  '2A: default de sourcing_type preserva itens existentes como outsourced'
);

insert into pg_temp.tap_results (result)
select has_table('public', 'own_price_proposals', '2A: tabela own_price_proposals existe');

insert into pg_temp.tap_results (result)
select ok(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'own_price_proposals'
     and column_name in ('id','catalog_item_id','sale_price','internal_cost','status','submitted_by','submitted_at','approved_by','approved_at','decision_notes','revision','created_at','created_by','updated_at','updated_by'))
  = 15,
  '2A: own_price_proposals possui todas as colunas previstas'
);

insert into pg_temp.tap_results (result)
select ok(
  (select count(*) from pg_constraint
   where conrelid = 'public.own_price_proposals'::regclass
     and conname = 'own_price_proposals_status_revision_chk') = 1,
  '2A: fim de decisao exige aprovador e data de aprovacao'
);

insert into pg_temp.tap_results (result)
select ok(
  to_regclass('public.uq_own_price_proposals_one_pending') is not null,
  '2A: indice unico parcial de uma proposta pending por item existe'
);

insert into pg_temp.tap_results (result)
select ok(
  to_regclass('public.idx_own_price_proposals_item_status') is not null,
  '2A: indice por item e status existe'
);

insert into pg_temp.tap_results (result)
select ok(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'price_list'
     and column_name in ('price_origin','own_price_proposal_id')) = 2,
  '2A: price_list declara origem do preco vigente'
);

insert into pg_temp.tap_results (result)
select is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'price_list'
     and column_name in ('source_quotation_item_id','margin_rule_id','cost_price','adjustment_type','adjustment_value')
     and is_nullable = 'YES'),
  5::bigint,
  '2A: campos de origem das cotacoes passam a ser opcionais em price_list'
);

insert into pg_temp.tap_results (result)
select ok(
  (select count(*) from pg_constraint
   where conrelid = 'public.price_list'::regclass
     and conname = 'price_list_origin_fields_chk') = 1,
  '2A: origem quotation e origem own sao mutuamente exclusivas em price_list'
);

insert into pg_temp.tap_results (result)
select ok(
  to_regprocedure('public.get_own_price_proposals(uuid,public.own_price_status)') is not null,
  '2A: funcao de leitura get_own_price_proposals existe'
);

insert into pg_temp.tap_results (result)
select ok(
  to_regprocedure('public.enforce_own_price_proposal_insert()') is not null
    and to_regprocedure('public.enforce_own_price_proposal_update()') is not null
    and to_regprocedure('public.enforce_catalog_item_sourcing_history()') is not null,
  '2A: funcoes de gatilho de guarda existem'
);

insert into pg_temp.tap_results (result)
select ok(
  to_regprocedure('public.approve_price(uuid,text,uuid)') is not null
    and to_regprocedure('public.approve_price(uuid,uuid)') is null,
  '2A: assinatura approve_price permanece intacta (deslocada para a 2B)'
);

-- ===========================================================================
-- B. RLS E GRANTS
-- ===========================================================================
insert into pg_temp.tap_results (result)
select ok(
  (select relrowsecurity from pg_class where oid = 'public.own_price_proposals'::regclass),
  '2A: RLS habilitada em own_price_proposals'
);

insert into pg_temp.tap_results (result)
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.own_price_proposals'::regclass),
  '2A: RLS forçada em own_price_proposals'
);

insert into pg_temp.tap_results (result)
select ok(
  has_table_privilege('authenticated', 'public.own_price_proposals', 'INSERT'),
  '2A: authenticated pode inserir propostas'
);

insert into pg_temp.tap_results (result)
select ok(
  has_column_privilege('authenticated', 'public.own_price_proposals', 'sale_price', 'SELECT'),
  '2A: authenticated pode selecionar sale_price'
);

insert into pg_temp.tap_results (result)
select ok(
  not has_column_privilege('authenticated', 'public.own_price_proposals', 'internal_cost', 'SELECT'),
  '2A: custo interno nao e selecionavel diretamente por authenticated'
);

insert into pg_temp.tap_results (result)
select ok(
  has_column_privilege('authenticated', 'public.own_price_proposals', 'sale_price', 'UPDATE')
    and has_column_privilege('authenticated', 'public.own_price_proposals', 'internal_cost', 'UPDATE'),
  '2A: authenticated pode atualizar preco e custo da propria proposta'
);

insert into pg_temp.tap_results (result)
select ok(
  not has_table_privilege('authenticated', 'public.own_price_proposals', 'DELETE'),
  '2A: authenticated nao pode excluir propostas (rastreabilidade)'
);

insert into pg_temp.tap_results (result)
select ok(
  not has_table_privilege('anon', 'public.own_price_proposals', 'INSERT')
    and not has_table_privilege('anon', 'public.own_price_proposals', 'SELECT')
    and not has_table_privilege('anon', 'public.own_price_proposals', 'DELETE'),
  '2A: anon nao possui acesso direto a propostas'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'own_price_proposals' and cmd = 'SELECT'
      and policyname = 'own_price_proposals_select_internal'
      and qual = '(is_internal_user() AND (is_admin() OR (submitted_by = ( SELECT auth.uid() AS uid))))'
  ),
  '2A: leitura via RLS fica restrita a owner/admin (custo interno oculto por grant de coluna)'
);

insert into pg_temp.tap_results (result)
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'own_price_proposals' and cmd = 'DELETE'
  ),
  '2A: exclusao via RLS esta bloqueada'
);

-- ===========================================================================
-- C. FUNCIONALIDADE COMO EQUIPE (donas das propostas)
-- ===========================================================================
insert into pg_temp.tap_results (result)
select ok(
  (select submitted_by = '50000000-0000-0000-0000-000000000002'
      and status = 'pending'
      and revision = 1
      and submitted_at is not null
    from public.get_own_price_proposals(
      p_catalog_item_id => '50000000-0000-0000-0000-000000000030'
    )
    where id = '50000000-0000-0000-0000-0000000000A0'),
  '2A: Equipe submete proposta e o sistema registra autor, estado e revisao'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.own_price_proposals (catalog_item_id, sale_price)
     values ('50000000-0000-0000-0000-000000000030', 0.00) $$,
  '23514',
  NULL,
  'Preco de venda zero e rejeitado'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.own_price_proposals (catalog_item_id, sale_price)
     values ('50000000-0000-0000-0000-000000000030', -1.00) $$,
  '23514',
  NULL,
  'Preco de venda negativo e rejeitado'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.own_price_proposals (catalog_item_id, sale_price)
     values ('50000000-0000-0000-0000-000000000030', 60.00) $$,
  '23505',
  'duplicate key value violates unique constraint "uq_own_price_proposals_one_pending"',
  'Uma segunda proposta pending para o mesmo item e rejeitada'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.own_price_proposals (catalog_item_id, sale_price, status)
     values ('50000000-0000-0000-0000-000000000030', 60.00, 'approved') $$,
  'P0001',
  'Uma nova proposta de preco proprio deve ser criada em estado pending.',
  'Nova proposta ja aprovada e rejeitada'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.own_price_proposals (catalog_item_id, sale_price, submitted_by)
     values ('50000000-0000-0000-0000-000000000030', 60.00, '50000000-0000-0000-0000-000000000001') $$,
  'P0001',
  'A proposta de preco proprio deve ser submetida pelo proprio usuario logado.',
  'Submissao em nome de outro usuario e rejeitada'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.own_price_proposals (catalog_item_id, sale_price)
     values ('50000000-0000-0000-0000-000000000031', 60.00) $$,
  'P0001',
  'Somente itens de servico proprio recebem proposta de preco proprio; itens terceirizados usam cotacao.',
  'Proposta para item terceirizado e rejeitada'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.own_price_proposals
     set sale_price = 55.00
     where id = '50000000-0000-0000-0000-0000000000A0' $$,
  'Equipe pode reajustar a propria proposta enquanto pending'
);

insert into pg_temp.tap_results (result)
select ok(
  (select sale_price = 55.00 and revision = 2
    from public.get_own_price_proposals(
      p_catalog_item_id => '50000000-0000-0000-0000-000000000030'
    )
    where id = '50000000-0000-0000-0000-0000000000A0'),
  'Reajuste em pending incrementa a revisao e preserva os valores'
);

-- ===========================================================================
-- D. LEITURA RESTRITA (mascaramento do custo interno)
-- ===========================================================================
insert into pg_temp.tap_results (result)
select ok(
  (select internal_cost is null
      and sale_price = 55.00
    from public.get_own_price_proposals(
      p_catalog_item_id => '50000000-0000-0000-0000-000000000030'
    )
    where id = '50000000-0000-0000-0000-0000000000A0'),
  '2A: Equipe le a proposta sem enxergar o custo interno'
);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select ok(
  (select internal_cost = 20.00
    from public.get_own_price_proposals(
      p_catalog_item_id => '50000000-0000-0000-0000-000000000030'
    )
    where id = '50000000-0000-0000-0000-0000000000A0'),
  '2A: Admin enxerga o custo interno'
);

insert into pg_temp.tap_results (result)
select is(
  (select count(*) from public.get_own_price_proposals(p_catalog_item_id => '50000000-0000-0000-0000-000000000030')),
  1::bigint,
  '2A: leitura filtrada por item retorna apenas as propostas do item'
);

-- ===========================================================================
-- E. PROPOSTA DECIDIDA (simulacao da RPC de aprovacao da Fase 2B)
-- ===========================================================================
-- A RPC de aprovacao (Fase 2B) opera sob a GUC efetiva_os.own_price_approval.
-- Aqui o Administrador do banco simula o mesmo caminho para validar os
-- gatilhos de imutabilidade e a exclusividade da transicao de estado.
set local role postgres;
select set_config('efetiva_os.own_price_approval', 'on', true);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.own_price_proposals
     set status = 'approved',
         approved_by = '50000000-0000-0000-0000-000000000001',
         approved_at = now(),
         decision_notes = 'Aprovado pela simulacao 2B'
     where id = '50000000-0000-0000-0000-0000000000A0' $$,
  '2A: aprovacao autorizada transiciona pending para approved'
);

select set_config('efetiva_os.own_price_approval', 'off', true);

insert into pg_temp.tap_results (result)
select ok(
  (select status = 'approved'
      and approved_by = '50000000-0000-0000-0000-000000000001'
      and approved_at is not null
      and decision_notes = 'Aprovado pela simulacao 2B'
    from public.own_price_proposals
    where id = '50000000-0000-0000-0000-0000000000A0'),
  '2A: decisao registra aprovador, data e nota'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.own_price_proposals
     set sale_price = 30.00
     where id = '50000000-0000-0000-0000-0000000000A0' $$,
  'P0001',
  'Proposta decidida e imutavel; reajuste exige nova proposta.',
  'Preco de proposta aprovada e imutavel'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.own_price_proposals
     set decision_notes = 'alteracao indevida'
     where id = '50000000-0000-0000-0000-0000000000A0' $$,
  'P0001',
  'Proposta decidida e imutavel; reajuste exige nova proposta.',
  'Nota de proposta aprovada e imutavel'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.own_price_proposals
     set status = 'approved'
     where id = '50000000-0000-0000-0000-0000000000B0' $$,
  '42501',
  'O estado de aprovacao somente muda pela RPC de aprovacao de preco proprio.',
  'Equipe nao transiciona estado de proposta diretamente'
);

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.own_price_proposals
     set status = 'inactive'
     where id = '50000000-0000-0000-0000-0000000000B0' $$,
  '42501',
  'O estado de aprovacao somente muda pela RPC de aprovacao de preco proprio.',
  'Admin nao transiciona estado fora da RPC de aprovacao'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ delete from public.own_price_proposals
     where id = '50000000-0000-0000-0000-0000000000B0' $$,
  '42501',
  NULL,
  'Nenhum papel exclui proposta diretamente'
);

-- ===========================================================================
-- F. HISTORICO DE ORIGEM DO ITEM
-- ===========================================================================
insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.catalog_items set sourcing_type = 'outsourced'
     where id = '50000000-0000-0000-0000-000000000030' $$,
  'P0001',
  'A origem do item nao pode mudar depois que o item participa de cotacao, proposta de preco proprio ou precificacao vigente.',
  'Origem de item com proposta propria nao muda para terceirizada'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.catalog_items set sourcing_type = 'own'
     where id = '50000000-0000-0000-0000-000000000031' $$,
  'P0001',
  'A origem do item nao pode mudar depois que o item participa de cotacao, proposta de preco proprio ou precificacao vigente.',
  'Origem de item com cotacao nao muda para propria'
);

insert into public.catalog_items (id, name, category_id, unit, sourcing_type)
values ('50000000-0000-0000-0000-000000000033', 'Item novo sem historico', '50000000-0000-0000-0000-000000000020', 'un', 'own');

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.catalog_items set sourcing_type = 'outsourced'
     where id = '50000000-0000-0000-0000-000000000033' $$,
  'Item sem historico pode ter a origem ajustada livremente'
);

-- ===========================================================================
-- G. REGRESSAO: fluxo de cotacao intacto
-- ===========================================================================
insert into pg_temp.tap_results (result)
select lives_ok(
  $$
    select public.approve_price(
      '50000000-0000-0000-0000-000000000031',
      public.price_decision_token('50000000-0000-0000-0000-000000000031')
    )
  $$,
  '2A: aprovação por cotacao continua funcionando (origem quotation)'
);

insert into pg_temp.tap_results (result)
select ok(
  (select price_origin = 'quotation'
      and own_price_proposal_id is null
    from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000031'),
  '2A: preco derivado de cotacao grava origem quotation e refencia nula a proposta'
);

insert into pg_temp.tap_results (result)
select ok(
  (select cost_price = 10.00
      and final_price = 11.00
      and source_quotation_item_id = '50000000-0000-0000-0000-000000000050'
      and margin_rule_id = '50000000-0000-0000-0000-000000000060'
      and adjustment_type = 'percentage'
      and adjustment_value = 10.0000
    from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000031'),
  '2A: snapshots de origem permanecem registrados em precos de cotacao'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1 from public.pricing_comparison_v
    where catalog_item_id = '50000000-0000-0000-0000-000000000031'
      and persisted_status = 'approved'
  ),
  '2A: comparacao de precos (pricing_comparison_v) permanece integra'
);

insert into pg_temp.tap_results (result)
select ok(
  not has_function_privilege('anon', 'public.get_own_price_proposals(uuid,public.own_price_status)', 'EXECUTE'),
  '2A: anon nao executa a leitura de propostas'
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