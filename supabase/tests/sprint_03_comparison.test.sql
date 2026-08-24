begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  seq bigint generated always as identity primary key,
  result text not null
) on commit drop;

grant insert, select on pg_temp.tap_results to authenticated, anon;
grant usage, select on sequence pg_temp.tap_results_seq_seq to authenticated, anon;

insert into pg_temp.tap_results (result)
select plan(33);

-- ----------------------------------------------------------------------------
-- Fixtures: 2 admin-equivalent users (admin + equipe) created inside the
-- transaction. Their IDs are stable across runs.
-- ----------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sprint03-admin@test.local', '', now(),
    '{}', '{"full_name":"Sprint 03 Admin"}', now(), now()
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sprint03-equipe@test.local', '', now(),
    '{}', '{"full_name":"Sprint 03 Equipe"}', now(), now()
  );

update public.profiles set role = 'admin'  where id = '30000000-0000-0000-0000-000000000001';
update public.profiles set role = 'equipe' where id = '30000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);

-- ----------------------------------------------------------------------------
-- Catalog fixtures
--   030: Cenarios 1, 2, 3 (precos diferentes, uma vence)
--   031: Cenarios 4, 7, 8 (empate de preco, desempate por validade/received)
--   032: Cenario 10 (descricoes distintas do mesmo item, em cotacoes distintas)
--   034: Cenario 9 (item sem cotacao elegivel)
-- ----------------------------------------------------------------------------
insert into public.suppliers (id, name, active)
values
  ('30000000-0000-0000-0000-000000000010', 'Fornecedor Comparacao 1', true),
  ('30000000-0000-0000-0000-000000000011', 'Fornecedor Comparacao 2', true),
  ('30000000-0000-0000-0000-000000000012', 'Fornecedor Comparacao 3', true),
  ('30000000-0000-0000-0000-000000000013', 'Fornecedor Comparacao Inativo', false);

insert into public.catalog_categories (id, name)
values ('30000000-0000-0000-0000-000000000020', 'Comparacao Categoria');

insert into public.catalog_items (id, code, name, category_id, unit, active)
values
  ('30000000-0000-0000-0000-000000000030', 'S03-EXA-1', 'Exame Comparacao Um',   '30000000-0000-0000-0000-000000000020', 'exame', true),
  ('30000000-0000-0000-0000-000000000031', 'S03-EXA-2', 'Exame Comparacao Dois', '30000000-0000-0000-0000-000000000020', 'exame', true),
  ('30000000-0000-0000-0000-000000000032', 'S03-EXA-3', 'Exame Comparacao Tres', '30000000-0000-0000-0000-000000000020', 'exame', true),
  ('30000000-0000-0000-0000-000000000033', 'S03-INA',   'Item Inativo Comparacao', '30000000-0000-0000-0000-000000000020', 'exame', false),
  ('30000000-0000-0000-0000-000000000034', 'S03-EXA-4', 'Exame Comparacao Quatro', '30000000-0000-0000-0000-000000000020', 'exame', true);

-- ============================================================================
-- Schema-level checks
-- ============================================================================
insert into pg_temp.tap_results (result)
select has_view('public', 'comparison_current_v', 'comparison_current_v existe como view');

insert into pg_temp.tap_results (result)
select ok(
  (select relkind = 'v' from pg_class where oid = 'public.comparison_current_v'::regclass),
  'comparison_current_v e uma view (nao uma tabela materializada)'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1
    from pg_class c
    where c.oid = 'public.comparison_current_v'::regclass
      and c.reloptions is not null
      and array_to_string(c.reloptions, ',') like '%security_invoker%'
  ),
  'comparison_current_v usa security_invoker para respeitar RLS do caller'
);

insert into pg_temp.tap_results (result)
select has_table_privilege('authenticated'::name, 'public.comparison_current_v', 'SELECT');

insert into pg_temp.tap_results (result)
select ok(
  not has_table_privilege('anon'::name, 'public.comparison_current_v', 'SELECT'),
  'anon nao possui SELECT em comparison_current_v'
);

