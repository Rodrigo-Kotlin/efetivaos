-- ============================================================================
-- EFETIVA OS - Fase 2B: RPCs de decisao de preco proprio (somente banco)
--
-- Complementa a Fase 2A: enquanto a 2A criou a estrutura e os gatilhos de
-- guarda de own_price_proposals, esta fase entrega as unicas acoes autorizadas
-- para mudar o estado de decisao de uma proposta:
--
--   approve_own_price_proposal()   : pending -> approved (cria/atualiza o preco
--                                    vigente em price_list com origem 'own')
--   inactivate_own_price_proposal(): pending -> inactive (rejeicao) ou
--                                    approved -> inactive (aposentadoria do
--                                    preco vigente correspondente)
--
-- Ambas sao SECURITY DEFINER, exclusivas de Admin e operam sob a GUC
-- efetiva_os.own_price_approval='on' exigida pelo gatilho de guarda da 2A.
-- O token de decisao (own_price_decision_token) protege contra telas
-- obsoletas: uma proposta reajustada depois que o Admin carregou a tela nao e
-- aprovada/inativada silenciosamente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Token de decisao para proposta de preco proprio
-- ---------------------------------------------------------------------------
-- Espelha o snapshot da proposta (valores, estado, revisao, auditoria) no
-- momento da leitura. Nenhum valor comercial trafega pela assinatura; a RPC
-- valida internamente contra o estado atual (comportamento CAS no UPDATE).
create or replace function public.own_price_decision_token(p_proposal_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  select md5(jsonb_build_object(
    'proposal_id', opp.id,
    'catalog_item_id', opp.catalog_item_id,
    'sale_price', opp.sale_price,
    'internal_cost', opp.internal_cost,
    'status', opp.status::text,
    'revision', opp.revision,
    'submitted_by', opp.submitted_by,
    'approved_by', opp.approved_by,
    'approved_at', opp.approved_at,
    'updated_at', opp.updated_at
  )::text)
  from public.own_price_proposals opp
  where opp.id = p_proposal_id
    and public.is_internal_user();
$$;

revoke all on function public.own_price_decision_token(uuid) from public, anon, authenticated;
grant execute on function public.own_price_decision_token(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. RPC de aprovacao de preco proprio
-- ---------------------------------------------------------------------------
create or replace function public.approve_own_price_proposal(
  p_proposal_id uuid,
  p_expected_decision_token text
)
returns public.own_price_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prop record;
  v_token text;
  v_prev_guc text;
  v_result public.own_price_proposals;
  v_item_active boolean;
  v_item_sourcing_type public.pricing_sourcing_type;
begin
  if not public.is_admin() then
    raise exception 'Apenas Admin pode aprovar ou inativar proposta de preco proprio.';
  end if;

  -- Serializa decisoes de preco proprio e tambem a via de cotacao (price_list
  -- possui uma unica linha por item; quem aprova nunca sobrescreve no meio de
  -- outra aprovacao).
  perform pg_advisory_xact_lock(hashtextextended('efetiva_os_own_price_approval', 0));
  perform pg_advisory_xact_lock(hashtextextended('efetiva_os_pricing_decisions', 0));

  select * into v_prop
  from public.own_price_proposals
  where id = p_proposal_id;

  if not found then
    raise exception 'Proposta de preco proprio inexistente.';
  end if;

  if v_prop.status is distinct from 'pending' then
    raise exception 'Somente propostas pendentes podem ser aprovadas.';
  end if;

  select ci.active, ci.sourcing_type
  into v_item_active, v_item_sourcing_type
  from public.catalog_items ci
  where ci.id = v_prop.catalog_item_id;

  if coalesce(v_item_active, false) = false then
    raise exception 'Item de catalogo inexistente ou inativo nao pode ter preco proprio aprovado.';
  end if;

  select public.own_price_decision_token(p_proposal_id) into v_token;
  if p_expected_decision_token is null
     or p_expected_decision_token is distinct from v_token then
    raise exception 'Decisao de preco proprio desatualizada: a proposta mudou. Recarregue antes de continuar.';
  end if;

  v_prev_guc := coalesce(nullif(current_setting('efetiva_os.own_price_approval', true), ''), 'off');
  perform set_config('efetiva_os.own_price_approval', 'on', true);

  -- Update CAS: alem do token, revalida os valores lidos para encerrar a
  -- corrida entre a leitura e a escrita.
  update public.own_price_proposals
  set status = 'approved',
      approved_by = (select auth.uid()),
      approved_at = now()
  where id = p_proposal_id
    and status = 'pending'
    and sale_price = v_prop.sale_price
    and internal_cost is not distinct from v_prop.internal_cost
    and revision = v_prop.revision
  returning * into v_result;

  if not found then
    perform set_config('efetiva_os.own_price_approval', v_prev_guc, true);
    raise exception 'Decisao de preco proprio desatualizada: a proposta mudou. Recarregue antes de continuar.';
  end if;

  perform set_config('efetiva_os.own_price_approval', v_prev_guc, true);

  -- Preco vigente: origem 'own' aponta para a proposta aprovada. Se o item
  -- tiver preco de cotacao vigente, ele e substituido (uma linha por item).
  insert into public.price_list (
    catalog_item_id,
    price_origin,
    own_price_proposal_id,
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
    v_prop.catalog_item_id,
    'own',
    p_proposal_id,
    v_result.sale_price,
    null,
    null,
    null,
    false,
    'approved',
    v_result.approved_at,
    v_result.approved_by,
    (select auth.uid()),
    (select auth.uid())
  )
  on conflict (catalog_item_id) do update set
    price_origin = 'own',
    own_price_proposal_id = excluded.own_price_proposal_id,
    final_price = excluded.final_price,
    source_quotation_item_id = null,
    margin_rule_id = null,
    cost_price = null,
    adjustment_type = null,
    adjustment_value = null,
    source_valid_until = null,
    best_quotation_item_id_at_approval = null,
    best_cost_at_approval = null,
    manual_source = false,
    status = 'approved',
    approved_at = excluded.approved_at,
    approved_by = excluded.approved_by,
    updated_by = (select auth.uid());

  return v_result;
end;
$$;

revoke all on function public.approve_own_price_proposal(uuid, text) from public, anon, authenticated;
grant execute on function public.approve_own_price_proposal(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. RPC de inativacao de preco proprio
-- ---------------------------------------------------------------------------
-- pending -> inactive: rejeicao (registra aprovador/nota da rejeicao, ja que
-- o CHECK de decisao exige aprovador e data). approved -> inactive:
-- aposentadoria do preco vigente referenciado pela proposta. Uma proposta
-- inativada nao bloqueia nova proposta pendente para o mesmo item.
create or replace function public.inactivate_own_price_proposal(
  p_proposal_id uuid,
  p_expected_decision_token text,
  p_decision_notes text default null
)
returns public.own_price_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prop record;
  v_token text;
  v_prev_guc text;
  v_result public.own_price_proposals;
begin
  if not public.is_admin() then
    raise exception 'Apenas Admin pode aprovar ou inativar proposta de preco proprio.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('efetiva_os_own_price_approval', 0));
  perform pg_advisory_xact_lock(hashtextextended('efetiva_os_pricing_decisions', 0));

  select * into v_prop
  from public.own_price_proposals
  where id = p_proposal_id;

  if not found then
    raise exception 'Proposta de preco proprio inexistente.';
  end if;

  if v_prop.status not in ('pending'::public.own_price_status, 'approved'::public.own_price_status) then
    raise exception 'Somente propostas pendentes ou aprovadas podem ser inativadas.';
  end if;

  select public.own_price_decision_token(p_proposal_id) into v_token;
  if p_expected_decision_token is null
     or p_expected_decision_token is distinct from v_token then
    raise exception 'Decisao de preco proprio desatualizada: a proposta mudou. Recarregue antes de continuar.';
  end if;

  v_prev_guc := coalesce(nullif(current_setting('efetiva_os.own_price_approval', true), ''), 'off');
  perform set_config('efetiva_os.own_price_approval', 'on', true);

  update public.own_price_proposals
  set status = 'inactive',
      approved_by = (select auth.uid()),
      approved_at = now(),
      decision_notes = case
        when v_prop.status = 'pending' then coalesce(p_decision_notes, v_prop.decision_notes)
        else v_prop.decision_notes
      end
  where id = p_proposal_id
    and status = v_prop.status
    and sale_price = v_prop.sale_price
    and internal_cost is not distinct from v_prop.internal_cost
    and revision = v_prop.revision
  returning * into v_result;

  if not found then
    perform set_config('efetiva_os.own_price_approval', v_prev_guc, true);
    raise exception 'Decisao de preco proprio desatualizada: a proposta mudou. Recarregue antes de continuar.';
  end if;

  perform set_config('efetiva_os.own_price_approval', v_prev_guc, true);

  -- Aposenta o preco vigente apenas quando ele referencia esta proposta.
  -- Uma proposta aprovada que ja foi substituida por reajuste nao toca o preco
  -- atual da outra proposta.
  update public.price_list
  set status = 'inactive', updated_by = (select auth.uid())
  where own_price_proposal_id = p_proposal_id
    and status <> 'inactive';

  return v_result;
end;
$$;

revoke all on function public.inactivate_own_price_proposal(uuid, text, text) from public, anon, authenticated;
grant execute on function public.inactivate_own_price_proposal(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Comparacao de precos: origem propria vira estado vigente normal
-- ---------------------------------------------------------------------------
-- Precos de servico proprio ('own' aprovado) devem aparecer como preco aprovado
-- na comparacao, sem passar pelos todos de revisao que dependem de cotacao e
-- regra de acrescimo. Precos 'own' inativos permanecem 'inactive'. Tambem
-- expoe price_origin e own_price_proposal_id para a interface da Fase 2B.
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