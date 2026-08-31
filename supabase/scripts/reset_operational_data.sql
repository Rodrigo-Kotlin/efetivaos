-- ============================================================================
-- EFETIVA OS — OPERAÇÃO B: RESET OPERACIONAL CONTROLADO
-- ============================================================================
--
-- VERSÃO: 4.0 (corrige trigger quotation_items draft-only + supplier sequence)
-- DATA: 2026-08-31
-- AMBIENTE: Supabase DEV (bxviuzluxcijbqqbpyzb)
--
-- PRÉ-REQUISITO:
--   Executar e COMMITAR backup_before_operational_reset.sql (Operação A)
--   ANTES deste script.
--
-- OBJETIVO:
--   Remover TODOS os dados operacionais do banco DEV, preservando:
--   - Estrutura (tabelas, constraints, indexes, views, RPCs, RLS)
--   - Triggers (incluindo imutáveis — apenas desabilitados temporariamente)
--   - Usuários auth.users e profiles
--   - Seeds estruturais: pipeline, etapas, motivos de perda, plano de contas,
--     centros de custo, linhas de serviço, categorias, formas de pagamento,
--     contas financeiras
--   - Configurações técnicas
--
-- SEQUÊNCIA (dentro de UMA ÚNICA TRANSAÇÃO):
--   1.  Capturar contagens pré-reset (tabelas operacionais + estruturais)
--   2.  Mock CRM audit (ANTES de deletar)
--   3.  DISABLE triggers: ledger (trg_fje_immutable, trg_fjl_immutable)
--                            + quotation_items (trg_quotation_items_draft_only,
--                              trg_quotation_items_integrity_deferred)
--   4.  CRM cleanup
--   5.  Finance cleanup
--   6.  Pricing cleanup
--   7.  Restart supplier_code_seq (if exists)
--   8.  Verificação: tabelas operacionais = 0 (EXCEPTION se falhar)
--   9.  Verificação: estruturas preservadas, before_count = after_count
--   10. ENABLE triggers: ledger + quotation_items
--   11. Verificação: pg_trigger tgenabled = 'O' para todos
--   12. Se qualquer gate falhar → RAISE EXCEPTION → ROLLBACK
--   13. Somente se tudo passar → COMMIT
--
-- SEGURO:
--   - Transacional: erro = ROLLBACK completo
--   - Sem TRUNCATE CASCADE
--   - Sem DELETE wildcard
--   - Mock audit ANTES do delete
--   - Verificações usam RAISE EXCEPTION (bloqueiam COMMIT)
--   - Preservação valida before_count = after_count
-- ============================================================================

BEGIN;

-- ============================================================================
-- FASE 1: CAPTURAR CONTAGENS PRÉ-RESET
-- ============================================================================
-- Armazena contagens de TODAS as tabelas (operacionais e estruturais)
-- para uso posterior na verificação de preservação (before == after).

DO $$
DECLARE
  -- Operacionais (devem ficar = 0)
  v_before_crm_events       int;  v_before_crm_activities    int;
  v_before_crm_opps         int;  v_before_clients           int;
  v_before_contacts          int;
  v_before_jl               int;  v_before_je                int;
  v_before_ft               int;  v_before_dep_postings      int;
  v_before_assets           int;  v_before_notes             int;
  v_before_import_rows      int;  v_before_import_batches    int;
  v_before_parties          int;
  v_before_price_list       int;  v_before_quotation_items   int;
  v_before_quotations       int;  v_before_margin_rules      int;
  v_before_catalog_items    int;  v_before_catalog_cats      int;
  v_before_suppliers        int;
  -- Estruturais (devem permanecer com mesma contagem)
  v_before_pipelines        int;  v_before_stages            int;
  v_before_loss_reasons     int;
  v_before_chart_accounts   int;  v_before_cost_centers      int;
  v_before_service_lines    int;  v_before_categories        int;
  v_before_payment_methods  int;  v_before_fin_accounts      int;
  v_before_profiles         int;  v_before_users             int;
