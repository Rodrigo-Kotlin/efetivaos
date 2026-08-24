begin;

alter table public.quotations
  add column source_file_pending boolean not null default false,
  add column revision bigint not null default 0,
  add constraint quotations_dates_finite_chk check (
    isfinite(received_at) and (valid_until is null or isfinite(valid_until))
  );

alter table public.quotation_items
  add constraint quotation_items_unit_price_finite_chk check (
    unit_price not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  );

alter table public.margin_rules
  add constraint margin_rules_value_finite_chk check (
    value not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ) not valid;

alter table public.margin_rules
  validate constraint margin_rules_value_finite_chk;

alter table public.price_list
  add constraint price_list_values_finite_chk check (
    cost_price not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    and adjustment_value not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    and final_price not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    and (
      best_cost_at_approval is null
      or best_cost_at_approval not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    )
  ) not valid;

alter table public.price_list
  validate constraint price_list_values_finite_chk;

create or replace function public.increment_quotation_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;

revoke all on function public.increment_quotation_revision() from public;
revoke all on function public.increment_quotation_revision() from anon;
revoke all on function public.increment_quotation_revision() from authenticated;

drop trigger if exists trg_quotations_revision on public.quotations;
create trigger trg_quotations_revision
before update on public.quotations
for each row execute function public.increment_quotation_revision();

drop function if exists public.save_quotation_draft(uuid, uuid, text, date, date, text, jsonb);
drop function if exists public.save_quotation_draft(uuid, timestamptz, uuid, text, date, date, text, jsonb);
drop function if exists public.save_quotation_draft(uuid, bigint, uuid, text, date, date, text, jsonb);
drop function if exists public.save_quotation_draft(uuid, timestamptz, bigint, uuid, text, date, date, text, jsonb);

create function public.save_quotation_draft(
  p_quotation_id uuid,
  p_expected_updated_at timestamptz,
  p_expected_revision bigint,
  p_supplier_id uuid,
  p_reference_number text,
  p_received_at date,
  p_valid_until date,
  p_notes text,
  p_items jsonb
)
returns public.quotations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quotation public.quotations;
  v_supplied_id_count integer;
  v_distinct_id_count integer;
  v_owned_id_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('efetiva_os_pricing_decisions', 0));

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Os itens da cotacao devem ser informados como um array JSON.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    where jsonb_typeof(item.value) is distinct from 'object'
  ) then
    raise exception 'Cada item da cotacao deve ser um objeto JSON.';
  end if;

  if p_received_at is null or not isfinite(p_received_at) then
    raise exception 'A data de recebimento deve ser uma data finita.';
  end if;

  if p_valid_until is not null and not isfinite(p_valid_until) then
    raise exception 'A validade deve ser uma data finita.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    where case
      when item.value ->> 'unit_price' is null then true
      when item.value ->> 'unit_price' !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' then true
      else (item.value ->> 'unit_price')::numeric <= 0
    end
  ) then
    raise exception 'Cada preco unitario deve ser um decimal positivo canonico com ate 12 inteiros e 2 casas decimais.';
  end if;

  if p_quotation_id is null then
    insert into public.quotations (
      supplier_id,
      reference_number,
      received_at,
      valid_until,
      status,
      notes
    ) values (
      p_supplier_id,
      p_reference_number,
      p_received_at,
      p_valid_until,
      'draft',
      p_notes
    )
    returning * into v_quotation;
  else
    select q.* into v_quotation
    from public.quotations q
    where q.id = p_quotation_id
      and q.status = 'draft'
    for update;

    if not found then
      raise exception 'Cotacao em rascunho nao encontrada ou sem permissao de acesso.';
    end if;

    if p_expected_revision is null
       or v_quotation.revision is distinct from p_expected_revision
       or (
         p_expected_updated_at is not null
         and v_quotation.updated_at is distinct from p_expected_updated_at
       ) then
      raise exception 'Cotacao desatualizada: outra alteracao foi salva. Recarregue antes de continuar.';
    end if;

    if v_quotation.source_file_pending then
      raise exception 'O anexo da cotacao esta sendo enviado. Aguarde o envio terminar antes de salvar novamente.';
    end if;

    update public.quotations
    set supplier_id = p_supplier_id,
        reference_number = p_reference_number,
        received_at = p_received_at,
        valid_until = p_valid_until,
        notes = p_notes
    where id = v_quotation.id
    returning * into v_quotation;
  end if;

  select
    count(*) filter (where nullif(item.value ->> 'id', '') is not null),
    count(distinct (item.value ->> 'id')::uuid) filter (where nullif(item.value ->> 'id', '') is not null)
  into v_supplied_id_count, v_distinct_id_count
  from jsonb_array_elements(p_items) as item(value);

  if v_supplied_id_count <> v_distinct_id_count then
    raise exception 'O mesmo item de cotacao foi informado mais de uma vez.';
  end if;

  select count(*) into v_owned_id_count
  from public.quotation_items qi
  where qi.quotation_id = v_quotation.id
    and qi.id in (
      select (item.value ->> 'id')::uuid
      from jsonb_array_elements(p_items) as item(value)
      where nullif(item.value ->> 'id', '') is not null
    );

  if v_owned_id_count <> v_distinct_id_count then
    raise exception 'Um item informado nao pertence a esta cotacao.';
  end if;

  delete from public.quotation_items qi
  where qi.quotation_id = v_quotation.id
    and not exists (
      select 1
      from jsonb_array_elements(p_items) as item(value)
      where nullif(item.value ->> 'id', '') is not null
        and (item.value ->> 'id')::uuid = qi.id
    );

  -- Clear only changing retained mappings so canonical A/B swaps do not hit
  -- the per-quotation unique index before both final values are written.
  update public.quotation_items qi
  set catalog_item_id = null
  from jsonb_array_elements(p_items) as item(value)
  where qi.quotation_id = v_quotation.id
    and nullif(item.value ->> 'id', '') is not null
    and qi.id = (item.value ->> 'id')::uuid
    and qi.catalog_item_id is distinct from nullif(item.value ->> 'catalog_item_id', '')::uuid;

  insert into public.quotation_items (
    id,
    quotation_id,
    catalog_item_id,
    supplier_description,
    supplier_item_code,
    unit_price,
    notes
  )
  select
    coalesce(nullif(item.value ->> 'id', '')::uuid, gen_random_uuid()),
    v_quotation.id,
    nullif(item.value ->> 'catalog_item_id', '')::uuid,
    nullif(item.value ->> 'supplier_description', ''),
    nullif(item.value ->> 'supplier_item_code', ''),
    (item.value ->> 'unit_price')::numeric(14,2),
    nullif(item.value ->> 'notes', '')
  from jsonb_array_elements(p_items) as item(value)
  on conflict (id) do update
  set catalog_item_id = excluded.catalog_item_id,
      supplier_description = excluded.supplier_description,
      supplier_item_code = excluded.supplier_item_code,
      unit_price = excluded.unit_price,
      notes = excluded.notes;

  select q.* into strict v_quotation
  from public.quotations q
  where q.id = v_quotation.id;

  return v_quotation;
