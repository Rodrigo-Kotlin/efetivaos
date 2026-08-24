begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  seq bigint generated always as identity primary key,
  result text not null
) on commit drop;

grant insert, select on pg_temp.tap_results to authenticated, anon;
grant usage, select on sequence pg_temp.tap_results_seq_seq to authenticated, anon;

insert into pg_temp.tap_results (result)
select plan(155);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sprint02-admin@test.local', '', now(),
    '{}', '{"full_name":"Sprint 02 Admin"}', now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sprint02-equipe@test.local', '', now(),
    '{}', '{"full_name":"Sprint 02 Equipe"}', now(), now()
  );

update public.profiles
set role = 'admin'
where id = '20000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

insert into public.suppliers (id, name, active)
values
  ('20000000-0000-0000-0000-000000000010', 'Fornecedor Admin Sprint 02', true),
  ('20000000-0000-0000-0000-000000000011', 'Fornecedor Equipe Sprint 02', true),
  ('20000000-0000-0000-0000-000000000012', 'Fornecedor Inativo Sprint 02', false),
  ('20000000-0000-0000-0000-000000000013', 'Fornecedor para Inativar Sprint 02', true);

insert into public.catalog_categories (id, name)
values ('20000000-0000-0000-0000-000000000020', 'Categoria Sprint 02');

insert into public.catalog_items (id, code, name, category_id, unit, active)
values
  ('20000000-0000-0000-0000-000000000030', 'S02-ADM', 'Item Admin Sprint 02', '20000000-0000-0000-0000-000000000020', 'un', true),
  ('20000000-0000-0000-0000-000000000031', 'S02-EQP', 'Item Equipe Sprint 02', '20000000-0000-0000-0000-000000000020', 'un', true),
  ('20000000-0000-0000-0000-000000000032', 'S02-INA', 'Item Inativo Sprint 02', '20000000-0000-0000-0000-000000000020', 'un', false),
  ('20000000-0000-0000-0000-000000000033', 'S02-IAT', 'Item para Inativar Sprint 02', '20000000-0000-0000-0000-000000000020', 'un', true),
  ('20000000-0000-0000-0000-000000000034', 'S02-AUX', 'Item Auxiliar Sprint 02', '20000000-0000-0000-0000-000000000020', 'un', true);

insert into pg_temp.tap_results (result)
select ok(
  (
    select a.attnotnull
      and a.atthasdef
      and a.atttypid = 'bigint'::regtype
      and pg_get_expr(d.adbin, d.adrelid) in ('0', '0::bigint')
    from pg_attribute a
    join pg_attrdef d
      on d.adrelid = a.attrelid
     and d.adnum = a.attnum
    where a.attrelid = 'public.quotations'::regclass
      and a.attname = 'revision'
      and not a.attisdropped
  ),
  'quotations.revision e bigint not null com default zero'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.quotations'::regclass
      and t.tgname = 'trg_quotations_revision'
      and not t.tgisinternal
      and t.tgenabled = 'O'
      and p.proname = 'increment_quotation_revision'
  ),
  'Trigger habilitado incrementa revision antes de updates da cotacao'
);

insert into pg_temp.tap_results (result)
select ok(
  has_function_privilege(
    'authenticated',
    'public.save_quotation_draft(uuid,timestamptz,bigint,uuid,text,date,date,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated possui EXECUTE na RPC final de persistencia do draft'
);

insert into pg_temp.tap_results (result)
select ok(
  not has_function_privilege(
    'anon',
    'public.save_quotation_draft(uuid,timestamptz,bigint,uuid,text,date,date,text,jsonb)',
    'EXECUTE'
  ),
  'anon nao possui EXECUTE na RPC final de persistencia do draft'
);

insert into pg_temp.tap_results (result)
select ok(
  not exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = 'public.save_quotation_draft(uuid,timestamptz,bigint,uuid,text,date,date,text,jsonb)'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC nao possui EXECUTE na RPC final de persistencia do draft'
);

insert into pg_temp.tap_results (result)
select is(
  (
    select coalesce(
      array_agg(pg_get_userbyid(acl.grantee)::text order by pg_get_userbyid(acl.grantee)::text),
      '{}'::text[]
    )
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = 'public.discard_pending_quotation_attachment(uuid,bigint)'::regprocedure
      and acl.grantee <> p.proowner
      and acl.privilege_type = 'EXECUTE'
  ),
  array['authenticated', 'service_role']::text[],
  'Somente authenticated e service_role possuem grant externo de EXECUTE na RPC de descarte'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select not p.prosecdef
      and l.lanname = 'plpgsql'
      and array_to_string(p.proconfig, ',') = 'search_path=""'
    from pg_proc p
    join pg_language l on l.oid = p.prolang
    where p.oid = 'public.discard_pending_quotation_attachment(uuid,bigint)'::regprocedure
  ),
  'RPC de descarte e plpgsql security invoker com search_path vazio'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select position('pg_advisory_xact_lock' in pg_get_functiondef(p.oid)) > 0
      and position('pg_advisory_xact_lock' in pg_get_functiondef(p.oid))
          < position('select q.*' in lower(pg_get_functiondef(p.oid)))
      and pg_get_functiondef(p.oid) !~* 'delete\s+from\s+storage'
    from pg_proc p
    where p.oid = 'public.discard_pending_quotation_attachment(uuid,bigint)'::regprocedure
  ),
  'RPC adquire o advisory lock antes da linha e nao exclui objeto do Storage'
);

-- Admin: fluxo completo de draft ate cancelamento.
insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into public.quotations (
       id, supplier_id, reference_number, received_at, valid_until
     ) values (
       '20000000-0000-0000-0000-000000000040',
       '20000000-0000-0000-0000-000000000010',
       'ADM-001', current_date, current_date + 30
     ) $$,
  'Admin cria cotacao em draft'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into public.quotation_items (
       id, quotation_id, supplier_description, unit_price
     ) values (
       '20000000-0000-0000-0000-000000000050',
       '20000000-0000-0000-0000-000000000040',
       'Descricao inicial Admin', 100
     ) $$,
  'Admin insere item sem mapeamento no draft'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations
     set reference_number = 'ADM-001-EDITADA',
         notes = 'Draft editado pelo Admin',
         created_at = '2000-01-01 00:00:00+00',
         created_by = '20000000-0000-0000-0000-000000000002'
     where id = '20000000-0000-0000-0000-000000000040';
     update public.quotation_items
     set supplier_description = 'Descricao editada Admin',
         unit_price = 101,
         created_at = '2000-01-01 00:00:00+00',
         created_by = '20000000-0000-0000-0000-000000000002'
     where id = '20000000-0000-0000-0000-000000000050' $$,
  'Admin edita cabecalho e item do draft'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into public.quotation_items (id, quotation_id, unit_price)
     values (
       '20000000-0000-0000-0000-000000000051',
       '20000000-0000-0000-0000-000000000040', 5
     );
     delete from public.quotation_items
     where id = '20000000-0000-0000-0000-000000000051' $$,
  'Admin remove item enquanto a cotacao esta em draft'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotation_items
     set catalog_item_id = '20000000-0000-0000-0000-000000000030'
     where id = '20000000-0000-0000-0000-000000000050' $$,
  'Admin mapeia item ao catalogo'
);

insert into pg_temp.tap_results (result)
select ok(
  (select not is_eligible
   from public.quotation_item_candidates_v
   where quotation_item_id = '20000000-0000-0000-0000-000000000050')
  and not exists (
    select 1
    from public.ranked_quotation_items_v
    where quotation_item_id = '20000000-0000-0000-0000-000000000050'
  ),
  'Item em cotacao draft nao e elegivel nem participa do ranking'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations
     set status = 'active'
     where id = '20000000-0000-0000-0000-000000000040' $$,
  'Admin ativa cotacao valida'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select q.status = 'active'
      and qi.catalog_item_id = '20000000-0000-0000-0000-000000000030'
    from public.quotations q
    join public.quotation_items qi on qi.quotation_id = q.id
    where q.id = '20000000-0000-0000-0000-000000000040'
  ),
  'Admin seleciona cotacao ativa e seu item mapeado'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotations
     set notes = 'Alteracao ativa proibida'
     where id = '20000000-0000-0000-0000-000000000040' $$,
  'P0001', 'Cotacao ativa somente pode ser cancelada.',
  'Cabecalho ativo e imutavel fora do cancelamento'
);

