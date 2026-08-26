-- ============================================================================
-- EFETIVA OS — ETAPA 08B — Motor de Lançamentos e Partidas Dobradas
-- Migration: Transactions, Journal Entries, Journal Lines, RPCs
--
-- Referência canônica: Efetiva Financeiro 360 v2.0.0 (server.js)
-- Preserva:三层架构 (transactions → journal_entries → journal_lines),
--           competência × caixa, cancelamento por estorno, fechamento de período,
--           concorrência via version, RLS SECURITY DEFINER.
--
-- NÃO cria: DRE, BP, DFC, DMPL, DLPA, DVA, Dashboard (futuras etapas).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Enum — financial_transaction_status
-- ---------------------------------------------------------------------------

create type public.financial_transaction_status as enum (
  'pending', 'settled', 'cancelled'
);

-- ---------------------------------------------------------------------------
-- 2. Tabela — financial_transactions
--    Cabeçalho da transação operacional. O motor gera lançamentos contábeis
--    automaticamente a partir deste registro.
-- ---------------------------------------------------------------------------

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  transaction_date date not null default current_date,
  competence_date date not null default date_trunc('month', current_date)::date,
  movement_type public.financial_movement_type not null,
  amount numeric(15,2) not null check (amount > 0),
  status public.financial_transaction_status not null default 'pending',

  -- Referências (nullable conforme tipo de movimento)
  category_id uuid references public.financial_categories(id) on delete restrict,
  origin_account_id uuid references public.financial_accounts(id) on delete restrict,
  destination_account_id uuid references public.financial_accounts(id) on delete restrict,
  party_id uuid references public.financial_parties(id) on delete set null,
  cost_center_id uuid references public.financial_cost_centers(id) on delete set null,
  service_line_id uuid references public.financial_service_lines(id) on delete set null,
  payment_method_id uuid references public.financial_payment_methods(id) on delete set null,

  -- Datas
  due_date date,
  payment_date date,

  -- Metadados
  notes text,
  review_required boolean not null default false,

  -- Concorrência
  version integer not null default 1,

  -- Auditoria
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,

  -- Constraints
  constraint ft_description_length_chk check (char_length(description) between 1 and 500),
  constraint ft_notes_length_chk check (notes is null or char_length(notes) <= 2000),
  constraint ft_competence_before_transaction_chk check (competence_date <= transaction_date),
  constraint ft_payment_date_after_transaction_chk check (payment_date is null or payment_date >= transaction_date),
  constraint ft_due_date_after_transaction_chk check (due_date is null or due_date >= transaction_date)
);

-- ---------------------------------------------------------------------------
-- 3. Tabela — financial_journal_entries
--    Cada transação gera um ou mais lançamentos contábeis (competência, caixa,
--    transferência, etc.). Cada entry contém linhas que somam débito = crédito.
-- ---------------------------------------------------------------------------

create table public.financial_journal_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.financial_transactions(id) on delete cascade,
  entry_type text not null default 'operacional',
  entry_date date not null default current_date,
  competence_date date not null default date_trunc('month', current_date)::date,
  description text not null,
  status public.financial_transaction_status not null default 'pending',
  review_required boolean not null default false,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,

  constraint fje_description_length_chk check (char_length(description) between 1 and 300),
  constraint fje_entry_type_chk check (entry_type in ('operacional', 'competencia', 'caixa', 'transferencia', 'ajuste', 'estorno'))
);

-- ---------------------------------------------------------------------------
-- 4. Tabela — financial_journal_lines
--    Linhas de débito/crédito de cada lançamento contábil.
--    Regra: debit > 0 XOR credit > 0; cada entry: SUM(debit) = SUM(credit).
-- ---------------------------------------------------------------------------

create table public.financial_journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.financial_journal_entries(id) on delete cascade,
  chart_account_id uuid not null references public.financial_chart_accounts(id) on delete restrict,
  debit numeric(15,2) not null default 0 check (debit >= 0),
  credit numeric(15,2) not null default 0 check (credit >= 0),
  description text,

  created_at timestamptz not null default now(),

  constraint fjl_debit_credit_xor_chk check (
    (debit > 0 and credit = 0) or (debit = 0 and credit > 0)
  ),
  constraint fjl_description_length_chk check (description is null or char_length(description) <= 300)
);

-- ---------------------------------------------------------------------------
-- 5. Índices
-- ---------------------------------------------------------------------------

