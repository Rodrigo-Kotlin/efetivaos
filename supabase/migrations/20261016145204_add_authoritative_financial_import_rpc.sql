-- FIN-IMPORT-3A
-- Restricted executor for the approved February 2026 manifest.
-- This is deliberately not a general-purpose journal-posting API.

begin;

create or replace function public.execute_authoritative_financial_import(
  p_manifest_hash text,
  p_batch_key text,
  p_manifest_json text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_manifest jsonb;
  v_rows jsonb;
  v_row jsonb;
  v_batch_id uuid;
  v_transaction_id uuid;
  v_entry_id uuid;
  v_source_row integer;
  v_amount numeric(15,2);
  v_date date;
  v_movement public.financial_movement_type;
  v_category_id uuid;
  v_debit_id uuid;
  v_credit_id uuid;
  v_debit_class public.financial_account_class;
  v_credit_class public.financial_account_class;
  v_cash_account_id uuid;
  v_source_rows integer[] := '{}';
  v_keys text[] := '{}';
  v_null_category_rows integer[] := '{}';
  v_expected_null_category_rows integer[] := array[54, 65, 66, 85, 100, 101, 102, 110];
  v_total_debit numeric(15,2) := 0;
  v_total_credit numeric(15,2) := 0;
  v_inflows numeric(15,2) := 0;
  v_outflows numeric(15,2) := 0;
  v_revenue numeric(15,2) := 0;
  v_costs numeric(15,2) := 0;
  v_expenses numeric(15,2) := 0;
  v_operating numeric(15,2) := 0;
  v_investing numeric(15,2) := 0;
  v_financing numeric(15,2) := 0;
  v_batch_count integer;
  v_economic_count integer;
  v_cora_balance numeric(15,2);
  v_criffer_liability numeric(15,2);
  v_criffer_asset numeric(15,2);
  v_row_count integer;
  v_unique_source_count integer;
  v_unique_key_count integer;
  v_existing_key_count integer;
  v_hash text;
  v_category_text text;
  v_dfc text;
  v_dre text;
  v_direction text;
  v_ar_ap text;
  v_description text;
  v_note text;
begin
  -- The existing finance RLS intentionally permits writes only through trusted
  -- RPCs. Keep the caller check explicit even though this function is definer.
  if auth.uid() is null or not public.is_admin() then
    raise exception 'FIN-IMPORT-3A exige usuario autenticado Admin';
  end if;

  if p_manifest_hash <> '79aeef88bf7c1561c230d1aa9bdcda383ee8b351be6a8bf1fe795d682ea280e9'
     or p_batch_key <> 'FIN-IMPORT-3::2026-02::79aeef88bf7c1561c230d1aa9bdcda383ee8b351be6a8bf1fe795d682ea280e9' then
    raise exception 'FIN-IMPORT-3A manifesto ou batch key nao autorizado';
  end if;

  if p_manifest_json is null or p_manifest_json = '' then
    raise exception 'FIN-IMPORT-3A manifesto ausente';
  end if;

  v_hash := encode(digest(p_manifest_json, 'sha256'), 'hex');
  if v_hash <> p_manifest_hash then
    raise exception 'FIN-IMPORT-3A hash do payload diverge do hash autorizado';
  end if;

  begin
    v_manifest := p_manifest_json::jsonb;
  exception when others then
    raise exception 'FIN-IMPORT-3A payload JSON invalido';
  end;

  if v_manifest->>'schema_version' <> 'FIN-IMPORT-2.6.v1'
     or (v_manifest->'period'->>'year')::integer <> 2026
     or (v_manifest->'period'->>'month')::integer <> 2 then
    raise exception 'FIN-IMPORT-3A schema ou periodo divergente';
  end if;

  v_rows := v_manifest->'rows';
  if jsonb_typeof(v_rows) <> 'array' then
    raise exception 'FIN-IMPORT-3A rows deve ser array';
  end if;

  select count(*), count(distinct (r->>'source_row')::integer), count(distinct r->>'idempotency_key')
  into v_row_count, v_unique_source_count, v_unique_key_count
  from jsonb_array_elements(v_rows) as x(r);

  if v_row_count <> 79 or v_unique_source_count <> 79 or v_unique_key_count <> 79 then
    raise exception 'FIN-IMPORT-3A exige exatamente 79 rows/source_rows/keys';
  end if;

  select count(*) into v_batch_count
  from public.financial_import_batches
  where file_name = p_batch_key;
  if v_batch_count <> 0 then
    raise exception 'FIN-IMPORT-3A batch key ja executada';
  end if;

  select count(*) into v_existing_key_count
  from public.financial_transactions t
  where t.idempotency_key in (select r->>'idempotency_key' from jsonb_array_elements(v_rows) as x(r));
  if v_existing_key_count <> 0 then
    raise exception 'FIN-IMPORT-3A idempotency key ja existente';
  end if;

  select count(*) into v_existing_key_count
  from public.financial_import_rows r
  where r.idempotency_key in (select x.r->>'idempotency_key' from jsonb_array_elements(v_rows) as x(r));
  if v_existing_key_count <> 0 then
    raise exception 'FIN-IMPORT-3A import row idempotente ja existente';
  end if;

  -- Preconditions are checked before the first INSERT.
  select count(*) into v_economic_count
  from public.financial_transactions t
  where t.competence_date >= date '2026-02-01'
    and t.competence_date < date '2026-03-01'
    and t.movement_type <> 'AJUSTE';
  if v_economic_count <> 0 then
    raise exception 'FIN-IMPORT-3A fevereiro ja possui transacoes economicas';
  end if;

  select coalesce(sum(jl.debit - jl.credit), 0)
  into v_cora_balance
  from public.financial_journal_lines jl
  join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
  where ca.code = '1.1.01.002';
  if v_cora_balance <> 2313.24 then
    raise exception 'FIN-IMPORT-3A saldo Cora divergente: %', v_cora_balance;
  end if;

  select coalesce(sum(jl.debit - jl.credit), 0)
  into v_criffer_liability
  from public.financial_journal_lines jl
  join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
  where ca.code = '2.1.09.001';
  if v_criffer_liability <> -566.84 then
    raise exception 'FIN-IMPORT-3A passivo Criffer divergente: %', v_criffer_liability;
  end if;

  select coalesce(sum(jl.debit - jl.credit), 0)
  into v_criffer_asset
  from public.financial_journal_lines jl
  join public.financial_chart_accounts ca on ca.id = jl.chart_account_id
  where ca.code = '1.2.99.001';
  if v_criffer_asset <> 566.84 then
    raise exception 'FIN-IMPORT-3A ativo historico Criffer divergente: %', v_criffer_asset;
  end if;

  if not exists (select 1 from public.financial_chart_accounts where code = '4.4.01.002' and active)
     or not exists (select 1 from public.financial_chart_accounts where code = '4.1.01.007' and active) then
    raise exception 'FIN-IMPORT-3A contas de custo aprovadas ausentes ou inativas';
  end if;

  select fa.id into v_cash_account_id
  from public.financial_accounts fa
  join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
  where ca.code = '1.1.01.002' and fa.active and ca.active;
  if v_cash_account_id is null then
    raise exception 'FIN-IMPORT-3A conta financeira Banco Cora ausente ou inativa';
  end if;

  -- Validate every row, including the eight intentionally uncategorized rows.
  for v_row in select * from jsonb_array_elements(v_rows)
  loop
    v_source_row := (v_row->>'source_row')::integer;
    v_amount := (v_row->>'amount')::numeric(15,2);
    v_date := (v_row->>'normalized_date')::date;
    v_movement := (v_row->>'movement_type')::public.financial_movement_type;
    v_category_text := nullif(v_row->>'category_id', '');
    v_direction := v_row->>'direction';
    v_dre := v_row->>'dre_effect';
    v_dfc := v_row->>'dfc_class';
    v_ar_ap := v_row->>'ar_ap_effect';

    if v_source_row is null or v_source_row <= 0
       or v_amount is null or v_amount <= 0
       or v_row->>'normalized_description' is null
       or v_row->>'normalized_description' = ''
       or v_row->>'idempotency_key' is null
       or v_row->>'row_status' <> 'READY' then
      raise exception 'FIN-IMPORT-3A row % possui campos invalidos', v_source_row;
    end if;
    if v_date < date '2026-02-01' or v_date >= date '2026-03-01' then
      raise exception 'FIN-IMPORT-3A row % fora de fevereiro/2026', v_source_row;
    end if;
    if v_direction not in ('INFLOW', 'OUTFLOW')
       or v_dre not in ('RECEITA', 'CUSTO', 'DESPESA', 'NONE')
       or v_dfc not in ('OPERACIONAL', 'INVESTIMENTO', 'FINANCIAMENTO', 'NAO_CAIXA')
       or v_ar_ap not in ('DIRECT_CASH', 'SETTLEMENT_EXISTING_LIABILITY', 'NONE') then
      raise exception 'FIN-IMPORT-3A row % possui classificacao invalida', v_source_row;
    end if;

    if v_category_text is null and not ((v_expected_null_category_rows @> array[v_source_row])) then
      raise exception 'FIN-IMPORT-3A category_id ausente nao autorizado na row %', v_source_row;
    end if;
    if v_category_text is not null then
      v_category_id := v_category_text::uuid;
      if not exists (select 1 from public.financial_categories where id = v_category_id and active) then
        raise exception 'FIN-IMPORT-3A categoria invalida na row %', v_source_row;
      end if;
    else
      v_category_id := null;
      v_null_category_rows := array_append(v_null_category_rows, v_source_row);
    end if;

    if not exists (select 1 from public.financial_chart_accounts where code = v_row->>'debit_account_code' and active)
       or not exists (select 1 from public.financial_chart_accounts where code = v_row->>'credit_account_code' and active) then
      raise exception 'FIN-IMPORT-3A conta explicita invalida na row %', v_source_row;
    end if;

    -- The approved manifest uses financial-account ids for cash sides and
    -- chart-account ids for non-cash sides. When present, each id must still
    -- resolve to the exact supplied account code; codes are never inferred.
    if nullif(v_row->>'debit_account_id', '') is not null
       and not exists (
         select 1 from public.financial_chart_accounts ca
         where ca.id = (v_row->>'debit_account_id')::uuid
           and ca.code = v_row->>'debit_account_code'
         union all
         select 1 from public.financial_accounts fa
         join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
         where fa.id = (v_row->>'debit_account_id')::uuid
           and ca.code = v_row->>'debit_account_code'
       ) then
      raise exception 'FIN-IMPORT-3A debit_account_id divergente na row %', v_source_row;
    end if;
    if nullif(v_row->>'credit_account_id', '') is not null
       and not exists (
         select 1 from public.financial_chart_accounts ca
         where ca.id = (v_row->>'credit_account_id')::uuid
           and ca.code = v_row->>'credit_account_code'
         union all
         select 1 from public.financial_accounts fa
         join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
         where fa.id = (v_row->>'credit_account_id')::uuid
           and ca.code = v_row->>'credit_account_code'
       ) then
      raise exception 'FIN-IMPORT-3A credit_account_id divergente na row %', v_source_row;
    end if;

    select id, class into v_debit_id, v_debit_class
    from public.financial_chart_accounts where code = v_row->>'debit_account_code' and active;
    select id, class into v_credit_id, v_credit_class
    from public.financial_chart_accounts where code = v_row->>'credit_account_code' and active;
    if v_debit_id = v_credit_id then
      raise exception 'FIN-IMPORT-3A debit e credit iguais na row %', v_source_row;
    end if;

    if v_dre = 'RECEITA' and v_credit_class <> 'RECEITA' then
      raise exception 'FIN-IMPORT-3A DRE receita incoerente na row %', v_source_row;
    elsif v_dre = 'CUSTO' and v_debit_class <> 'CUSTO' then
      raise exception 'FIN-IMPORT-3A DRE custo incoerente na row %', v_source_row;
    elsif v_dre = 'DESPESA' and v_debit_class <> 'DESPESA' then
      raise exception 'FIN-IMPORT-3A DRE despesa incoerente na row %', v_source_row;
    end if;

    if v_source_row = 54 and (v_movement <> 'EMPRESTIMO_RECEBIDO' or v_dre <> 'NONE' or v_dfc <> 'FINANCIAMENTO') then
      raise exception 'FIN-IMPORT-3A row 54 especial incoerente';
    end if;
    if v_source_row in (65, 66, 85) and (v_row->>'debit_account_code' <> '4.4.01.002' or v_dre <> 'CUSTO' or v_dfc <> 'OPERACIONAL') then
      raise exception 'FIN-IMPORT-3A grupo Bombeiro incoerente na row %', v_source_row;
    end if;
    if v_source_row in (100, 110) and (v_row->>'debit_account_code' <> '4.1.01.007' or v_dre <> 'CUSTO' or v_dfc <> 'OPERACIONAL') then
      raise exception 'FIN-IMPORT-3A grupo Clinica incoerente na row %', v_source_row;
    end if;
    if v_source_row in (101, 102) and (v_movement <> 'IMOBILIZADO' or v_row->>'debit_account_code' <> '2.1.09.001' or v_dre <> 'NONE' or v_dfc <> 'INVESTIMENTO' or v_ar_ap <> 'SETTLEMENT_EXISTING_LIABILITY') then
      raise exception 'FIN-IMPORT-3A grupo Criffer incoerente na row %', v_source_row;
    end if;

    v_source_rows := array_append(v_source_rows, v_source_row);
    v_keys := array_append(v_keys, v_row->>'idempotency_key');
  end loop;

  if v_null_category_rows @> v_expected_null_category_rows
     and v_expected_null_category_rows @> v_null_category_rows
     and cardinality(v_null_category_rows) = 8 then
    null;
  else
    raise exception 'FIN-IMPORT-3A conjunto de 8 rows sem categoria divergente';
  end if;

  insert into public.financial_import_batches (user_id, file_name, file_type, file_size, status, total_rows, valid_rows, imported_rows, column_mapping)
  values (auth.uid(), p_batch_key, 'xlsx', null, 'processing', 79, 79, 0,
          jsonb_build_object('manifest_hash', p_manifest_hash, 'schema_version', v_manifest->>'schema_version', 'scope', 'FIN-IMPORT-3'))
  returning id into v_batch_id;

  for v_row in select * from jsonb_array_elements(v_rows)
  loop
    v_source_row := (v_row->>'source_row')::integer;
    v_amount := (v_row->>'amount')::numeric(15,2);
    v_date := (v_row->>'normalized_date')::date;
    v_movement := (v_row->>'movement_type')::public.financial_movement_type;
    v_category_id := nullif(v_row->>'category_id', '')::uuid;
    v_description := v_row->>'normalized_description';
    v_note := format('FIN-IMPORT-3 source_row=%s dre=%s dfc=%s ar_ap=%s', v_source_row, v_row->>'dre_effect', v_row->>'dfc_class', v_row->>'ar_ap_effect');

    select id into v_debit_id from public.financial_chart_accounts where code = v_row->>'debit_account_code' and active;
    select id into v_credit_id from public.financial_chart_accounts where code = v_row->>'credit_account_code' and active;

    insert into public.financial_transactions (
      description, transaction_date, competence_date, movement_type, amount, status,
      category_id, origin_account_id, destination_account_id, payment_date,
      notes, review_required, created_by, updated_by, idempotency_key
    ) values (
      v_description, v_date, v_date, v_movement, v_amount, 'settled',
      v_category_id,
      case when v_row->>'direction' = 'INFLOW' then v_cash_account_id else null end,
      case when v_row->>'direction' = 'OUTFLOW' then v_cash_account_id else null end,
      v_date, v_note, false, auth.uid(), auth.uid(), v_row->>'idempotency_key'
    ) returning id into v_transaction_id;

    insert into public.financial_journal_entries (
      transaction_id, entry_type, entry_date, competence_date, description, status, review_required, created_by, idempotency_key
    ) values (
      v_transaction_id, 'caixa', v_date, v_date, v_description || ' - FIN-IMPORT-3', 'settled', false, auth.uid(), v_row->>'idempotency_key' || '::JOURNAL'
    ) returning id into v_entry_id;

    insert into public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    values
      (v_entry_id, v_debit_id, v_amount, 0, v_description || ' - Debito'),
      (v_entry_id, v_credit_id, 0, v_amount, v_description || ' - Credito');

    insert into public.financial_import_rows (batch_id, row_number, raw_data, mapped_data, status, transaction_id, idempotency_key)
    values (v_batch_id, v_source_row, v_row, v_row, 'imported', v_transaction_id, v_row->>'idempotency_key');

    v_total_debit := v_total_debit + v_amount;
    v_total_credit := v_total_credit + v_amount;
    if v_row->>'direction' = 'INFLOW' then v_inflows := v_inflows + v_amount; else v_outflows := v_outflows + v_amount; end if;
    if v_row->>'dre_effect' = 'RECEITA' then v_revenue := v_revenue + v_amount; end if;
    if v_row->>'dre_effect' = 'CUSTO' then v_costs := v_costs + v_amount; end if;
    if v_row->>'dre_effect' = 'DESPESA' then v_expenses := v_expenses + v_amount; end if;
    if v_row->>'dfc_class' = 'OPERACIONAL' then v_operating := v_operating + case when v_row->>'direction' = 'INFLOW' then v_amount else -v_amount end; end if;
    if v_row->>'dfc_class' = 'INVESTIMENTO' then v_investing := v_investing + case when v_row->>'direction' = 'INFLOW' then v_amount else -v_amount end; end if;
    if v_row->>'dfc_class' = 'FINANCIAMENTO' then v_financing := v_financing + case when v_row->>'direction' = 'INFLOW' then v_amount else -v_amount end; end if;
  end loop;

  if v_total_debit <> v_total_credit
     or v_inflows <> (v_manifest->'approved_totals'->>'cash_inflows')::numeric
     or v_outflows <> (v_manifest->'approved_totals'->>'cash_outflows')::numeric
     or v_revenue <> (v_manifest->'approved_totals'->>'revenue')::numeric
     or v_costs <> (v_manifest->'approved_totals'->>'costs')::numeric
     or v_expenses <> (v_manifest->'approved_totals'->>'expenses')::numeric
     or v_operating <> (v_manifest->'approved_totals'->>'dfc_operating')::numeric
     or v_investing <> (v_manifest->'approved_totals'->>'dfc_investing')::numeric
     or v_financing <> (v_manifest->'approved_totals'->>'dfc_financing')::numeric then
    raise exception 'FIN-IMPORT-3A totals divergem do manifesto';
  end if;

  update public.financial_import_batches
  set status = 'completed', imported_rows = 79, updated_at = now()
  where id = v_batch_id;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'batch_key', p_batch_key,
    'manifest_hash', p_manifest_hash,
    'rows', 79,
    'debits', v_total_debit,
    'credits', v_total_credit,
    'inflows', v_inflows,
    'outflows', v_outflows,
    'null_category_rows', to_jsonb(v_null_category_rows)
  );
end;
$$;

comment on function public.execute_authoritative_financial_import(text, text, text)
is 'FIN-IMPORT-3A restricted, atomic executor for the server-hashed February 2026 authoritative manifest only.';

revoke all on function public.execute_authoritative_financial_import(text, text, text) from public, anon;
grant execute on function public.execute_authoritative_financial_import(text, text, text) to authenticated;

commit;