update public.quotation_items
set unit_price = 999
where id = '20000000-0000-0000-0000-000000000050';

insert into pg_temp.tap_results (result)
select is(
  (select unit_price from public.quotation_items where id = '20000000-0000-0000-0000-000000000050'),
  101.00::numeric,
  'Item de cotacao ativa e imutavel'
);

delete from public.quotation_items
where id = '20000000-0000-0000-0000-000000000050';

insert into pg_temp.tap_results (result)
select is(
  (select count(*) from public.quotation_items where id = '20000000-0000-0000-0000-000000000050'),
  1::bigint,
  'Item de cotacao ativa nao pode ser excluido'
);

set local role postgres;

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotation_items
     set unit_price = 997
     where id = '20000000-0000-0000-0000-000000000050' $$,
  'P0001',
  'Itens de cotacao somente podem ser alterados enquanto a cotacao estiver em draft.',
  'Trigger bloqueia UPDATE direto de item ativo sem depender de RLS'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ delete from public.quotation_items
     where id = '20000000-0000-0000-0000-000000000050' $$,
  'P0001',
  'Itens de cotacao somente podem ser alterados enquanto a cotacao estiver em draft.',
  'Trigger bloqueia DELETE direto de item ativo sem depender de RLS'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ set constraints all immediate $$,
  'Constraints diferidas validam a integridade da cotacao ativa'
);
set constraints all deferred;

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations
     set status = 'cancelled'
     where id = '20000000-0000-0000-0000-000000000040' $$,
  'Admin cancela cotacao ativa'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotations
     set notes = 'Alteracao cancelada proibida'
     where id = '20000000-0000-0000-0000-000000000040' $$,
  'P0001', 'Cotacao cancelada nao pode ser alterada.',
  'Cabecalho cancelado permanece imutavel'
);

update public.quotation_items
set unit_price = 998
where id = '20000000-0000-0000-0000-000000000050';

insert into pg_temp.tap_results (result)
select is(
  (select unit_price from public.quotation_items where id = '20000000-0000-0000-0000-000000000050'),
  101.00::numeric,
  'Item de cotacao cancelada permanece imutavel'
);

set local role postgres;

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotation_items
     set unit_price = 996
     where id = '20000000-0000-0000-0000-000000000050' $$,
  'P0001',
  'Itens de cotacao somente podem ser alterados enquanto a cotacao estiver em draft.',
  'Trigger bloqueia UPDATE direto de item cancelado sem depender de RLS'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ delete from public.quotation_items
     where id = '20000000-0000-0000-0000-000000000050' $$,
  'P0001',
  'Itens de cotacao somente podem ser alterados enquanto a cotacao estiver em draft.',
  'Trigger bloqueia DELETE direto de item cancelado sem depender de RLS'
);

set local role authenticated;

-- Equipe: o mesmo fluxo operacional autorizado.
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into public.quotations (id, supplier_id, reference_number, received_at)
     values (
       '20000000-0000-0000-0000-000000000041',
       '20000000-0000-0000-0000-000000000011',
       'EQP-001', current_date
     ) $$,
  'Equipe cria cotacao em draft'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into public.quotation_items (
       id, quotation_id, supplier_description, unit_price
     ) values (
       '20000000-0000-0000-0000-000000000052',
       '20000000-0000-0000-0000-000000000041',
       'Descricao inicial Equipe', 80
     ) $$,
  'Equipe insere item sem mapeamento no draft'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations
     set reference_number = 'EQP-001-EDITADA',
         notes = 'Draft editado pela Equipe',
         created_at = '2000-01-01 00:00:00+00',
         created_by = '20000000-0000-0000-0000-000000000001'
     where id = '20000000-0000-0000-0000-000000000041';
     update public.quotation_items
     set supplier_description = 'Descricao editada Equipe',
         unit_price = 81,
         created_at = '2000-01-01 00:00:00+00',
         created_by = '20000000-0000-0000-0000-000000000001'
     where id = '20000000-0000-0000-0000-000000000052' $$,
  'Equipe edita cabecalho e item do draft'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into public.quotation_items (id, quotation_id, unit_price)
     values (
       '20000000-0000-0000-0000-000000000053',
       '20000000-0000-0000-0000-000000000041', 6
     );
     delete from public.quotation_items
     where id = '20000000-0000-0000-0000-000000000053' $$,
  'Equipe remove item enquanto a cotacao esta em draft'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotation_items
     set catalog_item_id = '20000000-0000-0000-0000-000000000031'
     where id = '20000000-0000-0000-0000-000000000052' $$,
  'Equipe mapeia item ao catalogo'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations
     set status = 'active'
     where id = '20000000-0000-0000-0000-000000000041' $$,
  'Equipe ativa cotacao valida'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select q.status = 'active'
      and qi.catalog_item_id = '20000000-0000-0000-0000-000000000031'
    from public.quotations q
    join public.quotation_items qi on qi.quotation_id = q.id
    where q.id = '20000000-0000-0000-0000-000000000041'
  ),
  'Equipe seleciona cotacao ativa e seu item mapeado'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations
     set status = 'cancelled'
     where id = '20000000-0000-0000-0000-000000000041' $$,
  'Equipe cancela cotacao ativa'
);

-- Auditoria: atribuicao pelo JWT e imutabilidade dos campos de criacao.
insert into pg_temp.tap_results (result)
select ok(
  (
    select q.created_by = '20000000-0000-0000-0000-000000000001'
      and q.updated_by = '20000000-0000-0000-0000-000000000001'
      and qi.created_by = '20000000-0000-0000-0000-000000000001'
      and qi.updated_by = '20000000-0000-0000-0000-000000000001'
    from public.quotations q
    join public.quotation_items qi on qi.quotation_id = q.id
    where q.id = '20000000-0000-0000-0000-000000000040'
  ),
  'Auditoria atribui criacao e atualizacao do fluxo Admin'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select q.created_at <> '2000-01-01 00:00:00+00'::timestamptz
      and q.created_by = '20000000-0000-0000-0000-000000000001'
      and qi.created_at <> '2000-01-01 00:00:00+00'::timestamptz
      and qi.created_by = '20000000-0000-0000-0000-000000000001'
    from public.quotations q
    join public.quotation_items qi on qi.quotation_id = q.id
    where q.id = '20000000-0000-0000-0000-000000000040'
  ),
  'Auditoria impede adulteracao dos campos de criacao do Admin'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select q.created_by = '20000000-0000-0000-0000-000000000002'
      and q.updated_by = '20000000-0000-0000-0000-000000000002'
      and qi.created_by = '20000000-0000-0000-0000-000000000002'
      and qi.updated_by = '20000000-0000-0000-0000-000000000002'
    from public.quotations q
    join public.quotation_items qi on qi.quotation_id = q.id
    where q.id = '20000000-0000-0000-0000-000000000041'
  ),
  'Auditoria atribui criacao e atualizacao do fluxo Equipe'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select q.created_at <> '2000-01-01 00:00:00+00'::timestamptz
      and q.created_by = '20000000-0000-0000-0000-000000000002'
      and qi.created_at <> '2000-01-01 00:00:00+00'::timestamptz
      and qi.created_by = '20000000-0000-0000-0000-000000000002'
    from public.quotations q
    join public.quotation_items qi on qi.quotation_id = q.id
    where q.id = '20000000-0000-0000-0000-000000000041'
  ),
  'Auditoria impede adulteracao dos campos de criacao da Equipe'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

