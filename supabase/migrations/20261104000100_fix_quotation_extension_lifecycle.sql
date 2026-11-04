-- A cotacao ativa e imutavel por contrato. A prorrogacao e um evento separado
-- e nao deve tocar a linha de quotations (nem mesmo revision/updated_at).
begin;

create or replace function public.extend_quotation_validity(
  p_quotation_id uuid,
  p_expected_revision bigint,
  p_reason text default 'Prorrogação autorizada pelo fornecedor'
)
returns public.quotations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quotation public.quotations;
  v_previous date;
begin
  if not public.is_internal_user() then
    raise exception 'Voce nao tem permissao para prorrogar cotacoes.';
  end if;

  select * into v_quotation
  from public.quotations
  where id = p_quotation_id
  for update;

  if not found then raise exception 'Cotacao nao encontrada.'; end if;
  if v_quotation.status <> 'active' then raise exception 'Somente cotacoes ativas podem ser prorrogadas.'; end if;
  if v_quotation.archived_at is not null then raise exception 'Desarquive a cotacao antes de prorrogar a validade.'; end if;
  if v_quotation.revision <> p_expected_revision then raise exception 'Cotacao desatualizada. Recarregue antes de continuar.'; end if;
  if v_quotation.valid_until is null then raise exception 'Cotacoes sem validade nao precisam de prorrogacao.'; end if;

  select coalesce(max(e.extended_until), v_quotation.valid_until)
    into v_previous
  from public.quotation_validity_extensions e
  where e.quotation_id = v_quotation.id;

  if v_previous >= current_date then
    raise exception 'A cotacao ainda esta vigente e nao precisa de nova prorrogacao.';
  end if;

  insert into public.quotation_validity_extensions (quotation_id, previous_valid_until, extended_until, reason, created_by)
  values (v_quotation.id, v_previous, v_previous + 30, coalesce(nullif(trim(p_reason), ''), 'Prorrogação autorizada pelo fornecedor'), (select auth.uid()));

  return v_quotation;
end;
$$;

revoke all on function public.extend_quotation_validity(uuid, bigint, text) from public;
grant execute on function public.extend_quotation_validity(uuid, bigint, text) to authenticated;

commit;
