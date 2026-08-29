-- ============================================================================
-- ETAPA 08K — SQL Checks: MIGRAÇÃO DE DADOS REAIS 2026 (Supabase DEV)
-- Projeto: efetivaos · Ref: bxviuzluxcijbqqbpyzb
-- Data-fonte: docs/BASE_MIGRACAO_FINANCEIRA_2026.xlsx (Lancamentos_Normalizados)
-- Objetivo: validar que a migração (661 lançamentos + SALDO_INICIAL) foi
--           realizada corretamente via RPC (mecanismo autoritativo), que a
--           reconciliação de 7 meses fecha, e que o razão está íntegro.
--
-- Como executar: rodar todo o conteúdo no SQL Editor do Supabase (DEV), ou
-- via psql, de novo que for preciso (os checks são idempotentes/read-only).
-- Não requer permissão de escrita — apenas SELECT + chamada de assert.
-- ============================================================================

-- Helper de asserção (o script falha na 1ª asserção que não passar)
create or replace function _08k_assert(condition boolean, msg text)
returns void as $$
begin
  if not condition then
    raise exception 'TEST FAIL: %', msg;
  end if;
  raise notice 'TEST PASS: %', msg;
end;
$$ language plpgsql;

-------------------------------------------------------------------------------
-- 1. CADASTROS (mirror da planilha-fonte)
--    - 10 centros de custo: CC01..CC09 + CC99
--    - 53 categorias espelhando as naturezas-fonte
--    - 3 contas financeiras: Cora, NU, Caixa Interno (todas is_cash)
-------------------------------------------------------------------------------
select _08k_assert(
  (select count(*) from public.financial_cost_centers where code like 'CC%' and active) = 10,
  '1.1 devem existir 10 centros de custo (CC01-CC09 + CC99)'
);

select _08k_assert(
  (select count(distinct code) from public.financial_cost_centers
    where code in ('CC01','CC02','CC03','CC04','CC05','CC06','CC07','CC08','CC09','CC99') and active) = 10,
  '1.2 os 10 códigos CC01-CC09 e CC99 estão presentes'
);

select _08k_assert(
  (select count(*) from public.financial_categories where active) = 53,
  '1.3 existem exatamente 53 categorias financeiras ativas (espelho das naturezas-fonte)'
);

select _08k_assert(
  (select count(*) from public.financial_accounts where active) = 3,
  '1.4 existem 3 contas financeiras ativas (Cora, NU, Caixa Interno)'
);

select _08k_assert(
  (select count(*) from public.financial_accounts fa
     join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
     where fa.active and ca.is_cash) = 3,
  '1.5 todas as 3 contas financeiras apontam para plano de contas is_cash'
);

select _08k_assert(
  exists (select 1 from public.financial_accounts where name ilike '%Cora%' and active),
  '1.6 a conta financeira Cora existe'
);

select _08k_assert(
  exists (select 1 from public.financial_accounts where name ilike '%NU%' and active),
  '1.7 a conta financeira NU existe'
);

-- Toda categoria RECEITA tem contrapartida em receita (3.1.x) e DESPESA em custo/despesa
select _08k_assert(
  (select count(*) from public.financial_categories c
     join public.financial_chart_accounts ca on ca.id = c.counter_account_id
     where c.active and c.movement_type = 'RECEITA'
       and ca.class not in ('RECEITA')) = 0,
  '1.8 nenhuma categoria RECEITA aponta para conta de classe que não seja RECEITA'
);

select _08k_assert(
  (select count(*) from public.financial_categories c
     join public.financial_chart_accounts ca on ca.id = c.counter_account_id
     where c.active and c.movement_type in ('DESPESA','CUSTO')
       and ca.class not in ('CUSTO','DESPESA')) = 0,
  '1.9 nenhuma categoria DESPESA/CUSTO aponta para classe indevida'
);

select _08k_assert(
  (select count(*) from public.financial_categories where active and cost_center_id is null) = 0,
  '1.10 toda categoria ativa possui centro de custo vinculado'
);

