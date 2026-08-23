-- ============================================================================
-- EFETIVA OS - Motor de Precos v1
-- Migration incremental adaptada do Projeto Tecnico v0.3
-- Baseline funcional: Especificacao v0.2 (agosto/2026)
--
-- IMPORTANTE
-- 1) Executar primeiro em projeto Supabase de desenvolvimento.
-- 2) Pressupoe 20260823000100_create_profiles_and_roles.sql aplicada.
-- 3) O frontend deve usar a RPC approve_price() para aprovacao comercial.
-- 4) O status de revisao exibido pela UI deve priorizar effective_status da
--    view pricing_comparison_v, pois vencimento por data e um estado derivado.
-- 5) O MVP compara preco unitario ja normalizado para a unidade do catalogo.
--    Conversao de unidade, frete, impostos e faixas de quantidade ficam fora v1.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Tipos de dominio
-- ---------------------------------------------------------------------------

create type public.quotation_status as enum ('draft', 'active', 'cancelled');
create type public.margin_scope_type as enum ('global', 'category', 'item');
create type public.adjustment_type as enum ('percentage', 'fixed');
create type public.price_status as enum ('approved', 'review_required', 'inactive');

-- ---------------------------------------------------------------------------
-- 1. Profiles / perfis internos existentes
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column active boolean not null default true,
  add column created_by uuid references auth.users(id) on delete set null,
  add column updated_by uuid references auth.users(id) on delete set null;

update public.profiles
set created_by = id,
    updated_by = id
where created_by is null
   or updated_by is null;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.active = true
  limit 1;
$$;

