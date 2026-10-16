-- FIN-ARAP-1.1 — native PostgreSQL read-only parity checks.
-- This test must not create transactions, journals, or journal lines.

do $$
declare
  v_received_count integer;
  v_paid_count integer;
  v_excluded_count integer;
  v_received_total numeric;
  v_paid_total numeric;
  v_batch_transactions integer;
  v_batch_journals integer;
  v_batch_lines integer;
  v_bank numeric;
begin
  select count(*), coalesce(sum(original_amount), 0)
    into v_received_count, v_received_total
  from public.financial_receivables_v v
  join public.financial_transactions t on t.id = v.transaction_id
  where t.idempotency_key like 'FIN-IMPORT-3::2026-02::%'
    and t.status = 'settled'
    and t.transaction_date >= date '2026-02-01'
    and t.transaction_date < date '2026-03-01';

  select count(*), coalesce(sum(original_amount), 0)
    into v_paid_count, v_paid_total
  from public.financial_payables_v v
  join public.financial_transactions t on t.id = v.transaction_id
  where t.idempotency_key like 'FIN-IMPORT-3::2026-02::%'
    and t.status = 'settled'
    and t.transaction_date >= date '2026-02-01'
    and t.transaction_date < date '2026-03-01';

  select count(*) into v_batch_transactions
  from public.financial_transactions
  where idempotency_key like 'FIN-IMPORT-3::2026-02::%';

  select count(*) into v_batch_journals
  from public.financial_journal_entries je
  join public.financial_transactions t on t.id = je.transaction_id
  where t.idempotency_key like 'FIN-IMPORT-3::2026-02::%';

  select count(*) into v_batch_lines
  from public.financial_journal_lines jl
  join public.financial_journal_entries je on je.id = jl.entry_id
  join public.financial_transactions t on t.id = je.transaction_id
  where t.idempotency_key like 'FIN-IMPORT-3::2026-02::%';

  select coalesce(sum(jl.debit) - sum(jl.credit), 0) into v_bank
  from public.financial_journal_lines jl
  join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
  where ca.code = '1.1.01.002';

  select count(*) into v_excluded_count
  from public.financial_transactions t
  where t.idempotency_key like 'FIN-IMPORT-3::2026-02::%'
    and not exists (select 1 from public.financial_receivables_v v where v.transaction_id = t.id)
    and not exists (select 1 from public.financial_payables_v v where v.transaction_id = t.id);

  if v_received_count <> 28 or v_received_total <> 19137.68 then
    raise exception 'FIN-ARAP-1.1 received mismatch: % rows / % amount', v_received_count, v_received_total;
  end if;
  if v_paid_count <> 40 or v_paid_total <> 32408.26 then
    raise exception 'FIN-ARAP-1.1 paid mismatch: % rows / % amount', v_paid_count, v_paid_total;
  end if;
  if v_excluded_count <> 11 then raise exception 'FIN-ARAP-1.1 excluded mismatch: %', v_excluded_count; end if;
  if v_batch_transactions <> 79 or v_batch_journals <> 79 or v_batch_lines <> 158 then
    raise exception 'FIN-ARAP-1.1 ledger count changed: %/%/%', v_batch_transactions, v_batch_journals, v_batch_lines;
  end if;
  if exists (select 1 from public.financial_receivables_v where status = 'settled' and open_amount <> 0)
     or exists (select 1 from public.financial_payables_v where status = 'settled' and open_amount <> 0) then
    raise exception 'Settled AR/AP rows have an open balance';
  end if;
  if v_bank <> 2070.12 then raise exception 'Banco Cora mismatch: %', v_bank; end if;
end $$;
