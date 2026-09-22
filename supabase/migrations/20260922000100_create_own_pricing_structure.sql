-- ============================================================================
-- EFETIVA OS - Fase 2A: estrutura de precos proprios (somente banco)
--
-- Preparacao do banco para propostas de preco de servicos proprios, sem
-- fornecedor e sem cotacao. Nenhuma RPC de aprovacao e entregue nesta fase:
-- o fluxo de decisao (aprovar/inativar) faz parte da Fase 2B.
--
-- REGRAS DE NEGOCIO (validadas no decision register)
-- 1) Todo item de catalogo tem origem: 'own' (servico proprio) ou
--    'outsourced' (terceirizado via cotacao). O default preserva o
--    comportamento existente ('outsourced').
-- 2) Uniforme e Equipe podem criar propostas de preco proprio; somente Admin
--    aprova (RPC na Fase 2B). O preco de venda e informado diretamente e o
--    custo interno e opcional.
-- 3) Custo interno e visivel somente para Admin.
-- 4) No maximo 1 proposta 'pending' por item.
-- 5) Origem propria e origem terceirizada sao mutuamente exclusivas:
--    o historico preservado (cotacao x proposta) impede a troca de origem
--    apos o primeiro uso.
-- 6) A tabela comercial price_list passa a declarar a origem do preco
--    vigente ('quotation' | 'own') e, para precos proprios, aponta para a
--    proposta aprovada. approve_price()/inactivate_price() nao mudam nesta fase.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Tipos de dominio
-- ---------------------------------------------------------------------------
create type public.pricing_sourcing_type as enum ('own', 'outsourced');
create type public.price_origin as enum ('quotation', 'own');
create type public.own_price_status as enum ('pending', 'approved', 'inactive');

-- ---------------------------------------------------------------------------
-- 2. Origem do item no catalogo
-- ---------------------------------------------------------------------------
alter table public.catalog_items
  add column sourcing_type public.pricing_sourcing_type not null default 'outsourced';

-- ---------------------------------------------------------------------------
-- 3. Propostas de preco proprio
-- ---------------------------------------------------------------------------
create table public.own_price_proposals (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references public.catalog_items(id) on delete restrict,
  sale_price numeric(14,2) not null check (sale_price > 0),
  internal_cost numeric(14,2) check (internal_cost is null or internal_cost > 0),
  status public.own_price_status not null default 'pending',
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  decision_notes text,
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint own_price_proposals_status_revision_chk check (
    (status = 'pending' and approved_by is null and approved_at is null)
    or
    (status in ('approved', 'inactive') and approved_by is not null and approved_at is not null)
  )
);

-- No maximo uma proposta aguardando decisao por item de catalogo.
create unique index uq_own_price_proposals_one_pending
  on public.own_price_proposals (catalog_item_id)
  where status = 'pending';

create index idx_own_price_proposals_item_status
  on public.own_price_proposals (catalog_item_id, status);

-- ---------------------------------------------------------------------------
-- 4. Auditoria
-- ---------------------------------------------------------------------------
drop trigger if exists trg_own_price_proposals_audit on public.own_price_proposals;
create trigger trg_own_price_proposals_audit
before insert or update on public.own_price_proposals
for each row execute function public.set_audit_fields();

-- ---------------------------------------------------------------------------
-- 5. Guardas de dados (funcoes de gatilho)
-- ---------------------------------------------------------------------------
-- Insercao: somente estado pending, revisao 1, autor = usuario logado,
-- item ativo e de servico proprio.
create or replace function public.enforce_own_price_proposal_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_active boolean;
  v_item_sourcing_type public.pricing_sourcing_type;
