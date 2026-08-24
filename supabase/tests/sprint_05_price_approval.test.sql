begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  seq bigint generated always as identity primary key,
  result text not null
) on commit drop;

create temporary table decision_tokens (
  name text primary key,
  token text not null
) on commit drop;

grant insert, select on pg_temp.tap_results to authenticated, anon;
grant usage, select on sequence pg_temp.tap_results_seq_seq to authenticated, anon;
grant insert, select, update on pg_temp.decision_tokens to authenticated;

insert into pg_temp.tap_results (result)
select plan(48);

-- Fixtures are transaction-local and use fixed IDs to keep failures readable.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sprint05-admin@test.local', '', now(),
    '{}', '{"full_name":"Sprint 05 Admin"}', now(), now()
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sprint05-equipe@test.local', '', now(),
    '{}', '{"full_name":"Sprint 05 Equipe"}', now(), now()
  );

update public.profiles set role = 'admin'
where id = '50000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);

insert into public.suppliers (id, name)
values
  ('50000000-0000-0000-0000-000000000010', 'Fornecedor A Sprint 05'),
  ('50000000-0000-0000-0000-000000000011', 'Fornecedor B Sprint 05');

insert into public.catalog_categories (id, name)
values ('50000000-0000-0000-0000-000000000020', 'Categoria Sprint 05');

insert into public.catalog_items (id, code, name, category_id, unit)
values
  ('50000000-0000-0000-0000-000000000030', 'S05-A', 'Item percentual', '50000000-0000-0000-0000-000000000020', 'un'),
  ('50000000-0000-0000-0000-000000000031', 'S05-B', 'Item fixo', '50000000-0000-0000-0000-000000000020', 'un'),
  ('50000000-0000-0000-0000-000000000032', 'S05-C', 'Item de outra origem', '50000000-0000-0000-0000-000000000020', 'un');

insert into public.margin_rules (
  id, scope_type, catalog_item_id, calculation_type, value
)
values
  ('50000000-0000-0000-0000-000000000060', 'global', null, 'percentage', 12.5000),
  ('50000000-0000-0000-0000-000000000061', 'item', '50000000-0000-0000-0000-000000000031', 'fixed', 2.3450);

insert into public.quotations (
  id, supplier_id, reference_number, received_at, valid_until
)
values
  ('50000000-0000-0000-0000-000000000040', '50000000-0000-0000-0000-000000000010', 'S05-A-BEST', current_date - 5, current_date + 30),
  ('50000000-0000-0000-0000-000000000041', '50000000-0000-0000-0000-000000000011', 'S05-A-MANUAL', current_date - 4, current_date + 20),
  ('50000000-0000-0000-0000-000000000042', '50000000-0000-0000-0000-000000000010', 'S05-B-BEST', current_date - 5, current_date + 30),
  ('50000000-0000-0000-0000-000000000043', '50000000-0000-0000-0000-000000000011', 'S05-C-WRONG', current_date - 5, current_date + 30),
  ('50000000-0000-0000-0000-000000000044', '50000000-0000-0000-0000-000000000010', 'S05-B-EXPIRED', current_date - 10, current_date - 1),
  ('50000000-0000-0000-0000-000000000045', '50000000-0000-0000-0000-000000000011', 'S05-B-CANCELLED', current_date - 5, current_date + 30),
  ('50000000-0000-0000-0000-000000000046', '50000000-0000-0000-0000-000000000011', 'S05-B-DRAFT', current_date - 1, current_date + 30);

