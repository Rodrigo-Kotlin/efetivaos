begin;

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

  select
    coalesce(sum(debit), 0),
    coalesce(sum(credit), 0)
  into v_total_debit, v_total_credit
  from public.financial_journal_lines
  where entry_id = v_entry_id;

  if v_total_debit != v_total_credit then
    raise exception 'Lancamento contabil desbalanceado: debito % != credito %', v_total_debit, v_total_credit;
  end if;

  return coalesce(new, old);
end;
$$;

commit;
