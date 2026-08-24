-- ETAPA 05: aprovacao comercial autoritativa com deteccao de tela obsoleta.
-- O token nao autoriza nem transporta valores comerciais; ele identifica o
-- contexto de menor oferta, regra resolvida e preco atual lido pela interface.

begin;

create or replace function public.price_decision_token(p_catalog_item_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  select md5(jsonb_build_object(
    'catalog_item_id', ci.id,
    'catalog_item_active', ci.active,
    'best_quotation_item_id', b.quotation_item_id,
    'best_cost', b.unit_price,
    'best_valid_until', b.valid_until,
    'resolved_margin_rule_id', r.margin_rule_id,
    'resolved_adjustment_type', r.calculation_type,
    'resolved_adjustment_value', r.value,
    'price_list_id', p.id,
    'approved_source_quotation_item_id', p.source_quotation_item_id,
    'approved_margin_rule_id', p.margin_rule_id,
    'approved_cost_price', p.cost_price,
    'approved_adjustment_type', p.adjustment_type,
    'approved_adjustment_value', p.adjustment_value,
    'approved_final_price', p.final_price,
    'approved_source_valid_until', p.source_valid_until,
    'best_quotation_item_id_at_approval', p.best_quotation_item_id_at_approval,
    'best_cost_at_approval', p.best_cost_at_approval,
    'manual_source', p.manual_source,
    'persisted_status', p.status,
    'approved_at', p.approved_at,
    'approved_by', p.approved_by,
    'updated_at', p.updated_at
  )::text)
  from public.catalog_items ci
  left join public.best_quote_per_item_v b on b.catalog_item_id = ci.id
  left join lateral public.resolve_margin_rule(ci.id) r on true
  left join public.price_list p on p.catalog_item_id = ci.id
  where ci.id = p_catalog_item_id
    and public.is_internal_user();
$$;

revoke all on function public.price_decision_token(uuid) from public;
revoke all on function public.price_decision_token(uuid) from anon;
revoke all on function public.price_decision_token(uuid) from authenticated;
grant execute on function public.price_decision_token(uuid) to authenticated;

create or replace view public.pricing_comparison_v
with (security_invoker = true)
as
select
  ci.id as catalog_item_id,
  ci.code,
  ci.name as item_name,
  ci.unit,
  cc.id as category_id,
  cc.name as category_name,
  b.quotation_item_id as best_quotation_item_id,
  b.unit_price as best_cost,
  b.supplier_id as best_supplier_id,
  b.supplier_name as best_supplier_name,
  b.valid_until as best_valid_until,
  b.validity_not_informed as best_validity_not_informed,
  coalesce(b.eligible_offer_count, 0) as eligible_offer_count,
  r.margin_rule_id as resolved_margin_rule_id,
  r.scope_type as resolved_rule_scope,
  r.calculation_type as resolved_adjustment_type,
  r.value as resolved_adjustment_value,
  case
    when b.unit_price is null or r.margin_rule_id is null then null
    when r.calculation_type = 'percentage'
      then round(b.unit_price * (1 + r.value / 100), 2)
    when r.calculation_type = 'fixed'
      then round(b.unit_price + r.value, 2)
  end as suggested_price,
  p.id as price_list_id,
  p.cost_price as approved_cost_price,
  p.final_price as approved_final_price,
  p.adjustment_type as approved_adjustment_type,
  p.adjustment_value as approved_adjustment_value,
  p.manual_source,
  p.approved_at,
  p.approved_by,
  p.source_quotation_item_id as approved_source_quotation_item_id,
  src.supplier_id as approved_supplier_id,
  src.supplier_name as approved_supplier_name,
  p.source_valid_until as approved_source_valid_until,
  case
    when p.id is null and b.quotation_item_id is null then 'no_cost'
    when p.id is null and r.margin_rule_id is null then 'no_rule'
    when p.id is null then 'suggestion_available'
    when p.status = 'inactive' then 'inactive'
    when p.status = 'review_required' then 'review_required'
    when coalesce(src.is_eligible, false) = false then 'review_required'
    when b.quotation_item_id is distinct from p.best_quotation_item_id_at_approval then 'review_required'
    when r.margin_rule_id is null then 'review_required'
    when r.margin_rule_id is distinct from p.margin_rule_id then 'review_required'
    when r.calculation_type is distinct from p.adjustment_type then 'review_required'
    when r.value is distinct from p.adjustment_value then 'review_required'
    else 'approved'
  end as effective_status,
  case
    when p.id is null or p.status = 'inactive' then null
    when p.status = 'review_required' then 'manual_review_required'
    when coalesce(src.is_eligible, false) = false then 'approved_source_ineligible'
    when b.quotation_item_id is distinct from p.best_quotation_item_id_at_approval then 'best_cost_reference_changed'
    when r.margin_rule_id is null then 'no_active_rule'
    when r.margin_rule_id is distinct from p.margin_rule_id
      or r.calculation_type is distinct from p.adjustment_type
      or r.value is distinct from p.adjustment_value then 'pricing_rule_changed'
    else null
  end as review_reason,
  p.status as persisted_status,
  p.margin_rule_id as approved_margin_rule_id,
  p.best_quotation_item_id_at_approval,
  p.best_cost_at_approval,
  public.price_decision_token(ci.id) as decision_token
from public.catalog_items ci
join public.catalog_categories cc on cc.id = ci.category_id
left join public.best_quote_per_item_v b on b.catalog_item_id = ci.id
left join lateral public.resolve_margin_rule(ci.id) r on true
left join public.price_list p on p.catalog_item_id = ci.id
left join public.quotation_item_candidates_v src on src.quotation_item_id = p.source_quotation_item_id
where ci.active = true;

drop function public.approve_price(uuid, uuid);

create function public.approve_price(
  p_catalog_item_id uuid,
  p_expected_decision_token text,
  p_source_quotation_item_id uuid default null
)
returns public.price_list
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_best record;
  v_source record;
  v_rule record;
  v_final numeric(14,2);
  v_result public.price_list;
  v_current_decision_token text;
begin
  if not public.is_admin() then
    raise exception 'Apenas Admin pode aprovar ou atualizar preco comercial.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('efetiva_os_pricing_decisions', 0));

  select public.price_decision_token(p_catalog_item_id)
  into v_current_decision_token;

  if v_current_decision_token is null then
    raise exception 'Item de catalogo inexistente ou inativo nao pode ser aprovado.';
  end if;

  if p_expected_decision_token is null
     or p_expected_decision_token is distinct from v_current_decision_token then
    raise exception 'Decisao de preco desatualizada: ofertas, regra ou aprovacao mudaram. Recarregue antes de continuar.';
  end if;

  if not exists (
    select 1
    from public.catalog_items ci
    where ci.id = p_catalog_item_id
      and ci.active = true
  ) then
    raise exception 'Item de catalogo inexistente ou inativo nao pode ser aprovado.';
  end if;

  select * into v_best
  from public.best_quote_per_item_v
  where catalog_item_id = p_catalog_item_id;

  if not found then
    raise exception 'Nao existe cotacao elegivel para este item.';
  end if;

  select * into v_source
  from public.quotation_item_candidates_v
  where quotation_item_id = coalesce(p_source_quotation_item_id, v_best.quotation_item_id)
    and catalog_item_id = p_catalog_item_id
    and is_eligible = true;

  if not found then
    raise exception 'A fonte selecionada nao e elegivel para este item.';
  end if;

  select * into v_rule
  from public.resolve_margin_rule(p_catalog_item_id);

  if not found then
    raise exception 'Defina uma regra de acrescimo antes de aprovar este preco.';
  end if;

  if v_rule.calculation_type = 'percentage' then
    v_final := round(v_source.unit_price * (1 + v_rule.value / 100), 2);
  else
    v_final := round(v_source.unit_price + v_rule.value, 2);
  end if;

  insert into public.price_list (
    catalog_item_id,
    source_quotation_item_id,
    margin_rule_id,
    cost_price,
    adjustment_type,
    adjustment_value,
    final_price,
    source_valid_until,
    best_quotation_item_id_at_approval,
    best_cost_at_approval,
    manual_source,
    status,
    approved_at,
    approved_by,
    created_by,
    updated_by
  ) values (
    p_catalog_item_id,
    v_source.quotation_item_id,
    v_rule.margin_rule_id,
    v_source.unit_price,
    v_rule.calculation_type,
    v_rule.value,
    v_final,
    v_source.valid_until,
    v_best.quotation_item_id,
    v_best.unit_price,
    (v_source.quotation_item_id <> v_best.quotation_item_id),
    'approved',
    now(),
    (select auth.uid()),
    (select auth.uid()),
    (select auth.uid())
  )
  on conflict (catalog_item_id) do update set
    source_quotation_item_id = excluded.source_quotation_item_id,
    margin_rule_id = excluded.margin_rule_id,
    cost_price = excluded.cost_price,
    adjustment_type = excluded.adjustment_type,
    adjustment_value = excluded.adjustment_value,
    final_price = excluded.final_price,
    source_valid_until = excluded.source_valid_until,
    best_quotation_item_id_at_approval = excluded.best_quotation_item_id_at_approval,
    best_cost_at_approval = excluded.best_cost_at_approval,
    manual_source = excluded.manual_source,
    status = 'approved',
    approved_at = excluded.approved_at,
    approved_by = excluded.approved_by,
    updated_by = (select auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.approve_price(uuid, text, uuid) from public;
revoke all on function public.approve_price(uuid, text, uuid) from anon;
revoke all on function public.approve_price(uuid, text, uuid) from authenticated;
grant execute on function public.approve_price(uuid, text, uuid) to authenticated;

drop function public.inactivate_price(uuid);

create function public.inactivate_price(
  p_catalog_item_id uuid,
  p_expected_decision_token text
)
returns public.price_list
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.price_list;
  v_current_decision_token text;
begin
  if not public.is_admin() then
    raise exception 'Apenas Admin pode inativar preco comercial.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('efetiva_os_pricing_decisions', 0));

  select public.price_decision_token(p_catalog_item_id)
  into v_current_decision_token;

  if p_expected_decision_token is null
     or p_expected_decision_token is distinct from v_current_decision_token then
    raise exception 'Decisao de preco desatualizada: ofertas, regra ou aprovacao mudaram. Recarregue antes de continuar.';
  end if;

  update public.price_list
  set status = 'inactive', updated_by = (select auth.uid())
  where catalog_item_id = p_catalog_item_id
    and status <> 'inactive'
  returning * into v_result;

  if not found then
    raise exception 'Preco ativo nao encontrado para o item informado.';
  end if;

  return v_result;
end;
$$;

revoke all on function public.inactivate_price(uuid, text) from public;
revoke all on function public.inactivate_price(uuid, text) from anon;
revoke all on function public.inactivate_price(uuid, text) from authenticated;
grant execute on function public.inactivate_price(uuid, text) to authenticated;

commit;