begin
  if new.status is distinct from 'pending' then
    raise exception 'Uma nova proposta de preco proprio deve ser criada em estado pending.' using errcode = 'P0001';
  end if;

  if new.revision is distinct from 1 then
    raise exception 'Uma nova proposta de preco proprio inicia com revisao 1.' using errcode = 'P0001';
  end if;

  if (select auth.uid()) is null then
    raise exception 'Propostas de preco proprio exigem um usuario autenticado.' using errcode = '42501';
  end if;

  if new.submitted_by is null then
    new.submitted_by := (select auth.uid());
  end if;

  if new.submitted_by is distinct from (select auth.uid()) then
    raise exception 'A proposta de preco proprio deve ser submetida pelo proprio usuario logado.' using errcode = 'P0001';
  end if;

  select ci.active, ci.sourcing_type
  into v_item_active, v_item_sourcing_type
  from public.catalog_items ci
  where ci.id = new.catalog_item_id;

  if coalesce(v_item_active, false) = false then
    raise exception 'Item de catalogo inexistente ou inativo nao pode receber proposta de preco proprio.' using errcode = 'P0001';
  end if;

  if v_item_sourcing_type is distinct from 'own' then
    raise exception 'Somente itens de servico proprio recebem proposta de preco proprio; itens terceirizados usam cotacao.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger trg_own_price_proposals_insert_guard
before insert on public.own_price_proposals
for each row execute function public.enforce_own_price_proposal_insert();

-- Atualizacao: identidade imutavel; estado de decisao muda apenas pela RPC de
-- aprovacao (Fase 2B) que opera sob a GUC efetiva_os.own_price_approval='on';
-- conteudo de propostas ja decididas e imutavel; revisao cresce em reajuste.
create or replace function public.enforce_own_price_proposal_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.catalog_item_id is distinct from old.catalog_item_id
     or new.submitted_by is distinct from old.submitted_by
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'Identidade, item, autor e data de envio da proposta de preco proprio sao imutaveis.' using errcode = 'P0001';
  end if;

  if (new.status is distinct from old.status
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at)
     and not (public.is_admin()
              and current_setting('efetiva_os.own_price_approval', true) = 'on') then
    raise exception 'O estado de aprovacao somente muda pela RPC de aprovacao de preco proprio.' using errcode = '42501';
  end if;

  if old.status is distinct from 'pending' then
    if new.sale_price is distinct from old.sale_price
       or new.internal_cost is distinct from old.internal_cost
       or new.decision_notes is distinct from old.decision_notes
       or new.revision is distinct from old.revision then
      raise exception 'Proposta decidida e imutavel; reajuste exige nova proposta.' using errcode = 'P0001';
    end if;
  end if;

  if new.sale_price is distinct from old.sale_price
     or new.internal_cost is distinct from old.internal_cost then
    new.revision := old.revision + 1;
  end if;

  return new;
end;
$$;

create trigger trg_own_price_proposals_update_guard
before update on public.own_price_proposals
for each row execute function public.enforce_own_price_proposal_update();

-- Origem do item nao muda apos historico (cotacao / proposta / preco vigente).
-- Tabela own_price_proposals ja existe quando esta funcao e criada (trecho 3).
create or replace function public.enforce_catalog_item_sourcing_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sourcing_type is distinct from old.sourcing_type then
    if exists (
      select 1 from public.quotation_items qi where qi.catalog_item_id = old.id
    ) or exists (
      select 1 from public.own_price_proposals opp where opp.catalog_item_id = old.id
    ) or exists (
      select 1 from public.price_list pl where pl.catalog_item_id = old.id
    ) then
      raise exception 'A origem do item nao pode mudar depois que o item participa de cotacao, proposta de preco proprio ou precificacao vigente.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_catalog_items_sourcing_history_guard
before update on public.catalog_items
for each row execute function public.enforce_catalog_item_sourcing_history();

-- ---------------------------------------------------------------------------
-- 6. price_list: origem do preco vigente
-- ---------------------------------------------------------------------------
-- Precos proprios substituem os campos de origem por um snapshot na proposta.
-- Os campos de origem das cotacoes passam a ser obrigatorios apenas quando a
-- origem e 'quotation' (consistencia garantida por CHECK).
alter table public.price_list
  add column price_origin public.price_origin not null default 'quotation',
  add column own_price_proposal_id uuid references public.own_price_proposals(id) on delete restrict,
  alter column source_quotation_item_id drop not null,
  alter column margin_rule_id drop not null,
  alter column cost_price drop not null,
  alter column adjustment_type drop not null,
  alter column adjustment_value drop not null;

alter table public.price_list
  add constraint price_list_origin_fields_chk check (
    (price_origin = 'quotation'
       and source_quotation_item_id is not null
       and margin_rule_id is not null
       and cost_price is not null
       and adjustment_type is not null
       and adjustment_value is not null
       and own_price_proposal_id is null)
    or
    (price_origin = 'own'
       and source_quotation_item_id is null
       and margin_rule_id is null
       and cost_price is null
       and adjustment_type is null
       and adjustment_value is null
       and own_price_proposal_id is not null)
  );