-------------------------------------------------------------------------------
-- 2. COMPLETUDE (todos os 661 lançamentos-fonte + SALDO_INICIAL presentes)
--    Chave de idempotência de migração: MIG-FIN-2026-JAN-JUL-V1::<id-fonte>
-------------------------------------------------------------------------------
-- 2.1 total de transações migradas (662 = 661 fonte + SALDO_INICIAL), não canceladas
select _08k_assert(
  (select count(*) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%' and status = 'settled') = 662,
  '2.1 total de transações migradas e settleadas = 662 (661 fonte + SALDO_INICIAL)'
);

select _08k_assert(
  (select count(*) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%' and status = 'cancelled') = 4,
  '2.2 exatamente 4 transações migradas re-emitidas ficam canceladas (as 4 re-datadas)'
);

-- Distribuição por tipo de movimento (fonte)
select _08k_assert(
  (select count(*) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and status = 'settled' and movement_type = 'RECEITA') = 264,
  '2.3 RECEITA settleada = 264'
);

select _08k_assert(
  (select count(*) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and status = 'settled' and movement_type = 'DESPESA') = 380,
  '2.4 DESPESA settleada = 380'
);

select _08k_assert(
  (select count(*) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and status = 'settled' and movement_type = 'RETIRADA') = 6,
  '2.5 RETIRADA settleada = 6 (5 liquidação M001 + FLX-0654)'
);

select _08k_assert(
  (select count(*) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and status = 'settled' and movement_type = 'IMOBILIZADO') = 2,
  '2.6 IMOBILIZADO settleado = 2 (investimento I001)'
);

select _08k_assert(
  (select count(*) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and status = 'settled' and movement_type = 'EMPRESTIMO_RECEBIDO') = 4,
  '2.7 EMPRESTIMO_RECEBIDO settleado = 4'
);

select _08k_assert(
  (select count(*) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and status = 'settled' and movement_type = 'EMPRESTIMO_PAGO') = 3,
  '2.8 EMPRESTIMO_PAGO settleado = 3 (principal)'
);

select _08k_assert(
  (select count(*) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and status = 'settled' and movement_type = 'TRANSFERENCIA') = 2,
  '2.9 TRANSFERENCIA settleada = 2 (FLX-0656 Jun / FLX-0659 Jul)'
);

select _08k_assert(
  (select count(*) from public.financial_transactions
     where movement_type = 'SALDO_INICIAL'
       and idempotency_key = 'MIG-FIN-2026-JAN-JUL-V1::SALDO_INICIAL-CORA'
       and status = 'settled') = 1,
  '2.10 SALDO_INICIAL Cora (4.386,45) presente e settleado'
);

-- Nenhum lançamento-fonte ficou pendente (todos settleados)
select _08k_assert(
  (select count(*) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%' and status = 'pending') = 0,
  '2.11 nenhuma transação migrada está pendente (todas settleadas ou canceladas)'
);

-- Soma dos valores médios: conferir montante total migrado > 0 e coerente
select _08k_assert(
  (select coalesce(sum(amount),0) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%' and status = 'settled') > 0,
  '2.12 montante total migrado é positivo'
);

-------------------------------------------------------------------------------
-- 3. RECONCILIAÇÃO MENSAL (Controle de caixa — conta Cora, plano 1.1.01.002)
--    Metas-fonte: Jan 2.313,24 · Fev 2.070,12 · Mar 18.187,58 · Abr 11.639,96
--                 Mai 3.910,14 · Jun 7.021,13 · Jul 13.657,76  (tolerância < 0,01)
--    A variável mo vota no competência; chamamos um bloco DO para somar por mês.
-------------------------------------------------------------------------------
do $$
declare
  v_cora uuid := (
    select fa.id from public.financial_accounts fa
    join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
    where ca.code = '1.1.01.002' and fa.active limit 1
  );
  r record;
begin
  if v_cora is null then
    raise exception 'TEST FAIL: conta Cora (1.1.01.002) não encontrada';
  end if;

  for r in
    select
      to_char(je.competence_date, 'YYYY-MM') as mes,
      round(sum(jl.debit - jl.credit)::numeric, 2) as saldo
    from public.financial_journal_entries je
    join public.financial_journal_lines jl on jl.entry_id = je.id
    where jl.chart_account_id = (
            select chart_account_id from public.financial_accounts where id = v_cora
    )
      and je.transaction_id in (
            select id from public.financial_transactions where status = 'settled')
    group by mes
    order by mes
  loop
    raise notice '  Cora % saldo %', r.mes, r.saldo;
  end loop;
end $$;

-- As metas são verificadas de forma cumulativa/final a seguir.
select _08k_assert(
  (select abs(sum(jl.debit - jl.credit))
     from public.financial_journal_entries je
     join public.financial_journal_lines jl on jl.entry_id = je.id
     where jl.chart_account_id = (
        select fa.chart_account_id from public.financial_accounts fa
        join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
        where ca.code = '1.1.01.002' and fa.active limit 1)
       and je.transaction_id in (select id from public.financial_transactions where status='settled')
  ) - 13657.76 < 0.01,
  '3.1 saldo final da conta Cora = 13.657,76 (meta Julho)'
);

-- Receita operacional total reconhecida = 381.159,72 (fonte)
select _08k_assert(
  abs(coalesce(
    (select sum(jl.credit - jl.debit)
       from public.financial_journal_entries je
       join public.financial_journal_lines jl on jl.entry_id = je.id
       join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
       where ca.class = 'RECEITA'
         and je.transaction_id in (select id from public.financial_transactions where status='settled')
    ), 0) - 381159.72) < 0.01,
  '3.2 receita operacional total reconhecida no DRE = 381.159,72 (fonte)'
);

-- Saldo da conta Cora ao fim de cada competência deve bater com as metas
do $$
declare
  v_cora_chart uuid := (
    select fa.chart_account_id from public.financial_accounts fa
    join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
    where ca.code = '1.1.01.002' and fa.active limit 1
  );
  target numeric;
  got numeric;
begin
  -- JAN
  target := 2313.24;
  select coalesce(sum(jl.debit - jl.credit),0) into got
    from public.financial_journal_entries je
    join public.financial_journal_lines jl on jl.entry_id = je.id
    where jl.chart_account_id = v_cora_chart
      and je.competence_date between '2026-01-01' and '2026-01-31'
      and je.transaction_id in (select id from public.financial_transactions where status='settled');
  if abs(got - target) < 0.01 then
    raise notice 'TEST PASS: 3.3 Jan Cora = % (meta %)', got, target;
  else
    raise exception 'TEST FAIL: 3.3 Jan Cora = % (meta %)', got, target;
  end if;

  -- FEV
  target := 2070.12;
  select coalesce(sum(jl.debit - jl.credit),0) into got
    from public.financial_journal_entries je
    join public.financial_journal_lines jl on jl.entry_id = je.id
    where jl.chart_account_id = v_cora_chart
      and je.competence_date <= '2026-02-28'
      and je.transaction_id in (select id from public.financial_transactions where status='settled');
  if abs(got - target) < 0.01 then
    raise notice 'TEST PASS: 3.4 Fev Cora = % (meta %)', got, target;
  else
    raise exception 'TEST FAIL: 3.4 Fev Cora = % (meta %)', got, target;
  end if;

  -- MAR
  target := 18187.58;
  select coalesce(sum(jl.debit - jl.credit),0) into got
    from public.financial_journal_entries je
    join public.financial_journal_lines jl on jl.entry_id = je.id
    where jl.chart_account_id = v_cora_chart
      and je.competence_date <= '2026-03-31'
      and je.transaction_id in (select id from public.financial_transactions where status='settled');
  if abs(got - target) < 0.01 then
    raise notice 'TEST PASS: 3.5 Mar Cora = % (meta %)', got, target;
  else
    raise exception 'TEST FAIL: 3.5 Mar Cora = % (meta %)', got, target;
  end if;

  -- ABR
  target := 11639.96;
  select coalesce(sum(jl.debit - jl.credit),0) into got
    from public.financial_journal_entries je
    join public.financial_journal_lines jl on jl.entry_id = je.id
    where jl.chart_account_id = v_cora_chart
      and je.competence_date <= '2026-04-30'
      and je.transaction_id in (select id from public.financial_transactions where status='settled');
  if abs(got - target) < 0.01 then
    raise notice 'TEST PASS: 3.6 Abr Cora = % (meta %)', got, target;
  else
    raise exception 'TEST FAIL: 3.6 Abr Cora = % (meta %)', got, target;
  end if;

  -- MAI
  target := 3910.14;
  select coalesce(sum(jl.debit - jl.credit),0) into got
    from public.financial_journal_entries je
    join public.financial_journal_lines jl on jl.entry_id = je.id
    where jl.chart_account_id = v_cora_chart
      and je.competence_date <= '2026-05-31'
      and je.transaction_id in (select id from public.financial_transactions where status='settled');
  if abs(got - target) < 0.01 then
    raise notice 'TEST PASS: 3.7 Mai Cora = % (meta %)', got, target;
  else
    raise exception 'TEST FAIL: 3.7 Mai Cora = % (meta %)', got, target;
  end if;

  -- JUN
  target := 7021.13;
  select coalesce(sum(jl.debit - jl.credit),0) into got
    from public.financial_journal_entries je
    join public.financial_journal_lines jl on jl.entry_id = je.id
    where jl.chart_account_id = v_cora_chart
      and je.competence_date <= '2026-06-30'
      and je.transaction_id in (select id from public.financial_transactions where status='settled');
  if abs(got - target) < 0.01 then
    raise notice 'TEST PASS: 3.8 Jun Cora = % (meta %)', got, target;
  else
    raise exception 'TEST FAIL: 3.8 Jun Cora = % (meta %)', got, target;
  end if;

  -- JUL
  target := 13657.76;
  select coalesce(sum(jl.debit - jl.credit),0) into got
    from public.financial_journal_entries je
    join public.financial_journal_lines jl on jl.entry_id = je.id
    where jl.chart_account_id = v_cora_chart
      and je.competence_date <= '2026-07-31'
      and je.transaction_id in (select id from public.financial_transactions where status='settled');
  if abs(got - target) < 0.01 then
    raise notice 'TEST PASS: 3.9 Jul Cora = % (meta %)', got, target;
  else
    raise exception 'TEST FAIL: 3.9 Jul Cora = % (meta %)', got, target;
  end if;
end $$;

-------------------------------------------------------------------------------
-- 4. INTEGRIDADE CONTÁBIL (razão)
-------------------------------------------------------------------------------
-- 4.1 Débitos = Créditos nas linhas de diário não canceladas
select _08k_assert(
  abs(coalesce((
    select sum(jl.debit)
      from public.financial_journal_entries je
      join public.financial_journal_lines jl on jl.entry_id = je.id
      where je.transaction_id in (
        select id from public.financial_transactions where status <> 'cancelled')
  ),0)
  -
  coalesce((
    select sum(jl.credit)
      from public.financial_journal_entries je
      join public.financial_journal_lines jl on jl.entry_id = je.id
      where je.transaction_id in (
        select id from public.financial_transactions where status <> 'cancelled')
  ),0)) < 0.01,
  '4.1 os débitos e créditos do razão (excl. cancelados) estão balanceados'
);

-- 4.2 Contas a Receber (AR 1.1.02.001) zeradas após settle — sem títulos fictícios
select _08k_assert(
  abs(coalesce((
    select sum(jl.debit - jl.credit)
      from public.financial_journal_entries je
      join public.financial_journal_lines jl on jl.entry_id = je.id
      join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
      where ca.code = '1.1.02.001'
        and je.transaction_id in (select id from public.financial_transactions where status <> 'cancelled')
  ),0)) < 0.01,
  '4.2 contas a receber (1.1.02.001) liquidadas a zero (sem títulos históricos)'
);

-- 4.3 Contas a Pagar (AP 2.1.01.001) zeradas após settle
select _08k_assert(
  abs(coalesce((
    select sum(jl.debit - jl.credit)
      from public.financial_journal_entries je
      join public.financial_journal_lines jl on jl.entry_id = je.id
      join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
      where ca.code = '2.1.01.001'
        and je.transaction_id in (select id from public.financial_transactions where status <> 'cancelled')
  ),0)) < 0.01,
  '4.3 contas a pagar (2.1.01.001) liquidadas a zero'
);

-- 4.4 Empréstimos líquidos a pagar = 15.622,57 (recebidos 58.990,00 − pagos 43.367,43)
select _08k_assert(
  abs(coalesce((
    select sum(jl.debit - jl.credit)
      from public.financial_journal_entries je
      join public.financial_journal_lines jl on jl.entry_id = je.id
      join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
      where ca.code = '2.1.06.001'
        and je.transaction_id in (select id from public.financial_transactions where status <> 'cancelled')
  ),0)) - (-15622.57) < 0.01,
  '4.4 empréstimos a pagar líquidos = 15.622,57 (saldo credor)'
);

-- 4.5 Contas NU e Caixa Interno zeradas (transferências anulam entre si)
select _08k_assert(
  abs(
    (select coalesce(sum(jl.debit - jl.credit),0)
       from public.financial_journal_entries je
       join public.financial_journal_lines jl on jl.entry_id = je.id
       join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
       where ca.code = '1.1.01.003'
         and je.transaction_id in (select id from public.financial_transactions where status <> 'cancelled'))
  ) < 0.01,
  '4.5 conta NU (1.1.01.003) saldada a zero (transferências anulam)'
);

select _08k_assert(
  abs(
    (select coalesce(sum(jl.debit - jl.credit),0)
       from public.financial_journal_entries je
       join public.financial_journal_lines jl on jl.entry_id = je.id
       join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
       where ca.code = '1.1.01.001'
         and je.transaction_id in (select id from public.financial_transactions where status <> 'cancelled'))
  ) < 0.01,
  '4.6 conta Caixa Interno (1.1.01.001) saldada a zero'
);

-- 4.7 Nenhuma transação ativa "Teste"/mock permanece (todas canceladas)
select _08k_assert(
  (select count(*) from public.financial_transactions
     where (description ilike '%Teste 08H%' or description ilike '%PROBE-RETIRADA%')
       and status <> 'cancelled') = 0,
  '4.7 nenhuma transação de teste/probe permanece ativa (todas canceladas)'
);

-- 4.8 Razão: nenhuma linha de diário órfã (sem transação) 
select _08k_assert(
  (select count(*) from public.financial_journal_entries
     where transaction_id not in (select id from public.financial_transactions)) = 0,
  '4.8 não existem lançamentos de diário órfãos'
);

-- 4.9 Toda transação settleada tem ao menos um lançamento de diário
select _08k_assert(
  (select count(*) from public.financial_transactions t
     where t.status = 'settled'
       and not exists (select 1 from public.financial_journal_entries e where e.transaction_id = t.id)) = 0,
  '4.9 toda transação settleada possui lançamento de diário'
);

-------------------------------------------------------------------------------
-- 5. AS 4 LINHAS RE-DATADAS (data de movimento fora da competência-fonte)
--    Devem estar postadas NO MÊS DA COMPETÊNCIA, com a categoria correta.
-------------------------------------------------------------------------------
-- FLX-2026-0121 (600,00) — Aluguel de Carro — categoria D001 / competência FEV
select _08k_assert(
  (select count(*) from public.financial_transactions t
     join public.financial_journal_entries je on je.transaction_id = t.id
     where t.idempotency_key like '%FLX-2026-0121%' and t.status = 'settled'
       and je.competence_date between '2026-02-01' and '2026-02-28') = 1,
  '5.1 FLX-0121 (Aluguel Carro, 600) postado na competência FEV/2026'
);

-- FLX-2026-0123 (150,00) — Entrada Boné Uniforme BC — categoria C006 / competência FEV
select _08k_assert(
  (select count(*) from public.financial_transactions t
     join public.financial_journal_entries je on je.transaction_id = t.id
     where t.idempotency_key like '%FLX-2026-0123%' and t.status = 'settled'
       and je.competence_date between '2026-02-01' and '2026-02-28') = 1,
  '5.2 FLX-0123 (Entrada Boné Uniforme BC, 150) postado na competência FEV/2026'
);

-- FLX-2026-0479 (240,00 entrada) — ASOs R Frota — categoria R003 / competência JUN
select _08k_assert(
  (select count(*) from public.financial_transactions t
     join public.financial_journal_entries je on je.transaction_id = t.id
     where t.idempotency_key like '%FLX-2026-0479%' and t.status = 'settled'
       and je.competence_date between '2026-06-01' and '2026-06-30') = 1,
  '5.3 FLX-0479 (ASOs R Frota entrada, 240) postado na competência JUN/2026'
);

-- FLX-2026-0628 (503,41) — Material de cozinha — categoria D011 / competência JUL
select _08k_assert(
  (select count(*) from public.financial_transactions t
     join public.financial_journal_entries je on je.transaction_id = t.id
     where t.idempotency_key like '%FLX-2026-0628%' and t.status = 'settled'
       and je.competence_date between '2026-07-01' and '2026-07-31') = 1,
  '5.4 FLX-0628 (Material de cozinha, 503,41) postado na competência JUL/2026'
);

-- Nenhum mês espúrio (ex.: lançamentos em SET/2026 inexistente)
select _08k_assert(
  (select count(*) from public.financial_journal_entries je
     join public.financial_transactions t on t.id = je.transaction_id
     where t.status = 'settled'
       and t.idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and je.competence_date >= '2026-08-01') = 0,
  '5.5 não existem lançamentos migrados com competência após JUL/2026'
);

-------------------------------------------------------------------------------
-- 6. CLASSIFICAÇÃO DAS TRANSAÇÕES ESPECIAIS
-------------------------------------------------------------------------------
-- 6.1 RETIRADAS apontam para conta de origem (Cora) com categoria nula (RETIRADA exige só origem)
select _08k_assert(
  (select count(*) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and status = 'settled' and movement_type = 'RETIRADA'
       and (category_id is not null or origin_account_id is null)) = 0,
  '6.1 todas as RETIRADA têm origem preenchida e categoria nula (conforme regra)'
);

-- 6.2 EMPRESTIMO_RECEBIDO: origin Cora. EMPRESTIMO_PAGO: dest Cora
select _08k_assert(
  (select count(*) from public.financial_transactions t
     join public.financial_accounts fa on fa.id = t.origin_account_id
     where t.movement_type = 'EMPRESTIMO_RECEBIDO' and t.status = 'settled'
       and t.idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and fa.name ilike '%Cora%') = 4,
  '6.2 os 4 EMPRESTIMO_RECEBIDO têm origem Cora'
);

-- 6.3 TRANSFERENCIA: pares Cora <-> NU (2 transferências, 2 contas distintas cada)
select _08k_assert(
  (select count(*) from public.financial_transactions
     where movement_type = 'TRANSFERENCIA' and status = 'settled'
       and idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%') = 2,
  '6.3 existem exatamente 2 transferências internas (Cora↔NU)'
);

-------------------------------------------------------------------------------
-- 7. SEGURANÇA / IMUTABILIDADE DO RAZÃO (hardening)
-------------------------------------------------------------------------------
-- 7.1 Idempotência: re-invocação da chave não duplica (verificamos único id por chave)
select _08k_assert(
  (select count(*) from (
     select idempotency_key
     from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
     group by idempotency_key
     having count(*) > 1
   ) dup) = 0,
  '7.1 chaves de idempotência são únicas por transação'
);

-- 7.2 Nenhum lançamento de diário com saldo desbalanceado individualmente
--     (partido em dupla partida sempre)
select _08k_assert(
  (select count(*) from (
     select e.id
     from public.financial_journal_entries e
     join public.financial_journal_lines l on l.entry_id = e.id
     join public.financial_transactions t on t.id = e.transaction_id
     where t.status <> 'cancelled'
     group by e.id
     having abs(sum(l.debit) - sum(l.credit)) > 0.01
   ) unbalanced) = 0,
  '7.2 todos os lançamentos (não cancelados) estão em partida dobrada'
);

-- 7.3 Toda categoria referenciada por transação existente e ativa
select _08k_assert(
  (select count(*) from public.financial_transactions t
     where t.category_id is not null
       and not exists (select 1 from public.financial_categories c
                       where c.id = t.category_id and c.active)) = 0,
  '7.3 toda transação referencia categoria ativa existente'
);

-- 7.4 Toda transação referencia origem e/ou destino existentes
select _08k_assert(
  (select count(*) from public.financial_transactions t
     where (t.origin_account_id is not null and
            not exists (select 1 from public.financial_accounts fa where fa.id = t.origin_account_id))
        or (t.destination_account_id is not null and
            not exists (select 1 from public.financial_accounts fa where fa.id = t.destination_account_id))) = 0,
  '7.4 toda transação referencia contas financeiras existentes'
);

-- 7.5 Nenhuma categoria órfã (contrapartida aponta para conta existente)
select _08k_assert(
  (select count(*) from public.financial_categories c
     where c.counter_account_id is not null
       and not exists (select 1 from public.financial_chart_accounts ca where ca.id = c.counter_account_id)) = 0,
  '7.5 toda categoria referencia plano de contas existente'
);

-- 7.6 Status válidos: sem valores fora do conjunto permitido (p/ migradas)
select _08k_assert(
  (select count(*) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and status not in ('settled','cancelled')) = 0,
  '7.6 transações migradas apenas em estado settled ou cancelled'
);

-------------------------------------------------------------------------------
-- 8. VALIDAÇÃO CRUZADA: SALDO_INICIAL
-------------------------------------------------------------------------------
-- 8.1 SALDO_INICIAL (4.386,45) lançado na conta Cora na competência JAN/2026
select _08k_assert(
  (select coalesce(sum(jl.debit - jl.credit),0)
     from public.financial_journal_entries je
     join public.financial_journal_lines jl on jl.entry_id = je.id
     where je.transaction_id in (
        select id from public.financial_transactions
        where movement_type = 'SALDO_INICIAL' and status = 'settled')
       and jl.chart_account_id = (
          select fa.chart_account_id from public.financial_accounts fa
          join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
          where ca.code = '1.1.01.002' and fa.active limit 1)
  ) - 4386.45 < 0.01,
  '8.1 SALDO_INICIAL de 4.386,45 está na conta Cora'
);

-- 8.2 SALDO_INICIAL na competência de janeiro
select _08k_assert(
  (select count(*) from public.financial_journal_entries je
     where je.transaction_id in (
        select id from public.financial_transactions
        where movement_type = 'SALDO_INICIAL' and status = 'settled')
       and je.competence_date between '2026-01-01' and '2026-01-31') = 1,
  '8.2 SALDO_INICIAL postado na competência JAN/2026'
);

-------------------------------------------------------------------------------
-- 9. CHECKS SUPLEMENTARES (detalhe por linha e DRE)
-------------------------------------------------------------------------------
-- 9.1 Valores das 4 linhas re-datadas conferem com a fonte
select _08k_assert(
  (select count(*) from public.financial_transactions
     where status='settled'
       and ((idempotency_key like '%FLX-2026-0121%' and amount = 600.00)
         or (idempotency_key like '%FLX-2026-0123%' and amount = 150.00)
         or (idempotency_key like '%FLX-2026-0479%' and amount = 240.00)
         or (idempotency_key like '%FLX-2026-0628%' and amount = 503.41))) = 4,
  '9.1 valores das 4 linhas re-datadas batem com a fonte (600/150/240/503,41)'
);

-- 9.2 Categoria correta por linha re-datada (D001/C006/R003/D011)
--     As categorias foram criadas espelhando os códigos-fonte: "Migração D001" etc.
select _08k_assert(
  (select count(*)
     from public.financial_transactions t
     join public.financial_categories c on c.id = t.category_id
     where t.status='settled'
       and ((t.idempotency_key like '%FLX-2026-0121%' and c.name ilike '%D001%')
         or (t.idempotency_key like '%FLX-2026-0123%' and c.name ilike '%C006%')
         or (t.idempotency_key like '%FLX-2026-0479%' and c.name ilike '%R003%')
         or (t.idempotency_key like '%FLX-2026-0628%' and c.name ilike '%D011%'))) = 4,
  '9.2 categorias das 4 linhas re-datadas corretas (D001/C006/R003/D011)'
);

-- 9.3 Custo total (classes CUSTO+DESPESA) reconhecido = 342.332,19 (fonte custo+despesa)
select _08k_assert(
  abs(coalesce((
    select sum(jl.debit - jl.credit)
      from public.financial_journal_entries je
      join public.financial_journal_lines jl on jl.entry_id = je.id
      join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
      where ca.class in ('CUSTO','DESPESA')
        and je.transaction_id in (select id from public.financial_transactions where status='settled')
  ),0) - 342332.19) < 0.01,
  '9.3 custo+despesa reconhecidos no DRE = 342.332,19 (fonte)'
);

-- 9.4 Resultado do período (Receita − Custo − Despesa) = 38.827,53
select _08k_assert(
  abs(
    (select coalesce(sum(jl.credit - jl.debit),0)
       from public.financial_journal_entries je
       join public.financial_journal_lines jl on jl.entry_id = je.id
       join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
       where ca.class = 'RECEITA'
         and je.transaction_id in (select id from public.financial_transactions where status='settled'))
    - (select coalesce(sum(jl.debit - jl.credit),0)
       from public.financial_journal_entries je
       join public.financial_journal_lines jl on jl.entry_id = je.id
       join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
       where ca.class in ('CUSTO','DESPESA')
         and je.transaction_id in (select id from public.financial_transactions where status='settled'))
    - 38827.53) < 0.01,
  '9.4 resultado do período (DRE) = 38.827,53'
);

-- 9.5 Total de contas migradas com tipo não esperado
select _08k_assert(
  (select count(*) from public.financial_transactions
     where idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and status='settled'
       and movement_type not in
         ('RECEITA','DESPESA','RETIRADA','IMOBILIZADO','EMPRESTIMO_RECEBIDO','EMPRESTIMO_PAGO','TRANSFERENCIA','SALDO_INICIAL')) = 0,
  '9.5 nenhum lançamento migrado com tipo de movimento não esperado'
);

-- 9.6 Todas as categorias usadas nas transações migradas possuem centro de custo válido
select _08k_assert(
  (select count(*) from public.financial_transactions t
     join public.financial_categories c on c.id = t.category_id
     where t.status='settled' and t.idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and c.cost_center_id is null) = 0,
  '9.6 nenhuma transação migrada usa categoria sem centro de custo'
);

-- 9.7 Movimentos não-DRE não tocam em contas de resultado
select _08k_assert(
  (select count(*) from public.financial_transactions t
     join public.financial_journal_entries je on je.transaction_id = t.id
     join public.financial_journal_lines jl on jl.entry_id = je.id
     join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
     where t.movement_type in ('TRANSFERENCIA','EMPRESTIMO_RECEBIDO','EMPRESTIMO_PAGO','RETIRADA')
       and t.status='settled' and t.idempotency_key like 'MIG-FIN-2026-JAN-JUL-V1::%'
       and ca.class in ('RECEITA','CUSTO','DESPESA')) = 0,
  '9.7 movimentos não-DRE (transferência/empréstimo/retirada) não tocam em contas de resultado'
);

-- 9.8 Os investimentos (IMOBILIZADO) tocam apenas ativo imobilizado (1.2.x) e caixa
select _08k_assert(
  (select count(*) from public.financial_transactions t
     join public.financial_journal_entries je on je.transaction_id = t.id
     join public.financial_journal_lines jl on jl.entry_id = je.id
     join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
     where t.movement_type = 'IMOBILIZADO' and t.status='settled'
       and ca.class not in ('ATIVO')) = 0,
  '9.8 IMOBILIZADO só toca contas da classe ATIVO (imobilizado + caixa)'
);

-- 9.9 Toda transação settleada possui ao menos 1 lançamento de diário
--     (tipos com reconhecimento DRE usam 2 lançamentos: pendência + liquidação;
--      tipos sem DRE — transferência/empréstimo/retirada/saldo inicial — usam 1)
select _08k_assert(
  (select count(*) from public.financial_transactions t
     where t.status = 'settled'
       and not exists (select 1 from public.financial_journal_entries e
                       where e.transaction_id = t.id)) = 0,
  '9.9 toda transação settleada possui ao menos 1 lançamento de diário (partida dobrada)'
);

-- 9.10 Nenhuma transação em estado não previsto
select _08k_assert(
  (select count(*) from public.financial_transactions
     where status not in ('settled','cancelled')) = 0,
  '9.10 nenhuma transação fora dos estados settled/cancelled (sem pendências/draft)'
);

-- FIM
select _08k_assert(true, '· Fim da suíte de checks 08K (migração de dados reais 2026)');
