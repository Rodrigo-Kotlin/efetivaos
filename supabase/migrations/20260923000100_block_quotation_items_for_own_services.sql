-- ============================================================================
-- EFETIVA OS - Fase 2E: integridade entre servicos proprios e cotacoes (DB)
--
-- Objetivo: impedir, em nivel de banco, que itens de catalogo com
-- sourcing_type = 'own' sejam vinculados a quotation_items (fluxo
-- terceirizado). A protecao aplica a INSERT e UPDATE, independentemente de
-- qual cliente/interface executa a operacao.
--
-- Escopo desta migration:
--   1) Ampliar a guarda JA EXISTENTE em quotation_items
--      (public.enforce_quotation_item_draft_only) para incluir a validacao
--      de origem, preservando todas as regras atuais (rascunho, item ativo).
--   2) NAO altera o trigger (mesmo nome/evento continua vinculado a funcao
--      estendida).
--
-- Nao duplica a protecao de mudanca de origem: o trigger 2A
-- trg_catalog_items_sourcing_history_guard ja bloqueia outsourced->own e
-- own->outsourced quando o item participa de cotacao, proposta propria ou
-- precificacao vigente (ver migration 20260922000100).
--
-- Nao altera approve_price()/inactivate_price() (assinaturas preservadas).
-- Nao toca o Financeiro.
-- ============================================================================

begin;

create or replace function public.enforce_quotation_item_draft_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_quotation_ids uuid[];
  v_quotation record;
  v_item_active boolean;
  v_item_sourcing_type public.pricing_sourcing_type;
begin
  v_quotation_ids := case
    when tg_op = 'INSERT' then array[new.quotation_id]
    when tg_op = 'DELETE' then array[old.quotation_id]
    else array[old.quotation_id, new.quotation_id]
  end;

  for v_quotation in
    select q.id, q.status
    from public.quotations q
    where q.id = any(v_quotation_ids)
    order by q.id
    for update
  loop
    if v_quotation.status is distinct from 'draft' then
      raise exception 'Itens de cotacao somente podem ser alterados enquanto a cotacao estiver em draft.';
    end if;
  end loop;

  if tg_op <> 'DELETE' and new.catalog_item_id is not null then
    select ci.active, ci.sourcing_type
    into v_item_active, v_item_sourcing_type
    from public.catalog_items ci
    where ci.id = new.catalog_item_id
    for share;

    if coalesce(v_item_active, false) = false then
      raise exception 'Item de catalogo inativo nao pode ser usado em nova cotacao.';
    end if;

    if v_item_sourcing_type is distinct from 'outsourced' then
      raise exception 'Servicos proprios da Efetiva nao podem ser incluidos em cotacoes de fornecedores.';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Selagem: mantem sem EXECUTE publico (apenas uso via trigger).
revoke all on function public.enforce_quotation_item_draft_only() from public, anon, authenticated;

commit;