create or replace function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.active = true
      and p.role in ('admin', 'equipe')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() = 'admin';
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.is_internal_user() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_internal_user() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Preserva o contrato da baseline: profiles.id referencia auth.users.id e
-- promocao de role continua exclusiva da RPC set_user_role().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, full_name, role, active, created_by, updated_by
  ) values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    'equipe',
    true,
    new.id,
    new.id
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Funcao generica de auditoria
-- ---------------------------------------------------------------------------
create or replace function public.set_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce((select auth.uid()), new.created_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;

  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

-- Serializa alteracoes que podem mudar fonte, regra ou estado de uma aprovacao.
-- O lock global e deliberadamente simples para o volume interno previsto no MVP.
create or replace function public.lock_pricing_decision_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('efetiva_os_pricing_decisions', 0));
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Tabelas do Motor de Precos
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  legal_name text,
  tax_id text,
  category text,
  contact_name text,
  email text,
  phone text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  code text not null check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  category_id uuid not null references public.catalog_categories(id) on delete restrict,
  unit text not null check (length(trim(unit)) > 0),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  reference_number text,
  received_at date not null,
  valid_until date,
  status public.quotation_status not null default 'draft',
  source_file_path text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint quotations_validity_chk check (
    valid_until is null or valid_until >= received_at
  )
);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete restrict,
  -- Nullable durante o rascunho para permitir captura/mapeamento progressivo.
  -- A ativacao da cotacao exige todos os itens mapeados.
  catalog_item_id uuid references public.catalog_items(id) on delete restrict,
  supplier_description text,
  supplier_item_code text,
  unit_price numeric(14,2) not null check (unit_price > 0),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table public.margin_rules (
  id uuid primary key default gen_random_uuid(),
  scope_type public.margin_scope_type not null,
  category_id uuid references public.catalog_categories(id) on delete restrict,
  catalog_item_id uuid references public.catalog_items(id) on delete restrict,
  calculation_type public.adjustment_type not null,
  value numeric(14,4) not null check (value >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint margin_rules_scope_target_chk check (
    (scope_type = 'global'   and category_id is null     and catalog_item_id is null)
    or
    (scope_type = 'category' and category_id is not null and catalog_item_id is null)
    or
    (scope_type = 'item'     and category_id is null     and catalog_item_id is not null)
  )
);

create table public.price_list (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references public.catalog_items(id) on delete restrict,
  source_quotation_item_id uuid not null references public.quotation_items(id) on delete restrict,
  margin_rule_id uuid not null references public.margin_rules(id) on delete restrict,

  -- Snapshots da aprovacao. Evitam que alteracoes futuras em cotacao/regra
  -- reescrevam silenciosamente o preco aprovado.
  cost_price numeric(14,2) not null check (cost_price > 0),
  adjustment_type public.adjustment_type not null,
  adjustment_value numeric(14,4) not null check (adjustment_value >= 0),
  final_price numeric(14,2) not null check (final_price >= 0),
  source_valid_until date,

  -- Snapshot do menor custo no instante da aprovacao. Necessario para saber
  -- se uma nova cotacao mudou a referencia de menor custo sem penalizar uma
  -- escolha manual que ja era diferente do menor custo no momento da aprovacao.
  best_quotation_item_id_at_approval uuid references public.quotation_items(id) on delete restrict,
  best_cost_at_approval numeric(14,2) check (best_cost_at_approval is null or best_cost_at_approval > 0),

  manual_source boolean not null default false,
  status public.price_status not null default 'approved',
  approved_at timestamptz not null default now(),
  approved_by uuid not null references auth.users(id) on delete restrict,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,

  constraint price_list_one_current_row_per_item unique (catalog_item_id)
);

-- ---------------------------------------------------------------------------
-- 4. Unicidade e indices
-- ---------------------------------------------------------------------------
create unique index if not exists uq_catalog_categories_name_ci
  on public.catalog_categories (lower(name));

create unique index if not exists uq_catalog_items_code_ci
  on public.catalog_items (lower(code));

-- Hipotese deliberada do MVP: um mesmo item canonico aparece no maximo uma
-- vez na mesma cotacao. Precos por faixa/quantidade ficam fora da v1.
create unique index if not exists uq_quotation_item_catalog_once
  on public.quotation_items (quotation_id, catalog_item_id)
  where catalog_item_id is not null;

create unique index if not exists uq_margin_rules_global_active
  on public.margin_rules ((1))
  where active = true and scope_type = 'global';

create unique index if not exists uq_margin_rules_category_active
  on public.margin_rules (category_id)
  where active = true and scope_type = 'category';

create unique index if not exists uq_margin_rules_item_active
  on public.margin_rules (catalog_item_id)
  where active = true and scope_type = 'item';

create index if not exists idx_suppliers_active_name
  on public.suppliers (active, lower(name));

create index if not exists idx_catalog_items_category_active
  on public.catalog_items (category_id, active);

create index if not exists idx_quotations_supplier
  on public.quotations (supplier_id, received_at desc);

create index if not exists idx_quotations_status_validity
  on public.quotations (status, valid_until, received_at desc);

create index if not exists idx_quotation_items_catalog_price
  on public.quotation_items (catalog_item_id, unit_price)
  where catalog_item_id is not null;

create index if not exists idx_quotation_items_quotation
  on public.quotation_items (quotation_id);

create index if not exists idx_price_list_status
  on public.price_list (status);

-- ---------------------------------------------------------------------------
-- 5. Triggers de auditoria
-- ---------------------------------------------------------------------------
drop trigger profiles_set_updated_at on public.profiles;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','suppliers','catalog_categories','catalog_items','quotations',
    'quotation_items','margin_rules','price_list'
  ]
  loop
    execute format('drop trigger if exists trg_%I_audit on public.%I', t, t);
    execute format(
      'create trigger trg_%I_audit before insert or update on public.%I for each row execute function public.set_audit_fields()',
      t, t
    );
  end loop;
end $$;

create trigger trg_margin_rules_pricing_lock
before insert or update or delete on public.margin_rules
for each row execute function public.lock_pricing_decision_changes();