-- RPC atomica de persistencia do draft.
insert into pg_temp.tap_results (result)
select is(
  (
    public.save_quotation_draft(
      p_quotation_id => null,
      p_expected_updated_at => null,
      p_expected_revision => null,
      p_supplier_id => '20000000-0000-0000-0000-000000000010',
      p_reference_number => 'RPC-CREATE',
      p_received_at => current_date,
      p_valid_until => null,
      p_notes => 'Criada pela RPC',
      p_items => '[]'::jsonb
    )
  ).status::text,
  'draft',
  'RPC cria nova cotacao sempre em draft'
);

insert into public.quotations (id, supplier_id, reference_number, received_at, notes)
values (
  '20000000-0000-0000-0000-000000000060',
  '20000000-0000-0000-0000-000000000010',
  'RPC-ANTES', current_date, 'Antes da troca'
);
insert into public.quotation_items (
  id, quotation_id, catalog_item_id, supplier_description, unit_price
)
values
  (
    '20000000-0000-0000-0000-000000000060',
    '20000000-0000-0000-0000-000000000060',
    '20000000-0000-0000-0000-000000000030', 'Linha A', 40
  ),
  (
    '20000000-0000-0000-0000-000000000061',
    '20000000-0000-0000-0000-000000000060',
    '20000000-0000-0000-0000-000000000031', 'Linha B', 50
  );

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ select public.save_quotation_draft(
       p_quotation_id => '20000000-0000-0000-0000-000000000060',
       p_expected_updated_at => (
         select updated_at
         from public.quotations
         where id = '20000000-0000-0000-0000-000000000060'
       ),
       p_expected_revision => (
         select revision
         from public.quotations
         where id = '20000000-0000-0000-0000-000000000060'
       ),
       p_supplier_id => '20000000-0000-0000-0000-000000000010',
       p_reference_number => 'RPC-TROCADA',
       p_received_at => current_date,
       p_valid_until => current_date + 15,
       p_notes => 'Cabecalho e itens trocados',
       p_items => '[
         {
           "id":"20000000-0000-0000-0000-000000000060",
           "catalog_item_id":"20000000-0000-0000-0000-000000000031",
           "supplier_description":"Linha A trocada",
           "supplier_item_code":"A-2",
           "unit_price":41,
           "notes":"A agora aponta para B"
         },
         {
           "id":"20000000-0000-0000-0000-000000000061",
           "catalog_item_id":"20000000-0000-0000-0000-000000000030",
           "supplier_description":"Linha B trocada",
           "supplier_item_code":"B-1",
           "unit_price":51,
           "notes":"B agora aponta para A"
         }
       ]'::jsonb
     ) $$,
  'RPC troca mapeamentos A/B e atualiza o cabecalho atomicamente'
);

insert into pg_temp.tap_results (result)
select ok(
  (select reference_number = 'RPC-TROCADA'
     and valid_until = current_date + 15
     and notes = 'Cabecalho e itens trocados'
   from public.quotations
   where id = '20000000-0000-0000-0000-000000000060')
  and (select catalog_item_id = '20000000-0000-0000-0000-000000000031'
         and supplier_item_code = 'A-2'
         and unit_price = 41
       from public.quotation_items
       where id = '20000000-0000-0000-0000-000000000060')
  and (select catalog_item_id = '20000000-0000-0000-0000-000000000030'
         and supplier_item_code = 'B-1'
         and unit_price = 51
       from public.quotation_items
       where id = '20000000-0000-0000-0000-000000000061'),
  'RPC persiste o cabecalho e o estado final da troca A/B'
);

create temporary table s02_rpc_revision_result on commit drop as
select r.id, r.revision
from public.save_quotation_draft(
  p_quotation_id => '20000000-0000-0000-0000-000000000060',
  p_expected_updated_at => (
    select updated_at
    from public.quotations
    where id = '20000000-0000-0000-0000-000000000060'
  ),
  p_expected_revision => (
    select revision
    from public.quotations
    where id = '20000000-0000-0000-0000-000000000060'
  ),
  p_supplier_id => '20000000-0000-0000-0000-000000000010',
  p_reference_number => 'RPC-TROCADA',
  p_received_at => current_date,
  p_valid_until => current_date + 15,
  p_notes => 'Cabecalho e itens trocados',
  p_items => '[
    {
      "id":"20000000-0000-0000-0000-000000000060",
      "catalog_item_id":"20000000-0000-0000-0000-000000000031",
      "supplier_description":"Linha A trocada",
      "supplier_item_code":"A-2",
      "unit_price":41,
      "notes":"A agora aponta para B"
    },
    {
      "id":"20000000-0000-0000-0000-000000000061",
      "catalog_item_id":"20000000-0000-0000-0000-000000000030",
      "supplier_description":"Linha B trocada",
      "supplier_item_code":"B-1",
      "unit_price":51,
      "notes":"B agora aponta para A"
    }
  ]'::jsonb
) r;

insert into pg_temp.tap_results (result)
select is(
  (select revision from pg_temp.s02_rpc_revision_result),
  (select revision
   from public.quotations
   where id = '20000000-0000-0000-0000-000000000060'),
  'RPC retorna a revision persistida no pai depois das mutacoes dos itens'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.save_quotation_draft(
       p_quotation_id => '20000000-0000-0000-0000-000000000060',
       p_expected_updated_at => (
         select updated_at - interval '1 microsecond'
         from public.quotations
         where id = '20000000-0000-0000-0000-000000000060'
       ),
       p_expected_revision => (
         select revision
         from public.quotations
         where id = '20000000-0000-0000-0000-000000000060'
       ),
       p_supplier_id => '20000000-0000-0000-0000-000000000010',
       p_reference_number => 'RPC-DESATUALIZADA',
       p_received_at => current_date,
       p_valid_until => current_date + 20,
       p_notes => 'Nao deve persistir por versao antiga',
       p_items => '[]'::jsonb
     ) $$,
  'P0001',
  'Cotacao desatualizada: outra alteracao foi salva. Recarregue antes de continuar.',
  'RPC rejeita versao desatualizada do draft'
);

insert into pg_temp.tap_results (result)
select ok(
  (select reference_number = 'RPC-TROCADA'
     and valid_until = current_date + 15
     and notes = 'Cabecalho e itens trocados'
   from public.quotations
   where id = '20000000-0000-0000-0000-000000000060')
  and (select catalog_item_id = '20000000-0000-0000-0000-000000000031'
         and supplier_item_code = 'A-2'
         and unit_price = 41
       from public.quotation_items
       where id = '20000000-0000-0000-0000-000000000060')
  and (select catalog_item_id = '20000000-0000-0000-0000-000000000030'
         and supplier_item_code = 'B-1'
         and unit_price = 51
       from public.quotation_items
       where id = '20000000-0000-0000-0000-000000000061'),
  'Rejeicao por versao stale preserva cabecalho e itens'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.save_quotation_draft(
       p_quotation_id => '20000000-0000-0000-0000-000000000060',
       p_expected_updated_at => (
         select updated_at
         from public.quotations
         where id = '20000000-0000-0000-0000-000000000060'
       ),
       p_expected_revision => (
         select revision
         from public.quotations
         where id = '20000000-0000-0000-0000-000000000060'
       ),
       p_supplier_id => '20000000-0000-0000-0000-000000000010',
       p_reference_number => 'RPC-INVALIDA',
       p_received_at => current_date,
       p_valid_until => current_date + 20,
       p_notes => 'Nao deve persistir',
       p_items => '[
         {
           "id":"20000000-0000-0000-0000-000000000060",
           "catalog_item_id":"20000000-0000-0000-0000-000000000034",
           "supplier_description":"Duplicada A",
           "unit_price":42
         },
         {
           "id":"20000000-0000-0000-0000-000000000061",
           "catalog_item_id":"20000000-0000-0000-0000-000000000034",
           "supplier_description":"Duplicada B",
           "unit_price":52
         }
       ]'::jsonb
     ) $$,
  '23505',
  'duplicate key value violates unique constraint "uq_quotation_item_catalog_once"',
  'RPC rejeita mapeamento final duplicado'
);