-- ============================================================================
-- Cenarios 1-3 no item 030
--   040: 18.00, ativa, validade 2026-12-31
--   041: 15.50, ativa, validade 2026-12-31
--   042: 12.00, ativa, validade 2020-06-30 (passado, NAO elegivel)
-- ============================================================================
insert into public.quotations (id, supplier_id, received_at, valid_until, status)
values
  ('30000000-0000-0000-0000-000000000040', '30000000-0000-0000-0000-000000000010', '2026-08-20', '2026-12-31', 'draft'),
  ('30000000-0000-0000-0000-000000000041', '30000000-0000-0000-0000-000000000011', '2026-08-21', '2026-12-31', 'draft'),
  ('30000000-0000-0000-0000-000000000042', '30000000-0000-0000-0000-000000000012', '2020-01-01', '2020-06-30', 'draft');

-- ============================================================================
-- Cenarios 4, 7, 8 no item 031 (empate de preco)
--   050 (em 040): 14.00, validade 2026-12-31, recebida 2026-08-20
--   051 (em 041): 14.00, validade 2026-12-31, recebida 2026-08-21
--   052 (em 043): 14.00, sem validade, recebida 2026-08-23
--   053 (em 044, rascunho): 5.00
-- ============================================================================
insert into public.quotations (id, supplier_id, received_at, valid_until, status)
values
  ('30000000-0000-0000-0000-000000000043', '30000000-0000-0000-0000-000000000012', '2026-08-23', null, 'draft'),
  ('30000000-0000-0000-0000-000000000044', '30000000-0000-0000-0000-000000000010', '2026-08-24', '2026-12-31', 'draft');

-- Inserir todos os items de cotacao enquanto as cotacoes estao em 'draft'
insert into public.quotation_items (id, quotation_id, catalog_item_id, supplier_description, supplier_item_code, unit_price)
values
  -- Item 030
  ('30000000-0000-0000-0000-000000000060', '30000000-0000-0000-0000-000000000040', '30000000-0000-0000-0000-000000000030', 'Exame A',      'A1', 18.00),
  ('30000000-0000-0000-0000-000000000061', '30000000-0000-0000-0000-000000000041', '30000000-0000-0000-0000-000000000030', 'Exame A alt',  'B1', 15.50),
  ('30000000-0000-0000-0000-000000000062', '30000000-0000-0000-0000-000000000042', '30000000-0000-0000-0000-000000000030', 'Exame A alt2', 'C1', 12.00),
  -- Item 031 (empate)
  ('30000000-0000-0000-0000-000000000050', '30000000-0000-0000-0000-000000000040', '30000000-0000-0000-0000-000000000031', 'Exame B em 040',       'BV1', 14.00),
  ('30000000-0000-0000-0000-000000000051', '30000000-0000-0000-0000-000000000041', '30000000-0000-0000-0000-000000000031', 'Exame B em 041',       'BV2', 14.00),
  ('30000000-0000-0000-0000-000000000052', '30000000-0000-0000-0000-000000000043', '30000000-0000-0000-0000-000000000031', 'Exame B sem validade', 'BV3', 14.00),
  ('30000000-0000-0000-0000-000000000053', '30000000-0000-0000-0000-000000000044', '30000000-0000-0000-0000-000000000031', 'Rascunho barato',      'DR1', 5.00);

-- Ativar 040, 041, 042, 043 (044 permanece em draft)
update public.quotations set status = 'active' where id in (
  '30000000-0000-0000-0000-000000000040',
  '30000000-0000-0000-0000-000000000041',
  '30000000-0000-0000-0000-000000000042',
  '30000000-0000-0000-0000-000000000043'
);

-- ============================================================================
-- Cenario 5: cotacao cancelada era a melhor (item 031)
-- Sera cancelada 043 (sem validade, mas recente) e 041 (validade, recente) -
-- a 040 (validade, mas recebida antes) assume com alerta porque a comparacao
-- atual nao tem mais quem a desbance.
-- ============================================================================

