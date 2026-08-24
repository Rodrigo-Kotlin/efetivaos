-- ============================================================================
-- EFETIVA OS - Sprint 3 / Motor de Precos
-- View autoritativa para a tela de comparacao
--
-- Dependencias:
--   20260823000100_create_profiles_and_roles.sql
--   20260823000200_create_pricing_schema.sql
--   20260823000300_add_save_quotation_draft_rpc.sql
--
-- Esta migration NAO recria objetos existentes.
-- Acrescenta apenas a view public.comparison_current_v, que e a fonte
-- autoritativa da listagem operacional do Motor de Precos (Etapa 03):
--   - Lista TODOS os itens ativos do Catalogo Efetiva
--   - Junta o melhor custo vigente (best_quote_per_item_v) com as regras de
--     elegibilidade ja garantidas pelo schema de Sprint 0/2
--   - Mantem o empilhamento canonico por catalog_item_id
--   - Nao persiste estado novo; apenas deriva o que ja existe
-- ============================================================================

begin;

create or replace view public.comparison_current_v
with (security_invoker = true)
as
select
  ci.id as catalog_item_id,
  ci.code,
  ci.name as item_name,
  ci.unit,
  cc.id as category_id,
  cc.name as category_name,
  b.quotation_item_id as best_quotation_item_id,
  b.supplier_id as best_supplier_id,
  b.supplier_name as best_supplier_name,
  b.unit_price as best_unit_price,
  b.valid_until as best_valid_until,
  b.received_at as best_received_at,
  b.validity_not_informed as best_validity_not_informed,
  coalesce(b.eligible_offer_count, 0)::int as eligible_offer_count
from public.catalog_items ci
join public.catalog_categories cc on cc.id = ci.category_id
left join public.best_quote_per_item_v b on b.catalog_item_id = ci.id
where ci.active = true;

grant select on public.comparison_current_v to authenticated;

commit;
