-- ============================================================================
-- FASE 2H.2 — A3 (helper de trigger de fornecedores) e A6 (default privileges)
-- Revogação de EXECUTE de anon/PUBLIC no helper prevent_supplier_code_change
-- e saneamento dos privilégios padrão que regeneram EXECUTE para anon
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Empiricamente verificado (probe 2h2 no DEV, 2026-09-23):
--   1) prevent_supplier_code_change() é a ÚNICA função security definer do
--      schema public com EXECUTE para anon/PUBLIC. As funções irmãs
--      (prevent_catalog_item_code_change, enforce_catalog_item_sourcing_history,
--      assert_active_quotation_integrity) possuem ACL {postgres=X, service_role=X}.
--   2) O trigger trg_suppliers_code_immutable (BEFORE UPDATE em public.suppliers)
--      invoca o helper internamente e NÃO exige EXECUTE na role executora; a
--      revogação do helper não afeta o bloqueio (probe: TRIGGER_STILL_BLOCKS).
--   3) ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM public
--      NÃO remove o EXECUTE implícito de PUBLIC em funções novas (no-op).
--      Já REVOKE FROM anon nos default privileges REMOVE o anon:X auto-concedido.
--      Portanto os default privileges abaixo só são capazes de remover anon;
--      o PUBLIC é intrínseco ao PostgreSQL e é tratado por REVOKE explícito
--      por função (padrão do repositório) + teste de regressão.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- A3 — prevent_supplier_code_change: alinhar ACL ao padrão das funções irmãs
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.prevent_supplier_code_change() FROM public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A6 — Default privileges: não regenerar EXECUTE para anon em funções novas
-- do schema public criadas pela pipeline (role postgres).
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;