BEGIN
  -- Operacionais
  SELECT count(*) INTO v_before_crm_events      FROM public.crm_opportunity_events;
  SELECT count(*) INTO v_before_crm_activities   FROM public.crm_activities;
  SELECT count(*) INTO v_before_crm_opps         FROM public.crm_opportunities;
  SELECT count(*) INTO v_before_clients          FROM public.clients;
  SELECT count(*) INTO v_before_contacts         FROM public.client_contacts;
  SELECT count(*) INTO v_before_jl               FROM public.financial_journal_lines;
  SELECT count(*) INTO v_before_je               FROM public.financial_journal_entries;
  SELECT count(*) INTO v_before_ft               FROM public.financial_transactions;
  SELECT count(*) INTO v_before_dep_postings     FROM public.financial_asset_depreciation_postings;
  SELECT count(*) INTO v_before_assets           FROM public.financial_assets;
  SELECT count(*) INTO v_before_notes            FROM public.financial_notes;
  SELECT count(*) INTO v_before_import_rows      FROM public.financial_import_rows;
  SELECT count(*) INTO v_before_import_batches   FROM public.financial_import_batches;
  SELECT count(*) INTO v_before_parties          FROM public.financial_parties;
  SELECT count(*) INTO v_before_price_list       FROM public.price_list;
  SELECT count(*) INTO v_before_quotation_items  FROM public.quotation_items;
  SELECT count(*) INTO v_before_quotations       FROM public.quotations;
  SELECT count(*) INTO v_before_margin_rules     FROM public.margin_rules;
  SELECT count(*) INTO v_before_catalog_items    FROM public.catalog_items;
  SELECT count(*) INTO v_before_catalog_cats     FROM public.catalog_categories;
  SELECT count(*) INTO v_before_suppliers        FROM public.suppliers;

  -- Estruturais
  SELECT count(*) INTO v_before_pipelines        FROM public.crm_pipelines;
  SELECT count(*) INTO v_before_stages           FROM public.crm_stages;
  SELECT count(*) INTO v_before_loss_reasons     FROM public.crm_loss_reasons;
  SELECT count(*) INTO v_before_chart_accounts   FROM public.financial_chart_accounts;
  SELECT count(*) INTO v_before_cost_centers     FROM public.financial_cost_centers;
  SELECT count(*) INTO v_before_service_lines    FROM public.financial_service_lines;
  SELECT count(*) INTO v_before_categories       FROM public.financial_categories;
  SELECT count(*) INTO v_before_payment_methods  FROM public.financial_payment_methods;
  SELECT count(*) INTO v_before_fin_accounts     FROM public.financial_accounts;
  SELECT count(*) INTO v_before_profiles         FROM public.profiles;
  SELECT count(*) INTO v_before_users            FROM auth.users;

  -- Armazenar em variáveis de sessão para uso nas fases posteriores
  PERFORM set_config('app.bef_crm_events',      v_before_crm_events::text,      false);
  PERFORM set_config('app.bef_crm_activities',   v_before_crm_activities::text,   false);
  PERFORM set_config('app.bef_crm_opps',         v_before_crm_opps::text,         false);
  PERFORM set_config('app.bef_clients',          v_before_clients::text,          false);
  PERFORM set_config('app.bef_contacts',         v_before_contacts::text,         false);
  PERFORM set_config('app.bef_jl',               v_before_jl::text,               false);
  PERFORM set_config('app.bef_je',               v_before_je::text,               false);
  PERFORM set_config('app.bef_ft',               v_before_ft::text,               false);
  PERFORM set_config('app.bef_dep_postings',     v_before_dep_postings::text,     false);
  PERFORM set_config('app.bef_assets',           v_before_assets::text,           false);
  PERFORM set_config('app.bef_notes',            v_before_notes::text,            false);
  PERFORM set_config('app.bef_import_rows',      v_before_import_rows::text,      false);
  PERFORM set_config('app.bef_import_batches',   v_before_import_batches::text,   false);
  PERFORM set_config('app.bef_parties',          v_before_parties::text,          false);
  PERFORM set_config('app.bef_price_list',       v_before_price_list::text,       false);
  PERFORM set_config('app.bef_quotation_items',  v_before_quotation_items::text,  false);
  PERFORM set_config('app.bef_quotations',       v_before_quotations::text,       false);
  PERFORM set_config('app.bef_margin_rules',     v_before_margin_rules::text,     false);
  PERFORM set_config('app.bef_catalog_items',    v_before_catalog_items::text,    false);
  PERFORM set_config('app.bef_catalog_cats',     v_before_catalog_cats::text,     false);
  PERFORM set_config('app.bef_suppliers',        v_before_suppliers::text,        false);
  PERFORM set_config('app.bef_pipelines',        v_before_pipelines::text,        false);
  PERFORM set_config('app.bef_stages',           v_before_stages::text,           false);
  PERFORM set_config('app.bef_loss_reasons',     v_before_loss_reasons::text,     false);
  PERFORM set_config('app.bef_chart_accounts',   v_before_chart_accounts::text,   false);
  PERFORM set_config('app.bef_cost_centers',     v_before_cost_centers::text,     false);
  PERFORM set_config('app.bef_service_lines',    v_before_service_lines::text,    false);
  PERFORM set_config('app.bef_categories',       v_before_categories::text,       false);
  PERFORM set_config('app.bef_payment_methods',  v_before_payment_methods::text,  false);
  PERFORM set_config('app.bef_fin_accounts',     v_before_fin_accounts::text,     false);
  PERFORM set_config('app.bef_profiles',         v_before_profiles::text,         false);
  PERFORM set_config('app.bef_users',            v_before_users::text,            false);

  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'CONTAGENS PRÉ-RESET CAPTURADAS';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '--- Operacionais (devem ficar = 0) ---';
  RAISE NOTICE '  crm_opportunity_events:  %', v_before_crm_events;
  RAISE NOTICE '  crm_activities:          %', v_before_crm_activities;
  RAISE NOTICE '  crm_opportunities:       %', v_before_crm_opps;
  RAISE NOTICE '  clients:                 %', v_before_clients;
  RAISE NOTICE '  client_contacts:         %', v_before_contacts;
  RAISE NOTICE '  journal_lines:           %', v_before_jl;
  RAISE NOTICE '  journal_entries:         %', v_before_je;
  RAISE NOTICE '  transactions:            %', v_before_ft;
  RAISE NOTICE '  depreciation_postings:   %', v_before_dep_postings;
  RAISE NOTICE '  assets:                  %', v_before_assets;
  RAISE NOTICE '  notes:                   %', v_before_notes;
  RAISE NOTICE '  import_rows:             %', v_before_import_rows;
  RAISE NOTICE '  import_batches:          %', v_before_import_batches;
  RAISE NOTICE '  parties:                 %', v_before_parties;
  RAISE NOTICE '  price_list:              %', v_before_price_list;
  RAISE NOTICE '  quotation_items:         %', v_before_quotation_items;
  RAISE NOTICE '  quotations:              %', v_before_quotations;
  RAISE NOTICE '  margin_rules:            %', v_before_margin_rules;
  RAISE NOTICE '  catalog_items:           %', v_before_catalog_items;
  RAISE NOTICE '  catalog_categories:      %', v_before_catalog_cats;
  RAISE NOTICE '  suppliers:               %', v_before_suppliers;
  RAISE NOTICE '--- Estruturais (devem permanecer) ---';
  RAISE NOTICE '  crm_pipelines:           %', v_before_pipelines;
  RAISE NOTICE '  crm_stages:              %', v_before_stages;
  RAISE NOTICE '  crm_loss_reasons:        %', v_before_loss_reasons;
  RAISE NOTICE '  chart_accounts:          %', v_before_chart_accounts;
  RAISE NOTICE '  cost_centers:            %', v_before_cost_centers;
  RAISE NOTICE '  service_lines:           %', v_before_service_lines;
  RAISE NOTICE '  categories:              %', v_before_categories;
  RAISE NOTICE '  payment_methods:         %', v_before_payment_methods;
  RAISE NOTICE '  financial_accounts:      %', v_before_fin_accounts;
  RAISE NOTICE '  profiles:                %', v_before_profiles;
  RAISE NOTICE '  auth.users:              %', v_before_users;
  RAISE NOTICE '====================================================================';
