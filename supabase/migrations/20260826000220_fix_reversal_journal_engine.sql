begin;

-- Helper: insere pares de linhas de journal com lógica de estorno
-- Para estorno, inverte débito/crédito entre as duas linhas
create or replace function public._insert_journal_pair(
  p_entry_id uuid,
  p_account1 uuid, p_debit1 numeric, p_credit1 numeric, p_desc1 text,
  p_account2 uuid, p_debit2 numeric, p_credit2 numeric, p_desc2 text,
  p_is_reversal boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_is_reversal then
    -- Estorno: inverte débito/crédito entre as duas linhas
    insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    values
      (p_entry_id, p_account1, p_credit1, p_debit1, p_desc1),
      (p_entry_id, p_account2, p_credit2, p_debit2, p_desc2);
  else
    insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    values
      (p_entry_id, p_account1, p_debit1, p_credit1, p_desc1),
      (p_entry_id, p_account2, p_debit2, p_credit2, p_desc2);
  end if;
end;
$$;

revoke execute on function public._insert_journal_pair(uuid,uuid,numeric,numeric,text,uuid,numeric,numeric,text,boolean) from public, anon, authenticated;

-- Helper: insere três linhas de journal (para empréstimo pago com juros)
create or replace function public._insert_journal_triple(
  p_entry_id uuid,
  p_account1 uuid, p_debit1 numeric, p_credit1 numeric, p_desc1 text,
  p_account2 uuid, p_debit2 numeric, p_credit2 numeric, p_desc2 text,
  p_account3 uuid, p_debit3 numeric, p_credit3 numeric, p_desc3 text,
  p_is_reversal boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_is_reversal then
    insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    values
      (p_entry_id, p_account1, p_credit1, p_debit1, p_desc1),
      (p_entry_id, p_account2, p_credit2, p_debit2, p_desc2),
      (p_entry_id, p_account3, p_credit3, p_debit3, p_desc3);
  else
    insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    values
      (p_entry_id, p_account1, p_debit1, p_credit1, p_desc1),
      (p_entry_id, p_account2, p_debit2, p_credit2, p_desc2),
      (p_entry_id, p_account3, p_debit3, p_credit3, p_desc3);
  end if;
end;
$$;

revoke execute on function public._insert_journal_triple(uuid,uuid,numeric,numeric,text,uuid,numeric,numeric,text,uuid,numeric,numeric,text,boolean) from public, anon, authenticated;

-- Reescrever generate_journal_entries usando os helpers
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
    select c.counter_account_id into v_cat_acct from public.financial_categories c where c.id = p_category_id;
  end if;

  -- Fallback: se categoria não tem contrapartida, usar conta padrão por tipo
  if v_cat_acct is null then
    case p_movement_type
      when 'APORTE' then v_cat_acct := public.get_chart_account_id_by_code('2.3.01.001');
      when 'RETIRADA' then v_cat_acct := public.get_chart_account_id_by_code('2.3.04.001');
      when 'RECEITA' then v_cat_acct := public.get_chart_account_id_by_code('3.1.01.001');
      when 'DESPESA', 'IMOBILIZADO' then v_cat_acct := public.get_chart_account_id_by_code('5.9.01.001');
      else null;
    end case;
  end if;
  if p_origin_account_id is not null then
    select fa.chart_account_id into v_origin_acct from public.financial_accounts fa where fa.id = p_origin_account_id;
  end if;
  if p_destination_account_id is not null then
    select fa.chart_account_id into v_dest_acct from public.financial_accounts fa where fa.id = p_destination_account_id;
  end if;

  -- RECEITA
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

  -- DESPESA / IMOBILIZADO
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
      perform public._insert_journal_pair(v_entry_id, v_dest_acct, 0, v_amount, 'Banco', v_payable, v_amount, 0, 'Fornecedores a Pagar', p_is_reversal);

    elsif p_status = 'cancelled' then
      insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
      values (p_transaction_id, 'estorno', p_transaction_date, p_competence_date, p_description || ' - Estorno', 'cancelled', true)
      returning id into v_entry_id;
      perform public._insert_journal_pair(v_entry_id, v_cat_acct, 0, v_amount, 'Custo/Despesa (estorno)', v_payable, v_amount, 0, 'Fornecedores a Pagar (estorno)', p_is_reversal);
    end if;

  -- TRANSFERENCIA
  elsif p_movement_type = 'TRANSFERENCIA' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'transferencia', p_transaction_date, p_competence_date, p_description || ' - Transferencia', p_status, false)
    returning id into v_entry_id;
    perform public._insert_journal_pair(v_entry_id, v_dest_acct, v_amount, 0, 'Conta destino', v_origin_acct, 0, v_amount, 'Conta origem', p_is_reversal);

  -- EMPRESTIMO_RECEBIDO
  elsif p_movement_type = 'EMPRESTIMO_RECEBIDO' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'caixa', p_transaction_date, p_competence_date, p_description || ' - Emprestimo Recebido', p_status, false)
    returning id into v_entry_id;
    perform public._insert_journal_pair(v_entry_id, v_origin_acct, v_amount, 0, 'Banco', v_loan, 0, v_amount, 'Emprestimos', p_is_reversal);

  -- EMPRESTIMO_PAGO
  elsif p_movement_type = 'EMPRESTIMO_PAGO' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'caixa', p_transaction_date, p_competence_date, p_description || ' - Pagamento Emprestimo', p_status, false)
    returning id into v_entry_id;

    if v_interest > 0 then
      perform public._insert_journal_triple(
        v_entry_id,
        v_loan, v_principal, 0, 'Emprestimos (principal)',
        v_interest_exp, v_interest, 0, 'Juros e Encargos',
        v_dest_acct, 0, v_total, 'Banco',
        p_is_reversal
      );
    else
      perform public._insert_journal_pair(v_entry_id, v_loan, v_principal, 0, 'Emprestimos (principal)', v_dest_acct, 0, v_total, 'Banco', p_is_reversal);
    end if;

  -- APORTE
  elsif p_movement_type = 'APORTE' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'caixa', p_transaction_date, p_competence_date, p_description || ' - Aporte', p_status, false)
    returning id into v_entry_id;
    perform public._insert_journal_pair(v_entry_id, v_origin_acct, v_amount, 0, 'Banco', v_cat_acct, 0, v_amount, 'Capital/PL', p_is_reversal);

  -- RETIRADA
  elsif p_movement_type = 'RETIRADA' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'caixa', p_transaction_date, p_competence_date, p_description || ' - Retirada', p_status, false)
    returning id into v_entry_id;
    perform public._insert_journal_pair(v_entry_id, v_cat_acct, v_amount, 0, 'Conta PL', v_origin_acct, 0, v_amount, 'Banco', p_is_reversal);

  -- SALDO_INICIAL
  elsif p_movement_type = 'SALDO_INICIAL' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'caixa', p_transaction_date, p_competence_date, p_description || ' - Saldo Inicial', p_status, true)
    returning id into v_entry_id;
    perform public._insert_journal_pair(v_entry_id, v_origin_acct, v_amount, 0, 'Ativo/Caixa', v_opening_equity, 0, v_amount, 'Contrapartida de Saldos Iniciais', p_is_reversal);

  -- AJUSTE
  elsif p_movement_type = 'AJUSTE' then
    insert into public.financial_journal_entries (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values (p_transaction_id, 'ajuste', p_transaction_date, p_competence_date, p_description || ' - Ajuste', p_status, true);
  end if;
end;
$$;

revoke execute on function public.generate_journal_entries(uuid,public.financial_movement_type,numeric,public.financial_transaction_status,uuid,uuid,uuid,date,date,text,boolean,numeric,numeric) from public, anon, authenticated;

commit;