insert into public.quotation_items (
  id, quotation_id, catalog_item_id, supplier_description, unit_price
)
values
  ('50000000-0000-0000-0000-000000000050', '50000000-0000-0000-0000-000000000040', '50000000-0000-0000-0000-000000000030', 'A melhor inicial', 10.01),
  ('50000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000041', '50000000-0000-0000-0000-000000000030', 'A manual elegivel', 12.00),
  ('50000000-0000-0000-0000-000000000052', '50000000-0000-0000-0000-000000000042', '50000000-0000-0000-0000-000000000031', 'B melhor', 6.70),
  ('50000000-0000-0000-0000-000000000053', '50000000-0000-0000-0000-000000000043', '50000000-0000-0000-0000-000000000032', 'C item diferente', 5.00),
  ('50000000-0000-0000-0000-000000000054', '50000000-0000-0000-0000-000000000044', '50000000-0000-0000-0000-000000000031', 'B vencida', 5.00),
  ('50000000-0000-0000-0000-000000000055', '50000000-0000-0000-0000-000000000045', '50000000-0000-0000-0000-000000000031', 'B cancelada', 5.10),
  ('50000000-0000-0000-0000-000000000056', '50000000-0000-0000-0000-000000000046', '50000000-0000-0000-0000-000000000031', 'B rascunho', 4.90);

update public.quotations
set status = 'active'
where id in (
  '50000000-0000-0000-0000-000000000040',
  '50000000-0000-0000-0000-000000000041',
  '50000000-0000-0000-0000-000000000042',
  '50000000-0000-0000-0000-000000000043',
  '50000000-0000-0000-0000-000000000044',
  '50000000-0000-0000-0000-000000000045'
);

update public.quotations set status = 'cancelled'
where id = '50000000-0000-0000-0000-000000000045';

-- Signatures and grants introduced by the CAS migration.
insert into pg_temp.tap_results (result)
select ok(
  to_regprocedure('public.price_decision_token(uuid)') is not null
    and to_regprocedure('public.approve_price(uuid,text,uuid)') is not null
    and to_regprocedure('public.inactivate_price(uuid,text)') is not null,
  'ETAPA 05: assinaturas CAS existem'
);

insert into pg_temp.tap_results (result)
select ok(
  to_regprocedure('public.approve_price(uuid,uuid)') is null
    and to_regprocedure('public.inactivate_price(uuid)') is null,
  'ETAPA 05: assinaturas antigas foram removidas'
);

insert into pg_temp.tap_results (result)
select ok(
  has_function_privilege('authenticated', 'public.price_decision_token(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.approve_price(uuid,text,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.inactivate_price(uuid,text)', 'EXECUTE'),
  'ETAPA 05: authenticated possui EXECUTE nas RPCs CAS'
);

insert into pg_temp.tap_results (result)
select ok(
  not has_function_privilege('anon', 'public.price_decision_token(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.approve_price(uuid,text,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.inactivate_price(uuid,text)', 'EXECUTE'),
  'ETAPA 05: anon nao possui EXECUTE nas RPCs CAS'
);