END $$;

-- ============================================================================
-- FASE 2: MOCK CRM AUDIT (ANTES DO DELETE)
-- ============================================================================
-- Busca nomes fictícios do mock visual no banco.
-- Executa ANTES de qualquer DELETE para detectar se mocks foram inseridos.

DO $$
DECLARE
  v_mock_names text[] := ARRAY[
    'Norte Logística Ltda.',
    'Construtora Tapajós',
    'Hotel Rio Verde',
    'Mineração Horizonte',
    'Shopping Amazônia',
    'Grupo Madeira Forte',
    'Transportes Norte Brasil',
    'Arati Distribuidora',
    'Grupo Das Neves'
  ];
  v_name text;
  v_count int;
  v_total int := 0;
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'MOCK CRM AUDIT — ANTES DO DELETE';
  RAISE NOTICE '====================================================================';

  FOREACH v_name IN ARRAY v_mock_names LOOP
    SELECT count(*) INTO v_count
    FROM public.clients
    WHERE trade_name ILIKE '%' || v_name || '%'
       OR legal_name ILIKE '%' || v_name || '%';

    RAISE NOTICE '  %: %', v_name, v_count;
    v_total := v_total + v_count;
  END LOOP;

  RAISE NOTICE '---';
  RAISE NOTICE 'Mock CRM records found BEFORE reset: %', v_total;
  RAISE NOTICE 'Mock HTML preserved: YES (docs/wireframes/crm-comercial-mock.html)';
  RAISE NOTICE '====================================================================';

  -- Armazenar para referência posterior
  PERFORM set_config('app.mock_found_before', v_total::text, false);