insert into pg_temp.tap_results (result)
select ok(
  (select reference_number = 'RPC-TROCADA'
     and valid_until = current_date + 15
     and notes = 'Cabecalho e itens trocados'
   from public.quotations
   where id = '20000000-0000-0000-0000-000000000060')
  and (select catalog_item_id = '20000000-0000-0000-0000-000000000031'
         and supplier_item_code = 'A-2'
         and unit_price = 41
       from public.quotation_items
       where id = '20000000-0000-0000-0000-000000000060')
  and (select catalog_item_id = '20000000-0000-0000-0000-000000000030'
         and supplier_item_code = 'B-1'
         and unit_price = 51
       from public.quotation_items
       where id = '20000000-0000-0000-0000-000000000061'),
  'Falha da RPC reverte cabecalho e itens ao estado anterior completo'
);

update public.quotations
set source_file_pending = true
where id = '20000000-0000-0000-0000-000000000060';

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.save_quotation_draft(
       p_quotation_id => '20000000-0000-0000-0000-000000000060',
       p_expected_updated_at => (
         select updated_at
         from public.quotations
         where id = '20000000-0000-0000-0000-000000000060'
       ),
       p_expected_revision => (
         select revision
         from public.quotations
         where id = '20000000-0000-0000-0000-000000000060'
       ),
       p_supplier_id => '20000000-0000-0000-0000-000000000011',
       p_reference_number => 'RPC-UPLOAD-CONCORRENTE',
       p_received_at => current_date - 1,
       p_valid_until => current_date + 30,
       p_notes => 'Nao deve persistir durante upload',
       p_items => '[]'::jsonb
     ) $$,
  'P0001',
  'O anexo da cotacao esta sendo enviado. Aguarde o envio terminar antes de salvar novamente.',
  'RPC rejeita novo save enquanto o upload do anexo esta em andamento'
);

insert into pg_temp.tap_results (result)
select ok(
  (select supplier_id = '20000000-0000-0000-0000-000000000010'
     and reference_number = 'RPC-TROCADA'
     and received_at = current_date
     and valid_until = current_date + 15
     and notes = 'Cabecalho e itens trocados'
     and source_file_pending
   from public.quotations
   where id = '20000000-0000-0000-0000-000000000060')
  and (select count(*) = 2
       from public.quotation_items
       where quotation_id = '20000000-0000-0000-0000-000000000060')
  and (select catalog_item_id = '20000000-0000-0000-0000-000000000031'
         and supplier_item_code = 'A-2'
         and unit_price = 41
       from public.quotation_items
       where id = '20000000-0000-0000-0000-000000000060')
  and (select catalog_item_id = '20000000-0000-0000-0000-000000000030'
         and supplier_item_code = 'B-1'
         and unit_price = 51
       from public.quotation_items
       where id = '20000000-0000-0000-0000-000000000061'),
  'Rejeicao durante upload preserva integralmente cabecalho e itens'
);

update public.quotations
set source_file_pending = false
where id = '20000000-0000-0000-0000-000000000060';

insert into public.quotations (
  id, supplier_id, received_at, source_file_path, source_file_pending
)
values (
  '20000000-0000-0000-0000-000000000075',
  '20000000-0000-0000-0000-000000000010', current_date,
  '20000000-0000-0000-0000-000000000075/recuperacao.pdf', true
);

insert into storage.objects (bucket_id, name, metadata)
values (
  'supplier-quotes',
  '20000000-0000-0000-0000-000000000075/recuperacao.pdf',
  '{"mimetype":"application/pdf"}'::jsonb
);

create temporary table s02_discard_observation on commit drop as
select revision as initial_revision
from public.quotations
where id = '20000000-0000-0000-0000-000000000075';

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.discard_pending_quotation_attachment(
       '20000000-0000-0000-0000-000000000075',
       (select initial_revision - 1 from pg_temp.s02_discard_observation)
     ) $$,
  'P0001',
  'Cotacao desatualizada: outra alteracao foi salva. Recarregue antes de continuar.',
  'Descarte rejeita revision stale'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select q.source_file_path = '20000000-0000-0000-0000-000000000075/recuperacao.pdf'
      and q.source_file_pending
      and q.revision = o.initial_revision
    from public.quotations q
    cross join pg_temp.s02_discard_observation o
    where q.id = '20000000-0000-0000-0000-000000000075'
  ),
  'Falha por revision stale preserva path, pending e revision'
);

insert into public.quotations (id, supplier_id, received_at)
values (
  '20000000-0000-0000-0000-000000000076',
  '20000000-0000-0000-0000-000000000010', current_date
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.discard_pending_quotation_attachment(
       '20000000-0000-0000-0000-000000000076',
       (select revision from public.quotations
        where id = '20000000-0000-0000-0000-000000000076')
     ) $$,
  'P0001',
  'A cotacao nao possui envio de anexo pendente para descartar.',
  'Descarte rejeita cotacao sem upload pendente'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ select public.discard_pending_quotation_attachment(
       '20000000-0000-0000-0000-000000000075',
       (select initial_revision from pg_temp.s02_discard_observation)
     ) $$,
  'Descarte recupera draft preso em upload pendente'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select q.source_file_path is null
      and not q.source_file_pending
      and q.revision = o.initial_revision + 1
    from public.quotations q
    cross join pg_temp.s02_discard_observation o
    where q.id = '20000000-0000-0000-0000-000000000075'
  ),
  'Descarte limpa path e pending e avanca revision'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1
    from storage.objects
    where bucket_id = 'supplier-quotes'
      and name = '20000000-0000-0000-0000-000000000075/recuperacao.pdf'
  ),
  'Descarte preserva objeto que pode ter sido concluido pelo upload concorrente'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.save_quotation_draft(
       p_quotation_id => null,
       p_expected_updated_at => null,
       p_expected_revision => null,
       p_supplier_id => '20000000-0000-0000-0000-000000000010',
       p_reference_number => 'RPC-NAN',
       p_received_at => current_date,
       p_valid_until => null,
       p_notes => null,
       p_items => '[{"unit_price":"NaN"}]'::jsonb
     ) $$,
  'P0001',
  'Cada preco unitario deve ser um decimal positivo canonico com ate 12 inteiros e 2 casas decimais.',
  'RPC rejeita unit_price NaN'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.save_quotation_draft(
       p_quotation_id => null,
       p_expected_updated_at => null,
       p_expected_revision => null,
       p_supplier_id => '20000000-0000-0000-0000-000000000010',
       p_reference_number => 'RPC-INFINITY',
       p_received_at => current_date,
       p_valid_until => null,
       p_notes => null,
       p_items => '[{"unit_price":"Infinity"}]'::jsonb
     ) $$,
  'P0001',
  'Cada preco unitario deve ser um decimal positivo canonico com ate 12 inteiros e 2 casas decimais.',
  'RPC rejeita unit_price Infinity'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.save_quotation_draft(
       p_quotation_id => null,
       p_expected_updated_at => null,
       p_expected_revision => null,
       p_supplier_id => '20000000-0000-0000-0000-000000000010',
       p_reference_number => 'RPC-NAO-CANONICO',
       p_received_at => current_date,
       p_valid_until => null,
       p_notes => null,
       p_items => '[{"unit_price":"1e2"}]'::jsonb
     ) $$,
  'P0001',
  'Cada preco unitario deve ser um decimal positivo canonico com ate 12 inteiros e 2 casas decimais.',
  'RPC rejeita unit_price em formato nao canonico'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.save_quotation_draft(
       p_quotation_id => null,
       p_expected_updated_at => null,
       p_expected_revision => null,
       p_supplier_id => '20000000-0000-0000-0000-000000000010',
       p_reference_number => 'RPC-PRECISAO',
       p_received_at => current_date,
       p_valid_until => null,
       p_notes => null,
       p_items => '[{"unit_price":"1.001"}]'::jsonb
     ) $$,
  'P0001',
  'Cada preco unitario deve ser um decimal positivo canonico com ate 12 inteiros e 2 casas decimais.',
  'RPC rejeita unit_price com precisao excessiva'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.save_quotation_draft(
       p_quotation_id => null,
       p_expected_updated_at => null,
       p_expected_revision => null,
       p_supplier_id => '20000000-0000-0000-0000-000000000010',
       p_reference_number => 'RPC-RECEBIMENTO-INFINITO',
       p_received_at => 'infinity'::date,
       p_valid_until => null,
       p_notes => null,
       p_items => '[]'::jsonb
     ) $$,
  'P0001', 'A data de recebimento deve ser uma data finita.',
  'RPC rejeita received_at infinito'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.save_quotation_draft(
       p_quotation_id => null,
       p_expected_updated_at => null,
       p_expected_revision => null,
       p_supplier_id => '20000000-0000-0000-0000-000000000010',
       p_reference_number => 'RPC-VALIDADE-INFINITA',
       p_received_at => current_date,
       p_valid_until => 'infinity'::date,
       p_notes => null,
       p_items => '[]'::jsonb
     ) $$,
  'P0001', 'A validade deve ser uma data finita.',
  'RPC rejeita valid_until infinito'
);