insert into pg_temp.tap_results (result)
select ok(
  has_table_privilege('authenticated', 'public.price_list', 'SELECT')
    and has_table_privilege('authenticated', 'public.pricing_comparison_v', 'SELECT')
    and not has_table_privilege('authenticated', 'public.price_list', 'INSERT')
    and not has_table_privilege('authenticated', 'public.price_list', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.price_list', 'DELETE'),
  'ETAPA 05: tabela comercial e somente leitura direta para authenticated'
);

-- Automatic approval uses the best source and server-side percentage pricing.
insert into pg_temp.tap_results (result)
select ok(
  length(public.price_decision_token('50000000-0000-0000-0000-000000000030')) = 32,
  'Token de decisao e emitido para item ativo e usuario interno'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$
    select public.approve_price(
      '50000000-0000-0000-0000-000000000030',
      public.price_decision_token('50000000-0000-0000-0000-000000000030')
    )
  $$,
  'Admin aprova automaticamente a melhor fonte elegivel'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select source_quotation_item_id = '50000000-0000-0000-0000-000000000050'
      and best_quotation_item_id_at_approval = '50000000-0000-0000-0000-000000000050'
      and cost_price = 10.01
      and best_cost_at_approval = 10.01
      and not manual_source
    from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Aprovacao automatica persiste fonte, custo, melhor oferta e flag de origem'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select adjustment_type = 'percentage'
      and adjustment_value = 12.5000
      and final_price = 11.26
    from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Percentual e calculado no servidor e arredondado para duas casas'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select persisted_status = 'approved' and effective_status = 'approved'
    from public.pricing_comparison_v
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Status persistido e efetivo iniciam aprovados'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select approved_by = '50000000-0000-0000-0000-000000000001'
      and approved_at is not null
      and source_valid_until = current_date + 30
    from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Snapshot registra validade, aprovador e data de aprovacao'
);

-- Fixed adjustment keeps rule precision but rounds the commercial price.
insert into pg_temp.tap_results (result)
select lives_ok(
  $$
    select public.approve_price(
      '50000000-0000-0000-0000-000000000031',
      public.price_decision_token('50000000-0000-0000-0000-000000000031')
    )
  $$,
  'Admin aprova item com acrescimo fixo'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select cost_price = 6.70
      and adjustment_type = 'fixed'
      and adjustment_value = 2.3450
      and final_price = 9.05
    from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000031'
  ),
  'Fixo 2,345 sobre 6,70 e calculado no servidor e arredondado para 9,05'
);

-- Token validation precedes all business mutations.
insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.approve_price('50000000-0000-0000-0000-000000000031', null) $$,
  'P0001',
  'Decisao de preco desatualizada: ofertas, regra ou aprovacao mudaram. Recarregue antes de continuar.',
  'Token nulo e rejeitado'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$ select public.approve_price('50000000-0000-0000-0000-000000000031', 'token-forjado') $$,
  'P0001',
  'Decisao de preco desatualizada: ofertas, regra ou aprovacao mudaram. Recarregue antes de continuar.',
  'Token forjado e rejeitado'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$
    select public.approve_price(
      '50000000-0000-0000-0000-000000000031',
      public.price_decision_token('50000000-0000-0000-0000-000000000031'),
      '50000000-0000-0000-0000-000000000053'
    )
  $$,
  'P0001',
  'A fonte selecionada nao e elegivel para este item.',
  'Fonte pertencente a outro item e rejeitada'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$
    select public.approve_price(
      '50000000-0000-0000-0000-000000000031',
      public.price_decision_token('50000000-0000-0000-0000-000000000031'),
      '50000000-0000-0000-0000-000000000054'
    )
  $$,
  'P0001',
  'A fonte selecionada nao e elegivel para este item.',
  'Fonte vencida e rejeitada'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$
    select public.approve_price(
      '50000000-0000-0000-0000-000000000031',
      public.price_decision_token('50000000-0000-0000-0000-000000000031'),
      '50000000-0000-0000-0000-000000000055'
    )
  $$,
  'P0001',
  'A fonte selecionada nao e elegivel para este item.',
  'Fonte cancelada e rejeitada'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$
    select public.approve_price(
      '50000000-0000-0000-0000-000000000031',
      public.price_decision_token('50000000-0000-0000-0000-000000000031'),
      '50000000-0000-0000-0000-000000000056'
    )
  $$,
  'P0001',
  'A fonte selecionada nao e elegivel para este item.',
  'Fonte em rascunho e rejeitada'
);

-- A new best offer invalidates the old screen without overwriting snapshots.
insert into pg_temp.decision_tokens (name, token)
values (
  'before_offer_change',
  public.price_decision_token('50000000-0000-0000-0000-000000000030')
);

insert into public.quotations (
  id, supplier_id, reference_number, received_at, valid_until
)
values (
  '50000000-0000-0000-0000-000000000047',
  '50000000-0000-0000-0000-000000000011',
  'S05-A-NEW-BEST', current_date, current_date + 40
);

