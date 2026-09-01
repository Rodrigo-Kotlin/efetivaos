-- ============================================================================
-- EFETIVA OS — OPERAÇÃO A: BACKUP ANTES DO RESET OPERACIONAL
-- ============================================================================
--
-- VERSÃO: 1.1 (adiciona financial_period_locks)
-- DATA: 2026-08-29 (atualizado 2026-09-01)
-- AMBIENTE: Supabase DEV (bxviuzluxcijbqqbpyzb)
--
-- OBJETIVO:
--   Criar backup lógico de todas as tabelas operacionais que serão limpas
--   pelo reset. Executar e COMMITAR ANTES do reset.
--
-- MÉTODO:
--   1. Schema versionado por timestamp (_reset_backup_YYYYMMDD_HHMM)
--   2. CTAS (CREATE TABLE AS SELECT) para cada tabela operacional
--   3. Validação: source count = backup count para cada tabela
--   4. Se qualquer contagem divergir: BLOCKER (não prosseguir)
--
-- IMPORTANTE:
--   - Executar PRIMEIRO este script
--   - COMMITAR este script INDEPENDENTEMENTE do reset
--   - NÃO commitar este arquivo no Git (contém dados reais)
--   - Após reset confirmado, remover backup: DROP SCHEMA _reset_backup_... CASCADE;
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. GERAR NOME DO SCHEMA COM TIMESTAMP
-- ============================================================================

DO $$
DECLARE
  v_ts text;
  v_schema text;
BEGIN
  v_ts := to_char(now(), 'YYYYMMDD_HH24MI');
  v_schema := '_reset_backup_' || v_ts;

  -- Criar schema
  EXECUTE format('CREATE SCHEMA %I', v_schema);

  -- Armazenar nome do schema em variável de sessão para uso posterior
  PERFORM set_config('app.reset_backup_schema', v_schema, false);

  RAISE NOTICE 'Schema de backup criado: %', v_schema;
END $$;

-- ============================================================================
-- 2. CRIAR TABELAS DE BACKUP (CTAS)
-- ============================================================================

DO $$
DECLARE
  v_schema text;
  v_tables text[] := ARRAY[
    'crm_opportunity_events',
    'crm_activities',
    'crm_opportunities',
    'client_contacts',
    'clients',
    'financial_journal_lines',
    'financial_journal_entries',
    'financial_transactions',
    'financial_asset_depreciation_postings',
    'financial_assets',
    'financial_notes',
    'financial_import_rows',
    'financial_import_batches',
    'financial_parties',
    'financial_period_locks',
    'price_list',
    'quotation_items',
    'margin_rules',
    'quotations',
    'catalog_items',
    'catalog_categories',
    'suppliers'
  ];
  v_table text;
BEGIN
  v_schema := current_setting('app.reset_backup_schema');

  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format(
      'CREATE TABLE %I.%I AS SELECT * FROM public.%I',
      v_schema, v_table, v_table
    );
    RAISE NOTICE 'Backup criado: %.%', v_schema, v_table;
  END LOOP;

  RAISE NOTICE 'Todas as tabelas de backup criadas em schema %', v_schema;
END $$;

-- ============================================================================
-- 3. VALIDAÇÃO: SOURCE COUNT = BACKUP COUNT
-- ============================================================================

DO $$
DECLARE
  v_schema text;
  v_tables text[] := ARRAY[
    'crm_opportunity_events',
    'crm_activities',
    'crm_opportunities',
    'client_contacts',
    'clients',
    'financial_journal_lines',
    'financial_journal_entries',
    'financial_transactions',
    'financial_asset_depreciation_postings',
    'financial_assets',
    'financial_notes',
    'financial_import_rows',
    'financial_import_batches',
    'financial_parties',
    'financial_period_locks',
    'price_list',
    'quotation_items',
    'margin_rules',
    'quotations',
    'catalog_items',
    'catalog_categories',
    'suppliers'
  ];
  v_table text;
  v_source_count int;
  v_backup_count int;
  v_errors text := '';
  v_ok boolean := true;
BEGIN
  v_schema := current_setting('app.reset_backup_schema');

  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'VALIDAÇÃO DE BACKUP — SOURCE COUNT = BACKUP COUNT';
  RAISE NOTICE '====================================================================';

  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_table) INTO v_source_count;
    EXECUTE format('SELECT count(*) FROM %I.%I', v_schema, v_table) INTO v_backup_count;

    IF v_source_count = v_backup_count THEN
      RAISE NOTICE '  %: source=% backup=% ✓', v_table, v_source_count, v_backup_count;
    ELSE
      RAISE WARNING '  %: source=% backup=% DIVERGENCE!', v_table, v_source_count, v_backup_count;
      v_errors := v_errors || v_table || '(source=' || v_source_count || ',backup=' || v_backup_count || ') ';
      v_ok := false;
    END IF;
  END LOOP;

  RAISE NOTICE '====================================================================';

  IF v_ok THEN
    RAISE NOTICE 'VALIDAÇÃO DE BACKUP: TODAS AS CONTAGENS CONFEREM ✓';
    RAISE NOTICE 'Schema de backup: %', v_schema;
    RAISE NOTICE 'Próximo passo: executar reset_operational_data.sql';
  ELSE
    RAISE EXCEPTION 'BLOCKER: Contagens de backup divergentes: %', v_errors;
  END IF;
END $$;

-- ============================================================================
-- 4. LISTAGEM FINAL DO SCHEMA
-- ============================================================================

DO $$
DECLARE
  v_schema text;
  v_count int;
BEGIN
  v_schema := current_setting('app.reset_backup_schema');

  SELECT count(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema = v_schema;

  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'RESUMO DO BACKUP';
  RAISE NOTICE '  Schema: %', v_schema;
  RAISE NOTICE '  Tabelas: %', v_count;
  RAISE NOTICE '  Status: COMMIT confirmado';
  RAISE NOTICE '  Para remover após reset: DROP SCHEMA % CASCADE;', v_schema;
  RAISE NOTICE '====================================================================';
END $$;

-- ============================================================================
-- COMMIT
-- ============================================================================

COMMIT;

-- ============================================================================
-- OPERAÇÃO A — BACKUP — CONCLUÍDO
-- ============================================================================
-- Próximos passos:
-- 1. Verificar logs (RAISE NOTICE)
-- 2. Anotar o nome do schema de backup
-- 3. Executar reset_operational_data.sql (Operação B)
-- 4. Após reset confirmado: DROP SCHEMA _reset_backup_YYYYMMDD_HHMM CASCADE;
-- ============================================================================