END $$;

-- ============================================================================
-- FASE 3: DESABILITAR TRIGGERS DO LEDGER + QUOTATION_ITEMS
-- ============================================================================
-- Ledger: trg_fje_immutable e trg_fjl_immutable bloqueiam DELETE.
-- Quotation items:
--   trg_quotation_items_draft_only bloqueia DELETE quando quotation não é draft.
--   trg_quotation_items_integrity_deferred bloqueia DELETE que deixaria
--     quotation active sem itens ou com itens inválidos.
-- Todos desabilitados DENTRO da transação. Reabilitados antes do COMMIT.
-- Se ROLLBACK, voltam ao estado anterior automaticamente.

-- Ledger
ALTER TABLE public.financial_journal_entries
  DISABLE TRIGGER trg_fje_immutable;

ALTER TABLE public.financial_journal_lines
  DISABLE TRIGGER trg_fjl_immutable;

-- Quotation items (draft-only + integrity deferred)
ALTER TABLE public.quotation_items
  DISABLE TRIGGER trg_quotation_items_draft_only;

ALTER TABLE public.quotation_items
  DISABLE TRIGGER trg_quotation_items_integrity_deferred;

DO $$ BEGIN
  RAISE NOTICE 'Triggers desabilitados (dentro da transação):';
  RAISE NOTICE '  - trg_fje_immutable (ledger)';
  RAISE NOTICE '  - trg_fjl_immutable (ledger)';
  RAISE NOTICE '  - trg_quotation_items_draft_only (quotation items)';
  RAISE NOTICE '  - trg_quotation_items_integrity_deferred (quotation items)';
END $$;

-- ============================================================================
-- FASE 4: CRM — REMOVER DADOS OPERACIONAIS
-- ============================================================================
-- Ordem FK:
--   crm_opportunity_events.opportunity_id → crm_opportunities (CASCADE)
--   crm_activities.opportunity_id → crm_opportunities (CASCADE)
--   crm_opportunities.client_id → clients (RESTRICT)

DELETE FROM public.crm_opportunity_events;
DELETE FROM public.crm_activities;
DELETE FROM public.crm_opportunities;
DELETE FROM public.client_contacts;
DELETE FROM public.clients;

DO $$ BEGIN
  RAISE NOTICE 'CRM cleanup concluído';
END $$;

-- ============================================================================
-- FASE 5: FINANCEIRO — REMOVER DADOS OPERACIONAIS DO LEDGER
-- ============================================================================
-- Triggers imutáveis desabilitados na Fase 3.
-- Ordem: linhas → entradas → transações → depreciação → ativos → notas → import → partes

DELETE FROM public.financial_journal_lines;
DELETE FROM public.financial_journal_entries;
DELETE FROM public.financial_transactions;
DELETE FROM public.financial_asset_depreciation_postings;
DELETE FROM public.financial_assets;
DELETE FROM public.financial_notes;
DELETE FROM public.financial_import_rows;
DELETE FROM public.financial_import_batches;
DELETE FROM public.financial_parties;

DO $$ BEGIN
  RAISE NOTICE 'Finance cleanup concluído';
END $$;

-- ============================================================================
-- FASE 6: PRICING — REMOVER DADOS OPERACIONAIS
-- ============================================================================
-- Ordem FK: price_list → quotation_items → margin_rules → quotations
--           → catalog_items → catalog_categories → suppliers

DELETE FROM public.price_list;
DELETE FROM public.quotation_items;
DELETE FROM public.margin_rules;
DELETE FROM public.quotations;
DELETE FROM public.catalog_items;
DELETE FROM public.catalog_categories;
DELETE FROM public.suppliers;

DO $$ BEGIN
  RAISE NOTICE 'Pricing cleanup concluído';
END $$;

-- ============================================================================
-- FASE 6.1: REINICIAR SUPPLIER CODE SEQUENCE (se existir)
-- ============================================================================
-- supplier_code_seq é usada por generate_supplier_code() para criar FOR-000001.
-- Após remover todos os suppliers, reiniciar para 1 para o próximo INSERT começar em FOR-000001.