-- Item DML toca o pai, mas now() nao avanca dentro desta unica transacao pgTAP.
insert into public.quotations (id, supplier_id, reference_number, received_at, notes)
values (
  '20000000-0000-0000-0000-000000000080',
  '20000000-0000-0000-0000-000000000010',
  'TOUCH-ANTES', current_date, 'Estado anterior ao item DML'
);

set local role postgres;
create temporary table s02_touch_observations (
  old_updated_at timestamptz,
  old_revision bigint,
  after_insert_updated_at timestamptz,
  after_insert_revision bigint,
  after_update_updated_at timestamptz,
  after_update_revision bigint,
  after_delete_updated_at timestamptz,
  after_delete_revision bigint,
  after_insert_updated_by uuid,
  after_update_updated_by uuid,
  after_delete_updated_by uuid
) on commit drop;
insert into pg_temp.s02_touch_observations (old_updated_at, old_revision)
select updated_at, revision
from public.quotations
where id = '20000000-0000-0000-0000-000000000080';
grant select on pg_temp.s02_touch_observations to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into public.quotation_items (id, quotation_id, unit_price)
     values (
       '20000000-0000-0000-0000-000000000080',
       '20000000-0000-0000-0000-000000000080', 80
     ) $$,
  'Insert direto de item toca a cotacao draft pai'
);

set local role postgres;
update pg_temp.s02_touch_observations
set after_insert_updated_at = q.updated_at,
    after_insert_revision = q.revision,
    after_insert_updated_by = q.updated_by
from public.quotations q
where q.id = '20000000-0000-0000-0000-000000000080';

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotation_items
     set supplier_description = 'Item alterado diretamente'
     where id = '20000000-0000-0000-0000-000000000080' $$,
  'Update direto de item toca a cotacao draft pai'
);

set local role postgres;
update pg_temp.s02_touch_observations
set after_update_updated_at = q.updated_at,
    after_update_revision = q.revision,
    after_update_updated_by = q.updated_by
from public.quotations q
where q.id = '20000000-0000-0000-0000-000000000080';

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ delete from public.quotation_items
     where id = '20000000-0000-0000-0000-000000000080' $$,
  'Delete direto de item toca a cotacao draft pai'
);

set local role postgres;
update pg_temp.s02_touch_observations
set after_delete_updated_at = q.updated_at,
    after_delete_revision = q.revision,
    after_delete_updated_by = q.updated_by
from public.quotations q
where q.id = '20000000-0000-0000-0000-000000000080';

insert into pg_temp.tap_results (result)
select ok(
  (
    select after_insert_updated_at >= old_updated_at
      and after_update_updated_at >= after_insert_updated_at
      and after_delete_updated_at >= after_update_updated_at
      and old_revision = 0
      and after_insert_revision = 1
      and after_update_revision = 2
      and after_delete_revision = 3
      and after_insert_updated_by = '20000000-0000-0000-0000-000000000002'
      and after_update_updated_by = '20000000-0000-0000-0000-000000000001'
      and after_delete_updated_by = '20000000-0000-0000-0000-000000000002'
    from pg_temp.s02_touch_observations
  ),
  'Item INSERT/UPDATE/DELETE incrementa revision e atribui o toque no pai'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select after_insert_updated_at = old_updated_at
      and after_update_updated_at = old_updated_at
      and after_delete_updated_at = old_updated_at
    from pg_temp.s02_touch_observations
  ),
  'Informativo: updated_at permanece transaction-stable enquanto revision avanca'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.save_quotation_draft(
       p_quotation_id => '20000000-0000-0000-0000-000000000080',
       p_expected_updated_at => (
         select old_updated_at from pg_temp.s02_touch_observations
       ),
       p_expected_revision => (
         select old_revision from pg_temp.s02_touch_observations
       ),
       p_supplier_id => '20000000-0000-0000-0000-000000000010',
       p_reference_number => 'TOUCH-NAO-DEVE-PERSISTIR',
       p_received_at => current_date,
       p_valid_until => null,
       p_notes => 'Versao anterior ao item DML',
       p_items => '[{
         "id":"20000000-0000-0000-0000-000000000060",
         "catalog_item_id":"20000000-0000-0000-0000-000000000030",
         "unit_price":80
       }]'::jsonb
     ) $$,
  'P0001',
  'Cotacao desatualizada: outra alteracao foi salva. Recarregue antes de continuar.',
  'RPC rejeita revision capturada antes do item DML na mesma transacao'
);

set local role postgres;
insert into pg_temp.tap_results (result)
select ok(
  (select reference_number = 'TOUCH-ANTES'
     and notes = 'Estado anterior ao item DML'
     and revision = 3
     and updated_by = '20000000-0000-0000-0000-000000000002'
   from public.quotations
   where id = '20000000-0000-0000-0000-000000000080')
  and not exists (
    select 1
    from public.quotation_items
    where quotation_id = '20000000-0000-0000-0000-000000000080'
  ),
  'Rejeicao por revision stale preserva cabecalho e itens sem mudanca parcial'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

-- Constraints e guardas do ciclo de vida atual.
insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotations (supplier_id, received_at, status)
     values ('20000000-0000-0000-0000-000000000010', current_date, 'active') $$,
  'P0001', 'Nova cotacao deve ser criada em estado draft.',
  'Nova cotacao nao pode nascer fora de draft'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotations (supplier_id, received_at)
     values ('20000000-0000-0000-0000-000000000012', current_date) $$,
  'P0001', 'Fornecedor inativo: ative-o antes de registrar a cotacao.',
  'Fornecedor inativo bloqueia criacao de cotacao'
);

insert into public.quotations (id, supplier_id, received_at)
values (
  '20000000-0000-0000-0000-000000000042',
  '20000000-0000-0000-0000-000000000013', current_date
);
insert into public.quotation_items (quotation_id, catalog_item_id, unit_price)
values (
  '20000000-0000-0000-0000-000000000042',
  '20000000-0000-0000-0000-000000000034', 20
);
update public.suppliers
set active = false
where id = '20000000-0000-0000-0000-000000000013';

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotations
     set status = 'active'
     where id = '20000000-0000-0000-0000-000000000042' $$,
  'P0001', 'Fornecedor deve estar ativo para ativar a cotacao.',
  'Fornecedor inativado depois do draft bloqueia ativacao'
);

insert into public.quotations (id, supplier_id, received_at)
values (
  '20000000-0000-0000-0000-000000000043',
  '20000000-0000-0000-0000-000000000010', current_date
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotation_items (quotation_id, catalog_item_id, unit_price)
     values (
       '20000000-0000-0000-0000-000000000043',
       '20000000-0000-0000-0000-000000000032', 21
     ) $$,
  'P0001', 'Item de catalogo inativo nao pode ser usado em nova cotacao.',
  'Item inativo do catalogo bloqueia mapeamento'
);

