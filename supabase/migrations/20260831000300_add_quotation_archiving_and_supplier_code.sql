-- ============================================================================
-- EFETIVA OS — Quotation Archiving + Supplier Auto Code
-- Migration: 20260831000300
--
-- Part A: Reversible quotation archiving (archived_at / archived_by columns,
--         archive_quotation / unarchive_quotation RPCs)
-- Part B: Automatic supplier code generation (FOR-000001 format, sequence-based)
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Part A: Quotation Archiving
-- ---------------------------------------------------------------------------

-- A1. Columns
alter table public.quotations
  add column archived_at timestamptz null,
  add column archived_by uuid null references auth.users(id) on delete set null;

-- A2. Index
create index idx_quotations_archived on public.quotations (archived_at) where archived_at is not null;

-- A3. RPC archive_quotation
create or replace function public.archive_quotation(p_quotation_id uuid)
returns public.quotations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.quotations;
begin
  if not public.is_internal_user() then
    raise exception 'Voce nao tem permissao para arquivar cotacoes.';
  end if;

  select * into v_row
  from public.quotations q
  where q.id = p_quotation_id
    for update;

  if not found then
    raise exception 'Cotacao nao encontrada.';
  end if;

  if v_row.archived_at is not null then
    raise exception 'Esta cotacao ja esta arquivada.';
  end if;

  update public.quotations
  set archived_at = now(),
      archived_by = (select auth.uid())
  where id = p_quotation_id;

  select * into v_row
  from public.quotations q
  where q.id = p_quotation_id;

  return v_row;
end;
$$;

-- A4. RPC unarchive_quotation
create or replace function public.unarchive_quotation(p_quotation_id uuid)
returns public.quotations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.quotations;
begin
  if not public.is_internal_user() then
    raise exception 'Voce nao tem permissao para desarquivar cotacoes.';
  end if;

  select * into v_row
  from public.quotations q
  where q.id = p_quotation_id
    for update;

  if not found then
    raise exception 'Cotacao nao encontrada.';
  end if;

  if v_row.archived_at is null then
    raise exception 'Esta cotacao nao esta arquivada.';
  end if;

  update public.quotations
  set archived_at = null,
      archived_by = null
  where id = p_quotation_id;

  select * into v_row
  from public.quotations q
  where q.id = p_quotation_id;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Part B: Supplier Auto Code
-- ---------------------------------------------------------------------------

-- B1. Sequence
create sequence if not exists public.supplier_code_seq;

-- B2. Generator function
create or replace function public.generate_supplier_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select 'FOR-' || lpad(nextval('public.supplier_code_seq')::text, 6, '0');
$$;

-- B3. Column (nullable first, no DEFAULT — avoids sequence advancement before backfill)
alter table public.suppliers
  add column code text;

-- B4. Backfill existing suppliers (deterministic: by created_at, then id)
with numbered as (
  select id,
         row_number() over (order by created_at, id) as rn
  from public.suppliers
)
update public.suppliers s
set code = 'FOR-' || lpad(n.rn::text, 6, '0')
from numbered n
where s.id = n.id;

-- B5. Sync sequence to continue after highest backfilled number
select setval(
  'public.supplier_code_seq',
  (select coalesce(max(replace(code, 'FOR-', '')::int), 0) from public.suppliers),
  true
);

-- B6. Add NOT NULL + DEFAULT for new inserts
alter table public.suppliers
  alter column code set not null,
  alter column code set default public.generate_supplier_code();

-- B7. Unique constraint
alter table public.suppliers
  add constraint suppliers_code_unique unique (code);

-- B8. Code immutability trigger
create or replace function public.prevent_supplier_code_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.code is distinct from new.code then
    raise exception 'O codigo do fornecedor nao pode ser alterado.';
  end if;
  return new;
end;
$$;

create trigger trg_suppliers_code_immutable
  before update on public.suppliers
  for each row
  execute function public.prevent_supplier_code_change();

-- B9. Revoke direct execution of generate_supplier_code
revoke execute on function public.generate_supplier_code() from public;
revoke execute on function public.generate_supplier_code() from anon;

commit;