insert into public.quotation_items (
  id, quotation_id, catalog_item_id, supplier_description, unit_price
)
values (
  '50000000-0000-0000-0000-000000000057',
  '50000000-0000-0000-0000-000000000047',
  '50000000-0000-0000-0000-000000000030',
  'A nova melhor', 8.00
);

update public.quotations set status = 'active'
where id = '50000000-0000-0000-0000-000000000047';

insert into pg_temp.tap_results (result)
select throws_ok(
  format(
    'select public.approve_price(%L, %L)',
    '50000000-0000-0000-0000-000000000030',
    (select token from pg_temp.decision_tokens where name = 'before_offer_change')
  ),
  'P0001',
  'Decisao de preco desatualizada: ofertas, regra ou aprovacao mudaram. Recarregue antes de continuar.',
  'Token anterior a mudanca da melhor oferta e rejeitado'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select effective_status = 'review_required'
      and review_reason = 'best_cost_reference_changed'
      and persisted_status = 'approved'
      and approved_cost_price = 10.01
      and approved_final_price = 11.26
    from public.pricing_comparison_v
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Nova melhor oferta exige revisao sem sobrescrever preco ou snapshots aprovados'
);

insert into pg_temp.decision_tokens (name, token)
values (
  'before_reapproval',
  public.price_decision_token('50000000-0000-0000-0000-000000000030')
);

insert into pg_temp.tap_results (result)
select lives_ok(
  format(
    'select public.approve_price(%L, %L)',
    '50000000-0000-0000-0000-000000000030',
    (select token from pg_temp.decision_tokens where name = 'before_reapproval')
  ),
  'Token atualizado permite aprovar a nova melhor oferta'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select source_quotation_item_id = '50000000-0000-0000-0000-000000000057'
      and best_quotation_item_id_at_approval = '50000000-0000-0000-0000-000000000057'
      and cost_price = 8.00
      and final_price = 9.00
      and status = 'approved'
    from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Reaprovacao atualiza snapshots e preco exclusivamente por acao explicita'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  format(
    'select public.approve_price(%L, %L)',
    '50000000-0000-0000-0000-000000000030',
    (select token from pg_temp.decision_tokens where name = 'before_reapproval')
  ),
  'P0001',
  'Decisao de preco desatualizada: ofertas, regra ou aprovacao mudaram. Recarregue antes de continuar.',
  'Token usado antes da alteracao da propria aprovacao nao pode ser reutilizado'
);

insert into pg_temp.tap_results (result)
select is(
  (select count(*) from public.price_list where catalog_item_id = '50000000-0000-0000-0000-000000000030'),
  1::bigint,
  'Existe no maximo uma linha comercial corrente por item de catalogo'
);

-- Rule changes and disappearance produce review and invalidate stale screens.
insert into pg_temp.decision_tokens (name, token)
values (
  'before_rule_change',
  public.price_decision_token('50000000-0000-0000-0000-000000000030')
);

update public.margin_rules set value = 20.0000
where id = '50000000-0000-0000-0000-000000000060';

insert into pg_temp.tap_results (result)
select throws_ok(
  format(
    'select public.approve_price(%L, %L)',
    '50000000-0000-0000-0000-000000000030',
    (select token from pg_temp.decision_tokens where name = 'before_rule_change')
  ),
  'P0001',
  'Decisao de preco desatualizada: ofertas, regra ou aprovacao mudaram. Recarregue antes de continuar.',
  'Token anterior a alteracao da regra e rejeitado'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select effective_status = 'review_required'
      and review_reason = 'pricing_rule_changed'
      and persisted_status = 'approved'
      and approved_adjustment_value = 12.5000
    from public.pricing_comparison_v
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Mudanca da regra exige revisao e preserva a regra aprovada'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$
    select public.approve_price(
      '50000000-0000-0000-0000-000000000030',
      public.price_decision_token('50000000-0000-0000-0000-000000000030')
    )
  $$,
  'Regra alterada pode ser aplicada por nova aprovacao explicita'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select adjustment_value = 20.0000 and final_price = 9.60
    from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Nova aprovacao recalcula o percentual alterado no servidor'
);