DO $$
BEGIN
  IF to_regclass('public.supplier_code_seq') IS NOT NULL THEN
    PERFORM setval('public.supplier_code_seq', 1, false);
    RAISE NOTICE 'supplier_code_seq reiniciada → próximo código: FOR-000001';
  ELSE
    RAISE NOTICE 'supplier_code_seq não existe — nada a reiniciar';
  END IF;
END $$;

-- ============================================================================
-- FASE 7: VERIFICAÇÃO PÓS-RESET — TABELAS OPERACIONAIS DEVEM ESTAR ZERADAS
-- ============================================================================
-- Se qualquer tabela operacional tiver registros → RAISE EXCEPTION → ROLLBACK

DO $$
DECLARE
  v_errors text := '';
  v_count  int;
  v_ok     boolean := true;
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'VERIFICAÇÃO PÓS-RESET — TABELAS OPERACIONAIS';
  RAISE NOTICE '====================================================================';

  -- CRM
  SELECT count(*) INTO v_count FROM public.crm_opportunity_events;
  IF v_count > 0 THEN v_errors := v_errors || 'crm_opportunity_events=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.crm_activities;
  IF v_count > 0 THEN v_errors := v_errors || 'crm_activities=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.crm_opportunities;
  IF v_count > 0 THEN v_errors := v_errors || 'crm_opportunities=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.clients;
  IF v_count > 0 THEN v_errors := v_errors || 'clients=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.client_contacts;
  IF v_count > 0 THEN v_errors := v_errors || 'client_contacts=' || v_count || ' '; v_ok := false; END IF;

  -- Finance
  SELECT count(*) INTO v_count FROM public.financial_journal_lines;
  IF v_count > 0 THEN v_errors := v_errors || 'journal_lines=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.financial_journal_entries;
  IF v_count > 0 THEN v_errors := v_errors || 'journal_entries=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.financial_transactions;
  IF v_count > 0 THEN v_errors := v_errors || 'transactions=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.financial_asset_depreciation_postings;
  IF v_count > 0 THEN v_errors := v_errors || 'depreciation_postings=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.financial_assets;
  IF v_count > 0 THEN v_errors := v_errors || 'assets=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.financial_notes;
  IF v_count > 0 THEN v_errors := v_errors || 'notes=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.financial_import_rows;
  IF v_count > 0 THEN v_errors := v_errors || 'import_rows=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.financial_import_batches;
  IF v_count > 0 THEN v_errors := v_errors || 'import_batches=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.financial_parties;
  IF v_count > 0 THEN v_errors := v_errors || 'parties=' || v_count || ' '; v_ok := false; END IF;

  -- Pricing
  SELECT count(*) INTO v_count FROM public.price_list;
  IF v_count > 0 THEN v_errors := v_errors || 'price_list=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.quotation_items;
  IF v_count > 0 THEN v_errors := v_errors || 'quotation_items=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.quotations;
  IF v_count > 0 THEN v_errors := v_errors || 'quotations=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.margin_rules;
  IF v_count > 0 THEN v_errors := v_errors || 'margin_rules=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.catalog_items;
  IF v_count > 0 THEN v_errors := v_errors || 'catalog_items=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.catalog_categories;
  IF v_count > 0 THEN v_errors := v_errors || 'catalog_categories=' || v_count || ' '; v_ok := false; END IF;

  SELECT count(*) INTO v_count FROM public.suppliers;
  IF v_count > 0 THEN v_errors := v_errors || 'suppliers=' || v_count || ' '; v_ok := false; END IF;

  IF v_ok THEN
    RAISE NOTICE 'Todas as tabelas operacionais: ZERADAS ✓';
  ELSE
    RAISE EXCEPTION 'BLOCKER: Operational residue after reset: %', v_errors;
  END IF;
END $$;

-- ============================================================================
-- FASE 8: VERIFICAÇÃO DE PRESERVAÇÃO — BEFORE_COUNT = AFTER_COUNT
-- ============================================================================
-- Compara contagens capturadas na Fase 1 com contagens atuais.
-- Estrutura antes == Estrutura depois.
-- Se qualquer divergência → RAISE EXCEPTION → ROLLBACK.

