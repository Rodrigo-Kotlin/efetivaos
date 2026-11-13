-- CLIENTES-CONTRATOS-05
-- Corrige a RPC de eventos sem conceder INSERT direto a authenticated.
begin;

drop policy if exists client_contract_events_insert_internal on public.client_contract_events;

create or replace function public.record_client_contract_event(
  p_contract_id uuid,
  p_event_type public.contract_event_type,
  p_summary text,
  p_details jsonb default '{}'::jsonb
) returns public.client_contract_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.client_contract_events;
begin
  if (select auth.uid()) is null or not coalesce(public.is_internal_user(), false) then
    raise exception 'Usuario interno ativo obrigatorio.' using errcode = '42501';
  end if;

  if p_contract_id is null
     or not exists (
       select 1
       from public.client_contracts c
       where c.id = p_contract_id
         and c.archived_at is null
     ) then
    raise exception 'Contrato nao encontrado.' using errcode = 'P0002';
  end if;

  if p_summary is null or char_length(btrim(p_summary)) = 0 or char_length(btrim(p_summary)) > 500 then
    raise exception 'Resumo do evento invalido.' using errcode = '22023';
  end if;

  if p_details is null or jsonb_typeof(p_details) <> 'object' then
    raise exception 'Detalhes do evento devem ser um objeto JSON.' using errcode = '22023';
  end if;

  -- These values are authoritative database columns and can never be supplied
  -- through the metadata payload.
  if p_details ?| array['id', 'contract_id', 'client_id', 'created_by', 'created_at', 'actor'] then
    raise exception 'Campos de auditoria nao podem ser informados nos detalhes.' using errcode = '22023';
  end if;

  insert into public.client_contract_events(contract_id, event_type, summary, details, created_by)
  values (p_contract_id, p_event_type, btrim(p_summary), p_details, (select auth.uid()))
  returning * into v_event;

  return v_event;
end;
$$;

alter function public.record_client_contract_event(uuid, public.contract_event_type, text, jsonb) owner to postgres;
revoke all on function public.record_client_contract_event(uuid, public.contract_event_type, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_client_contract_event(uuid, public.contract_event_type, text, jsonb) to authenticated;

revoke insert, update, delete on public.client_contract_events from authenticated, anon, public;
grant select on public.client_contract_events to authenticated;

commit;
