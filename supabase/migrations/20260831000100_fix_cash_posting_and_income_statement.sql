-- FINANCE MICROGATE 02
-- Canonical cash/accrual posting and competence-basis income statement.

begin;

-- Remove the pre-idempotency overload. Calls that omit the key resolve to the
-- canonical overload because p_idempotency_key has a default.
drop function if exists public.create_financial_transaction(
  text, date, date, public.financial_movement_type, numeric,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid,
  date, date, text, numeric, numeric
);

create or replace function public.post_direct_cash_transaction(
  p_transaction_id uuid,
  p_movement_type public.financial_movement_type,
  p_amount numeric,
  p_category_id uuid,
  p_origin_account_id uuid,
  p_destination_account_id uuid,
  p_competence_date date,
  p_payment_date date,
  p_description text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry_id uuid;
  v_category_account_id uuid;
  v_category_class public.financial_account_class;
  v_cash_account_id uuid;
  v_cash_is_cash boolean;
  v_amount numeric := abs(p_amount);
begin
  select ca.id, ca.class
  into v_category_account_id, v_category_class
  from public.financial_categories fc
  join public.financial_chart_accounts ca on ca.id = fc.counter_account_id
  where fc.id = p_category_id
    and fc.active = true;

  if v_category_account_id is null then
    raise exception 'Categoria sem conta contabil ativa para posting a vista';
  end if;

  if p_movement_type = 'RECEITA' then
    if v_category_class <> 'RECEITA' then
      raise exception 'Receita a vista exige categoria vinculada a conta de receita';
    end if;

    select fa.chart_account_id, ca.is_cash
    into v_cash_account_id, v_cash_is_cash
    from public.financial_accounts fa
    join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
    where fa.id = p_origin_account_id
      and fa.active = true;

  elsif p_movement_type = 'DESPESA' then
    if v_category_class not in ('CUSTO', 'DESPESA') then
      raise exception 'Despesa a vista exige categoria vinculada a conta de custo ou despesa';
    end if;

    select fa.chart_account_id, ca.is_cash
    into v_cash_account_id, v_cash_is_cash
    from public.financial_accounts fa
    join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
    where fa.id = p_destination_account_id
      and fa.active = true;

  elsif p_movement_type = 'IMOBILIZADO' then
    if v_category_class <> 'ATIVO' then
      raise exception 'Imobilizado a vista exige categoria vinculada a conta de ativo';
    end if;

    select fa.chart_account_id, ca.is_cash
    into v_cash_account_id, v_cash_is_cash
    from public.financial_accounts fa
    join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
    where fa.id = p_destination_account_id
      and fa.active = true;
  else
    raise exception 'Tipo de movimento nao suportado para posting direto a vista: %', p_movement_type;
  end if;

  if v_cash_account_id is null or v_cash_is_cash is not true then
    raise exception 'Operacao a vista exige conta financeira ativa vinculada a caixa ou banco';
  end if;

  insert into public.financial_journal_entries (
    transaction_id, entry_type, entry_date, competence_date,
    description, status, review_required
  ) values (
    p_transaction_id, 'caixa', p_payment_date, p_competence_date,
    p_description || ' - A vista', 'settled', false
  )
  returning id into v_entry_id;

  if p_movement_type = 'RECEITA' then
    perform public._insert_journal_pair(
      v_entry_id,
      v_cash_account_id, v_amount, 0, 'Caixa/Banco',
      v_category_account_id, 0, v_amount, 'Receita',
      false
    );
  else
    perform public._insert_journal_pair(
      v_entry_id,
      v_category_account_id, v_amount, 0,
      case when p_movement_type = 'IMOBILIZADO' then 'Ativo imobilizado' else 'Custo/Despesa' end,
      v_cash_account_id, 0, v_amount, 'Caixa/Banco',
      false
    );
  end if;
end;
$$;

revoke all on function public.post_direct_cash_transaction(
  uuid, public.financial_movement_type, numeric, uuid, uuid, uuid,
  date, date, text
) from public, anon, authenticated;

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
  v_posting_date date;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores podem criar transacoes';
  end if;

  if p_idempotency_key is not null then
    select id into v_existing_id
    from public.financial_transactions
    where idempotency_key = p_idempotency_key
    limit 1;

    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  perform public.assert_period_unlocked(p_competence_date);
  if p_payment_date is not null then
    if p_payment_date <> p_competence_date then
      perform public.assert_period_unlocked(p_payment_date);
    end if;
  elsif p_transaction_date <> p_competence_date then
    perform public.assert_period_unlocked(p_transaction_date);
  end if;

  perform public.validate_transaction_references(
    p_category_id, p_origin_account_id, p_destination_account_id,
    p_party_id, p_cost_center_id, p_service_line_id, p_payment_method_id
  );

  perform public.validate_transaction_by_movement_type(
    p_movement_type, p_category_id, p_origin_account_id, p_destination_account_id,
    p_principal_amount, p_interest_amount
  );

  if p_payment_date is not null then
    v_initial_status := 'settled';
    v_posting_date := p_payment_date;
  else
    v_initial_status := 'pending';
    v_posting_date := p_transaction_date;
  end if;

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

  if p_payment_date is not null
     and p_movement_type in ('RECEITA', 'DESPESA', 'IMOBILIZADO') then
    perform public.post_direct_cash_transaction(
      v_transaction_id, p_movement_type, p_amount, p_category_id,
      p_origin_account_id, p_destination_account_id,
      p_competence_date, p_payment_date, p_description
    );
  else
    perform public.generate_journal_entries(
      v_transaction_id, p_movement_type, p_amount, v_initial_status,
      p_category_id, p_origin_account_id, p_destination_account_id,
      p_competence_date, v_posting_date, p_description,
      false, p_principal_amount, p_interest_amount
    );
  end if;

  return v_transaction_id;
end;
$$;

revoke all on function public.create_financial_transaction(
  text, date, date, public.financial_movement_type, numeric,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid,
  date, date, text, numeric, numeric, text
) from public, anon, authenticated;
grant execute on function public.create_financial_transaction(
  text, date, date, public.financial_movement_type, numeric,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid,
  date, date, text, numeric, numeric, text
) to authenticated;

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
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores podem liquidar transacoes';
  end if;

  select * into v_tx
  from public.financial_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transacao nao encontrada';
  end if;

  if v_tx.status <> 'pending' then
    raise exception 'Apenas transacoes pendentes podem ser liquidadas. Status atual: %', v_tx.status;
  end if;

  if v_tx.movement_type not in ('RECEITA', 'DESPESA', 'IMOBILIZADO') then
    raise exception 'Liquidacao separada aplica-se somente a titulos AR/AP';
  end if;

  perform public.assert_period_unlocked(p_payment_date);

  update public.financial_transactions
  set status = 'settled',
      payment_date = p_payment_date,
      payment_method_id = coalesce(p_payment_method_id, v_tx.payment_method_id),
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_transaction_id;

  perform public.generate_journal_entries(
    p_transaction_id, v_tx.movement_type, v_tx.amount, 'settled',
    v_tx.category_id, v_tx.origin_account_id, v_tx.destination_account_id,
    v_tx.competence_date, p_payment_date, v_tx.description,
    false, null, null
  );
end;
$$;

revoke all on function public.settle_financial_transaction(uuid, date, uuid)
  from public, anon, authenticated;
grant execute on function public.settle_financial_transaction(uuid, date, uuid)
  to authenticated;

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
  v_swap_posting boolean;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores podem cancelar transacoes';
  end if;

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

  if v_tx.status = 'settled' then
    raise exception 'Cancelamento de transacao liquidada requer estorno integral (F-07)';
  end if;

  perform public.assert_period_unlocked(v_tx.competence_date);
  if v_tx.transaction_date <> v_tx.competence_date then
    perform public.assert_period_unlocked(v_tx.transaction_date);
  end if;

  -- The legacy DESPESA/IMOBILIZADO cancelled branch is already expressed as
  -- the inverse posting. Other branches still require debit/credit swapping.
  v_swap_posting := v_tx.movement_type not in ('DESPESA', 'IMOBILIZADO');

  perform public.generate_journal_entries(
    p_transaction_id, v_tx.movement_type, v_tx.amount, 'cancelled',
    v_tx.category_id, v_tx.origin_account_id, v_tx.destination_account_id,
    v_tx.competence_date, v_tx.transaction_date, v_tx.description,
    v_swap_posting, null, null
  );

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

revoke all on function public.cancel_financial_transaction(uuid, text)
  from public, anon, authenticated;
grant execute on function public.cancel_financial_transaction(uuid, text)
  to authenticated;

-- Cash transactions have no title. Credit transactions remain in AR/AP after
-- settlement because they retain their competence entry.
create or replace view public.financial_receivables_v
with (security_invoker = true) as
with tx as (
  select
    t.id as transaction_id,
    t.description,
    t.movement_type,
    t.status,
    t.amount as original_amount,
    t.due_date,
    t.competence_date,
    t.transaction_date,
    t.created_at,
    case when t.status in ('settled', 'cancelled') then 0 else t.amount end as open_amount,
    case when t.status in ('settled', 'cancelled') then t.amount else 0 end as settled_amount,
    (t.status = 'pending' and t.due_date < current_date) as overdue,
    case when t.status = 'pending' and t.due_date < current_date
      then current_date - t.due_date else 0 end as days_overdue,
    t.party_id,
    t.cost_center_id,
    t.service_line_id,
    t.review_required,
    p.name as party_name,
    (select ca.name from public.financial_categories ca where ca.id = t.category_id) as category_name,
    (select cc.name from public.financial_cost_centers cc where cc.id = t.cost_center_id) as cost_center_name,
    (select sl.name from public.financial_service_lines sl where sl.id = t.service_line_id) as service_line_name,
    t.origin_account_id,
    t.payment_method_id,
    je_comp.id as competency_entry_id,
    je_liq.id as settlement_entry_id
  from public.financial_transactions t
  left join public.financial_parties p on t.party_id = p.id
  left join public.financial_journal_entries je_comp
    on je_comp.transaction_id = t.id and je_comp.entry_type = 'competencia'
  left join public.financial_journal_entries je_liq
    on je_liq.transaction_id = t.id and je_liq.entry_type = 'caixa'
  where t.movement_type = 'RECEITA'
    and (
      t.payment_date is null
      or exists (
        select 1 from public.financial_journal_entries recognized
        where recognized.transaction_id = t.id
          and recognized.entry_type = 'competencia'
      )
    )
)
select
  transaction_id, description, movement_type, status, original_amount,
  settled_amount, open_amount, transaction_date, competence_date, due_date,
  overdue, days_overdue, party_name, category_name, cost_center_id,
  cost_center_name, service_line_id, service_line_name, origin_account_id,
  payment_method_id, competency_entry_id, settlement_entry_id
from tx;

create or replace view public.financial_payables_v
with (security_invoker = true) as
with tx as (
  select
    t.id as transaction_id,
    t.description,
    t.movement_type,
    t.status,
    t.amount as original_amount,
    t.due_date,
    t.competence_date,
    t.transaction_date,
    t.created_at,
    case when t.status in ('settled', 'cancelled') then 0 else t.amount end as open_amount,
    case when t.status in ('settled', 'cancelled') then t.amount else 0 end as settled_amount,
    (t.status = 'pending' and t.due_date < current_date) as overdue,
    case when t.status = 'pending' and t.due_date < current_date
      then current_date - t.due_date else 0 end as days_overdue,
    t.party_id,
    t.cost_center_id,
    t.service_line_id,
    t.review_required,
    p.name as party_name,
    (select ca.name from public.financial_categories ca where ca.id = t.category_id) as category_name,
    (select cc.name from public.financial_cost_centers cc where cc.id = t.cost_center_id) as cost_center_name,
    (select sl.name from public.financial_service_lines sl where sl.id = t.service_line_id) as service_line_name,
    t.origin_account_id,
    t.payment_method_id,
    je_comp.id as competency_entry_id,
    je_liq.id as settlement_entry_id
  from public.financial_transactions t
  left join public.financial_parties p on t.party_id = p.id
  left join public.financial_journal_entries je_comp
    on je_comp.transaction_id = t.id and je_comp.entry_type = 'competencia'
  left join public.financial_journal_entries je_liq
    on je_liq.transaction_id = t.id and je_liq.entry_type = 'caixa'
  where t.movement_type in ('DESPESA', 'IMOBILIZADO')
    and (
      t.payment_date is null
      or exists (
        select 1 from public.financial_journal_entries recognized
        where recognized.transaction_id = t.id
          and recognized.entry_type = 'competencia'
      )
    )
)
select
  transaction_id, description, movement_type, status, original_amount,
  settled_amount, open_amount, transaction_date, competence_date, due_date,
  overdue, days_overdue, party_name, category_name, cost_center_id,
  cost_center_name, service_line_id, service_line_name, origin_account_id,
  payment_method_id, competency_entry_id, settlement_entry_id
from tx;

revoke all on public.financial_receivables_v from public, anon, authenticated;
revoke all on public.financial_payables_v from public, anon, authenticated;
grant select on public.financial_receivables_v to authenticated;
grant select on public.financial_payables_v to authenticated;

comment on view public.financial_receivables_v is
  'Titulos AR de RECEITA reconhecidos por competencia; operacoes a vista nao usam AR.';
comment on view public.financial_payables_v is
  'Titulos AP de DESPESA/IMOBILIZADO reconhecidos por competencia; operacoes a vista nao usam AP.';

create or replace function public.get_income_statement(
  p_from date default null,
  p_to date default null,
  p_cost_center_id uuid default null,
  p_service_line_id uuid default null
)
returns table (
  row_code text,
  label text,
  row_type text,
  amount numeric,
  sort_order int
)
language plpgsql stable security definer
set search_path to 'public', pg_temp
as $$
begin
  if auth.uid() is not null and not public.is_internal_user() then
    raise exception 'Acesso negado: usuario inativo ou sem permissao.';
  end if;

  return query
  with line_values as (
    select
      ca.dre_class,
      (case when ca.nature = 'DEBITO'
            then jl.debit - jl.credit
            else jl.credit - jl.debit
       end)::numeric as natural_value
    from public.financial_journal_entries je
    join public.financial_journal_lines jl on jl.entry_id = je.id
    join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
    join public.financial_transactions ft on ft.id = je.transaction_id
    where ca.class in ('RECEITA', 'CUSTO', 'DESPESA')
      and nullif(ca.dre_class, '') is not null
      and (p_from is null or je.competence_date >= p_from)
      and (p_to is null or je.competence_date <= p_to)
      and (p_cost_center_id is null or ft.cost_center_id = p_cost_center_id)
      and (p_service_line_id is null or ft.service_line_id = p_service_line_id)
  ),
  totals as (
    select
      coalesce(sum(case when dre_class = 'RECEITA_BRUTA' then natural_value else 0 end), 0) as receita_bruta,
      coalesce(sum(case when dre_class = 'DEDUCAO_RECEITA' then natural_value else 0 end), 0) as deducoes,
      coalesce(sum(case when dre_class = 'CUSTO_SERVICO' then natural_value else 0 end), 0) as csp,
      coalesce(sum(case when dre_class = 'DESPESA_OPERACIONAL' then natural_value else 0 end), 0) as despesas_op,
      coalesce(sum(case when dre_class = 'DEPRECIACAO_AMORTIZACAO' then natural_value else 0 end), 0) as da,
      coalesce(sum(case when dre_class = 'RECEITA_FINANCEIRA' then natural_value else 0 end), 0) as receita_financeira,
      coalesce(sum(case when dre_class = 'DESPESA_FINANCEIRA' then natural_value else 0 end), 0) as despesa_financeira,
      coalesce(sum(case when dre_class = 'OUTRAS_RECEITAS' then natural_value else 0 end), 0) as outras_receitas,
      coalesce(sum(case when dre_class = 'OUTRAS_DESPESAS' then natural_value else 0 end), 0) as outras_despesas,
      coalesce(sum(case when dre_class = 'IMPOSTO_RESULTADO' then natural_value else 0 end), 0) as imposto
    from line_values
  ),
  s as (
    select
      receita_bruta,
      deducoes,
      receita_bruta - deducoes as receita_liquida,
      csp,
      receita_bruta - deducoes - csp as lucro_bruto,
      despesas_op,
      receita_bruta - deducoes - csp - despesas_op as ebitda,
      da,
      receita_bruta - deducoes - csp - despesas_op - da as ebit,
      receita_financeira - despesa_financeira as resultado_financeiro,
      outras_receitas - outras_despesas as outros_resultados,
      receita_bruta - deducoes - csp - despesas_op - da
        + receita_financeira - despesa_financeira
        + outras_receitas - outras_despesas as antes_imposto,
      imposto,
      receita_bruta - deducoes - csp - despesas_op - da
        + receita_financeira - despesa_financeira
        + outras_receitas - outras_despesas - imposto as resultado_liquido
    from totals
  )
  select dre_rows.row_code, dre_rows.label, dre_rows.row_type, dre_rows.amount, dre_rows.sort_order
  from (
    select 'RECEITA_BRUTA', 'Receita Bruta', 'SUBTOTAL', receita_bruta, 10 from s
    union all select 'DEDUCOES', '(-) Deducoes da Receita', 'DETAIL', -deducoes, 20 from s
    union all select 'RECEITA_LIQUIDA', 'Receita Liquida', 'SUBTOTAL', receita_liquida, 30 from s
    union all select 'CUSTOS', '(-) Custos dos Servicos Prestados', 'DETAIL', -csp, 40 from s
    union all select 'LUCRO_BRUTO', 'Lucro Bruto / Margem de Contribuicao', 'SUBTOTAL', lucro_bruto, 50 from s
    union all select 'DESPESAS_OPERACIONAIS', '(-) Despesas Operacionais', 'DETAIL', -despesas_op, 60 from s
    union all select 'EBITDA', 'EBITDA Gerencial', 'SUBTOTAL', ebitda, 70 from s
    union all select 'DEPRECIACAO', '(-) Depreciacao e Amortizacao', 'DETAIL', -da, 80 from s
    union all select 'EBIT', 'Resultado Operacional (EBIT)', 'SUBTOTAL', ebit, 90 from s
    union all select 'RESULTADO_FINANCEIRO', 'Resultado Financeiro', 'DETAIL', resultado_financeiro, 100 from s
    union all select 'OUTROS_RESULTADOS', 'Outros Resultados', 'DETAIL', outros_resultados, 110 from s
    union all select 'ANTES_IMPOSTOS', 'Resultado antes dos Tributos sobre Lucro', 'SUBTOTAL', antes_imposto, 120 from s
    union all select 'IMPOSTOS', '(-) Tributos sobre Resultado', 'DETAIL', -imposto, 130 from s
    union all select 'RESULTADO_LIQUIDO', 'RESULTADO LIQUIDO', 'TOTAL', resultado_liquido, 140 from s
  ) as dre_rows(row_code, label, row_type, amount, sort_order)
  order by dre_rows.sort_order;
end;
$$;

revoke all on function public.get_income_statement(date, date, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_income_statement(date, date, uuid, uuid)
  to authenticated;

comment on function public.get_income_statement(date, date, uuid, uuid) is
  'DRE por competencia: inclui linhas de contas de resultado, inclusive reversoes, sem depender de liquidacao financeira.';

commit;