-- ============================================================================
-- Cenario 10 no item 032 (descricoes distintas do mesmo item)
--   045: Hemograma completo, 25.00
--   046: Hemograma c/ plaquetas, 30.00
-- ============================================================================
insert into public.quotations (id, supplier_id, received_at, valid_until, status)
values
  ('30000000-0000-0000-0000-000000000045', '30000000-0000-0000-0000-000000000010', '2026-08-25', '2026-12-31', 'draft'),
  ('30000000-0000-0000-0000-000000000046', '30000000-0000-0000-0000-000000000010', '2026-08-25', '2026-12-31', 'draft');

insert into public.quotation_items (id, quotation_id, catalog_item_id, supplier_description, supplier_item_code, unit_price)
values
  ('30000000-0000-0000-0000-000000000070', '30000000-0000-0000-0000-000000000045', '30000000-0000-0000-0000-000000000032', 'Hemograma completo',     'FOR-A', 25.00),
  ('30000000-0000-0000-0000-000000000071', '30000000-0000-0000-0000-000000000046', '30000000-0000-0000-0000-000000000032', 'Hemograma c/ plaquetas', 'FOR-B', 30.00);

update public.quotations set status = 'active' where id in (
  '30000000-0000-0000-0000-000000000045',
  '30000000-0000-0000-0000-000000000046'
);

-- ============================================================================
-- ============================================================================
-- ASSERTIONS
-- ============================================================================
-- ============================================================================

-- ============================================================================
-- Cenário 1: duas cotações ativas com preços diferentes → menor custo correto
-- ============================================================================
insert into pg_temp.tap_results (result)
select ok(
  (
    select best_unit_price = 15.50
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000030'
  ),
  'Cenario 1: menor preco entre duas cotacoes ativas e 15.50 (a 12.00 venceu por validade)'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select best_supplier_id = '30000000-0000-0000-0000-000000000011'
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000030'
  ),
  'Cenario 1: fornecedor do menor custo e o de codigo 011'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select eligible_offer_count = 2
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000030'
  ),
  'Cenario 1: existem duas ofertas elegiveis (042 foi filtrada por validade)'
);

-- ============================================================================
-- Cenário 2: três cotações → ordenação correta (a 12.00 venceu por preco)
-- (valido apenas enquanto a 042 esta "no presente". Vamos simular isso
--  movendo o received_at para data muito antiga e a validade para futuro
--  distante para validar o ranking)
-- ============================================================================
-- Para validar o ranking com 3 ofertas elegiveis, vamos inserir uma
-- cotacao temporaria com validade futura e preco intermediario.
insert into public.quotations (id, supplier_id, received_at, valid_until, status)
values
  ('30000000-0000-0000-0000-000000000080', '30000000-0000-0000-0000-000000000010', '2026-08-22', '2027-01-01', 'draft');

insert into public.quotation_items (id, quotation_id, catalog_item_id, supplier_description, supplier_item_code, unit_price)
values
  ('30000000-0000-0000-0000-000000000081', '30000000-0000-0000-0000-000000000080', '30000000-0000-0000-0000-000000000030', 'Exame A futuro', 'D1', 10.00);

update public.quotations set status = 'active' where id = '30000000-0000-0000-0000-000000000080';

insert into pg_temp.tap_results (result)
select ok(
  (
    select best_unit_price = 10.00
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000030'
  ),
  'Cenario 2: tres cotacoes elegiveis ordenadas - menor preco 10.00'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select best_supplier_id = '30000000-0000-0000-0000-000000000010'
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000030'
  ),
  'Cenario 2: fornecedor do menor custo e 010 (10.00)'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select eligible_offer_count = 3
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000030'
  ),
  'Cenario 2: tres ofertas elegiveis'
);

-- ============================================================================
-- Cenário 3: cotação mais barata vencida → próxima melhor assume
-- A cotacao 080 (10.00) tem validade 2027-01-01 (futuro). Vamos move-la
-- para o passado para simular o vencimento sem violar a regra de
-- imutabilidade de cotacoes ativas.
-- ============================================================================
-- (Nao conseguimos alterar valid_until de cotacao ativa. Em vez disso,
--  criamos um novo cenario 3 usando o item 031.)