insert into pg_temp.decision_tokens (name, token)
values (
  'before_rule_disappears',
  public.price_decision_token('50000000-0000-0000-0000-000000000030')
);

update public.margin_rules set active = false
where id = '50000000-0000-0000-0000-000000000060';

insert into pg_temp.tap_results (result)
select throws_ok(
  format(
    'select public.approve_price(%L, %L)',
    '50000000-0000-0000-0000-000000000030',
    (select token from pg_temp.decision_tokens where name = 'before_rule_disappears')
  ),
  'P0001',
  'Decisao de preco desatualizada: ofertas, regra ou aprovacao mudaram. Recarregue antes de continuar.',
  'Token anterior ao desaparecimento da regra e rejeitado'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select effective_status = 'review_required'
      and review_reason = 'no_active_rule'
      and persisted_status = 'approved'
    from public.pricing_comparison_v
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Desaparecimento da regra exige revisao sem apagar aprovacao'
);

update public.margin_rules set active = true
where id = '50000000-0000-0000-0000-000000000060';

insert into pg_temp.tap_results (result)
select lives_ok(
  $$
    select public.approve_price(
      '50000000-0000-0000-0000-000000000030',
      public.price_decision_token('50000000-0000-0000-0000-000000000030')
    )
  $$,
  'Regra restaurada requer e aceita nova aprovacao'
);

-- Manual source selection is traced and its later ineligibility is derived.
insert into pg_temp.tap_results (result)
select lives_ok(
  $$
    select public.approve_price(
      '50000000-0000-0000-0000-000000000030',
      public.price_decision_token('50000000-0000-0000-0000-000000000030'),
      '50000000-0000-0000-0000-000000000051'
    )
  $$,
  'Admin pode selecionar fonte alternativa elegivel'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select manual_source
      and source_quotation_item_id = '50000000-0000-0000-0000-000000000051'
      and cost_price = 12.00
      and final_price = 14.40
      and best_quotation_item_id_at_approval = '50000000-0000-0000-0000-000000000057'
      and best_cost_at_approval = 8.00
    from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Fonte manual preserva snapshots da escolha e da melhor referencia'
);

insert into pg_temp.decision_tokens (name, token)
values (
  'before_manual_source_ineligible',
  public.price_decision_token('50000000-0000-0000-0000-000000000030')
);

update public.quotations set status = 'cancelled'
where id = '50000000-0000-0000-0000-000000000041';

insert into pg_temp.tap_results (result)
select isnt(
  public.price_decision_token('50000000-0000-0000-0000-000000000030'),
  (select token from pg_temp.decision_tokens where name = 'before_manual_source_ineligible'),
  'Perda de elegibilidade da fonte manual invalida o token de decisao'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select effective_status = 'review_required'
      and review_reason = 'approved_source_ineligible'
      and persisted_status = 'approved'
      and approved_source_quotation_item_id = '50000000-0000-0000-0000-000000000051'
      and approved_final_price = 14.40
    from public.pricing_comparison_v
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Fonte aprovada que se torna inelegivel exige revisao sem reprecificar'
);

-- Inactivation is explicit; only a fresh post-inactivation token can reactivate.
insert into pg_temp.decision_tokens (name, token)
values (
  'before_inactivation',
  public.price_decision_token('50000000-0000-0000-0000-000000000030')
);