DO $$
DECLARE
  v_errors text := '';
  v_count  int;
  v_ok     boolean := true;
  v_before int;
  v_table  text;
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'VERIFICAÇÃO DE PRESERVAÇÃO — BEFORE = AFTER';
  RAISE NOTICE '====================================================================';

  -- crm_pipelines
  v_before := current_setting('app.bef_pipelines')::int;
  SELECT count(*) INTO v_count FROM public.crm_pipelines;
  v_table := 'crm_pipelines';
  IF v_count != v_before THEN
    RAISE WARNING '  %: before=% after=% DIVERGENCE', v_table, v_before, v_count;
    v_errors := v_errors || v_table || '(before=' || v_before || ',after=' || v_count || ') ';
    v_ok := false;
  ELSE
    RAISE NOTICE '  %: before=% after=% ✓', v_table, v_before, v_count;
  END IF;

  -- crm_stages
  v_before := current_setting('app.bef_stages')::int;
  SELECT count(*) INTO v_count FROM public.crm_stages;
  v_table := 'crm_stages';
  IF v_count != v_before THEN
    RAISE WARNING '  %: before=% after=% DIVERGENCE', v_table, v_before, v_count;
    v_errors := v_errors || v_table || '(before=' || v_before || ',after=' || v_count || ') ';
    v_ok := false;
  ELSE
    RAISE NOTICE '  %: before=% after=% ✓', v_table, v_before, v_count;
  END IF;

  -- crm_loss_reasons
  v_before := current_setting('app.bef_loss_reasons')::int;
  SELECT count(*) INTO v_count FROM public.crm_loss_reasons;
  v_table := 'crm_loss_reasons';
  IF v_count != v_before THEN
    RAISE WARNING '  %: before=% after=% DIVERGENCE', v_table, v_before, v_count;
    v_errors := v_errors || v_table || '(before=' || v_before || ',after=' || v_count || ') ';
    v_ok := false;
  ELSE
    RAISE NOTICE '  %: before=% after=% ✓', v_table, v_before, v_count;
  END IF;

  -- financial_chart_accounts
  v_before := current_setting('app.bef_chart_accounts')::int;
  SELECT count(*) INTO v_count FROM public.financial_chart_accounts;
  v_table := 'financial_chart_accounts';
  IF v_count != v_before THEN
    RAISE WARNING '  %: before=% after=% DIVERGENCE', v_table, v_before, v_count;
    v_errors := v_errors || v_table || '(before=' || v_before || ',after=' || v_count || ') ';
    v_ok := false;
  ELSE
    RAISE NOTICE '  %: before=% after=% ✓', v_table, v_before, v_count;
  END IF;

  -- financial_cost_centers
  v_before := current_setting('app.bef_cost_centers')::int;
  SELECT count(*) INTO v_count FROM public.financial_cost_centers;
  v_table := 'financial_cost_centers';
  IF v_count != v_before THEN
    RAISE WARNING '  %: before=% after=% DIVERGENCE', v_table, v_before, v_count;
    v_errors := v_errors || v_table || '(before=' || v_before || ',after=' || v_count || ') ';
    v_ok := false;
  ELSE
    RAISE NOTICE '  %: before=% after=% ✓', v_table, v_before, v_count;
  END IF;

  -- financial_service_lines
  v_before := current_setting('app.bef_service_lines')::int;
  SELECT count(*) INTO v_count FROM public.financial_service_lines;
  v_table := 'financial_service_lines';
  IF v_count != v_before THEN
    RAISE WARNING '  %: before=% after=% DIVERGENCE', v_table, v_before, v_count;
    v_errors := v_errors || v_table || '(before=' || v_before || ',after=' || v_count || ') ';
    v_ok := false;
  ELSE
    RAISE NOTICE '  %: before=% after=% ✓', v_table, v_before, v_count;
  END IF;

  -- financial_categories
  v_before := current_setting('app.bef_categories')::int;
  SELECT count(*) INTO v_count FROM public.financial_categories;
  v_table := 'financial_categories';
  IF v_count != v_before THEN
    RAISE WARNING '  %: before=% after=% DIVERGENCE', v_table, v_before, v_count;
    v_errors := v_errors || v_table || '(before=' || v_before || ',after=' || v_count || ') ';
    v_ok := false;
  ELSE
    RAISE NOTICE '  %: before=% after=% ✓', v_table, v_before, v_count;
  END IF;

  -- financial_payment_methods
  v_before := current_setting('app.bef_payment_methods')::int;
  SELECT count(*) INTO v_count FROM public.financial_payment_methods;
  v_table := 'financial_payment_methods';
  IF v_count != v_before THEN
    RAISE WARNING '  %: before=% after=% DIVERGENCE', v_table, v_before, v_count;
    v_errors := v_errors || v_table || '(before=' || v_before || ',after=' || v_count || ') ';
    v_ok := false;
  ELSE
    RAISE NOTICE '  %: before=% after=% ✓', v_table, v_before, v_count;
  END IF;

  -- financial_accounts
  v_before := current_setting('app.bef_fin_accounts')::int;
  SELECT count(*) INTO v_count FROM public.financial_accounts;
  v_table := 'financial_accounts';
  IF v_count != v_before THEN
    RAISE WARNING '  %: before=% after=% DIVERGENCE', v_table, v_before, v_count;
    v_errors := v_errors || v_table || '(before=' || v_before || ',after=' || v_count || ') ';
    v_ok := false;
  ELSE
    RAISE NOTICE '  %: before=% after=% ✓', v_table, v_before, v_count;
  END IF;

  -- profiles
  v_before := current_setting('app.bef_profiles')::int;
  SELECT count(*) INTO v_count FROM public.profiles;
  v_table := 'profiles';
  IF v_count != v_before THEN
    RAISE WARNING '  %: before=% after=% DIVERGENCE', v_table, v_before, v_count;
    v_errors := v_errors || v_table || '(before=' || v_before || ',after=' || v_count || ') ';
    v_ok := false;
  ELSE
    RAISE NOTICE '  %: before=% after=% ✓', v_table, v_before, v_count;
  END IF;

  -- auth.users
  v_before := current_setting('app.bef_users')::int;
  SELECT count(*) INTO v_count FROM auth.users;
  v_table := 'auth.users';
  IF v_count != v_before THEN
    RAISE WARNING '  %: before=% after=% DIVERGENCE', v_table, v_before, v_count;
    v_errors := v_errors || v_table || '(before=' || v_before || ',after=' || v_count || ') ';
    v_ok := false;
  ELSE
    RAISE NOTICE '  %: before=% after=% ✓', v_table, v_before, v_count;
  END IF;

  RAISE NOTICE '====================================================================';

  IF v_ok THEN
    RAISE NOTICE 'Preservação estrutural: BEFORE = AFTER ✓';
  ELSE
    RAISE EXCEPTION 'BLOCKER: Structural preservation failed (before ≠ after): %', v_errors;
  END IF;