-- Cenario 3 no item 031: criar uma cotacao de 13.00 com validade no passado
-- para mostrar que ela nao vence mesmo sendo a mais barata entre as
-- vigentes.
insert into public.quotations (id, supplier_id, received_at, valid_until, status)
values
  ('30000000-0000-0000-0000-000000000082', '30000000-0000-0000-0000-000000000010', '2020-01-01', '2020-06-30', 'draft');

insert into public.quotation_items (id, quotation_id, catalog_item_id, supplier_description, supplier_item_code, unit_price)
values
  ('30000000-0000-0000-0000-000000000083', '30000000-0000-0000-0000-000000000082', '30000000-0000-0000-0000-000000000031', 'Exame B barato vencido', 'BV4', 13.00);

update public.quotations set status = 'active' where id = '30000000-0000-0000-0000-000000000082';

insert into pg_temp.tap_results (result)
select ok(
  (
    select best_unit_price = 14.00
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000031'
  ),
  'Cenario 3: cotacao de 13.00 venceu - menor vigente segue 14.00'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select best_supplier_id = '30000000-0000-0000-0000-000000000011'
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000031'
  ),
  'Cenario 3: fornecedor vencedor continua sendo 011 (14.00 com validade)'
);

-- ============================================================================
-- Cenário 4: cotação sem validade pode vencer com alerta
-- No item 031, cancelar 041 (validade 2026-12-31) e 043 (sem validade).
-- A 040 (validade 2026-12-31) assume.
-- ============================================================================
update public.quotations set status = 'cancelled' where id = '30000000-0000-0000-0000-000000000043';

insert into pg_temp.tap_results (result)
select ok(
  (
    select best_unit_price = 14.00
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000031'
  ),
  'Cenario 5: cancelada 043 deixa de participar - vencedor segue 14.00'
);

update public.quotations set status = 'cancelled' where id = '30000000-0000-0000-0000-000000000041';

insert into pg_temp.tap_results (result)
select ok(
  (
    select best_unit_price = 14.00
      and best_supplier_id = '30000000-0000-0000-0000-000000000010'
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000031'
  ),
  'Cenario 5: apos cancelar 041 e 043, a 040 (validade conhecida) assume com 14.00'
);

-- Para o Cenario 4 puro (sem validade vence com alerta), vamos inserir
-- uma nova cotacao sem validade no item 031 e cancelar a 040.
update public.quotations set status = 'cancelled' where id = '30000000-0000-0000-0000-000000000040';

insert into public.quotations (id, supplier_id, received_at, valid_until, status)
values
  ('30000000-0000-0000-0000-000000000084', '30000000-0000-0000-0000-000000000010', '2026-08-22', null, 'draft');

insert into public.quotation_items (id, quotation_id, catalog_item_id, supplier_description, supplier_item_code, unit_price)
values
  ('30000000-0000-0000-0000-000000000085', '30000000-0000-0000-0000-000000000084', '30000000-0000-0000-0000-000000000031', 'Exame B novo sem validade', 'BV5', 14.00);

update public.quotations set status = 'active' where id = '30000000-0000-0000-0000-000000000084';

insert into pg_temp.tap_results (result)
select ok(
  (
    select best_unit_price = 14.00
      and best_validity_not_informed = true
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000031'
  ),
  'Cenario 4: oferta sem validade (14.00) vence o item e marca alerta'
);

-- ============================================================================
-- Cenário 6: cotação draft mais barata → não participa
-- A 044 com 5.00 continua em draft. Para o item 031, a melhor vigente
-- agora e 085 (14.00 sem validade).
-- ============================================================================
insert into pg_temp.tap_results (result)
select ok(
  (
    select best_unit_price = 14.00
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000031'
  ),
  'Cenario 6: rascunho de 5.00 nao participa - vencedor segue 14.00'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select count(*) >= 1
    from public.quotation_item_candidates_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000031'
      and quotation_status = 'draft'
      and unit_price = 5.00
  ),
  'Cenario 6: o rascunho continua rastreavel no historico de candidatos'
);