insert into pg_temp.tap_results (result)
select lives_ok(
  format(
    'select public.inactivate_price(%L, %L)',
    '50000000-0000-0000-0000-000000000030',
    (select token from pg_temp.decision_tokens where name = 'before_inactivation')
  ),
  'Admin inativa preco com o token corrente'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select persisted_status = 'inactive'
      and effective_status = 'inactive'
      and review_reason is null
    from public.pricing_comparison_v
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Inativacao aparece nos status persistido e efetivo'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  format(
    'select public.approve_price(%L, %L)',
    '50000000-0000-0000-0000-000000000030',
    (select token from pg_temp.decision_tokens where name = 'before_inactivation')
  ),
  'P0001',
  'Decisao de preco desatualizada: ofertas, regra ou aprovacao mudaram. Recarregue antes de continuar.',
  'Token anterior a inativacao nao pode reativar preco'
);

insert into pg_temp.tap_results (result)
select lives_ok(
  $$
    select public.approve_price(
      '50000000-0000-0000-0000-000000000030',
      public.price_decision_token('50000000-0000-0000-0000-000000000030')
    )
  $$,
  'Somente token fresco permite reativacao por nova aprovacao'
);

insert into pg_temp.tap_results (result)
select ok(
  (
    select status = 'approved'
      and source_quotation_item_id = '50000000-0000-0000-0000-000000000057'
      and not manual_source
    from public.price_list
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Reativacao segura grava aprovacao fresca usando fonte elegivel atual'
);

update public.catalog_items
set active = false
where id = '50000000-0000-0000-0000-000000000030';

insert into pg_temp.tap_results (result)
select ok(
  (
    select not catalog_item_active and price_list_id is not null
    from public.pricing_comparison_v
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  ),
  'Item de catalogo inativo preserva consulta do registro comercial corrente'
);

-- Equipe can read/select context but cannot mutate commercial approval state.
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);

insert into pg_temp.tap_results (result)
select ok(
  exists (
    select 1 from public.pricing_comparison_v
    where catalog_item_id = '50000000-0000-0000-0000-000000000030'
  )
    and exists (
      select 1 from public.price_list
      where catalog_item_id = '50000000-0000-0000-0000-000000000030'
    )
    and public.price_decision_token('50000000-0000-0000-0000-000000000030') is not null,
  'Equipe pode selecionar comparacao, tabela e token de decisao'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$
    select public.approve_price(
      '50000000-0000-0000-0000-000000000030',
      public.price_decision_token('50000000-0000-0000-0000-000000000030')
    )
  $$,
  'P0001',
  'Apenas Admin pode aprovar ou atualizar preco comercial.',
  'Equipe nao pode aprovar preco'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$
    select public.inactivate_price(
      '50000000-0000-0000-0000-000000000030',
      public.price_decision_token('50000000-0000-0000-0000-000000000030')
    )
  $$,
  'P0001',
  'Apenas Admin pode inativar preco comercial.',
  'Equipe nao pode inativar preco'
);

insert into pg_temp.tap_results (result)
select throws_ok(
  $$
    insert into public.price_list (
      catalog_item_id, source_quotation_item_id, margin_rule_id, cost_price,
      adjustment_type, adjustment_value, final_price, approved_by
    ) values (
      '50000000-0000-0000-0000-000000000032',
      '50000000-0000-0000-0000-000000000053',
      '50000000-0000-0000-0000-000000000060',
      5.00, 'percentage', 20.00, 6.00,
      '50000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  'permission denied for table price_list',
  'Equipe nao possui escrita direta em price_list'
);

-- Anon has neither data access nor RPC execution grants.
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

insert into pg_temp.tap_results (result)
select ok(
  not has_table_privilege('anon', 'public.price_list', 'SELECT')
    and not has_table_privilege('anon', 'public.pricing_comparison_v', 'SELECT'),
  'Anon nao possui acesso a tabela comercial nem a comparacao'
);

insert into pg_temp.tap_results (result)
select ok(
  not has_function_privilege('anon', 'public.price_decision_token(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.approve_price(uuid,text,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.inactivate_price(uuid,text)', 'EXECUTE'),
  'Anon nao pode executar token, aprovacao ou inativacao'
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