create or replace function public.enforce_catalog_item_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.active is distinct from old.active
     or new.category_id is distinct from old.category_id
     or new.unit is distinct from old.unit then
    perform pg_advisory_xact_lock(hashtextextended('efetiva_os_pricing_decisions', 0));
  end if;

  if (
    new.category_id is distinct from old.category_id
    or new.unit is distinct from old.unit
  ) and exists (
    select 1
    from public.quotation_items qi
    where qi.catalog_item_id = old.id
  ) then
    raise exception 'Categoria e unidade nao podem mudar depois que o item participa de uma cotacao.';
  end if;

  return new;
end;
$$;

create trigger trg_catalog_items_history_guard
before update on public.catalog_items
for each row execute function public.enforce_catalog_item_history();

-- ---------------------------------------------------------------------------
-- 6. Regras de ciclo de vida das cotacoes
-- ---------------------------------------------------------------------------
create or replace function public.enforce_quotation_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_supplier_active boolean;
  v_total_items integer;
  v_unmapped_items integer;
  v_inactive_items integer;
begin
  if new.source_file_path is not null
     and new.source_file_path not like new.id::text || '/%' then
    raise exception 'Arquivo da cotacao deve usar o caminho <quotation_id>/arquivo.';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Nova cotacao deve ser criada em estado draft.';
    end if;

    select s.active into v_supplier_active
    from public.suppliers s
    where s.id = new.supplier_id;

    if coalesce(v_supplier_active, false) = false then
      raise exception 'Fornecedor inativo: ative-o antes de registrar a cotacao.';
    end if;

    return new;
  end if;

  -- Cotacao cancelada e terminal.
  if old.status = 'cancelled' then
    raise exception 'Cotacao cancelada nao pode ser alterada.';
  end if;

  -- Cotacao ativa so pode ser cancelada, sem alterar seus dados de origem.
  if old.status = 'active' then
    perform pg_advisory_xact_lock(hashtextextended('efetiva_os_pricing_decisions', 0));

    if new.status <> 'cancelled' then
      raise exception 'Cotacao ativa somente pode ser cancelada.';
    end if;

    if new.supplier_id is distinct from old.supplier_id
       or new.reference_number is distinct from old.reference_number
       or new.received_at is distinct from old.received_at
       or new.valid_until is distinct from old.valid_until
       or new.source_file_path is distinct from old.source_file_path
       or new.notes is distinct from old.notes then
      raise exception 'Dados de cotacao ativa sao imutaveis; cancele e registre nova cotacao se necessario.';
    end if;
    return new;
  end if;

  if new.supplier_id is distinct from old.supplier_id then
    select s.active into v_supplier_active
    from public.suppliers s
    where s.id = new.supplier_id;

    if coalesce(v_supplier_active, false) = false then
      raise exception 'Fornecedor inativo nao pode receber nova cotacao.';
    end if;
  end if;

  -- A partir de draft, so sao aceitos draft, active ou cancelled.
  if old.status = 'draft' and new.status = 'active' then
    perform pg_advisory_xact_lock(hashtextextended('efetiva_os_pricing_decisions', 0));

    select s.active into v_supplier_active
    from public.suppliers s
    where s.id = new.supplier_id;

    if coalesce(v_supplier_active, false) = false then
      raise exception 'Fornecedor deve estar ativo para ativar a cotacao.';
    end if;

    select count(*) into v_total_items
    from public.quotation_items qi
    where qi.quotation_id = old.id;

    if v_total_items = 0 then
      raise exception 'Adicione ao menos um item antes de ativar a cotacao.';
    end if;

    select count(*) into v_unmapped_items
    from public.quotation_items qi
    where qi.quotation_id = old.id
      and qi.catalog_item_id is null;

    if v_unmapped_items > 0 then
      raise exception 'Mapeie todos os itens ao Catalogo Efetiva antes de ativar a cotacao.';
    end if;

    select count(*) into v_inactive_items
    from public.quotation_items qi
    join public.catalog_items ci on ci.id = qi.catalog_item_id
    where qi.quotation_id = old.id
      and ci.active = false;

    if v_inactive_items > 0 then
      raise exception 'Itens inativos do Catalogo Efetiva nao podem participar de nova cotacao ativa.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_quotations_lifecycle on public.quotations;