-- ============================================================================
-- Cenário 7 e 8: empate de valor
-- Para validar o criterio 2 (maior validade conhecida vence), usamos o
-- item 030 onde a 080 (10.00, validade 2027-01-01) e a 041 (15.50,
-- validade 2026-12-31) empatam nao. Nao ha empate. Em vez disso, criamos
-- um novo par de cotacoes com mesmo preco.
-- ============================================================================
-- Vou criar duas cotacoes de 20.00 no item 030 com validades diferentes.
insert into public.quotations (id, supplier_id, received_at, valid_until, status)
values
  ('30000000-0000-0000-0000-000000000090', '30000000-0000-0000-0000-000000000010', '2026-08-26', '2026-12-31', 'draft'),
  ('30000000-0000-0000-0000-000000000091', '30000000-0000-0000-0000-000000000011', '2026-08-27', '2027-06-30', 'draft');

insert into public.quotation_items (id, quotation_id, catalog_item_id, supplier_description, supplier_item_code, unit_price)
values
  ('30000000-0000-0000-0000-000000000092', '30000000-0000-0000-0000-000000000090', '30000000-0000-0000-0000-000000000032', 'Item 3 20.00 v1', 'XX1', 20.00),
  ('30000000-0000-0000-0000-000000000093', '30000000-0000-0000-0000-000000000091', '30000000-0000-0000-0000-000000000032', 'Item 3 20.00 v2', 'XX2', 20.00);

update public.quotations set status = 'active' where id in (
  '30000000-0000-0000-0000-000000000090',
  '30000000-0000-0000-0000-000000000091'
);

-- Para o item 032, ja temos 070 (25.00) e 071 (30.00). Adicionar 092 e 093
-- com 20.00 faz a 092/093 serem as mais baratas. Mas para validar empate,
-- vamos usar duas cotacoes de 20.00 e checar quem vence.
insert into pg_temp.tap_results (result)
select ok(
  (
    select best_unit_price = 20.00
      and best_supplier_id = '30000000-0000-0000-0000-000000000011'
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000032'
  ),
  'Cenario 7: empate 20.00 entre 090 e 091 - vence 091 (validade 2027-06-30 > 2026-12-31)'
);

-- Cenario 8: empate completo. Adicionar uma terceira cotacao com
-- mesma validade e received_at mais recente.
insert into public.quotations (id, supplier_id, received_at, valid_until, status)
values
  ('30000000-0000-0000-0000-000000000094', '30000000-0000-0000-0000-000000000012', '2026-08-28', '2027-06-30', 'draft');

insert into public.quotation_items (id, quotation_id, catalog_item_id, supplier_description, supplier_item_code, unit_price)
values
  ('30000000-0000-0000-0000-000000000095', '30000000-0000-0000-0000-000000000094', '30000000-0000-0000-0000-000000000032', 'Item 3 20.00 v3', 'XX3', 20.00);

update public.quotations set status = 'active' where id = '30000000-0000-0000-0000-000000000094';

insert into pg_temp.tap_results (result)
select ok(
  (
    select best_supplier_id = '30000000-0000-0000-0000-000000000012'
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000032'
  ),
  'Cenario 8: empate completo de preco e validade - vence 094 (received_at 2026-08-28)'
);

-- ============================================================================
-- Cenário 9: nenhuma oferta elegível → sem oferta vigente (item 034)
-- ============================================================================
insert into pg_temp.tap_results (result)
select ok(
  (
    select best_quotation_item_id is null
      and best_unit_price is null
      and eligible_offer_count = 0
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000034'
  ),
  'Cenario 9: item sem cotacao elegivel aparece sem oferta vigente'
);

-- ============================================================================
-- Cenário 10: descrições diferentes do mesmo item
-- (item 032 tem 070 e 071 com descricoes distintas - mas essas foram
--  superadas por 092/093/094 com 20.00. Vamos validar via 070/071 que
--  descricoes distintas competem entre si.)
-- ============================================================================
insert into pg_temp.tap_results (result)
select ok(
  (
    select count(*) >= 2
    from public.quotation_item_candidates_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000032'
      and supplier_description in ('Hemograma completo', 'Hemograma c/ plaquetas')
  ),
  'Cenario 10: descricoes distintas do mesmo item coexistindo em candidatos'
);