end;
$$;

revoke all on function public.save_quotation_draft(uuid, timestamptz, bigint, uuid, text, date, date, text, jsonb) from public;
revoke all on function public.save_quotation_draft(uuid, timestamptz, bigint, uuid, text, date, date, text, jsonb) from anon;
revoke all on function public.save_quotation_draft(uuid, timestamptz, bigint, uuid, text, date, date, text, jsonb) from authenticated;
grant execute on function public.save_quotation_draft(uuid, timestamptz, bigint, uuid, text, date, date, text, jsonb) to authenticated;

drop function if exists public.discard_pending_quotation_attachment(uuid, bigint);

create function public.discard_pending_quotation_attachment(
  p_quotation_id uuid,
  p_expected_revision bigint
)
returns public.quotations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quotation public.quotations;
begin
  perform pg_advisory_xact_lock(hashtextextended('efetiva_os_pricing_decisions', 0));

  select q.* into v_quotation
  from public.quotations q
  where q.id = p_quotation_id
    and q.status = 'draft'
  for update;

  if not found then
    raise exception 'Cotacao em rascunho nao encontrada ou sem permissao de acesso.';
  end if;

  if p_expected_revision is null
     or v_quotation.revision is distinct from p_expected_revision then
    raise exception 'Cotacao desatualizada: outra alteracao foi salva. Recarregue antes de continuar.';
  end if;

  if not v_quotation.source_file_pending then
    raise exception 'A cotacao nao possui envio de anexo pendente para descartar.';
  end if;

  -- Nao remove o objeto: um upload concorrente ainda pode concluir no path estavel.
  update public.quotations
  set source_file_path = null,
      source_file_pending = false
  where id = v_quotation.id
  returning * into v_quotation;

  return v_quotation;
end;
$$;

revoke all on function public.discard_pending_quotation_attachment(uuid, bigint) from public;
revoke all on function public.discard_pending_quotation_attachment(uuid, bigint) from anon;
revoke all on function public.discard_pending_quotation_attachment(uuid, bigint) from authenticated;
grant execute on function public.discard_pending_quotation_attachment(uuid, bigint) to authenticated;

create or replace function public.enforce_quotation_attachment_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- The existing private-bucket SELECT policy exposes object metadata to
  -- authenticated internal users, so invoker rights are sufficient here.
  if old.status = 'draft'
     and new.status in ('active', 'cancelled')
     and (
       new.source_file_pending
       or (
         new.source_file_path is not null
         and not exists (
           select 1
           from storage.objects o
           where o.bucket_id = 'supplier-quotes'
             and o.name = new.source_file_path
         )
       )
     ) then
    raise exception 'O anexo informado ainda nao foi armazenado. Aguarde o envio antes de ativar ou cancelar a cotacao.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_quotation_attachment_transition() from public;
revoke all on function public.enforce_quotation_attachment_transition() from anon;
revoke all on function public.enforce_quotation_attachment_transition() from authenticated;

drop trigger if exists trg_quotations_attachment_transition on public.quotations;
create trigger trg_quotations_attachment_transition
before update on public.quotations
for each row execute function public.enforce_quotation_attachment_transition();

create or replace function public.touch_draft_quotation_from_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quotation_ids uuid[];
  v_quotation_id uuid;
begin
  v_quotation_ids := case
    when tg_op = 'INSERT' then array[new.quotation_id]
    when tg_op = 'DELETE' then array[old.quotation_id]
    else array[old.quotation_id, new.quotation_id]
  end;

  for v_quotation_id in
    select distinct parent_id
    from unnest(v_quotation_ids) as parent(parent_id)
    where parent_id is not null
    order by parent_id
  loop
    update public.quotations
    set updated_at = now()
    where id = v_quotation_id
      and status = 'draft';
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.touch_draft_quotation_from_item() from public;
revoke all on function public.touch_draft_quotation_from_item() from anon;
revoke all on function public.touch_draft_quotation_from_item() from authenticated;

drop trigger if exists trg_quotation_items_touch_draft_parent on public.quotation_items;
create trigger trg_quotation_items_touch_draft_parent
after insert or update or delete on public.quotation_items
for each row execute function public.touch_draft_quotation_from_item();

commit;