create trigger trg_quotations_lifecycle
before insert or update on public.quotations
for each row execute function public.enforce_quotation_lifecycle();

create or replace function public.enforce_quotation_item_draft_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_quotation_id uuid;
  v_status public.quotation_status;
  v_item_active boolean;
begin
  v_quotation_id := case when tg_op = 'DELETE' then old.quotation_id else new.quotation_id end;

  select q.status into v_status
  from public.quotations q
  where q.id = v_quotation_id;

  if v_status is distinct from 'draft' then
    raise exception 'Itens de cotacao somente podem ser alterados enquanto a cotacao estiver em draft.';
  end if;

  if tg_op <> 'DELETE' and new.catalog_item_id is not null then
    select ci.active into v_item_active
    from public.catalog_items ci
    where ci.id = new.catalog_item_id;

    if coalesce(v_item_active, false) = false then
      raise exception 'Item de catalogo inativo nao pode ser usado em nova cotacao.';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_quotation_items_draft_only on public.quotation_items;
create trigger trg_quotation_items_draft_only
before insert or update or delete on public.quotation_items
for each row execute function public.enforce_quotation_item_draft_only();

-- ---------------------------------------------------------------------------
-- 7. Views de comparacao
-- ---------------------------------------------------------------------------
create or replace view public.quotation_item_candidates_v
with (security_invoker = true)
as
select
  qi.id as quotation_item_id,
  qi.quotation_id,
  qi.catalog_item_id,
  qi.unit_price,
  qi.supplier_description,
  qi.supplier_item_code,
  q.supplier_id,
  s.name as supplier_name,
  q.reference_number,
  q.received_at,
  q.valid_until,
  q.status as quotation_status,
  (q.valid_until is not null and q.valid_until < current_date) as is_expired,
  (q.valid_until is null) as validity_not_informed,
  (
    q.status = 'active'
    and qi.catalog_item_id is not null
    and (q.valid_until is null or q.valid_until >= current_date)
  ) as is_eligible
from public.quotation_items qi
join public.quotations q on q.id = qi.quotation_id
join public.suppliers s on s.id = q.supplier_id;

create or replace view public.ranked_quotation_items_v
with (security_invoker = true)
as
select
  c.*,
  row_number() over (
    partition by c.catalog_item_id
    order by
      c.unit_price asc,
      c.valid_until desc nulls last,
      c.received_at desc,
      c.quotation_item_id
  ) as offer_rank,
  count(*) over (partition by c.catalog_item_id) as eligible_offer_count
from public.quotation_item_candidates_v c
where c.is_eligible = true;

create or replace view public.best_quote_per_item_v
with (security_invoker = true)
as
select *
from public.ranked_quotation_items_v
where offer_rank = 1;

-- Regra efetiva por item. SECURITY DEFINER e intencional: Equipe pode visualizar
-- apenas a regra resolvida necessaria ao calculo, sem acesso CRUD a margin_rules.
create or replace function public.resolve_margin_rule(p_catalog_item_id uuid)
returns table (
  margin_rule_id uuid,
  scope_type public.margin_scope_type,
  calculation_type public.adjustment_type,
  value numeric(14,4)
)
language sql
stable
security definer
set search_path = ''
as $$
  select mr.id, mr.scope_type, mr.calculation_type, mr.value
  from public.catalog_items ci
  join public.margin_rules mr
    on mr.active = true
   and (
     (mr.scope_type = 'item' and mr.catalog_item_id = ci.id)
     or
     (mr.scope_type = 'category' and mr.category_id = ci.category_id)
     or
     (mr.scope_type = 'global')
   )
  where ci.id = p_catalog_item_id
    and public.is_internal_user()
  order by case mr.scope_type
    when 'item' then 1
    when 'category' then 2
    when 'global' then 3
  end
  limit 1;
