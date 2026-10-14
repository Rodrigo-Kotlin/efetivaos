-- FIN-FIX-2: restrict unsafe category mappings and reject invalid competence
-- counter accounts without changing financial transaction history.

begin;

-- These broad or unresolved categories remain available for historical reads,
-- but cannot be selected for new transactions until their accounting policy is
-- resolved and a non-cash counter account is assigned.
update public.financial_categories
set active = false,
    updated_at = now()
where id in (
  '1d36b4e3-c6f2-422e-aa29-f70fc26e4ced'::uuid, -- Servicos Terceirizados
  '6257ac44-be28-4172-9d3f-64fa056ca5fc'::uuid, -- Renovacao Documentacoes
  '0df0d9d1-d0c7-4215-a6b6-5d5dbced9708'::uuid  -- Materiais, Insumos e Equipamentos
);

-- This unused category is unambiguously a principal repayment. Keep the
-- liability counter account and align the category movement/DFC semantics.
update public.financial_categories
set movement_type = 'EMPRESTIMO_PAGO'::public.financial_movement_type,
    cash_flow_class = 'FINANCIAMENTO'::public.financial_dfc_class,
    updated_at = now()
where id = 'cad5c961-7c6d-4d32-915d-f5130374ee8e'::uuid;

create or replace function public.generate_journal_entries(
  p_transaction_id uuid,
  p_movement_type public.financial_movement_type,
  p_amount numeric(15,2),
  p_status public.financial_transaction_status,
  p_category_id uuid,
  p_origin_account_id uuid,
  p_destination_account_id uuid,
  p_competence_date date,
  p_transaction_date date,
  p_description text,
  p_is_reversal boolean default false,
  p_principal_amount numeric default null,
  p_interest_amount numeric default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry_id uuid;
  v_cat_acct uuid;
  v_category_class public.financial_account_class;
  v_category_is_cash boolean;
  v_category_active boolean;
  v_origin_acct uuid;
  v_dest_acct uuid;
  v_receivable uuid;
  v_payable uuid;
  v_loan uuid;
  v_interest_exp uuid;
  v_opening_equity uuid;
  v_amount numeric := abs(p_amount);
  v_principal numeric := coalesce(abs(p_principal_amount), v_amount);
  v_interest numeric := coalesce(abs(p_interest_amount), 0);
  v_total numeric := v_principal + v_interest;
begin
  v_receivable := public.get_chart_account_id_by_code('1.1.02.001');
  v_payable := public.get_chart_account_id_by_code('2.1.01.001');
  v_loan := public.get_chart_account_id_by_code('2.1.06.001');
  v_interest_exp := public.get_chart_account_id_by_code('6.1.01.001');
  v_opening_equity := public.get_chart_account_id_by_code('2.3.99.001');

  if p_category_id is not null then
    select c.counter_account_id
    into v_cat_acct
    from public.financial_categories c
    where c.id = p_category_id;
  end if;

  -- Competence postings must have an explicit, active, non-cash economic
  -- counter account. Never fall back to a generic expense account.
  if p_status = 'pending'
     and p_movement_type in ('DESPESA', 'IMOBILIZADO') then
    if p_category_id is null then
      raise exception 'Categoria obrigatoria para posting de competencia';
    end if;

    if v_cat_acct is null then
      raise exception 'Categoria sem counter_account_id para posting de competencia';
    end if;

    select ca.class, ca.is_cash, ca.active
    into v_category_class, v_category_is_cash, v_category_active
    from public.financial_chart_accounts ca
    where ca.id = v_cat_acct;

    if not found or v_category_active is not true then
      raise exception 'Counter account da categoria inexistente ou inativo';
    end if;

    if v_category_is_cash is true then
      raise exception 'Counter account de competencia nao pode ser conta financeira/is_cash';
    end if;

    if p_movement_type = 'IMOBILIZADO' and v_category_class <> 'ATIVO' then
      raise exception 'Imobilizado exige categoria vinculada a conta de ativo';
    end if;

    if p_movement_type = 'DESPESA'
       and v_category_class not in ('ATIVO', 'CUSTO', 'DESPESA') then
      raise exception 'Despesa exige contrapartida de ativo, custo ou despesa';
    end if;
  end if;

  if p_origin_account_id is not null then
    select fa.chart_account_id
    into v_origin_acct
    from public.financial_accounts fa
    where fa.id = p_origin_account_id;
  end if;

  if p_destination_account_id is not null then
    select fa.chart_account_id
    into v_dest_acct
    from public.financial_accounts fa
    where fa.id = p_destination_account_id;
  end if;

  if p_movement_type = 'RECEITA' then
    if p_status = 'pending' then
      insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
      values (p_transaction_id, 'competencia', p_transaction_date, p_competence_date, p_description || ' - Competencia', 'pending', false)
      returning id into v_entry_id;
      perform public._insert_journal_pair(v_entry_id, v_receivable, v_amount, 0, 'Clientes a Receber', v_cat_acct, 0, v_amount, 'Receita', p_is_reversal);
    elsif p_status = 'settled' then
      insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
      values (p_transaction_id, 'caixa', p_transaction_date, p_competence_date, p_description || ' - Liquidacao', 'settled', false)
      returning id into v_entry_id;
      perform public._insert_journal_pair(v_entry_id, v_origin_acct, v_amount, 0, 'Banco', v_receivable, 0, v_amount, 'Clientes a Receber', p_is_reversal);
    elsif p_status = 'cancelled' then
      insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
      values (p_transaction_id, 'estorno', p_transaction_date, p_competence_date, p_description || ' - Estorno', 'cancelled', true)
      returning id into v_entry_id;
      perform public._insert_journal_pair(v_entry_id, v_receivable, v_amount, 0, 'Clientes a Receber (estorno)', v_cat_acct, 0, v_amount, 'Receita (estorno)', p_is_reversal);
    end if;

  elsif p_movement_type in ('DESPESA', 'IMOBILIZADO') then
    if p_status = 'pending' then
      insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
      values (p_transaction_id, 'competencia', p_transaction_date, p_competence_date, p_description || ' - Competencia', 'pending', false)
      returning id into v_entry_id;
      perform public._insert_journal_pair(v_entry_id, v_payable, 0, v_amount, 'Fornecedores a Pagar', v_cat_acct, v_amount, 0, 'Custo/Despesa', p_is_reversal);
    elsif p_status = 'settled' then
      insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
      values (p_transaction_id, 'caixa', p_transaction_date, p_competence_date, p_description || ' - Liquidacao', 'settled', false)
      returning id into v_entry_id;
      perform public._insert_journal_pair(v_entry_id, v_payable, v_amount, 0, 'Fornecedores a Pagar', v_dest_acct, 0, v_amount, 'Banco', p_is_reversal);
    elsif p_status = 'cancelled' then
      insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
      values (p_transaction_id, 'estorno', p_transaction_date, p_competence_date, p_description || ' - Estorno', 'cancelled', false)
      returning id into v_entry_id;
      perform public._insert_journal_pair(v_entry_id, v_payable, v_amount, 0, 'Fornecedores a Pagar (estorno)', v_cat_acct, 0, v_amount, 'Custo/Despesa (estorno)', p_is_reversal);
    end if;

  elsif p_movement_type = 'TRANSFERENCIA' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'transferencia', p_transaction_date, p_competence_date, p_description || ' - Transferencia', p_status, false)
    returning id into v_entry_id;
    perform public._insert_journal_pair(v_entry_id, v_dest_acct, v_amount, 0, 'Conta destino', v_origin_acct, 0, v_amount, 'Conta origem', p_is_reversal);

  elsif p_movement_type = 'EMPRESTIMO_RECEBIDO' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'caixa', p_transaction_date, p_competence_date, p_description || ' - Emprestimo Recebido', p_status, false)
    returning id into v_entry_id;
    perform public._insert_journal_pair(v_entry_id, v_origin_acct, v_amount, 0, 'Banco', v_loan, 0, v_amount, 'Emprestimos', p_is_reversal);

  elsif p_movement_type = 'EMPRESTIMO_PAGO' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'caixa', p_transaction_date, p_competence_date, p_description || ' - Pagamento Emprestimo', p_status, false)
    returning id into v_entry_id;
    if v_interest > 0 then
      perform public._insert_journal_triple(v_entry_id, v_loan, v_principal, 0, 'Emprestimos (principal)', v_interest_exp, v_interest, 0, 'Juros e Encargos', v_dest_acct, 0, v_total, 'Banco', p_is_reversal);
    else
      perform public._insert_journal_pair(v_entry_id, v_loan, v_principal, 0, 'Emprestimos (principal)', v_dest_acct, 0, v_total, 'Banco', p_is_reversal);
    end if;

  elsif p_movement_type = 'APORTE' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'caixa', p_transaction_date, p_competence_date, p_description || ' - Aporte', p_status, false)
    returning id into v_entry_id;
    perform public._insert_journal_pair(v_entry_id, v_origin_acct, v_amount, 0, 'Banco', v_cat_acct, 0, v_amount, 'Capital/PL', p_is_reversal);

  elsif p_movement_type = 'RETIRADA' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'caixa', p_transaction_date, p_competence_date, p_description || ' - Retirada', p_status, false)
    returning id into v_entry_id;
    perform public._insert_journal_pair(v_entry_id, v_cat_acct, v_amount, 0, 'Conta PL', v_origin_acct, 0, v_amount, 'Banco', p_is_reversal);

  elsif p_movement_type = 'SALDO_INICIAL' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'caixa', p_transaction_date, p_competence_date, p_description || ' - Saldo Inicial', p_status, true)
    returning id into v_entry_id;
    perform public._insert_journal_pair(v_entry_id, v_origin_acct, v_amount, 0, 'Ativo/Caixa', v_opening_equity, 0, v_amount, 'Contrapartida de Saldos Iniciais', p_is_reversal);

  elsif p_movement_type = 'AJUSTE' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'ajuste', p_transaction_date, p_competence_date, p_description || ' - Ajuste', p_status, true);
  end if;
end;
$$;

revoke execute on function public.generate_journal_entries(
  uuid, public.financial_movement_type, numeric, public.financial_transaction_status,
  uuid, uuid, uuid, date, date, text, boolean, numeric, numeric
) from public, anon, authenticated;

commit;