-- ---------------------------------------------------------------------------
-- 7. RLS e grants
-- ---------------------------------------------------------------------------
alter table public.own_price_proposals enable row level security;
alter table public.own_price_proposals force row level security;

-- A leitura com mascaramento do custo interno acontece por
-- public.get_own_price_proposals(). Existe policy de SELECT (escopo owner/
-- admin) somente porque o UPDATE sob RLS exige que a linha seja visivel ao
-- papel alterador; o custo interno permanece protegido pelo grant de coluna.
-- Sem DELETE.
DROP POLICY IF EXISTS own_price_proposals_select_internal ON public.own_price_proposals;
create policy own_price_proposals_select_internal
on public.own_price_proposals for select to authenticated
using (public.is_internal_user() and (public.is_admin() or submitted_by = (select auth.uid())));

DROP POLICY IF EXISTS own_price_proposals_insert_internal ON public.own_price_proposals;
create policy own_price_proposals_insert_internal
on public.own_price_proposals for insert to authenticated
with check (public.is_internal_user());

DROP POLICY IF EXISTS own_price_proposals_update_owner_or_admin ON public.own_price_proposals;
create policy own_price_proposals_update_owner_or_admin
on public.own_price_proposals for update to authenticated
using (public.is_internal_user() and (public.is_admin() or submitted_by = (select auth.uid())))
with check (public.is_internal_user() and (public.is_admin() or submitted_by = (select auth.uid())));

revoke all on public.own_price_proposals from public, anon, authenticated;
grant insert on public.own_price_proposals to authenticated;
grant select (
  id, catalog_item_id, sale_price, status, submitted_by, submitted_at,
  approved_by, approved_at, decision_notes, revision,
  created_at, created_by, updated_at, updated_by
) on public.own_price_proposals to authenticated;
-- Colunas de decisao ficam acessiveis ao UPDATE para toda transicao de estado
-- passar pelo gatilho de guarda (que exige a GUC da RPC de aprovacao).
grant update (sale_price, internal_cost, decision_notes, status, approved_by, approved_at) on public.own_price_proposals to authenticated;

-- Itens de servico proprio sao criados pelo mesmo fluxo autorizado do catalogo.
revoke insert on public.catalog_items from authenticated;
grant insert (
  id, name, category_id, unit, description, active, sourcing_type,
  created_at, created_by, updated_at, updated_by
) on public.catalog_items to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Leitura restrita: custo interno exclusivo do Admin
-- ---------------------------------------------------------------------------
create or replace function public.get_own_price_proposals(
  p_catalog_item_id uuid default null,
  p_status public.own_price_status default null
)
returns table (
  id uuid,
  catalog_item_id uuid,
  item_code text,
  item_name text,
  sale_price numeric(14,2),
  internal_cost numeric(14,2),
  status public.own_price_status,
  submitted_by uuid,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  decision_notes text,
  revision integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    opp.id,
    opp.catalog_item_id,
    ci.code,
    ci.name,
    opp.sale_price,
    case when public.is_admin() then opp.internal_cost end as internal_cost,
    opp.status,
    opp.submitted_by,
    opp.submitted_at,
    opp.approved_by,
    opp.approved_at,
    opp.decision_notes,
    opp.revision,
    opp.created_at,
    opp.updated_at
  from public.own_price_proposals opp
  join public.catalog_items ci on ci.id = opp.catalog_item_id
  where public.is_internal_user()
    and (p_catalog_item_id is null or opp.catalog_item_id = p_catalog_item_id)
    and (p_status is null or opp.status = p_status)
  order by opp.submitted_at desc, opp.id;
$$;

revoke all on function public.get_own_price_proposals(uuid, public.own_price_status) from public, anon, authenticated;
grant execute on function public.get_own_price_proposals(uuid, public.own_price_status) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Selagem de funcoes de gatilho e helper
-- ---------------------------------------------------------------------------
revoke all on function public.enforce_own_price_proposal_insert() from public, anon, authenticated;
revoke all on function public.enforce_own_price_proposal_update() from public, anon, authenticated;
revoke all on function public.enforce_catalog_item_sourcing_history() from public, anon, authenticated;

commit;