-- FIN-RECON-3: atomically replace an incorrectly classified settled transaction.
-- The original header and journal remain queryable; its journal is reversed by
-- the existing copy-based reversal engine before the replacement is created.

create or replace function public.correct_financial_transaction_to_opening_balance(
  p_original_transaction_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.financial_transactions%rowtype;
  v_replacement_id uuid;
  v_reason text;
  v_replacement public.financial_transactions%rowtype;
  v_origin_chart_account_id uuid;
  v_opening_equity_account_id uuid;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores podem corrigir transacoes financeiras';
  end if;

  select * into v_original
  from public.financial_transactions
  where id = p_original_transaction_id
  for update;

  if not found then
    raise exception 'Transacao original nao encontrada';
  end if;

  if v_original.status <> 'settled' then
    raise exception 'Apenas transacoes liquidadas podem ser reclassificadas';
  end if;

  if v_original.movement_type <> 'RECEITA' then
    raise exception 'A correcao de FIN-RECON-3 exige uma receita incorretamente classificada';
  end if;

  if v_original.payment_date is null or v_original.origin_account_id is null then
    raise exception 'A transacao original precisa ter data de pagamento e conta financeira';
  end if;

  v_reason := coalesce(nullif(btrim(p_reason), ''), 'Reclassificacao atomica FIN-RECON-3');

  -- Both calls run in this function transaction. Any failure in the second
  -- call rolls back the reversal and the original status update as well.
  perform public.cancel_financial_transaction(
    p_original_transaction_id,
    v_reason || ' | substituto SALDO_INICIAL sera criado atomicamente'
  );

  v_replacement_id := public.create_financial_transaction(
    v_original.description,
    v_original.transaction_date,
    v_original.competence_date,
    'SALDO_INICIAL'::public.financial_movement_type,
    v_original.amount,
    null,
    v_original.origin_account_id,
    null,
    null,
    null,
    null,
    null,
    null,
    v_original.payment_date,
    'Origem da reclassificacao: ' || p_original_transaction_id::text || E'\n' || v_reason,
    null,
    null,
    'FIN-RECON-3::' || p_original_transaction_id::text
  );

  select * into v_replacement
  from public.financial_transactions
  where id = v_replacement_id;

  if v_replacement.movement_type <> 'SALDO_INICIAL'
     or v_replacement.status <> 'settled'
     or v_replacement.amount <> v_original.amount
     or v_replacement.origin_account_id <> v_original.origin_account_id
     or v_replacement.category_id is not null
     or position(p_original_transaction_id::text in coalesce(v_replacement.notes, '')) = 0 then
    raise exception 'Substituto de saldo inicial inconsistente';
  end if;

  select fa.chart_account_id into v_origin_chart_account_id
  from public.financial_accounts fa
  where fa.id = v_original.origin_account_id;

  v_opening_equity_account_id := public.get_chart_account_id_by_code('2.3.99.001');

  if not exists (
    select 1
    from public.financial_journal_entries je
    join public.financial_journal_lines debit_line on debit_line.entry_id = je.id
    join public.financial_journal_lines credit_line on credit_line.entry_id = je.id
    where je.transaction_id = v_replacement_id
      and je.entry_type = 'caixa'
      and debit_line.chart_account_id = v_origin_chart_account_id
      and debit_line.debit = v_original.amount
      and debit_line.credit = 0
      and credit_line.chart_account_id = v_opening_equity_account_id
      and credit_line.credit = v_original.amount
      and credit_line.debit = 0
  ) then
    raise exception 'Journal substituto nao corresponde a saldo inicial';
  end if;

  if exists (
    select 1
    from public.financial_journal_entries je
    join public.financial_journal_lines jl on jl.entry_id = je.id
    join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
    where je.transaction_id = v_replacement_id
      and ca.class = 'RECEITA'
  ) then
    raise exception 'Substituto de saldo inicial nao pode creditar receita';
  end if;

  return v_replacement_id;
end;
$$;

revoke all on function public.correct_financial_transaction_to_opening_balance(uuid, text)
  from public, anon, authenticated;
grant execute on function public.correct_financial_transaction_to_opening_balance(uuid, text)
  to authenticated;

comment on function public.correct_financial_transaction_to_opening_balance(uuid, text)
  is 'Atomically reverses an incorrectly settled RECEITA and creates its SALDO_INICIAL replacement. Admin-only; FIN-RECON-3.';
