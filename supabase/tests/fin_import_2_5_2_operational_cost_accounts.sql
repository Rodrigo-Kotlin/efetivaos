-- FIN-IMPORT-2.5.2 — contas novas e ausência de fatos econômicos/importação.
-- Read-only; a extensão pgTAP e os resultados vivem somente nesta transação.

begin;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  seq bigint generated always as identity primary key,
  result text not null
) on commit drop;

insert into pg_temp.tap_results (result) select plan(14);

insert into pg_temp.tap_results (result)
select ok(count(*) = 1, '4.4.01.002 exists exactly once')
from public.financial_chart_accounts
where code = '4.4.01.002';

insert into pg_temp.tap_results (result)
select ok(count(*) = 1, '4.1.01.007 exists exactly once')
from public.financial_chart_accounts
where code = '4.1.01.007';

insert into pg_temp.tap_results (result)
select ok(count(*) = 1 and bool_and(
  name = 'Uniformes, EPIs e Materiais da Operação de Bombeiro Civil'
  and class = 'CUSTO'
  and nature = 'DEBITO'
  and active = true
  and dfc_default = 'OPERACIONAL'
  and dre_class = 'CUSTO_SERVICO'
), '4.4.01.002 has the approved classification')
from public.financial_chart_accounts
where code = '4.4.01.002';

insert into pg_temp.tap_results (result)
select ok(count(*) = 1 and bool_and(
  name = 'Aluguel e Ocupação da Unidade Clínica'
  and class = 'CUSTO'
  and nature = 'DEBITO'
  and active = true
  and dfc_default = 'OPERACIONAL'
  and dre_class = 'CUSTO_SERVICO'
), '4.1.01.007 has the approved classification')
from public.financial_chart_accounts
where code = '4.1.01.007';

insert into pg_temp.tap_results (result)
select ok(count(*) = 1 and bool_and(class = 'CUSTO' and nature = 'DEBITO'),
  '4.4.01.001 parent account remains unchanged')
from public.financial_chart_accounts
where code = '4.4.01.001';

insert into pg_temp.tap_results (result)
select ok(count(*) = 1 and bool_and(class = 'CUSTO' and nature = 'DEBITO'),
  '4.1.01.006 preceding account remains unchanged')
from public.financial_chart_accounts
where code = '4.1.01.006';

insert into pg_temp.tap_results (result)
select ok(not exists (
  select 1 from public.financial_categories
  where name in (
    'Uniformes/EPIs vinculados à operação de Bombeiro Civil',
    'Aluguel/Ocupação da Unidade Clínica'
  )
), 'no artificial categories were created')
;

insert into pg_temp.tap_results (result)
select ok(not exists (
  select 1 from public.financial_transactions
  where description ilike '%FIN-IMPORT-2.5.2%'
), 'no transaction was created by this gate')
;

insert into pg_temp.tap_results (result)
select ok(not exists (
  select 1 from public.financial_journal_entries
  where idempotency_key ilike '%FIN-IMPORT-2.5.2%'
), 'no journal was created by this gate')
;

insert into pg_temp.tap_results (result)
select ok(not exists (
  select 1 from public.financial_import_batches
  where file_name ilike '%FIN-IMPORT-3%'
), 'no FIN-IMPORT-3 batch exists')
;

insert into pg_temp.tap_results (result)
select ok(not exists (
  select 1
  from public.financial_import_rows r
  join public.financial_import_batches b on b.id = r.batch_id
  where b.file_name ilike '%FIN-IMPORT-3%'
), 'no FIN-IMPORT-3 rows exist')
;

insert into pg_temp.tap_results (result)
select ok(not exists (
  select 1 from public.financial_chart_accounts
  where code in ('4.4.01.002', '4.1.01.007')
  group by code
  having count(*) > 1
), 'new account codes are not duplicated')
;

insert into pg_temp.tap_results (result)
select ok(not exists (
  select 1 from public.financial_transactions
  where transaction_date >= date '2026-02-01'
    and transaction_date < date '2026-03-01'
    and movement_type <> 'AJUSTE'
), 'February economic transactions remain uncreated')
;

insert into pg_temp.tap_results (result)
select ok(not exists (
  select 1 from public.financial_journal_entries
  where competence_date >= date '2026-02-01'
    and competence_date < date '2026-03-01'
    and idempotency_key not like 'FIN-FIX-5::CRIFFER::%'
), 'February economic journals remain uncreated')
;

select * from pg_temp.tap_results order by seq;

rollback;
