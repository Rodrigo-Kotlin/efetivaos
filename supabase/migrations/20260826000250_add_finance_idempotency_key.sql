-- ============================================================================
-- MICROGATE 08B.1 — Idempotency Key
-- Adds idempotency_key to financial_transactions for duplicate prevention.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Add idempotency_key column (idempotent)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'financial_transactions' and column_name = 'idempotency_key'
  ) then
    alter table public.financial_transactions add column idempotency_key text;
  end if;
end $$;

-- Unique constraint: ensures no duplicate submissions (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_idempotency_key
  ON public.financial_transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Recreate create_financial_transaction with idempotency check
-- ---------------------------------------------------------------------------

create or replace function public.create_financial_transaction(
  p_description text,
  p_transaction_date date,
  p_competence_date date,
  p_movement_type public.financial_movement_type,
  p_amount numeric(15,2),
  p_category_id uuid default null,
  p_origin_account_id uuid default null,
  p_destination_account_id uuid default null,
  p_party_id uuid default null,
  p_cost_center_id uuid default null,
  p_service_line_id uuid default null,
  p_payment_method_id uuid default null,
  p_due_date date default null,
  p_payment_date date default null,
  p_notes text default null,
  p_principal_amount numeric default null,
  p_interest_amount numeric default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_id uuid;
  v_initial_status public.financial_transaction_status;
  v_existing_id uuid;
begin
  -- Authorization: only admin (skip when no auth context, e.g. CLI tests)
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores podem criar transacoes';
  end if;

  -- Idempotency: if key provided and already exists, return existing tx
  if p_idempotency_key is not null then
    select id into v_existing_id
    from public.financial_transactions
    where idempotency_key = p_idempotency_key
    limit 1;

    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  -- Validation: period
  perform public.assert_period_unlocked(p_transaction_date);

  -- Validation: references
  perform public.validate_transaction_references(
    p_category_id, p_origin_account_id, p_destination_account_id,
    p_party_id, p_cost_center_id, p_service_line_id, p_payment_method_id
  );

  -- Validation: required fields per type
  perform public.validate_transaction_by_movement_type(
    p_movement_type, p_category_id, p_origin_account_id, p_destination_account_id,
    p_principal_amount, p_interest_amount
  );

  -- Determine initial status
  if p_payment_date is not null then
    v_initial_status := 'settled';
  else
    v_initial_status := 'pending';
  end if;

  -- Insert transaction
  insert into public.financial_transactions (
    description, transaction_date, competence_date, movement_type, amount, status,
    category_id, origin_account_id, destination_account_id,
    party_id, cost_center_id, service_line_id, payment_method_id,
    due_date, payment_date, notes, review_required,
    created_by, updated_by, idempotency_key
  ) values (
    p_description, p_transaction_date, p_competence_date, p_movement_type, p_amount, v_initial_status,
    p_category_id, p_origin_account_id, p_destination_account_id,
    p_party_id, p_cost_center_id, p_service_line_id, p_payment_method_id,
    p_due_date, p_payment_date, p_notes,
    case when p_movement_type = 'SALDO_INICIAL' then true else false end,
    auth.uid(), auth.uid(), p_idempotency_key
  ) returning id into v_transaction_id;

  -- Generate journal entries
  perform public.generate_journal_entries(
    v_transaction_id, p_movement_type, p_amount, v_initial_status,
    p_category_id, p_origin_account_id, p_destination_account_id,
    p_competence_date, p_transaction_date, p_description,
    false, p_principal_amount, p_interest_amount
  );

  return v_transaction_id;
end;
$$;

revoke execute on function public.create_financial_transaction(text,date,date,public.financial_movement_type,numeric,uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date,text,numeric,numeric,text) from public, anon, authenticated;
grant execute on function public.create_financial_transaction(text,date,date,public.financial_movement_type,numeric,uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date,text,numeric,numeric,text) to authenticated;

-- ---------------------------------------------------------------------------
-- FIM
-- ---------------------------------------------------------------------------

commit;