insert into public.quotation_items (quotation_id, catalog_item_id, unit_price)
values (
  '20000000-0000-0000-0000-000000000043',
  '20000000-0000-0000-0000-000000000033', 22
);
update public.catalog_items
set active = false
where id = '20000000-0000-0000-0000-000000000033';

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotations
     set status = 'active'
     where id = '20000000-0000-0000-0000-000000000043' $$,
  'P0001', 'Itens inativos do Catalogo Efetiva nao podem participar de nova cotacao ativa.',
  'Item do catalogo inativado depois do mapeamento bloqueia ativacao'
);

insert into public.quotations (id, supplier_id, received_at)
values (
  '20000000-0000-0000-0000-000000000044',
  '20000000-0000-0000-0000-000000000010', current_date
);
insert into public.quotation_items (quotation_id, unit_price)
values ('20000000-0000-0000-0000-000000000044', 23);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotations
     set status = 'active'
     where id = '20000000-0000-0000-0000-000000000044' $$,
  'P0001', 'Mapeie todos os itens ao Catalogo Efetiva antes de ativar a cotacao.',
  'Cotacao com item sem catalogo nao pode ser ativada'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotation_items (quotation_id, unit_price)
     values ('20000000-0000-0000-0000-000000000044', 0) $$,
  '23514',
  'new row for relation "quotation_items" violates check constraint "quotation_items_unit_price_check"',
  'Preco unitario zero e rejeitado'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotation_items (quotation_id, unit_price)
     values ('20000000-0000-0000-0000-000000000044', -1) $$,
  '23514',
  'new row for relation "quotation_items" violates check constraint "quotation_items_unit_price_check"',
  'Preco unitario negativo e rejeitado'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.quotation_items'::regclass
      and conname = 'quotation_items_unit_price_finite_chk'
      and pg_get_constraintdef(oid) ilike '%NaN%'
      and pg_get_constraintdef(oid) ilike '%Infinity%'
      and pg_get_constraintdef(oid) ilike '%-Infinity%'
  ),
  'Schema possui CHECK explicito para valores numeric nao finitos'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotation_items (quotation_id, unit_price)
     values ('20000000-0000-0000-0000-000000000044', 'NaN'::numeric) $$,
  '23514',
  'new row for relation "quotation_items" violates check constraint "quotation_items_unit_price_finite_chk"',
  'CHECK direto rejeita unit_price NaN'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotation_items (quotation_id, unit_price)
     values ('20000000-0000-0000-0000-000000000044', 'Infinity'::numeric) $$,
  '22003', 'numeric field overflow',
  'Typmod numeric rejeita unit_price positivo infinito antes do CHECK'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotation_items (quotation_id, unit_price)
     values ('20000000-0000-0000-0000-000000000044', '-Infinity'::numeric) $$,
  '22003', 'numeric field overflow',
  'Typmod numeric rejeita unit_price negativo infinito antes do CHECK'
);

set local role postgres;

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.margin_rules'::regclass
      and conname = 'margin_rules_value_finite_chk'
      and convalidated
      and pg_get_constraintdef(oid) ilike '%NaN%'
      and pg_get_constraintdef(oid) ilike '%Infinity%'
      and pg_get_constraintdef(oid) ilike '%-Infinity%'
  ),
  'margin_rules.value possui CHECK validado contra numeric nao finito'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.price_list'::regclass
      and conname = 'price_list_values_finite_chk'
      and convalidated
      and pg_get_constraintdef(oid) ilike '%cost_price%'
      and pg_get_constraintdef(oid) ilike '%adjustment_value%'
      and pg_get_constraintdef(oid) ilike '%final_price%'
      and pg_get_constraintdef(oid) ilike '%best_cost_at_approval%'
      and pg_get_constraintdef(oid) ~* 'best_cost_at_approval IS NULL'
      and pg_get_constraintdef(oid) ilike '%NaN%'
      and pg_get_constraintdef(oid) ilike '%Infinity%'
      and pg_get_constraintdef(oid) ilike '%-Infinity%'
  ),
  'price_list possui CHECK validado para os quatro snapshots numeric, incluindo best_cost nullable'
);

insert into public.margin_rules (
  id, scope_type, calculation_type, value, active
)
values (
  '20000000-0000-0000-0000-000000000090',
  'global', 'percentage', 10, true
);