END $$;

-- ============================================================================
-- FASE 9: MOCK CRM AUDIT — APÓS DELETE (confirmação)
-- ============================================================================

DO $$
DECLARE
  v_count int;
  v_before int;
BEGIN
  v_before := current_setting('app.mock_found_before')::int;

  SELECT count(*) INTO v_count
  FROM public.clients
  WHERE trade_name ILIKE '%Norte Logística%'
     OR legal_name ILIKE '%Norte Logística%'
     OR trade_name ILIKE '%Tapajós%'
     OR trade_name ILIKE '%Rio Verde%'
     OR trade_name ILIKE '%Horizonte%'
     OR trade_name ILIKE '%Amazônia%'
     OR trade_name ILIKE '%Madeira Forte%'
     OR trade_name ILIKE '%Norte Brasil%'
     OR trade_name ILIKE '%Arati%'
     OR trade_name ILIKE '%Das Neves%';

  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'MOCK CRM AUDIT — APÓS DELETE';
  RAISE NOTICE '  Mock records found BEFORE reset: %', v_before;
  RAISE NOTICE '  Mock records remaining AFTER reset: %', v_count;
  IF v_count > 0 THEN
    RAISE WARNING 'Mock records still present after reset: %', v_count;
  ELSE
    RAISE NOTICE 'Mock records absent after reset: YES ✓';
  END IF;
  RAISE NOTICE '====================================================================';
END $$;

-- ============================================================================
-- FASE 10: REABILITAR TRIGGERS (LEDGER + QUOTATION_ITEMS)
-- ============================================================================

-- Ledger
ALTER TABLE public.financial_journal_entries
  ENABLE TRIGGER trg_fje_immutable;

ALTER TABLE public.financial_journal_lines
  ENABLE TRIGGER trg_fjl_immutable;

-- Quotation items (draft-only + integrity deferred)
ALTER TABLE public.quotation_items
  ENABLE TRIGGER trg_quotation_items_draft_only;

ALTER TABLE public.quotation_items
  ENABLE TRIGGER trg_quotation_items_integrity_deferred;

DO $$ BEGIN
  RAISE NOTICE 'Triggers reabilitados:';
  RAISE NOTICE '  - trg_fje_immutable (ledger)';
  RAISE NOTICE '  - trg_fjl_immutable (ledger)';
  RAISE NOTICE '  - trg_quotation_items_draft_only (quotation items)';
  RAISE NOTICE '  - trg_quotation_items_integrity_deferred (quotation items)';
END $$;

-- ============================================================================
-- FASE 11: VERIFICAÇÃO DO ESTADO DOS TRIGGERS (pg_trigger)
-- ============================================================================
-- Consulta pg_trigger para confirmar tgenabled = 'O' (origin).
-- Se qualquer trigger não estiver habilitado → RAISE EXCEPTION → ROLLBACK.

