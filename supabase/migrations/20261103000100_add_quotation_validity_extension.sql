-- Prorrogacao de validade sem editar o documento original.
begin;

create table public.quotation_validity_extensions (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete restrict,
  previous_valid_until date not null,
  extended_until date not null,
  reason text not null default 'Prorrogação autorizada pelo fornecedor',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint quotation_validity_extension_order_chk check (extended_until > previous_valid_until),
  constraint quotation_validity_extension_reason_chk check (length(trim(reason)) > 0)
);

create index quotation_validity_extensions_quotation_idx
  on public.quotation_validity_extensions (quotation_id, extended_until desc);

alter table public.quotation_validity_extensions enable row level security;
-- A insercao e feita exclusivamente pela RPC SECURITY DEFINER abaixo. A
-- leitura continua protegida por RLS para os usuarios autenticados.
alter table public.quotation_validity_extensions no force row level security;
revoke all on public.quotation_validity_extensions from anon, authenticated;
grant select on public.quotation_validity_extensions to authenticated;

create policy quotation_validity_extensions_select_internal
on public.quotation_validity_extensions for select to authenticated
using (public.is_internal_user());

-- A acao e atomica e exclusiva para cotacoes ativas. O prazo e sempre de 30
-- dias a partir da ultima validade registrada, sem permitir retrocesso.
create or replace function public.extend_quotation_validity(
  p_quotation_id uuid,
  p_expected_revision bigint,
  p_reason text default 'Prorrogação autorizada pelo fornecedor'
)
returns public.quotations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quotation public.quotations;
  v_previous date;
  v_extended date;
begin
  if not public.is_internal_user() then
    raise exception 'Voce nao tem permissao para prorrogar cotacoes.';
  end if;

  select * into v_quotation
  from public.quotations
  where id = p_quotation_id
  for update;

  if not found then raise exception 'Cotacao nao encontrada.'; end if;
  if v_quotation.status <> 'active' then raise exception 'Somente cotacoes ativas podem ser prorrogadas.'; end if;
  if v_quotation.archived_at is not null then raise exception 'Desarquive a cotacao antes de prorrogar a validade.'; end if;
  if v_quotation.revision <> p_expected_revision then raise exception 'Cotacao desatualizada. Recarregue antes de continuar.'; end if;
  if v_quotation.valid_until is null then raise exception 'Cotacoes sem validade nao precisam de prorrogacao.'; end if;

  select coalesce(max(e.extended_until), v_quotation.valid_until)
    into v_previous
  from public.quotation_validity_extensions e
  where e.quotation_id = v_quotation.id;
  if v_previous >= current_date then
    raise exception 'A cotacao ainda esta vigente e nao precisa de nova prorrogacao.';
  end if;
  v_extended := v_previous + 30;

  insert into public.quotation_validity_extensions (quotation_id, previous_valid_until, extended_until, reason, created_by)
  values (v_quotation.id, v_previous, v_extended, coalesce(nullif(trim(p_reason), ''), 'Prorrogação autorizada pelo fornecedor'), (select auth.uid()));

  return v_quotation;
end;
$$;

revoke all on function public.extend_quotation_validity(uuid, bigint, text) from public;
grant execute on function public.extend_quotation_validity(uuid, bigint, text) to authenticated;

-- Todas as views de elegibilidade passam a considerar a ultima prorrogacao,
-- sem alterar quotations.valid_until (a validade original).
create or replace view public.quotation_item_candidates_v
with (security_invoker = true)
as
select
  qi.id as quotation_item_id, qi.quotation_id, qi.catalog_item_id, qi.unit_price,
  qi.supplier_description, qi.supplier_item_code, q.supplier_id, s.name as supplier_name,
  q.reference_number, q.received_at,
  coalesce(ext.extended_until, q.valid_until) as valid_until,
  q.status as quotation_status,
  (coalesce(ext.extended_until, q.valid_until) is not null and coalesce(ext.extended_until, q.valid_until) < current_date) as is_expired,
  (coalesce(ext.extended_until, q.valid_until) is null) as validity_not_informed,
  (q.status = 'active' and qi.catalog_item_id is not null
    and (coalesce(ext.extended_until, q.valid_until) is null or coalesce(ext.extended_until, q.valid_until) >= current_date)) as is_eligible
from public.quotation_items qi
join public.quotations q on q.id = qi.quotation_id
join public.suppliers s on s.id = q.supplier_id
left join lateral (
  select max(e.extended_until) as extended_until
  from public.quotation_validity_extensions e
  where e.quotation_id = q.id
) ext on true;

create or replace view public.ranked_quotation_items_v
with (security_invoker = true)
as
select c.*,
  row_number() over (partition by c.catalog_item_id order by c.unit_price asc, c.valid_until desc nulls last, c.received_at desc, c.quotation_item_id) as offer_rank,
  count(*) over (partition by c.catalog_item_id) as eligible_offer_count
from public.quotation_item_candidates_v c where c.is_eligible = true;

create or replace view public.best_quote_per_item_v
with (security_invoker = true)
as select * from public.ranked_quotation_items_v where offer_rank = 1;

commit;
