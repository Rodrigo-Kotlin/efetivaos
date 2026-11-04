-- A prorrogação altera a validade operacional da fonte, mas não o snapshot
-- gravado no price_list. A tela comercial deve mostrar a validade efetiva.
begin;

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
    when r.calculation_type = 'percentage' then round(b.unit_price * (1 + r.value / 100), 2)
    when r.calculation_type = 'fixed' then round(b.unit_price + r.value, 2)
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
  src.valid_until as approved_source_valid_until,
  case
    when p.id is null and b.quotation_item_id is null then 'no_cost'
    when p.id is null and r.margin_rule_id is null then 'no_rule'
    when p.id is null then 'suggestion_available'
    when p.price_origin = 'own' and p.status = 'approved' then 'approved'
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
    when p.price_origin = 'own' then null
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
  public.price_decision_token(ci.id) as decision_token,
  ci.active as catalog_item_active,
  src.quotation_id as approved_quotation_id,
  src.reference_number as approved_quotation_reference,
  p.price_origin,
  p.own_price_proposal_id
from public.catalog_items ci
join public.catalog_categories cc on cc.id = ci.category_id
left join public.best_quote_per_item_v b on b.catalog_item_id = ci.id
left join lateral public.resolve_margin_rule(ci.id) r on true
left join public.price_list p on p.catalog_item_id = ci.id
left join public.quotation_item_candidates_v src on src.quotation_item_id = p.source_quotation_item_id
where ci.active = true or p.id is not null;

commit;