DO $$
DECLARE
  v_fje_enabled text;
  v_fjl_enabled text;
  v_qi_draft_enabled text;
  v_qi_integrity_enabled text;
  v_blocker boolean := false;
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'VERIFICAÇÃO DOS TRIGGERS';
  RAISE NOTICE '====================================================================';

  -- Ledger triggers
  SELECT tgenabled INTO v_fje_enabled
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE t.tgname = 'trg_fje_immutable'
    AND n.nspname = 'public'
    AND c.relname = 'financial_journal_entries';

  SELECT tgenabled INTO v_fjl_enabled
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE t.tgname = 'trg_fjl_immutable'
    AND n.nspname = 'public'
    AND c.relname = 'financial_journal_lines';

  -- Quotation items triggers
  SELECT tgenabled INTO v_qi_draft_enabled
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE t.tgname = 'trg_quotation_items_draft_only'
    AND n.nspname = 'public'
    AND c.relname = 'quotation_items';

  SELECT tgenabled INTO v_qi_integrity_enabled
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE t.tgname = 'trg_quotation_items_integrity_deferred'
    AND n.nspname = 'public'
    AND c.relname = 'quotation_items';

  RAISE NOTICE 'trg_fje_immutable:                    tgenabled = %', COALESCE(v_fje_enabled, 'NOT FOUND');
  RAISE NOTICE 'trg_fjl_immutable:                    tgenabled = %', COALESCE(v_fjl_enabled, 'NOT FOUND');
  RAISE NOTICE 'trg_quotation_items_draft_only:        tgenabled = %', COALESCE(v_qi_draft_enabled, 'NOT FOUND');
  RAISE NOTICE 'trg_quotation_items_integrity_deferred: tgenabled = %', COALESCE(v_qi_integrity_enabled, 'NOT FOUND');

  IF v_fje_enabled IS NULL OR v_fje_enabled != 'O' THEN
    RAISE WARNING 'BLOCKER: trg_fje_immutable não habilitado (tgenabled=%)', COALESCE(v_fje_enabled, 'NULL');
    v_blocker := true;
  END IF;

  IF v_fjl_enabled IS NULL OR v_fjl_enabled != 'O' THEN
    RAISE WARNING 'BLOCKER: trg_fjl_immutable não habilitado (tgenabled=%)', COALESCE(v_fjl_enabled, 'NULL');
    v_blocker := true;
  END IF;

  IF v_qi_draft_enabled IS NULL OR v_qi_draft_enabled != 'O' THEN
    RAISE WARNING 'BLOCKER: trg_quotation_items_draft_only não habilitado (tgenabled=%)', COALESCE(v_qi_draft_enabled, 'NULL');
    v_blocker := true;
  END IF;

  IF v_qi_integrity_enabled IS NULL OR v_qi_integrity_enabled != 'O' THEN
    RAISE WARNING 'BLOCKER: trg_quotation_items_integrity_deferred não habilitado (tgenabled=%)', COALESCE(v_qi_integrity_enabled, 'NULL');
    v_blocker := true;
  END IF;

  IF v_blocker THEN
    RAISE EXCEPTION 'BLOCKER: Triggers não reabilitados. ROLLBACK.';
  ELSE
    RAISE NOTICE 'Todos os triggers: HABILITADOS ✓';
  END IF;
END $$;

-- ============================================================================
-- FASE 12: COMMIT
-- ============================================================================

COMMIT;

-- ============================================================================
-- OPERAÇÃO B — RESET OPERACIONAL CONTROLADO V4 — CONCLUÍDO
-- ============================================================================
-- V4 Changes (2026-08-31):
--   - Disable/enable trg_quotation_items_draft_only (blocks DELETE on non-draft)
--   - Disable/enable trg_quotation_items_integrity_deferred (blocks DELETE on active)
--   - Restart supplier_code_seq to 1 after supplier cleanup
--   - Verify all 4 triggers re-enabled (not just 2 ledger)
--
-- Próximos passos:
-- 1. Verificar logs acima (RAISE NOTICE/WARNING/EXCEPTION)
-- 2. Verificar no Dashboard que tabelas operacionais estão vazias
-- 3. Verificar que schema de backup existe (Operação A)
-- 4. Testar frontend: /crm, /finance, pricing → empty states
-- 5. Após validação: DROP SCHEMA _reset_backup_YYYYMMDD_HHMM CASCADE;
-- ============================================================================