create index idx_ft_status on public.financial_transactions (status);
create index idx_ft_movement_type on public.financial_transactions (movement_type);
create index idx_ft_transaction_date on public.financial_transactions (transaction_date);
create index idx_ft_competence_date on public.financial_transactions (competence_date);
create index idx_ft_category on public.financial_transactions (category_id) where category_id is not null;
create index idx_ft_origin_account on public.financial_transactions (origin_account_id) where origin_account_id is not null;
create index idx_ft_destination_account on public.financial_transactions (destination_account_id) where destination_account_id is not null;
create index idx_ft_party on public.financial_transactions (party_id) where party_id is not null;
create index idx_ft_created_by on public.financial_transactions (created_by);
create index idx_ft_created_at on public.financial_transactions (created_at);

create index idx_fje_transaction on public.financial_journal_entries (transaction_id);
create index idx_fje_status on public.financial_journal_entries (status);
create index idx_fje_entry_date on public.financial_journal_entries (entry_date);

create index idx_fjl_entry on public.financial_journal_lines (entry_id);
create index idx_fjl_chart_account on public.financial_journal_lines (chart_account_id);

-- ---------------------------------------------------------------------------
-- 6. Funções auxiliares
-- ---------------------------------------------------------------------------

-- Busca ID da conta contábil por código
create or replace function public.get_chart_account_id_by_code(p_code text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select ca.id into v_id
  from public.financial_chart_accounts ca
  where ca.code = p_code and ca.active = true
  limit 1;

  if v_id is null then
    raise exception 'Conta contábil com código % não encontrada ou inativa', p_code;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.get_chart_account_id_by_code(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Validação de período bloqueado
-- ---------------------------------------------------------------------------

create or replace function public.assert_period_unlocked(p_date date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_locked boolean;
begin
  select exists(
    select 1 from public.financial_period_locks pl
    where p_date >= pl.period_start and p_date <= pl.period_end
  ) into v_locked;

  if v_locked then
    raise exception 'Período bloqueado para a data %', p_date;
  end if;
end;
$$;

revoke execute on function public.assert_period_unlocked(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Validação de categorias e contas ativas
-- ---------------------------------------------------------------------------

create or replace function public.validate_transaction_references(
  p_category_id uuid,
  p_origin_account_id uuid,
  p_destination_account_id uuid,
  p_party_id uuid,
  p_cost_center_id uuid,
  p_service_line_id uuid,
  p_payment_method_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_category_id is not null then
    if not exists(select 1 from public.financial_categories where id = p_category_id and active = true) then
      raise exception 'Categoria não encontrada ou inativa';
    end if;
  end if;

  if p_origin_account_id is not null then
    if not exists(select 1 from public.financial_accounts where id = p_origin_account_id and active = true) then
      raise exception 'Conta financeira de origem não encontrada ou inativa';
    end if;
  end if;

  if p_destination_account_id is not null then
    if not exists(select 1 from public.financial_accounts where id = p_destination_account_id and active = true) then
      raise exception 'Conta financeira de destino não encontrada ou inativa';
    end if;
  end if;

  if p_party_id is not null then
    if not exists(select 1 from public.financial_parties where id = p_party_id and active = true) then
      raise exception 'Parte/contraparte não encontrada ou inativa';
    end if;
  end if;

  if p_cost_center_id is not null then
    if not exists(select 1 from public.financial_cost_centers where id = p_cost_center_id and active = true) then
      raise exception 'Centro de custo não encontrado ou inativo';
    end if;
  end if;

  if p_service_line_id is not null then
    if not exists(select 1 from public.financial_service_lines where id = p_service_line_id and active = true) then
      raise exception 'Linha de serviço não encontrada ou inativa';
    end if;
  end if;

  if p_payment_method_id is not null then
    if not exists(select 1 from public.financial_payment_methods where id = p_payment_method_id and active = true) then
      raise exception 'Forma de pagamento não encontrada ou inativa';
    end if;
  end if;
end;
$$;

revoke execute on function public.validate_transaction_references(uuid,uuid,uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Validação de campos obrigatórios por tipo de movimento
-- ---------------------------------------------------------------------------

create or replace function public.validate_transaction_by_movement_type(
  p_movement_type public.financial_movement_type,
  p_category_id uuid,
  p_origin_account_id uuid,
  p_destination_account_id uuid,
  p_principal_amount numeric,
  p_interest_amount numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  case p_movement_type
    when 'RECEITA' then
      if p_category_id is null then
        raise exception 'Categoria é obrigatória para receita';
      end if;
      if p_origin_account_id is null then
        raise exception 'Conta de origem é obrigatória para receita';
      end if;

    when 'DESPESA' then
      if p_category_id is null then
        raise exception 'Categoria é obrigatória para despesa';
      end if;
      if p_destination_account_id is null then
        raise exception 'Conta de destino é obrigatória para despesa';
      end if;

    when 'TRANSFERENCIA' then
      if p_origin_account_id is null then
        raise exception 'Conta de origem é obrigatória para transferência';
      end if;
      if p_destination_account_id is null then
        raise exception 'Conta de destino é obrigatória para transferência';
      end if;
      if p_origin_account_id = p_destination_account_id then
        raise exception 'Conta de origem e destino devem ser diferentes';
      end if;

    when 'EMPRESTIMO_RECEBIDO' then
      if p_origin_account_id is null then
        raise exception 'Conta de origem é obrigatória para empréstimo recebido';
      end if;

    when 'EMPRESTIMO_PAGO' then
      if p_destination_account_id is null then
        raise exception 'Conta de destino é obrigatória para pagamento de empréstimo';
      end if;
      if p_principal_amount is null or p_principal_amount <= 0 then
        raise exception 'Valor do principal é obrigatório e deve ser positivo';
      end if;
      if p_interest_amount is null or p_interest_amount < 0 then
        raise exception 'Valor dos juros deve ser não-negativo';
      end if;

    when 'APORTE' then
      if p_origin_account_id is null then
        raise exception 'Conta de origem é obrigatória para aporte';
      end if;

    when 'RETIRADA' then
      if p_origin_account_id is null then
        raise exception 'Conta de origem é obrigatória para retirada';
      end if;

    when 'IMOBILIZADO' then
      if p_category_id is null then
        raise exception 'Categoria é obrigatória para imobilizado';
      end if;

    when 'SALDO_INICIAL' then
      if p_origin_account_id is null then
        raise exception 'Conta de origem é obrigatória para saldo inicial';
      end if;

    when 'AJUSTE' then
      -- AJUSTE: sem validação específica (suporte estrutural)
      null;
  end case;
end;
$$;

revoke execute on function public.validate_transaction_by_movement_type(public.financial_movement_type,uuid,uuid,uuid,numeric,numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. Motor de partidas dobradas — generate_journal_entries
--     Gera lançamentos contábeis a partir de uma transação.
--     Chamado internamente por create/settle/cancel.
-- ---------------------------------------------------------------------------

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
  v_category_counter_account_id uuid;
  v_origin_chart_account_id uuid;
  v_destination_chart_account_id uuid;
  v_receivable_account_id uuid;
  v_payable_account_id uuid;
  v_loan_account_id uuid;
  v_interest_expense_account_id uuid;
  v_opening_equity_account_id uuid;
  v_multiplier numeric := case when p_is_reversal then -1 else 1 end;
  v_amount numeric := abs(p_amount);
  v_principal numeric := coalesce(abs(p_principal_amount), v_amount);
  v_interest numeric := coalesce(abs(p_interest_amount), 0);
  v_total numeric := v_principal + v_interest;
begin
  -- Contas auxiliares fixas
  v_receivable_account_id := public.get_chart_account_id_by_code('1.1.02.001');
  v_payable_account_id := public.get_chart_account_id_by_code('2.1.01.001');
  v_loan_account_id := public.get_chart_account_id_by_code('2.1.06.001');
  v_interest_expense_account_id := public.get_chart_account_id_by_code('6.1.01.001');
  v_opening_equity_account_id := public.get_chart_account_id_by_code('2.3.99.001');

  -- Conta da categoria
  if p_category_id is not null then
    select c.counter_account_id into v_category_counter_account_id
    from public.financial_categories c
    where c.id = p_category_id;
  end if;

  -- Conta contábil da conta financeira de origem
  if p_origin_account_id is not null then
    select fa.chart_account_id into v_origin_chart_account_id
    from public.financial_accounts fa
    where fa.id = p_origin_account_id;
  end if;

  -- Conta contábil da conta financeira de destino
  if p_destination_account_id is not null then
    select fa.chart_account_id into v_destination_chart_account_id
    from public.financial_accounts fa
    where fa.id = p_destination_account_id;
  end if;

  -- -------------------------------------------------------------------------
  -- RECEITA
  -- -------------------------------------------------------------------------
  if p_movement_type = 'RECEITA' then
    if p_status = 'pending' then
      -- Competência: D Clientes a Receber / C Receita
      insert into public.financial_journal_entries
        (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
      values
        (p_transaction_id, 'competencia', p_transaction_date, p_competence_date,
         p_description || ' - Competência', 'pending', false)
      returning id into v_entry_id;

      insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
      values
        (v_entry_id, v_receivable_account_id, v_amount * v_multiplier, 0, 'Clientes a Receber'),
        (v_entry_id, v_category_counter_account_id, 0, v_amount * v_multiplier, 'Receita');

    elsif p_status = 'settled' then
      -- Caixa: D Banco / C Clientes a Receber
      insert into public.financial_journal_entries
        (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
      values
        (p_transaction_id, 'caixa', p_transaction_date, p_competence_date,
         p_description || ' - Liquidação', 'settled', false)
      returning id into v_entry_id;

      insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
      values
        (v_entry_id, v_origin_chart_account_id, v_amount * v_multiplier, 0, 'Banco'),
        (v_entry_id, v_receivable_account_id, 0, v_amount * v_multiplier, 'Clientes a Receber');

    elsif p_status = 'cancelled' then
      -- Estorno: D Receita / C Clientes a Receber (inversão da competência)
      insert into public.financial_journal_entries
        (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
      values
        (p_transaction_id, 'estorno', p_transaction_date, p_competence_date,
         p_description || ' - Estorno', 'cancelled', false)
      returning id into v_entry_id;

      insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
      values
        (v_entry_id, v_category_counter_account_id, v_amount * v_multiplier, 0, 'Receita (estorno)'),
        (v_entry_id, v_receivable_account_id, 0, v_amount * v_multiplier, 'Clientes a Receber (estorno)');
    end if;

  -- -------------------------------------------------------------------------
  -- DESPESA / IMOBILIZADO
  -- -------------------------------------------------------------------------
  elsif p_movement_type in ('DESPESA', 'IMOBILIZADO') then
    if p_status = 'pending' then
      -- Competência: D Custo/Despesa / C Fornecedores a Pagar
      insert into public.financial_journal_entries
        (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
      values
        (p_transaction_id, 'competencia', p_transaction_date, p_competence_date,
         p_description || ' - Competência', 'pending', false)
      returning id into v_entry_id;

      insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
      values
        (v_entry_id, v_category_counter_account_id, 0, v_amount * v_multiplier, 'Custo/Despesa'),
        (v_entry_id, v_payable_account_id, 0, v_amount * v_multiplier, 'Fornecedores a Pagar');

    elsif p_status = 'settled' then
      -- Caixa: D Fornecedores a Pagar / C Banco
      insert into public.financial_journal_entries
        (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
      values
        (p_transaction_id, 'caixa', p_transaction_date, p_competence_date,
         p_description || ' - Liquidação', 'settled', false)
      returning id into v_entry_id;

      insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
      values
        (v_entry_id, v_payable_account_id, v_amount * v_multiplier, 0, 'Fornecedores a Pagar'),
        (v_entry_id, v_destination_chart_account_id, 0, v_amount * v_multiplier, 'Banco');

    elsif p_status = 'cancelled' then
      -- Estorno: D Fornecedores a Pagar / C Custo/Despesa (inversão da competência)
      insert into public.financial_journal_entries
        (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
      values
        (p_transaction_id, 'estorno', p_transaction_date, p_competence_date,
         p_description || ' - Estorno', 'cancelled', false)
      returning id into v_entry_id;

      insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
      values
        (v_entry_id, v_payable_account_id, v_amount * v_multiplier, 0, 'Fornecedores a Pagar (estorno)'),
        (v_entry_id, v_category_counter_account_id, 0, v_amount * v_multiplier, 'Custo/Despesa (estorno)');
    end if;

  -- -------------------------------------------------------------------------
  -- TRANSFERENCIA
  -- -------------------------------------------------------------------------
  elsif p_movement_type = 'TRANSFERENCIA' then
    -- D Conta destino / C Conta origem
    insert into public.financial_journal_entries
      (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values
      (p_transaction_id, 'transferencia', p_transaction_date, p_competence_date,
       p_description || ' - Transferência', p_status, false)
    returning id into v_entry_id;

    insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    values
      (v_entry_id, v_destination_chart_account_id, v_amount * v_multiplier, 0, 'Conta destino'),
      (v_entry_id, v_origin_chart_account_id, 0, v_amount * v_multiplier, 'Conta origem');

  -- -------------------------------------------------------------------------
  -- EMPRESTIMO_RECEBIDO
  -- -------------------------------------------------------------------------
  elsif p_movement_type = 'EMPRESTIMO_RECEBIDO' then
    -- D Banco / C Empréstimos
    insert into public.financial_journal_entries
      (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values
      (p_transaction_id, 'caixa', p_transaction_date, p_competence_date,
       p_description || ' - Empréstimo Recebido', p_status, false)
    returning id into v_entry_id;

    insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    values
      (v_entry_id, v_origin_chart_account_id, v_amount * v_multiplier, 0, 'Banco'),
      (v_entry_id, v_loan_account_id, 0, v_amount * v_multiplier, 'Empréstimos');

  -- -------------------------------------------------------------------------
  -- EMPRESTIMO_PAGO
  -- -------------------------------------------------------------------------
  elsif p_movement_type = 'EMPRESTIMO_PAGO' then
    -- D Empréstimos (principal) + D Despesa Financeira (juros) / C Banco
    insert into public.financial_journal_entries
      (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values
      (p_transaction_id, 'caixa', p_transaction_date, p_competence_date,
       p_description || ' - Pagamento Empréstimo', p_status, false)
    returning id into v_entry_id;

    insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    values
      (v_entry_id, v_loan_account_id, v_principal * v_multiplier, 0, 'Empréstimos (principal)');

    if v_interest > 0 then
      insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
      values
        (v_entry_id, v_interest_expense_account_id, v_interest * v_multiplier, 0, 'Juros e Encargos');
    end if;

    insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    values
      (v_entry_id, v_destination_chart_account_id, 0, v_total * v_multiplier, 'Banco');

  -- -------------------------------------------------------------------------
  -- APORTE
  -- -------------------------------------------------------------------------
  elsif p_movement_type = 'APORTE' then
    -- D Banco / C Capital/AFAC/PL
    insert into public.financial_journal_entries
      (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values
      (p_transaction_id, 'caixa', p_transaction_date, p_competence_date,
       p_description || ' - Aporte', p_status, false)
    returning id into v_entry_id;

    insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    values
      (v_entry_id, v_origin_chart_account_id, v_amount * v_multiplier, 0, 'Banco'),
      (v_entry_id, v_category_counter_account_id, 0, v_amount * v_multiplier, 'Capital/PL');

  -- -------------------------------------------------------------------------
  -- RETIRADA
  -- -------------------------------------------------------------------------
  elsif p_movement_type = 'RETIRADA' then
    -- D Conta PL / C Banco
    insert into public.financial_journal_entries
      (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values
      (p_transaction_id, 'caixa', p_transaction_date, p_competence_date,
       p_description || ' - Retirada', p_status, false)
    returning id into v_entry_id;

    insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    values
      (v_entry_id, v_category_counter_account_id, v_amount * v_multiplier, 0, 'Conta PL'),
      (v_entry_id, v_origin_chart_account_id, 0, v_amount * v_multiplier, 'Banco');

  -- -------------------------------------------------------------------------
  -- SALDO_INICIAL
  -- -------------------------------------------------------------------------
  elsif p_movement_type = 'SALDO_INICIAL' then
    -- D Ativo/Caixa / C Contrapartida de Saldos Iniciais (review_required = true)
    insert into public.financial_journal_entries
      (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values
      (p_transaction_id, 'caixa', p_transaction_date, p_competence_date,
       p_description || ' - Saldo Inicial', p_status, true)
    returning id into v_entry_id;

    insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    values
      (v_entry_id, v_origin_chart_account_id, v_amount * v_multiplier, 0, 'Ativo/Caixa'),
      (v_entry_id, v_opening_equity_account_id, 0, v_amount * v_multiplier, 'Contrapartida de Saldos Iniciais');

  -- -------------------------------------------------------------------------
  -- AJUSTE
  -- -------------------------------------------------------------------------
  elsif p_movement_type = 'AJUSTE' then
    -- Suporte estrutural apenas — sem geração automática
    insert into public.financial_journal_entries
      (transaction_id, entry_type, entry_date, competence_date, description, status, review_required)
    values
      (p_transaction_id, 'ajuste', p_transaction_date, p_competence_date,
       p_description || ' - Ajuste', p_status, true);
  end if;
end;
$$;

revoke execute on function public.generate_journal_entries(uuid,public.financial_movement_type,numeric,public.financial_transaction_status,uuid,uuid,uuid,date,date,text,boolean,numeric,numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 11. RPC — create_financial_transaction
--     Cria transação + gera lançamentos contábeis atomicamente.
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
  -- Validação: período bloqueado
  perform public.assert_period_unlocked(p_transaction_date);

  -- Validação: referências ativas
  perform public.validate_transaction_references(
    p_category_id, p_origin_account_id, p_destination_account_id,
    p_party_id, p_cost_center_id, p_service_line_id, p_payment_method_id
  );

  -- Validação: campos obrigatórios por tipo
  perform public.validate_transaction_by_movement_type(
    p_movement_type, p_category_id, p_origin_account_id, p_destination_account_id,
    p_principal_amount, p_interest_amount
  );

  -- Determinar status inicial
  if p_payment_date is not null then
    v_initial_status := 'settled';
  else
    v_initial_status := 'pending';
  end if;

  -- Inserir transação
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

  -- Gerar lançamentos contábeis
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
-- 12. RPC — settle_financial_transaction
--     Liquida uma transação pendente: status → settled, regenera journal.
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
  -- Buscar transação
  select * into v_tx
  from public.financial_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transação não encontrada';
  end if;

  if v_tx.status != 'pending' then
    raise exception 'Apenas transações pendentes podem ser liquidadas. Status atual: %', v_tx.status;
  end if;

  -- Validação: período bloqueado
  perform public.assert_period_unlocked(p_payment_date);

  -- Atualizar transação
  update public.financial_transactions
  set status = 'settled',
      payment_date = p_payment_date,
      payment_method_id = coalesce(p_payment_method_id, v_tx.payment_method_id),
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_transaction_id;

  -- Remover lançamentos anteriores
  delete from public.financial_journal_lines
  where entry_id in (
    select id from public.financial_journal_entries where transaction_id = p_transaction_id
  );
  delete from public.financial_journal_entries
  where transaction_id = p_transaction_id;

  -- Gerar novos lançamentos com status settled
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
-- 13. RPC — cancel_financial_transaction
--     Cancela uma transação: status → cancelled, gera estorno se necessário.
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
  -- Buscar transação
  select * into v_tx
  from public.financial_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transação não encontrada';
  end if;

  if v_tx.status = 'cancelled' then
    raise exception 'Transação já está cancelada';
  end if;

  -- Validação: período bloqueado (usa transaction_date original)
  perform public.assert_period_unlocked(v_tx.transaction_date);

  -- Remover lançamentos anteriores
  delete from public.financial_journal_lines
  where entry_id in (
    select id from public.financial_journal_entries where transaction_id = p_transaction_id
  );
  delete from public.financial_journal_entries
  where transaction_id = p_transaction_id;

  -- Gerar lançamentos de estorno
  perform public.generate_journal_entries(
    p_transaction_id, v_tx.movement_type, v_tx.amount, 'cancelled',
    v_tx.category_id, v_tx.origin_account_id, v_tx.destination_account_id,
    v_tx.competence_date, v_tx.transaction_date, v_tx.description,
    true, null, null
  );

  -- Atualizar transação
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
-- 14. RPC — update_financial_transaction
--     Atualiza transação pendente + regenera journal.
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
  -- Buscar transação
  select * into v_tx
  from public.financial_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transação não encontrada';
  end if;

  if v_tx.status != 'pending' then
    raise exception 'Apenas transações pendentes podem ser editadas. Status atual: %', v_tx.status;
  end if;

  -- CAS: version check
  if p_expected_version is not null and v_tx.version != p_expected_version then
    raise exception 'Conflito de concorrência. Versão esperada: %, atual: %', p_expected_version, v_tx.version;
  end if;

  -- Aplicar valores (usar coalesce para manter valores existentes)
  v_new_description := coalesce(p_description, v_tx.description);
  v_new_transaction_date := coalesce(p_transaction_date, v_tx.transaction_date);
  v_new_competence_date := coalesce(p_competence_date, v_tx.competence_date);
  v_new_movement_type := coalesce(p_movement_type, v_tx.movement_type);
  v_new_amount := coalesce(p_amount, v_tx.amount);
  v_new_category_id := coalesce(p_category_id, v_tx.category_id);
  v_new_origin_account_id := coalesce(p_origin_account_id, v_tx.origin_account_id);
  v_new_destination_account_id := coalesce(p_destination_account_id, v_tx.destination_account_id);
  v_new_party_id := p_party_id;  -- pode ser null para remover
  v_new_cost_center_id := p_cost_center_id;
  v_new_service_line_id := p_service_line_id;
  v_new_payment_method_id := p_payment_method_id;
  v_new_due_date := p_due_date;
  v_new_payment_date := p_payment_date;
  v_new_notes := p_notes;

  -- Validação: período bloqueado
  perform public.assert_period_unlocked(v_new_transaction_date);

  -- Validação: referências ativas
  perform public.validate_transaction_references(
    v_new_category_id, v_new_origin_account_id, v_new_destination_account_id,
    v_new_party_id, v_new_cost_center_id, v_new_service_line_id, v_new_payment_method_id
  );

  -- Validação: campos obrigatórios por tipo
  perform public.validate_transaction_by_movement_type(
    v_new_movement_type, v_new_category_id, v_new_origin_account_id, v_new_destination_account_id,
    p_principal_amount, p_interest_amount
  );

  -- Atualizar transação
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

  -- Remover lançamentos anteriores
  delete from public.financial_journal_lines
  where entry_id in (
    select id from public.financial_journal_entries where transaction_id = p_transaction_id
  );
  delete from public.financial_journal_entries
  where transaction_id = p_transaction_id;

  -- Determinar status para journal
  declare
    v_j_status public.financial_transaction_status;
  begin
    if v_new_payment_date is not null then
      v_j_status := 'settled';
    else
      v_j_status := 'pending';
    end if;

    -- Gerar novos lançamentos
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
-- 15. View — financial_transactions_list_v
--     Retorna transações com campos computed para UI.
-- ---------------------------------------------------------------------------

create or replace view public.financial_transactions_list_v
with (security_invoker = true)
as
select
  ft.id,
  ft.description,
  ft.transaction_date,
  ft.competence_date,
  ft.movement_type,
  ft.amount,
  ft.status,
  ft.category_id,
  fc.name as category_name,
  ft.origin_account_id,
  fa_o.name as origin_account_name,
  ft.destination_account_id,
  fa_d.name as destination_account_name,
  ft.party_id,
  fp.name as party_name,
  ft.cost_center_id,
  fcc.name as cost_center_name,
  ft.service_line_id,
  fsl.name as service_line_name,
  ft.payment_method_id,
  fpm.name as payment_method_name,
  ft.due_date,
  ft.payment_date,
  ft.notes,
  ft.review_required,
  ft.version,
  ft.created_at,
  ft.created_by,
  ft.updated_at,
  ft.updated_by,
  -- Campos computed
  (select count(*) from public.financial_journal_entries fje where fje.transaction_id = ft.id) as journal_entry_count,
  (select coalesce(sum(fjl.debit), 0) from public.financial_journal_lines fjl
   join public.financial_journal_entries fje2 on fje2.id = fjl.entry_id
   where fje2.transaction_id = ft.id) as total_debit,
  (select coalesce(sum(fjl.credit), 0) from public.financial_journal_lines fjl
   join public.financial_journal_entries fje2 on fje2.id = fjl.entry_id
   where fje2.transaction_id = ft.id) as total_credit
from public.financial_transactions ft
left join public.financial_categories fc on fc.id = ft.category_id
left join public.financial_accounts fa_o on fa_o.id = ft.origin_account_id
left join public.financial_accounts fa_d on fa_d.id = ft.destination_account_id
left join public.financial_parties fp on fp.id = ft.party_id
left join public.financial_cost_centers fcc on fcc.id = ft.cost_center_id
left join public.financial_service_lines fsl on fsl.id = ft.service_line_id
left join public.financial_payment_methods fpm on fpm.id = ft.payment_method_id
order by ft.transaction_date desc, ft.created_at desc;

revoke all on table public.financial_transactions_list_v from public, anon, authenticated;
grant select on table public.financial_transactions_list_v to authenticated;

-- ---------------------------------------------------------------------------
-- 16. View — financial_journal_entries_list_v
--     Retorna lançamentos com linhas para UI.
-- ---------------------------------------------------------------------------

create or replace view public.financial_journal_entries_list_v
with (security_invoker = true)
as
select
  fje.id,
  fje.transaction_id,
  fje.entry_type,
  fje.entry_date,
  fje.competence_date,
  fje.description,
  fje.status,
  fje.review_required,
  fje.created_at,
  (select coalesce(sum(fjl.debit), 0) from public.financial_journal_lines fjl where fjl.entry_id = fje.id) as total_debit,
  (select coalesce(sum(fjl.credit), 0) from public.financial_journal_lines fjl where fjl.entry_id = fje.id) as total_credit
from public.financial_journal_entries fje
order by fje.entry_date, fje.created_at;

revoke all on table public.financial_journal_entries_list_v from public, anon, authenticated;
grant select on table public.financial_journal_entries_list_v to authenticated;

-- ---------------------------------------------------------------------------
-- 17. View — financial_journal_lines_list_v
--     Retorna linhas com detalhes da conta contábil para UI.
-- ---------------------------------------------------------------------------

create or replace view public.financial_journal_lines_list_v
with (security_invoker = true)
as
select
  fjl.id,
  fjl.entry_id,
  fjl.chart_account_id,
  fca.code as chart_account_code,
  fca.name as chart_account_name,
  fca.class as chart_account_class,
  fjl.debit,
  fjl.credit,
  fjl.description,
  fjl.created_at
from public.financial_journal_lines fjl
left join public.financial_chart_accounts fca on fca.id = fjl.chart_account_id
order by fjl.debit desc, fjl.credit desc;

revoke all on table public.financial_journal_lines_list_v from public, anon, authenticated;
grant select on table public.financial_journal_lines_list_v to authenticated;

-- ---------------------------------------------------------------------------
-- 18. Triggers de auditoria
-- ---------------------------------------------------------------------------

-- Apenas financial_transactions tem updated_at/updated_by (auditoria completa).
-- Journal entries e lines são imutáveis após criação (apenas created_at/created_by).
do $$
begin
  execute format(
    'create trigger trg_financial_transactions_audit before insert or update on public.financial_transactions for each row execute function public.set_audit_fields()'
  );
end $$;

-- ---------------------------------------------------------------------------
-- 19. Trigger: validação de saldo de lançamentos
-- ---------------------------------------------------------------------------

create or replace function public.validate_journal_entry_balance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total_debit numeric(15,2);
  v_total_credit numeric(15,2);
  v_entry_id uuid;
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    v_entry_id := new.entry_id;
  else
    v_entry_id := old.entry_id;
  end if;

  -- Trigger AFTER: a linha já está na tabela, o SUM já inclui a operação atual
  select
    coalesce(sum(debit), 0),
    coalesce(sum(credit), 0)
  into v_total_debit, v_total_credit
  from public.financial_journal_lines
  where entry_id = v_entry_id;

  if v_total_debit != v_total_credit then
    raise exception 'Lançamento contábil desbalanceado: débito % ≠ crédito %', v_total_debit, v_total_credit;
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.validate_journal_entry_balance() from public, anon, authenticated;

create trigger trg_fjl_validate_balance
after insert or update or delete on public.financial_journal_lines
for each row execute function public.validate_journal_entry_balance();

-- ---------------------------------------------------------------------------
-- 20. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.financial_transactions enable row level security;
alter table public.financial_transactions force row level security;
alter table public.financial_journal_entries enable row level security;
alter table public.financial_journal_entries force row level security;
alter table public.financial_journal_lines enable row level security;
alter table public.financial_journal_lines force row level security;

-- --- financial_transactions ---
create policy ft_select_internal on public.financial_transactions
for select to authenticated using (public.is_internal_user());
create policy ft_insert_internal on public.financial_transactions
for insert to authenticated with check (public.is_internal_user());
create policy ft_update_internal on public.financial_transactions
for update to authenticated
using (public.is_internal_user()) with check (public.is_internal_user());

-- --- financial_journal_entries ---
create policy fje_select_internal on public.financial_journal_entries
for select to authenticated using (public.is_internal_user());
create policy fje_insert_internal on public.financial_journal_entries
for insert to authenticated with check (public.is_internal_user());
create policy fje_update_internal on public.financial_journal_entries
for update to authenticated
using (public.is_internal_user()) with check (public.is_internal_user());

-- --- financial_journal_lines ---
create policy fjl_select_internal on public.financial_journal_lines
for select to authenticated using (public.is_internal_user());
create policy fjl_insert_internal on public.financial_journal_lines
for insert to authenticated with check (public.is_internal_user());
create policy fjl_update_internal on public.financial_journal_lines
for update to authenticated
using (public.is_internal_user()) with check (public.is_internal_user());

-- ---------------------------------------------------------------------------
-- 21. Grants PostgREST
-- ---------------------------------------------------------------------------

revoke all on public.financial_transactions from public, anon, authenticated;
revoke all on public.financial_journal_entries from public, anon, authenticated;
revoke all on public.financial_journal_lines from public, anon, authenticated;

grant select, insert, update on public.financial_transactions to authenticated;
grant select, insert, update on public.financial_journal_entries to authenticated;
grant select, insert, update on public.financial_journal_lines to authenticated;

-- DELETE não é concedido — exclusão lógica via cancelamento

-- ---------------------------------------------------------------------------
-- 22. Validação de categorias por tipo de movimento
-- ---------------------------------------------------------------------------

create or replace function public.validate_category_movement_type()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected_type public.financial_movement_type;
begin
  if new.category_id is not null then
    select c.movement_type into v_expected_type
    from public.financial_categories c
    where c.id = new.category_id;

    if v_expected_type is not null and v_expected_type != new.movement_type then
      raise exception 'Categoria é do tipo %, mas o lançamento é do tipo %', v_expected_type, new.movement_type;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_category_movement_type() from public, anon, authenticated;

create trigger trg_ft_validate_category_movement
before insert or update on public.financial_transactions
for each row execute function public.validate_category_movement_type();

-- ---------------------------------------------------------------------------
-- FIM DA MIGRATION
-- ---------------------------------------------------------------------------
commit;
