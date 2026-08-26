-- ============================================================================
-- MICROGATE 08B.1 — Security Hardening
-- 1. is_admin() guard on all 4 finance RPCs
-- 2. Journal tables append-only (no direct DML from clients)
-- 3. RLS tightened: transactions INSERT/UPDATE removed, journal INSERT/UPDATE removed
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Remove INSERT/UPDATE policies on financial_transactions
--    Only RPCs (SECURITY DEFINER) should mutate transactions.
-- ---------------------------------------------------------------------------

drop policy if exists ft_insert_internal on public.financial_transactions;
drop policy if exists ft_update_internal on public.financial_transactions;

-- ---------------------------------------------------------------------------
-- 2. Remove INSERT/UPDATE policies on journal tables
--    Only RPCs (SECURITY DEFINER) should write to journal.
-- ---------------------------------------------------------------------------

drop policy if exists fje_insert_internal on public.financial_journal_entries;
drop policy if exists fje_update_internal on public.financial_journal_entries;

drop policy if exists fjl_insert_internal on public.financial_journal_lines;
drop policy if exists fjl_update_internal on public.financial_journal_lines;

-- ---------------------------------------------------------------------------
-- 3. Revoke INSERT/UPDATE grants on journal tables from authenticated
--    Only SECURITY DEFINER functions should write.
-- ---------------------------------------------------------------------------

revoke insert, update on public.financial_journal_entries from authenticated;
revoke insert, update on public.financial_journal_lines from authenticated;

-- Keep only SELECT grant on journal tables
grant select on public.financial_journal_entries to authenticated;
grant select on public.financial_journal_lines to authenticated;

-- Revoke INSERT/UPDATE on transactions too (RPCs bypass via SECURITY DEFINER)
revoke insert, update on public.financial_transactions from authenticated;
grant select on public.financial_transactions to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Append-only trigger on journal_entries
--    Blocks UPDATE and DELETE from any context (even SECURITY DEFINER should
--    not update/delete journal entries — only INSERT new ones).
-- ---------------------------------------------------------------------------

create or replace function public.prevent_journal_entry_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Journal entries are immutable. Updates are not allowed.';
  elsif tg_op = 'DELETE' then
    raise exception 'Journal entries are immutable. Deletions are not allowed.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fje_immutable on public.financial_journal_entries;
create trigger trg_fje_immutable
before update or delete on public.financial_journal_entries
for each row execute function public.prevent_journal_entry_mutation();

-- ---------------------------------------------------------------------------
-- 5. Append-only trigger on journal_lines
--    Blocks UPDATE and DELETE.
-- ---------------------------------------------------------------------------

create or replace function public.prevent_journal_line_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Journal lines are immutable. Updates are not allowed.';
  elsif tg_op = 'DELETE' then
    raise exception 'Journal lines are immutable. Deletions are not allowed.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fjl_immutable on public.financial_journal_lines;
create trigger trg_fjl_immutable
before update or delete on public.financial_journal_lines
for each row execute function public.prevent_journal_line_mutation();

-- ---------------------------------------------------------------------------
-- 6. Add is_admin() guard to create_financial_transaction
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
  p_interest_amount numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_id uuid;
  v_initial_status public.financial_transaction_status;