insert into public.price_list (
  id, catalog_item_id, source_quotation_item_id, margin_rule_id,
  cost_price, adjustment_type, adjustment_value, final_price,
  approved_by
)
values (
  '20000000-0000-0000-0000-000000000090',
  '20000000-0000-0000-0000-000000000031',
  '20000000-0000-0000-0000-000000000060',
  '20000000-0000-0000-0000-000000000090',
  41, 'percentage', 10, 45.10,
  '20000000-0000-0000-0000-000000000001'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.margin_rules
     set value = 'NaN'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '23514',
  'new row for relation "margin_rules" violates check constraint "margin_rules_value_finite_chk"',
  'CHECK direto rejeita margin_rules.value NaN'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.margin_rules
     set value = 'Infinity'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '22003', 'numeric field overflow',
  'Typmod numeric rejeita margin_rules.value positivo infinito'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.margin_rules
     set value = '-Infinity'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '22003', 'numeric field overflow',
  'Typmod numeric rejeita margin_rules.value negativo infinito'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.price_list
     set cost_price = 'NaN'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '23514',
  'new row for relation "price_list" violates check constraint "price_list_values_finite_chk"',
  'CHECK direto rejeita price_list.cost_price NaN'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.price_list
     set cost_price = 'Infinity'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '22003', 'numeric field overflow',
  'Typmod numeric rejeita price_list.cost_price positivo infinito'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.price_list
     set cost_price = '-Infinity'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '22003', 'numeric field overflow',
  'Typmod numeric rejeita price_list.cost_price negativo infinito'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.price_list
     set adjustment_value = 'NaN'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '23514',
  'new row for relation "price_list" violates check constraint "price_list_values_finite_chk"',
  'CHECK direto rejeita price_list.adjustment_value NaN'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.price_list
     set adjustment_value = 'Infinity'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '22003', 'numeric field overflow',
  'Typmod numeric rejeita price_list.adjustment_value positivo infinito'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.price_list
     set adjustment_value = '-Infinity'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '22003', 'numeric field overflow',
  'Typmod numeric rejeita price_list.adjustment_value negativo infinito'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.price_list
     set final_price = 'NaN'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '23514',
  'new row for relation "price_list" violates check constraint "price_list_values_finite_chk"',
  'CHECK direto rejeita price_list.final_price NaN'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.price_list
     set final_price = 'Infinity'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '22003', 'numeric field overflow',
  'Typmod numeric rejeita price_list.final_price positivo infinito'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.price_list
     set final_price = '-Infinity'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '22003', 'numeric field overflow',
  'Typmod numeric rejeita price_list.final_price negativo infinito'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.price_list
     set best_cost_at_approval = null
     where id = '20000000-0000-0000-0000-000000000090' $$,
  'CHECK direto permite price_list.best_cost_at_approval nulo'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.price_list
     set best_cost_at_approval = 'NaN'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '23514',
  'new row for relation "price_list" violates check constraint "price_list_values_finite_chk"',
  'CHECK direto rejeita price_list.best_cost_at_approval NaN'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.price_list
     set best_cost_at_approval = 'Infinity'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '22003', 'numeric field overflow',
  'Typmod numeric rejeita price_list.best_cost_at_approval positivo infinito'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.price_list
     set best_cost_at_approval = '-Infinity'::numeric
     where id = '20000000-0000-0000-0000-000000000090' $$,
  '22003', 'numeric field overflow',
  'Typmod numeric rejeita price_list.best_cost_at_approval negativo infinito'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

insert into pg_temp.tap_results (result)
select col_is_fk(
  'public', 'quotations', 'supplier_id',
  'Cotacao possui FK para fornecedor'
);

insert into pg_temp.tap_results (result)
select col_is_fk(
  'public', 'quotation_items', 'quotation_id',
  'Item possui FK para cotacao'
);

insert into pg_temp.tap_results (result)
select col_is_fk(
  'public', 'quotation_items', 'catalog_item_id',
  'Mapeamento possui FK para item do catalogo'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotations (supplier_id, received_at, valid_until)
     values (
       '20000000-0000-0000-0000-000000000010',
       current_date, current_date - 1
     ) $$,
  '23514',
  'new row for relation "quotations" violates check constraint "quotations_validity_chk"',
  'Validade nao pode ser anterior ao recebimento'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotations (supplier_id, received_at)
     values ('20000000-0000-0000-0000-000000000010', 'infinity'::date) $$,
  '23514',
  'new row for relation "quotations" violates check constraint "quotations_dates_finite_chk"',
  'CHECK direto rejeita received_at positivo infinito'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotations (supplier_id, received_at)
     values ('20000000-0000-0000-0000-000000000010', '-infinity'::date) $$,
  '23514',
  'new row for relation "quotations" violates check constraint "quotations_dates_finite_chk"',
  'CHECK direto rejeita received_at negativo infinito'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotations (supplier_id, received_at, valid_until)
     values (
       '20000000-0000-0000-0000-000000000010', current_date, 'infinity'::date
     ) $$,
  '23514',
  'new row for relation "quotations" violates check constraint "quotations_dates_finite_chk"',
  'CHECK direto rejeita valid_until positivo infinito'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotations (supplier_id, received_at, valid_until)
     values (
       '20000000-0000-0000-0000-000000000010', current_date, '-infinity'::date
     ) $$,
  '23514',
  'new row for relation "quotations" violates check constraint "quotations_dates_finite_chk"',
  'CHECK direto rejeita valid_until negativo infinito'
);

insert into public.quotations (id, supplier_id, received_at)
values (
  '20000000-0000-0000-0000-000000000046',
  '20000000-0000-0000-0000-000000000010', current_date
);
insert into public.quotation_items (quotation_id, catalog_item_id, unit_price)
values (
  '20000000-0000-0000-0000-000000000046',
  '20000000-0000-0000-0000-000000000034', 30
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotation_items (quotation_id, catalog_item_id, unit_price)
     values (
       '20000000-0000-0000-0000-000000000046',
       '20000000-0000-0000-0000-000000000034', 31
     ) $$,
  '23505',
  'duplicate key value violates unique constraint "uq_quotation_item_catalog_once"',
  'Item canonico nao pode se repetir na mesma cotacao'
);

insert into public.quotations (id, supplier_id, received_at)
values (
  '20000000-0000-0000-0000-000000000045',
  '20000000-0000-0000-0000-000000000010', current_date
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotations
     set status = 'active'
     where id = '20000000-0000-0000-0000-000000000045' $$,
  'P0001', 'Adicione ao menos um item antes de ativar a cotacao.',
  'Cotacao sem itens nao pode ser ativada'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotations (
       id, supplier_id, received_at, source_file_path
     ) values (
       '20000000-0000-0000-0000-000000000047',
       '20000000-0000-0000-0000-000000000010', current_date,
       'outra-cotacao/arquivo.pdf'
     ) $$,
  'P0001', 'Arquivo da cotacao deve usar o caminho <quotation_id>/arquivo.',
  'Caminho do arquivo deve iniciar pelo id da propria cotacao'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ delete from public.quotations
     where id = '20000000-0000-0000-0000-000000000045' $$,
  '42501', 'permission denied for table quotations',
  'Mesmo Admin nao possui hard delete de cotacao'
);

-- Transicoes com anexo exigem que o objeto correspondente ja exista.
insert into public.quotations (
  id, supplier_id, received_at, source_file_path
)
values (
  '20000000-0000-0000-0000-000000000072',
  '20000000-0000-0000-0000-000000000010', current_date,
  '20000000-0000-0000-0000-000000000072/ativacao.pdf'
);
insert into public.quotation_items (
  id, quotation_id, catalog_item_id, unit_price
)
values (
  '20000000-0000-0000-0000-000000000072',
  '20000000-0000-0000-0000-000000000072',
  '20000000-0000-0000-0000-000000000034', 72
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotations
     set status = 'active'
     where id = '20000000-0000-0000-0000-000000000072' $$,
  'P0001',
  'O anexo informado ainda nao foi armazenado. Aguarde o envio antes de ativar ou cancelar a cotacao.',
  'Cotacao com source_file_path sem objeto nao pode ser ativada'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values (
       'supplier-quotes',
       '20000000-0000-0000-0000-000000000072/ativacao.pdf',
       '{"mimetype":"application/pdf"}'::jsonb
     ) $$,
  'Admin armazena objeto correspondente antes da ativacao'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations
     set status = 'active'
     where id = '20000000-0000-0000-0000-000000000072' $$,
  'Cotacao com anexo armazenado pode ser ativada'
);

insert into public.quotations (
  id, supplier_id, received_at, source_file_path
)
values (
  '20000000-0000-0000-0000-000000000073',
  '20000000-0000-0000-0000-000000000010', current_date,
  '20000000-0000-0000-0000-000000000073/cancelamento.pdf'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotations
     set status = 'cancelled'
     where id = '20000000-0000-0000-0000-000000000073' $$,
  'P0001',
  'O anexo informado ainda nao foi armazenado. Aguarde o envio antes de ativar ou cancelar a cotacao.',
  'Cotacao com source_file_path sem objeto nao pode ser cancelada'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values (
       'supplier-quotes',
       '20000000-0000-0000-0000-000000000073/cancelamento.pdf',
       '{"mimetype":"application/pdf"}'::jsonb
     ) $$,
  'Admin armazena objeto correspondente antes do cancelamento'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations
     set status = 'cancelled'
     where id = '20000000-0000-0000-0000-000000000073' $$,
  'Cotacao com anexo armazenado pode ser cancelada'
);

insert into public.quotations (
  id, supplier_id, received_at, source_file_path, source_file_pending
)
values (
  '20000000-0000-0000-0000-000000000074',
  '20000000-0000-0000-0000-000000000010', current_date,
  '20000000-0000-0000-0000-000000000074/pendente.pdf', true
);
insert into public.quotation_items (
  id, quotation_id, catalog_item_id, unit_price
)
values (
  '20000000-0000-0000-0000-000000000074',
  '20000000-0000-0000-0000-000000000074',
  '20000000-0000-0000-0000-000000000034', 74
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values (
       'supplier-quotes',
       '20000000-0000-0000-0000-000000000074/pendente.pdf',
       '{"mimetype":"application/pdf"}'::jsonb
     ) $$,
  'Objeto em path estavel pode existir enquanto source_file_pending permanece true'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotations
     set status = 'active'
     where id = '20000000-0000-0000-0000-000000000074' $$,
  'P0001',
  'O anexo informado ainda nao foi armazenado. Aguarde o envio antes de ativar ou cancelar a cotacao.',
  'source_file_pending bloqueia transicao mesmo quando o objeto ja existe'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations
     set source_file_pending = false
     where id = '20000000-0000-0000-0000-000000000074' $$,
  'Draft pode confirmar source_file_pending false depois do upload'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update public.quotations
     set status = 'active'
     where id = '20000000-0000-0000-0000-000000000074' $$,
  'Transicao sucede quando pending e false e o objeto existe'
);

-- Anonimo nao recebe nenhum DML nas tabelas de Sprint 2.
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select count(*) from public.quotations $$,
  '42501', 'permission denied for table quotations',
  'Anonimo nao seleciona cotacoes'
);
insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotations (supplier_id, received_at)
     values ('20000000-0000-0000-0000-000000000010', current_date) $$,
  '42501', 'permission denied for table quotations',
  'Anonimo nao insere cotacoes'
);
insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotations set notes = 'anon' $$,
  '42501', 'permission denied for table quotations',
  'Anonimo nao atualiza cotacoes'
);
insert into pg_temp.tap_results (result)
select throws_ok(
  $$ delete from public.quotations $$,
  '42501', 'permission denied for table quotations',
  'Anonimo nao exclui cotacoes'
);
insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select count(*) from public.quotation_items $$,
  '42501', 'permission denied for table quotation_items',
  'Anonimo nao seleciona itens de cotacao'
);
insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into public.quotation_items (quotation_id, unit_price)
     values ('20000000-0000-0000-0000-000000000044', 10) $$,
  '42501', 'permission denied for table quotation_items',
  'Anonimo nao insere itens de cotacao'
);
insert into pg_temp.tap_results (result)
select throws_ok(
  $$ update public.quotation_items set unit_price = 10 $$,
  '42501', 'permission denied for table quotation_items',
  'Anonimo nao atualiza itens de cotacao'
);
insert into pg_temp.tap_results (result)
select throws_ok(
  $$ delete from public.quotation_items $$,
  '42501', 'permission denied for table quotation_items',
  'Anonimo nao exclui itens de cotacao'
);