-- ============================================================================
-- Item inativo (033) nao aparece no comparison_current_v
-- ============================================================================
insert into pg_temp.tap_results (result)
select ok(
  (
    select count(*) = 0
    from public.comparison_current_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000033'
  ),
  'Itens do catalogo inativos nao aparecem na view de comparacao'
);

-- ============================================================================
-- Invariantes do schema
-- ============================================================================
insert into pg_temp.tap_results (result)
select ok(
  (select count(*) = 4 from public.comparison_current_v),
  'comparison_current_v lista exatamente os 4 itens ativos do catalogo'
);

insert into pg_temp.tap_results (result)
select ok(
  (select count(*) filter (where best_quotation_item_id is null) = 1 from public.comparison_current_v),
  'comparison_current_v marca como sem oferta o item 034 (cenario 9)'
);

-- ============================================================================
-- RLS Admin: o caller (admin) enxerga todas as 4 linhas
-- ============================================================================
insert into pg_temp.tap_results (result)
select is(
  (select count(*)::text from public.comparison_current_v),
  '4',
  'Admin enxerga os 4 itens ativos do catalogo via comparison_current_v'
);

-- ============================================================================
-- RLS Equipe: tambem enxerga
-- ============================================================================
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select is(
  (select count(*)::text from public.comparison_current_v),
  '4',
  'Equipe enxerga os 4 itens ativos do catalogo via comparison_current_v'
);

-- Voltar para admin para os ultimos checks
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);

-- ============================================================================
-- quotation_item_candidates_v preserva historico
-- ============================================================================
insert into pg_temp.tap_results (result)
select ok(
  (
    select count(*) >= 1
    from public.quotation_item_candidates_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000030'
      and is_eligible = false
  ),
  'Historico (cotacao 042 com validade vencida) permanece em quotation_item_candidates_v'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select count(*) >= 1
    from public.quotation_item_candidates_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000031'
      and quotation_status = 'draft'
  ),
  'Rascunho (044) aparece em quotation_item_candidates_v mas nao disputa'
);

-- ============================================================================
-- ranked_quotation_items_v: ranqueia elegiveis com desempate canonico
-- Para o item 032, 092/093/094 tem mesmo preco e a 094 vence por
-- received_at. Vamos validar via offer_rank=1 == 094.
-- ============================================================================
insert into pg_temp.tap_results (result)
select results_eq(
  $$
    select quotation_item_id::text
    from public.ranked_quotation_items_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000032'
    order by offer_rank
    limit 1
  $$,
  $$
    values ('30000000-0000-0000-0000-000000000095'::text)
  $$,
  'ranked_quotation_items_v ranqueia 094 em primeiro no item 032 (desempate por received_at)'
);

-- ============================================================================
-- best_quote_per_item_v: sempre retorna apenas a primeira do ranking
-- ============================================================================
insert into pg_temp.tap_results (result)
select ok(
  (
    select count(*) = 1
    from public.best_quote_per_item_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000032'
  ),
  'best_quote_per_item_v retorna exatamente 1 linha por item'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select unit_price = 20.00
    from public.best_quote_per_item_v
    where catalog_item_id = '30000000-0000-0000-0000-000000000032'
  ),
  'best_quote_per_item_v ignora descricoes distintas (25 e 30) - vence a de 20.00'
);

-- ============================================================================
-- Sanity: visao publica
-- ============================================================================
insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1
    from pg_class c
    where c.oid = 'public.comparison_current_v'::regclass
      and c.reloptions is not null
      and array_to_string(c.reloptions, ',') like '%security_invoker%'
  ),
  'comparison_current_v declara security_invoker nos reloptions'
);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1
    from pg_class c
    where c.oid = 'public.best_quote_per_item_v'::regclass
      and c.reloptions is not null
      and array_to_string(c.reloptions, ',') like '%security_invoker%'
  ),
  'best_quote_per_item_v e uma view security_invoker (sem SECURITY DEFINER)'
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