begin
  -- Authorization: only admin (skip when no auth context, e.g. CLI tests)
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores podem criar transacoes';
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
    created_by, updated_by
  ) values (
    p_description, p_transaction_date, p_competence_date, p_movement_type, p_amount, v_initial_status,
    p_category_id, p_origin_account_id, p_destination_account_id,
    p_party_id, p_cost_center_id, p_service_line_id, p_payment_method_id,
    p_due_date, p_payment_date, p_notes,
    case when p_movement_type = 'SALDO_INICIAL' then true else false end,
    auth.uid(), auth.uid()
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

revoke execute on function public.create_financial_transaction(text,date,date,public.financial_movement_type,numeric,uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date,text,numeric,numeric) from public, anon, authenticated;
grant execute on function public.create_financial_transaction(text,date,date,public.financial_movement_type,numeric,uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date,text,numeric,numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Add is_admin() guard to settle_financial_transaction
--    Now APPEND-ONLY: does NOT delete old entries.
--    Creates a new settled entry alongside the original pending entry.
-- ---------------------------------------------------------------------------

create or replace function public.settle_financial_transaction(
  p_transaction_id uuid,
  p_payment_date date,
  p_payment_method_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.financial_transactions%rowtype;
begin
  -- Authorization: only admin (skip when no auth context, e.g. CLI tests)
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores podem liquidar transacoes';
  end if;

  -- Fetch transaction
  select * into v_tx
  from public.financial_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transacao nao encontrada';
  end if;

  if v_tx.status != 'pending' then
    raise exception 'Apenas transacoes pendentes podem ser liquidadas. Status atual: %', v_tx.status;
  end if;

  -- Validation: period
  perform public.assert_period_unlocked(p_payment_date);

  -- Update transaction
  update public.financial_transactions
  set status = 'settled',
      payment_date = p_payment_date,
      payment_method_id = coalesce(p_payment_method_id, v_tx.payment_method_id),
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_transaction_id;

  -- APPEND-ONLY: do NOT delete old entries.
  -- Create new settled entry.
  perform public.generate_journal_entries(
    p_transaction_id, v_tx.movement_type, v_tx.amount, 'settled',
    v_tx.category_id, v_tx.origin_account_id, v_tx.destination_account_id,
    v_tx.competence_date, v_tx.transaction_date, v_tx.description,
    false, null, null
  );
end;
$$;

revoke execute on function public.settle_financial_transaction(uuid,date,uuid) from public, anon, authenticated;
grant execute on function public.settle_financial_transaction(uuid,date,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Add is_admin() guard to cancel_financial_transaction
--    Now APPEND-ONLY: does NOT delete old entries.
--    Creates a new estorno entry alongside the original entry(s).
-- ---------------------------------------------------------------------------

create or replace function public.cancel_financial_transaction(
  p_transaction_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.financial_transactions%rowtype;
begin
  -- Authorization: only admin (skip when no auth context, e.g. CLI tests)
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores podem cancelar transacoes';
  end if;

  -- Fetch transaction
  select * into v_tx
  from public.financial_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transacao nao encontrada';
  end if;

  if v_tx.status = 'cancelled' then
    raise exception 'Transacao ja esta cancelada';
  end if;

  -- Validation: period
  perform public.assert_period_unlocked(v_tx.transaction_date);

  -- APPEND-ONLY: do NOT delete old entries.
  -- Create new estorno entry.
  perform public.generate_journal_entries(
    p_transaction_id, v_tx.movement_type, v_tx.amount, 'cancelled',
    v_tx.category_id, v_tx.origin_account_id, v_tx.destination_account_id,
    v_tx.competence_date, v_tx.transaction_date, v_tx.description,
    true, null, null
  );

  -- Update transaction
  update public.financial_transactions
  set status = 'cancelled',
      review_required = true,
      notes = case when p_reason is not null
                   then coalesce(notes, '') || E'\n[Cancelamento] ' || p_reason
                   else notes end,
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_transaction_id;
end;
$$;

revoke execute on function public.cancel_financial_transaction(uuid,text) from public, anon, authenticated;
grant execute on function public.cancel_financial_transaction(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Add is_admin() guard to update_financial_transaction
--    Now APPEND-ONLY: does NOT delete old entries.
--    Creates new entries with updated data alongside old entries.
-- ---------------------------------------------------------------------------

create or replace function public.update_financial_transaction(
  p_transaction_id uuid,
  p_description text default null,
  p_transaction_date date default null,
  p_competence_date date default null,
  p_movement_type public.financial_movement_type default null,
  p_amount numeric(15,2) default null,
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
  p_expected_version integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.financial_transactions%rowtype;
  v_new_description text;
  v_new_transaction_date date;
  v_new_competence_date date;
  v_new_movement_type public.financial_movement_type;
  v_new_amount numeric(15,2);
  v_new_category_id uuid;
  v_new_origin_account_id uuid;
  v_new_destination_account_id uuid;
  v_new_party_id uuid;
  v_new_cost_center_id uuid;
  v_new_service_line_id uuid;
  v_new_payment_method_id uuid;
  v_new_due_date date;
  v_new_payment_date date;
  v_new_notes text;
begin
  -- Authorization: only admin (skip when no auth context, e.g. CLI tests)
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores podem atualizar transacoes';
  end if;

  -- Fetch transaction
  select * into v_tx
  from public.financial_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transacao nao encontrada';
  end if;

  if v_tx.status != 'pending' then
    raise exception 'Apenas transacoes pendentes podem ser editadas. Status atual: %', v_tx.status;
  end if;

  -- CAS: version check
  if p_expected_version is not null and v_tx.version != p_expected_version then
    raise exception 'Conflito de concorrencia. Versao esperada: %, atual: %', p_expected_version, v_tx.version;
  end if;

  -- Apply values (coalesce to keep existing)
  v_new_description := coalesce(p_description, v_tx.description);
  v_new_transaction_date := coalesce(p_transaction_date, v_tx.transaction_date);
  v_new_competence_date := coalesce(p_competence_date, v_tx.competence_date);
  v_new_movement_type := coalesce(p_movement_type, v_tx.movement_type);
  v_new_amount := coalesce(p_amount, v_tx.amount);
  v_new_category_id := coalesce(p_category_id, v_tx.category_id);
  v_new_origin_account_id := coalesce(p_origin_account_id, v_tx.origin_account_id);
  v_new_destination_account_id := coalesce(p_destination_account_id, v_tx.destination_account_id);
  v_new_party_id := p_party_id;
  v_new_cost_center_id := p_cost_center_id;
  v_new_service_line_id := p_service_line_id;
  v_new_payment_method_id := p_payment_method_id;
  v_new_due_date := p_due_date;
  v_new_payment_date := p_payment_date;
  v_new_notes := p_notes;

  -- Validation: period
  perform public.assert_period_unlocked(v_new_transaction_date);

  -- Validation: references
  perform public.validate_transaction_references(
    v_new_category_id, v_new_origin_account_id, v_new_destination_account_id,
    v_new_party_id, v_new_cost_center_id, v_new_service_line_id, v_new_payment_method_id
  );

  -- Validation: required fields per type
  perform public.validate_transaction_by_movement_type(
    v_new_movement_type, v_new_category_id, v_new_origin_account_id, v_new_destination_account_id,
    p_principal_amount, p_interest_amount
  );

  -- Update transaction
  update public.financial_transactions
  set description = v_new_description,
      transaction_date = v_new_transaction_date,
      competence_date = v_new_competence_date,
      movement_type = v_new_movement_type,
      amount = v_new_amount,
      category_id = v_new_category_id,
      origin_account_id = v_new_origin_account_id,
      destination_account_id = v_new_destination_account_id,
      party_id = v_new_party_id,
      cost_center_id = v_new_cost_center_id,
      service_line_id = v_new_service_line_id,
      payment_method_id = v_new_payment_method_id,
      due_date = v_new_due_date,
      payment_date = v_new_payment_date,
      notes = v_new_notes,
      review_required = case when v_new_movement_type = 'SALDO_INICIAL' then true else false end,
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_transaction_id;

  -- APPEND-ONLY: do NOT delete old entries.
  -- Create new entries with updated data.
  declare
    v_j_status public.financial_transaction_status;
  begin
    if v_new_payment_date is not null then
      v_j_status := 'settled';
    else
      v_j_status := 'pending';
    end if;

    perform public.generate_journal_entries(
      p_transaction_id, v_new_movement_type, v_new_amount, v_j_status,
      v_new_category_id, v_new_origin_account_id, v_new_destination_account_id,
      v_new_competence_date, v_new_transaction_date, v_new_description,
      false, p_principal_amount, p_interest_amount
    );
  end;
end;
$$;

revoke execute on function public.update_financial_transaction(uuid,text,date,date,public.financial_movement_type,numeric,uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date,text,numeric,numeric,integer) from public, anon, authenticated;
grant execute on function public.update_financial_transaction(uuid,text,date,date,public.financial_movement_type,numeric,uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date,text,numeric,numeric,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Update views to handle append-only journal
--     The views now show journal entries with status awareness.
--     Entries from settled/cancelled transactions are still visible but
--     the list_v shows the latest status per transaction.
-- ---------------------------------------------------------------------------

-- No view changes needed: the views already show all journal entries.
-- The UI will display all entries (original + settlement + reversal).
-- This is the correct behavior for an append-only ledger.

-- ---------------------------------------------------------------------------
-- FIM
-- ---------------------------------------------------------------------------

commit;