$$;

revoke all on function public.resolve_margin_rule(uuid) from public;
grant execute on function public.resolve_margin_rule(uuid) to authenticated;

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
  src.valid_until as approved_source_valid_until,

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
    when p.id is null then null
    when coalesce(src.is_eligible, false) = false then 'approved_source_ineligible'
    when b.quotation_item_id is distinct from p.best_quotation_item_id_at_approval then 'best_cost_reference_changed'
    when r.margin_rule_id is null then 'no_active_rule'
    when r.margin_rule_id is distinct from p.margin_rule_id
      or r.calculation_type is distinct from p.adjustment_type
      or r.value is distinct from p.adjustment_value then 'pricing_rule_changed'
    else null
  end as review_reason
from public.catalog_items ci
join public.catalog_categories cc on cc.id = ci.category_id
left join public.best_quote_per_item_v b on b.catalog_item_id = ci.id
left join lateral public.resolve_margin_rule(ci.id) r on true
left join public.price_list p on p.catalog_item_id = ci.id
left join public.quotation_item_candidates_v src on src.quotation_item_id = p.source_quotation_item_id
where ci.active = true;

-- ---------------------------------------------------------------------------
-- 8. RPC segura de aprovacao de preco
-- ---------------------------------------------------------------------------
create or replace function public.approve_price(
  p_catalog_item_id uuid,
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
begin
  if not public.is_admin() then
    raise exception 'Apenas Admin pode aprovar ou atualizar preco comercial.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('efetiva_os_pricing_decisions', 0));

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

revoke all on function public.approve_price(uuid, uuid) from public;
grant execute on function public.approve_price(uuid, uuid) to authenticated;

create or replace function public.inactivate_price(p_catalog_item_id uuid)
returns public.price_list
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.price_list;
begin
  if not public.is_admin() then
    raise exception 'Apenas Admin pode inativar preco comercial.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('efetiva_os_pricing_decisions', 0));

  update public.price_list
  set status = 'inactive', updated_by = (select auth.uid())
  where catalog_item_id = p_catalog_item_id
  returning * into v_result;

  if not found then
    raise exception 'Preco nao encontrado para o item informado.';
  end if;

  return v_result;
end;
$$;

revoke all on function public.inactivate_price(uuid) from public;
grant execute on function public.inactivate_price(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.suppliers enable row level security;
alter table public.catalog_categories enable row level security;
alter table public.catalog_items enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.margin_rules enable row level security;
alter table public.price_list enable row level security;

alter table public.suppliers force row level security;
alter table public.catalog_categories force row level security;
alter table public.catalog_items force row level security;
alter table public.quotations force row level security;
alter table public.quotation_items force row level security;
alter table public.margin_rules force row level security;
alter table public.price_list force row level security;

-- As policies e os grants de profiles permanecem os da migration baseline.

-- Suppliers
DROP POLICY IF EXISTS suppliers_select_internal ON public.suppliers;
create policy suppliers_select_internal
on public.suppliers for select to authenticated
using (public.is_internal_user());

DROP POLICY IF EXISTS suppliers_insert_internal ON public.suppliers;
create policy suppliers_insert_internal
on public.suppliers for insert to authenticated
with check (public.is_internal_user());

DROP POLICY IF EXISTS suppliers_update_internal ON public.suppliers;
create policy suppliers_update_internal
on public.suppliers for update to authenticated
using (public.is_internal_user())
with check (public.is_internal_user());

-- Catalog categories
DROP POLICY IF EXISTS catalog_categories_select_internal ON public.catalog_categories;
create policy catalog_categories_select_internal
on public.catalog_categories for select to authenticated
using (public.is_internal_user());

DROP POLICY IF EXISTS catalog_categories_insert_internal ON public.catalog_categories;
create policy catalog_categories_insert_internal
on public.catalog_categories for insert to authenticated
with check (public.is_internal_user());

DROP POLICY IF EXISTS catalog_categories_update_internal ON public.catalog_categories;
create policy catalog_categories_update_internal
on public.catalog_categories for update to authenticated
using (public.is_internal_user())
with check (public.is_internal_user());

-- Catalog items
DROP POLICY IF EXISTS catalog_items_select_internal ON public.catalog_items;
create policy catalog_items_select_internal
on public.catalog_items for select to authenticated
using (public.is_internal_user());

DROP POLICY IF EXISTS catalog_items_insert_internal ON public.catalog_items;
create policy catalog_items_insert_internal
on public.catalog_items for insert to authenticated
with check (public.is_internal_user());

DROP POLICY IF EXISTS catalog_items_update_internal ON public.catalog_items;
create policy catalog_items_update_internal
on public.catalog_items for update to authenticated
using (public.is_internal_user())
with check (public.is_internal_user());

-- Quotations
DROP POLICY IF EXISTS quotations_select_internal ON public.quotations;
create policy quotations_select_internal
on public.quotations for select to authenticated
using (public.is_internal_user());

DROP POLICY IF EXISTS quotations_insert_internal ON public.quotations;
create policy quotations_insert_internal
on public.quotations for insert to authenticated
with check (public.is_internal_user());

DROP POLICY IF EXISTS quotations_update_internal ON public.quotations;
create policy quotations_update_internal
on public.quotations for update to authenticated
using (public.is_internal_user())
with check (public.is_internal_user());

-- Quotation items
DROP POLICY IF EXISTS quotation_items_select_internal ON public.quotation_items;
create policy quotation_items_select_internal
on public.quotation_items for select to authenticated
using (public.is_internal_user());

DROP POLICY IF EXISTS quotation_items_insert_draft ON public.quotation_items;
create policy quotation_items_insert_draft
on public.quotation_items for insert to authenticated
with check (
  public.is_internal_user()
  and exists (
    select 1 from public.quotations q
    where q.id = quotation_id and q.status = 'draft'
  )
);

DROP POLICY IF EXISTS quotation_items_update_draft ON public.quotation_items;
create policy quotation_items_update_draft
on public.quotation_items for update to authenticated
using (
  public.is_internal_user()
  and exists (
    select 1 from public.quotations q
    where q.id = quotation_id and q.status = 'draft'
  )
)
with check (
  public.is_internal_user()
  and exists (
    select 1 from public.quotations q
    where q.id = quotation_id and q.status = 'draft'
  )
);

DROP POLICY IF EXISTS quotation_items_delete_draft ON public.quotation_items;
create policy quotation_items_delete_draft
on public.quotation_items for delete to authenticated
using (
  public.is_internal_user()
  and exists (
    select 1 from public.quotations q
    where q.id = quotation_id and q.status = 'draft'
  )
);

-- Margin rules: configuracao integral exclusiva do Admin.
DROP POLICY IF EXISTS margin_rules_select_admin ON public.margin_rules;
create policy margin_rules_select_admin
on public.margin_rules for select to authenticated
using (public.is_admin());

DROP POLICY IF EXISTS margin_rules_insert_admin ON public.margin_rules;
create policy margin_rules_insert_admin
on public.margin_rules for insert to authenticated
with check (public.is_admin());

DROP POLICY IF EXISTS margin_rules_update_admin ON public.margin_rules;
create policy margin_rules_update_admin
on public.margin_rules for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Price list: leitura interna; escrita apenas pelas RPCs SECURITY DEFINER.
DROP POLICY IF EXISTS price_list_select_internal ON public.price_list;
create policy price_list_select_internal
on public.price_list for select to authenticated
using (public.is_internal_user());

-- ---------------------------------------------------------------------------
-- 10. Grants PostgREST
-- ---------------------------------------------------------------------------
revoke all on public.suppliers from public, anon, authenticated;
revoke all on public.catalog_categories from public, anon, authenticated;
revoke all on public.catalog_items from public, anon, authenticated;
revoke all on public.quotations from public, anon, authenticated;
revoke all on public.quotation_items from public, anon, authenticated;
revoke all on public.margin_rules from public, anon, authenticated;
revoke all on public.price_list from public, anon, authenticated;

revoke all on public.quotation_item_candidates_v from public, anon, authenticated;
revoke all on public.ranked_quotation_items_v from public, anon, authenticated;
revoke all on public.best_quote_per_item_v from public, anon, authenticated;
revoke all on public.pricing_comparison_v from public, anon, authenticated;

-- RLS define as linhas; os grants de profiles permanecem restritos a full_name.
grant select, insert, update on public.suppliers to authenticated;
grant select, insert, update on public.catalog_categories to authenticated;
grant select, insert, update on public.catalog_items to authenticated;
grant select, insert, update on public.quotations to authenticated;
grant select, insert, update, delete on public.quotation_items to authenticated;
grant select, insert, update on public.margin_rules to authenticated;
grant select on public.price_list to authenticated;

grant select on public.quotation_item_candidates_v to authenticated;
grant select on public.ranked_quotation_items_v to authenticated;
grant select on public.best_quote_per_item_v to authenticated;
grant select on public.pricing_comparison_v to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Storage privado para anexos de cotacoes (opcional no MVP)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-quotes',
  'supplier-quotes',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS supplier_quotes_files_select_internal ON storage.objects;
create policy supplier_quotes_files_select_internal
on storage.objects for select to authenticated
using (bucket_id = 'supplier-quotes' and public.is_internal_user());

DROP POLICY IF EXISTS supplier_quotes_files_insert_internal ON storage.objects;
create policy supplier_quotes_files_insert_internal
on storage.objects for insert to authenticated
with check (
  bucket_id = 'supplier-quotes'
  and public.is_internal_user()
  and exists (
    select 1
    from public.quotations q
    where q.id::text = (storage.foldername(name))[1]
      and q.source_file_path = name
      and q.status = 'draft'
  )
);

DROP POLICY IF EXISTS supplier_quotes_files_update_internal ON storage.objects;
create policy supplier_quotes_files_update_internal
on storage.objects for update to authenticated
using (
  bucket_id = 'supplier-quotes'
  and public.is_internal_user()
  and exists (
    select 1
    from public.quotations q
    where q.id::text = (storage.foldername(name))[1]
      and q.source_file_path = name
      and q.status = 'draft'
  )
)
with check (
  bucket_id = 'supplier-quotes'
  and public.is_internal_user()
  and exists (
    select 1
    from public.quotations q
    where q.id::text = (storage.foldername(name))[1]
      and q.source_file_path = name
      and q.status = 'draft'
  )
);

DROP POLICY IF EXISTS supplier_quotes_files_delete_admin ON storage.objects;
create policy supplier_quotes_files_delete_admin
on storage.objects for delete to authenticated
using (bucket_id = 'supplier-quotes' and public.is_admin());

commit;

-- ============================================================================
-- POS-MIGRATION / SEED MINIMO
-- ============================================================================
-- 1) Crie o primeiro usuario via Supabase Auth.
-- 2) Para o primeiro Admin, use um canal SQL administrativo privilegiado:
--    update public.profiles set role = 'admin' where id = '<UUID>';
--    Depois disso, alteracoes de role devem usar public.set_user_role().
-- 3) Cadastre ao menos uma regra global, por exemplo:
--    insert into public.margin_rules(scope_type, calculation_type, value)
--    values ('global','percentage',30);
--
-- CONSULTAS PRINCIPAIS DO FRONTEND
-- - Comparacao:      select * from public.pricing_comparison_v;
-- - Todas ofertas:   select * from public.ranked_quotation_items_v
--                    where catalog_item_id = '<UUID>' order by offer_rank;
-- - Aprovar melhor:  select public.approve_price('<ITEM_UUID>', null);
-- - Aprovar manual:  select public.approve_price('<ITEM_UUID>', '<QUOTE_ITEM_UUID>');
-- ============================================================================