-- Storage: metadados, policies e DML falso transacional. DELETE real usa a API no E2E.
set local role postgres;

insert into pg_temp.tap_results (result)
select ok(
  (
    select public = false
      and file_size_limit = 10485760
      and allowed_mime_types @> array[
        'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
      ]::text[]
    from storage.buckets
    where id = 'supplier-quotes'
  ),
  'Bucket de cotacoes e privado e preserva metadados aprovados'
);

insert into pg_temp.tap_results (result)
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
  'Storage possui somente a matriz esperada de policies de cotacao'
);

insert into pg_temp.tap_results (result)
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_select_internal'), 'Policy de leitura do Storage existe');
insert into pg_temp.tap_results (result)
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_insert_internal'), 'Policy de upload do Storage existe');
insert into pg_temp.tap_results (result)
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_update_internal'), 'Policy de substituicao do Storage existe');
insert into pg_temp.tap_results (result)
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_delete_admin'), 'Policy de remocao administrativa do Storage existe');

insert into pg_temp.tap_results (result)
select is((select cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_select_internal'), 'SELECT', 'Policy de leitura usa SELECT');
insert into pg_temp.tap_results (result)
select is((select cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_insert_internal'), 'INSERT', 'Policy de upload usa INSERT');
insert into pg_temp.tap_results (result)
select is((select cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_update_internal'), 'UPDATE', 'Policy de substituicao usa UPDATE');
insert into pg_temp.tap_results (result)
select is((select cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_delete_admin'), 'DELETE', 'Policy de remocao usa DELETE');

insert into pg_temp.tap_results (result)
select is((select roles::text from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_select_internal'), '{authenticated}', 'Leitura do Storage tem exatamente a role authenticated');
insert into pg_temp.tap_results (result)
select is((select roles::text from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_insert_internal'), '{authenticated}', 'Upload do Storage tem exatamente a role authenticated');
insert into pg_temp.tap_results (result)
select is((select roles::text from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_update_internal'), '{authenticated}', 'Substituicao do Storage tem exatamente a role authenticated');
insert into pg_temp.tap_results (result)
select is((select roles::text from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_delete_admin'), '{authenticated}', 'Remocao do Storage tem exatamente a role authenticated');

insert into pg_temp.tap_results (result)
select ok((select qual ilike '%supplier-quotes%' and qual ilike '%is_internal_user%' from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_select_internal'), 'Leitura exige bucket privado e usuario interno');
insert into pg_temp.tap_results (result)
select ok((select with_check ilike '%supplier-quotes%' and with_check ilike '%is_internal_user%' and with_check ilike '%foldername%' and with_check ilike '%source_file_path%' and with_check ilike '%draft%' from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_insert_internal'), 'Upload exige bucket, usuario interno, path e cotacao draft vinculada');
insert into pg_temp.tap_results (result)
select ok((select qual ilike '%supplier-quotes%' and qual ilike '%is_internal_user%' and qual ilike '%foldername%' and qual ilike '%source_file_path%' and qual ilike '%draft%' and with_check ilike '%supplier-quotes%' and with_check ilike '%is_internal_user%' and with_check ilike '%foldername%' and with_check ilike '%source_file_path%' and with_check ilike '%draft%' from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_update_internal'), 'Substituicao valida bucket, usuario interno, path e draft antes e depois');
insert into pg_temp.tap_results (result)
select ok((select qual ilike '%is_admin%' and qual ilike '%supplier-quotes%' from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'supplier_quotes_files_delete_admin'), 'Remocao exige Admin e bucket privado correto');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

insert into public.quotations (id, supplier_id, received_at, source_file_path)
values (
  '20000000-0000-0000-0000-000000000070',
  '20000000-0000-0000-0000-000000000010', current_date,
  '20000000-0000-0000-0000-000000000070/admin.pdf'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values (
       'supplier-quotes',
       '20000000-0000-0000-0000-000000000070/admin.pdf',
       '{"mimetype":"application/pdf","revision":1}'::jsonb
     ) $$,
  'Admin insere objeto falso vinculado a cotacao draft'
);

insert into pg_temp.tap_results (result)
select is(
  (select metadata ->> 'revision'
   from storage.objects
   where bucket_id = 'supplier-quotes'
     and name = '20000000-0000-0000-0000-000000000070/admin.pdf'),
  '1',
  'Admin seleciona objeto falso no bucket privado'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update storage.objects
     set metadata = '{"mimetype":"application/pdf","revision":2}'::jsonb
     where bucket_id = 'supplier-quotes'
       and name = '20000000-0000-0000-0000-000000000070/admin.pdf' $$,
  'Admin atualiza objeto falso de cotacao draft'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

insert into public.quotations (id, supplier_id, received_at, source_file_path)
values (
  '20000000-0000-0000-0000-000000000071',
  '20000000-0000-0000-0000-000000000011', current_date,
  '20000000-0000-0000-0000-000000000071/equipe.pdf'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values (
       'supplier-quotes',
       '20000000-0000-0000-0000-000000000071/equipe.pdf',
       '{"mimetype":"application/pdf","revision":1}'::jsonb
     ) $$,
  'Equipe insere objeto falso vinculado a cotacao draft'
);

insert into pg_temp.tap_results (result)
select is(
  (select metadata ->> 'revision'
   from storage.objects
   where bucket_id = 'supplier-quotes'
     and name = '20000000-0000-0000-0000-000000000071/equipe.pdf'),
  '1',
  'Equipe seleciona objeto falso no bucket privado'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$ update storage.objects
     set metadata = '{"mimetype":"application/pdf","revision":2}'::jsonb
     where bucket_id = 'supplier-quotes'
       and name = '20000000-0000-0000-0000-000000000071/equipe.pdf' $$,
  'Equipe atualiza objeto falso de cotacao draft'
);

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

insert into pg_temp.tap_results (result)
select is(
  (select count(*) from storage.objects where bucket_id = 'supplier-quotes'),
  0::bigint,
  'Anonimo nao seleciona objetos falsos do bucket privado'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('supplier-quotes', 'anon/arquivo.pdf') $$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'Anonimo nao insere objeto no bucket privado'
);

update storage.objects
set metadata = '{"anon":true}'::jsonb
where bucket_id = 'supplier-quotes';

set local role postgres;

insert into pg_temp.tap_results (result)
select ok(
  not exists (
    select 1
    from storage.objects
    where bucket_id = 'supplier-quotes'
      and metadata @> '{"anon":true}'::jsonb
  ),
  'Anonimo nao atualiza objetos do bucket privado'
);

set local role postgres;
insert into pg_temp.tap_results (result)
select * from finish();

select result
from pg_temp.tap_results
order by seq;

rollback;
