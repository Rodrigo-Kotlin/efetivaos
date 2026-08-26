-- ============================================================================
-- MICROGATE 08B.1 — SQL Test Suite (78 assertions)
-- Transaction engine + append-only journal + idempotency + security
-- All tests run inside a single transaction with ROLLBACK — zero side effects.
-- ============================================================================

BEGIN;

CREATE TEMPORARY TABLE _test_results (
  test_id int, description text, passed boolean, detail text
);

CREATE TEMPORARY TABLE _tx_ids (key text PRIMARY KEY, val uuid);

-- Seed: financial_accounts
INSERT INTO public.financial_accounts (id, name, chart_account_id, active)
SELECT '00000000-0000-0000-0000-000000000001', 'Banco Teste 01',
       (SELECT id FROM public.financial_chart_accounts WHERE code = '1.1.01.001' LIMIT 1), true
WHERE NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE id = '00000000-0000-0000-0000-000000000001');

INSERT INTO public.financial_accounts (id, name, chart_account_id, active)
SELECT '00000000-0000-0000-0000-000000000002', 'Banco Teste 02',
       (SELECT id FROM public.financial_chart_accounts WHERE code = '1.1.01.002' LIMIT 1), true
WHERE NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE id = '00000000-0000-0000-0000-000000000002');

-- ===========================================================================
-- 1-22: CORE TRANSACTION + JOURNAL ENGINE
-- ===========================================================================
DO $$
DECLARE
  _tx01 uuid; _tx02 uuid; _tx03 uuid; _tx04 uuid;
  _tx05 uuid; _tx06 uuid; _tx07 uuid; _tx08 uuid;
  _cat_receita uuid; _cat_despesa uuid;
  _acct1 uuid := '00000000-0000-0000-0000-000000000001';
  _acct2 uuid := '00000000-0000-0000-0000-000000000002';
  _ok boolean;
BEGIN
  SELECT id INTO _cat_receita FROM public.financial_categories
    WHERE active = true AND movement_type = 'RECEITA' LIMIT 1;
  SELECT id INTO _cat_despesa FROM public.financial_categories
    WHERE active = true AND movement_type = 'DESPESA' LIMIT 1;

  -- 1. RECEITA: requires category_id + origin_account_id
  _tx01 := public.create_financial_transaction(
    'Receita Teste 01', '2026-01-15', '2026-01-01', 'RECEITA', 1500.00,
    _cat_receita, _acct1, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO _tx_ids VALUES ('tx01', _tx01);

  INSERT INTO _test_results VALUES (1, 'RECEITA returns UUID',
    _tx01 IS NOT NULL AND length(_tx01::text) = 36, '');
  INSERT INTO _test_results VALUES (2, 'RECEITA status = pending',
    (SELECT status FROM public.financial_transactions WHERE id = _tx01) = 'pending', '');
  INSERT INTO _test_results VALUES (3, 'RECEITA has 1 journal entry',
    (SELECT count(*) FROM public.financial_journal_entries WHERE transaction_id = _tx01) = 1, '');
  INSERT INTO _test_results VALUES (4, 'RECEITA has 2 journal lines',
    (SELECT count(*) FROM public.financial_journal_lines
     WHERE entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx01)) = 2, '');
  INSERT INTO _test_results VALUES (5, 'RECEITA journal balanced',
    (SELECT abs(sum(debit) - sum(credit)) < 0.01
     FROM public.financial_journal_lines
     WHERE entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx01)), '');
  INSERT INTO _test_results VALUES (6, 'RECEITA debit to 1.1.02.001 (Clientes)',
    (SELECT count(*) > 0 FROM public.financial_journal_lines l
     JOIN public.financial_chart_accounts ca ON ca.id = l.chart_account_id
     WHERE ca.code = '1.1.02.001'
     AND l.entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx01)
     AND l.debit = 1500.00), '');

  -- 2. DESPESA: requires category_id + destination_account_id
  _tx02 := public.create_financial_transaction(
    'Despesa Teste 01', '2026-01-20', '2026-01-01', 'DESPESA', 800.50,
    _cat_despesa, NULL, _acct1,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO _tx_ids VALUES ('tx02', _tx02);

  INSERT INTO _test_results VALUES (7, 'DESPESA created',
    (SELECT count(*) = 1 FROM public.financial_transactions WHERE id = _tx02), '');
  INSERT INTO _test_results VALUES (8, 'DESPESA journal balanced',
    (SELECT abs(sum(debit) - sum(credit)) < 0.01
     FROM public.financial_journal_lines
     WHERE entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx02)), '');
  INSERT INTO _test_results VALUES (9, 'DESPESA credit to 2.1.01.001',
    (SELECT count(*) > 0 FROM public.financial_journal_lines l
     JOIN public.financial_chart_accounts ca ON ca.id = l.chart_account_id
     WHERE ca.code = '2.1.01.001'
     AND l.entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx02)
     AND l.credit = 800.50), '');

  -- 3. TRANSFERENCIA: requires origin + destination (different)
  _tx03 := public.create_financial_transaction(
    'Transferencia Teste', '2026-02-01', '2026-02-01', 'TRANSFERENCIA', 5000.00,
    NULL, _acct1, _acct2,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO _tx_ids VALUES ('tx03', _tx03);

  INSERT INTO _test_results VALUES (10, 'TRANSFERENCIA created',
    (SELECT count(*) = 1 FROM public.financial_transactions WHERE id = _tx03), '');
  INSERT INTO _test_results VALUES (11, 'TRANSFERENCIA journal balanced',
    (SELECT abs(sum(debit) - sum(credit)) < 0.01
     FROM public.financial_journal_lines
     WHERE entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx03)), '');

  -- 4. EMPRESTIMO_RECEBIDO: requires origin_account_id
  _tx04 := public.create_financial_transaction(
    'Emprestimo Recebido', '2026-02-10', '2026-02-01', 'EMPRESTIMO_RECEBIDO', 10000.00,
    NULL, _acct1, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO _tx_ids VALUES ('tx04', _tx04);

  INSERT INTO _test_results VALUES (12, 'EMPRESTIMO_RECEBIDO created',
    (SELECT count(*) = 1 FROM public.financial_transactions WHERE id = _tx04), '');
  INSERT INTO _test_results VALUES (13, 'EMPRESTIMO_RECEBIDO credit to 2.1.06.001',
    (SELECT count(*) > 0 FROM public.financial_journal_lines l
     JOIN public.financial_chart_accounts ca ON ca.id = l.chart_account_id
     WHERE ca.code = '2.1.06.001'
     AND l.entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx04)
     AND l.credit = 10000.00), '');

  -- 5. EMPRESTIMO_PAGO: requires destination_account_id + principal + interest
  _tx05 := public.create_financial_transaction(
    'Emprestimo Pago', '2026-03-01', '2026-03-01', 'EMPRESTIMO_PAGO', 5200.00,
    NULL, NULL, _acct1,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5000.00, 200.00, NULL);
  INSERT INTO _tx_ids VALUES ('tx05', _tx05);

  INSERT INTO _test_results VALUES (14, 'EMPRESTIMO_PAGO created',
    (SELECT count(*) = 1 FROM public.financial_transactions WHERE id = _tx05), '');
  INSERT INTO _test_results VALUES (15, 'EMPRESTIMO_PAGO has 3 journal lines',
    (SELECT count(*) = 3 FROM public.financial_journal_lines
     WHERE entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx05)), '');
  INSERT INTO _test_results VALUES (16, 'EMPRESTIMO_PAGO journal balanced',
    (SELECT abs(sum(debit) - sum(credit)) < 0.01
     FROM public.financial_journal_lines
     WHERE entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx05)), '');

  -- 6. APORTE: requires origin_account_id
  _tx06 := public.create_financial_transaction(
    'Aporte Teste', '2026-03-15', '2026-03-01', 'APORTE', 20000.00,
    NULL, _acct1, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO _tx_ids VALUES ('tx06', _tx06);

  INSERT INTO _test_results VALUES (17, 'APORTE created',
    (SELECT count(*) = 1 FROM public.financial_transactions WHERE id = _tx06), '');
  INSERT INTO _test_results VALUES (18, 'APORTE credit to 2.3.01.001',
    (SELECT count(*) > 0 FROM public.financial_journal_lines l
     JOIN public.financial_chart_accounts ca ON ca.id = l.chart_account_id
     WHERE ca.code = '2.3.01.001'
     AND l.entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx06)
     AND l.credit = 20000.00), '');

  -- 7. RETIRADA: requires origin_account_id
  _tx07 := public.create_financial_transaction(
    'Retirada Teste', '2026-04-01', '2026-04-01', 'RETIRADA', 3000.00,
    NULL, _acct1, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO _tx_ids VALUES ('tx07', _tx07);

  INSERT INTO _test_results VALUES (19, 'RETIRADA created',
    (SELECT count(*) = 1 FROM public.financial_transactions WHERE id = _tx07), '');
  INSERT INTO _test_results VALUES (20, 'RETIRADA debit to 2.3.04.001',
    (SELECT count(*) > 0 FROM public.financial_journal_lines l
     JOIN public.financial_chart_accounts ca ON ca.id = l.chart_account_id
     WHERE ca.code = '2.3.04.001'
     AND l.entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx07)
     AND l.debit = 3000.00), '');

  -- 8. SALDO_INICIAL: requires origin_account_id
  _tx08 := public.create_financial_transaction(
    'Saldo Inicial', '2026-01-01', '2026-01-01', 'SALDO_INICIAL', 50000.00,
    NULL, _acct1, _acct2,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO _tx_ids VALUES ('tx08', _tx08);

  INSERT INTO _test_results VALUES (21, 'SALDO_INICIAL review_required',
    (SELECT review_required FROM public.financial_transactions WHERE id = _tx08) = true, '');
  INSERT INTO _test_results VALUES (22, 'SALDO_INICIAL journal balanced',
    (SELECT abs(sum(debit) - sum(credit)) < 0.01
     FROM public.financial_journal_lines
     WHERE entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx08)), '');

END $$;

-- ===========================================================================
-- 23-29: SETTLE / CANCEL (append-only behavior)
-- ===========================================================================
DO $$
DECLARE
  _tx01 uuid; _tx02 uuid;
BEGIN
  SELECT val INTO _tx01 FROM _tx_ids WHERE key = 'tx01';
  SELECT val INTO _tx02 FROM _tx_ids WHERE key = 'tx02';

  -- SETTLE: append-only — original entry preserved + new settled entry
  PERFORM public.settle_financial_transaction(_tx01, '2026-01-20', NULL);

  INSERT INTO _test_results VALUES (23, 'RECEITA settled -> status = settled',
    (SELECT status FROM public.financial_transactions WHERE id = _tx01) = 'settled', '');
  INSERT INTO _test_results VALUES (24, 'RECEITA payment_date set',
    (SELECT payment_date FROM public.financial_transactions WHERE id = _tx01) = '2026-01-20', '');
  -- Append-only: original pending entry + new settled entry = 2 entries
  INSERT INTO _test_results VALUES (25, 'RECEITA settle has 2 journal entries (append-only)',
    (SELECT count(*) FROM public.financial_journal_entries WHERE transaction_id = _tx01) = 2, '');
  INSERT INTO _test_results VALUES (26, 'RECEITA total lines = 4 (2 per entry)',
    (SELECT count(*) FROM public.financial_journal_lines
     WHERE entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx01)) = 4, '');

  -- CANCEL: append-only — original entry preserved + new estorno entry
  PERFORM public.cancel_financial_transaction(_tx02, 'Cancelado para teste');

  INSERT INTO _test_results VALUES (27, 'DESPESA cancelled -> status = cancelled',
    (SELECT status FROM public.financial_transactions WHERE id = _tx02) = 'cancelled', '');
  -- Append-only: original pending entry + new estorno entry = 2 entries
  INSERT INTO _test_results VALUES (28, 'DESPESA cancel has 2 journal entries (append-only)',
    (SELECT count(*) FROM public.financial_journal_entries WHERE transaction_id = _tx02) = 2, '');
  INSERT INTO _test_results VALUES (29, 'DESPESA reversal journal balanced',
    (SELECT abs(sum(debit) - sum(credit)) < 0.01
     FROM public.financial_journal_lines
     WHERE entry_id IN (SELECT id FROM public.financial_journal_entries WHERE transaction_id = _tx02)), '');

END $$;

-- ===========================================================================
-- 30-36: VIEWS
-- ===========================================================================
INSERT INTO _test_results VALUES (30, 'Transactions list_v has rows',
  (SELECT count(*) > 0 FROM public.financial_transactions_list_v), '');

INSERT INTO _test_results VALUES (31, 'List_v journal_entry_count = 2 for settled tx',
  (SELECT journal_entry_count FROM public.financial_transactions_list_v
   WHERE id = (SELECT val FROM _tx_ids WHERE key = 'tx01')) = 2, '');

INSERT INTO _test_results VALUES (32, 'List_v total_debit > 0',
  (SELECT total_debit::numeric FROM public.financial_transactions_list_v
   WHERE id = (SELECT val FROM _tx_ids WHERE key = 'tx01')) > 0, '');

INSERT INTO _test_results VALUES (33, 'List_v name resolution',
  (SELECT origin_account_name FROM public.financial_transactions_list_v
   WHERE id = (SELECT val FROM _tx_ids WHERE key = 'tx01')) IS NOT NULL, '');

INSERT INTO _test_results VALUES (34, 'Journal entries list_v has rows',
  (SELECT count(*) > 0 FROM public.financial_journal_entries_list_v), '');

INSERT INTO _test_results VALUES (35, 'Journal lines list_v has rows',
  (SELECT count(*) > 0 FROM public.financial_journal_lines_list_v), '');

INSERT INTO _test_results VALUES (36, 'Journal lines list_v code resolved',
  (SELECT chart_account_code FROM public.financial_journal_lines_list_v LIMIT 1) IS NOT NULL, '');

-- ===========================================================================
-- 37-39: EDGE CASES
-- ===========================================================================
DO $$
DECLARE
  _tx02 uuid; _cat_receita uuid;
  _acct1 uuid := '00000000-0000-0000-0000-000000000001';
  _ok boolean;
BEGIN
  SELECT val INTO _tx02 FROM _tx_ids WHERE key = 'tx02';
  SELECT id INTO _cat_receita FROM public.financial_categories
    WHERE active = true AND movement_type = 'RECEITA' LIMIT 1;

  -- 37. Negative amount rejected
  _ok := false;
  BEGIN
    PERFORM public.create_financial_transaction(
      'Neg', '2026-01-01', '2026-01-01', 'RECEITA', -100,
      _cat_receita, _acct1, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  EXCEPTION WHEN OTHERS THEN _ok := true;
  END;
  INSERT INTO _test_results VALUES (37, 'Negative amount rejected', _ok, '');

  -- 38. Cannot settle cancelled
  _ok := false;
  BEGIN
    PERFORM public.settle_financial_transaction(_tx02, '2026-01-01', NULL);
  EXCEPTION WHEN OTHERS THEN _ok := true;
  END;
  INSERT INTO _test_results VALUES (38, 'Cannot settle cancelled tx', _ok, '');

  -- 39. Cancel on already-cancelled is rejected
  _ok := false;
  BEGIN
    PERFORM public.cancel_financial_transaction(_tx02, 'fail');
  EXCEPTION WHEN OTHERS THEN _ok := true;
  END;
  INSERT INTO _test_results VALUES (39, 'Cannot cancel already-cancelled tx', _ok, '');

END $$;

-- ===========================================================================
-- 40-47: SCHEMA
-- ===========================================================================
INSERT INTO _test_results VALUES (40, 'Table financial_transactions exists',
  (SELECT count(*) > 0 FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'financial_transactions'), '');

INSERT INTO _test_results VALUES (41, 'Table financial_journal_entries exists',
  (SELECT count(*) > 0 FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'financial_journal_entries'), '');

INSERT INTO _test_results VALUES (42, 'Table financial_journal_lines exists',
  (SELECT count(*) > 0 FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'financial_journal_lines'), '');

INSERT INTO _test_results VALUES (43, 'Enum financial_transaction_status exists',
  (SELECT count(*) > 0 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public' AND t.typname = 'financial_transaction_status'), '');

INSERT INTO _test_results VALUES (44, 'RPC create_financial_transaction exists',
  (SELECT count(*) > 0 FROM information_schema.routines
   WHERE routine_schema = 'public' AND routine_name = 'create_financial_transaction'), '');

INSERT INTO _test_results VALUES (45, 'RPC settle_financial_transaction exists',
  (SELECT count(*) > 0 FROM information_schema.routines
   WHERE routine_schema = 'public' AND routine_name = 'settle_financial_transaction'), '');

INSERT INTO _test_results VALUES (46, 'RPC cancel_financial_transaction exists',
  (SELECT count(*) > 0 FROM information_schema.routines
   WHERE routine_schema = 'public' AND routine_name = 'cancel_financial_transaction'), '');

INSERT INTO _test_results VALUES (47, 'RPC update_financial_transaction exists',
  (SELECT count(*) > 0 FROM information_schema.routines
   WHERE routine_schema = 'public' AND routine_name = 'update_financial_transaction'), '');

-- ===========================================================================
-- 48-55: RLS / GRANTS / COLUMNS
-- ===========================================================================
INSERT INTO _test_results VALUES (48, 'RLS on financial_transactions',
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'financial_transactions'), '');

INSERT INTO _test_results VALUES (49, 'RLS on financial_journal_entries',
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'financial_journal_entries'), '');

INSERT INTO _test_results VALUES (50, 'RLS on financial_journal_lines',
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'financial_journal_lines'), '');

INSERT INTO _test_results VALUES (51, 'Authenticated SELECT on transactions',
  (SELECT count(*) > 0 FROM information_schema.role_table_grants
   WHERE grantee = 'authenticated' AND table_name = 'financial_transactions'
   AND privilege_type = 'SELECT'), '');

-- 52: No authenticated INSERT on journal_entries (removed by hardening)
INSERT INTO _test_results VALUES (52, 'No INSERT on journal_entries for authenticated',
  (SELECT count(*) = 0 FROM information_schema.role_table_grants
   WHERE grantee = 'authenticated' AND table_name = 'financial_journal_entries'
   AND privilege_type = 'INSERT'), '');

INSERT INTO _test_results VALUES (53, 'No DELETE on transactions for authenticated',
  (SELECT count(*) = 0 FROM information_schema.role_table_grants
   WHERE grantee = 'authenticated' AND table_name = 'financial_transactions'
   AND privilege_type = 'DELETE'), '');

INSERT INTO _test_results VALUES (54, 'Version column exists',
  (SELECT count(*) > 0 FROM information_schema.columns
   WHERE table_name = 'financial_transactions' AND column_name = 'version'), '');

INSERT INTO _test_results VALUES (55, 'review_required column exists',
  (SELECT count(*) > 0 FROM information_schema.columns
   WHERE table_name = 'financial_transactions' AND column_name = 'review_required'), '');

-- ===========================================================================
-- 56-65: SECURITY HARDENING (new)
-- ===========================================================================

-- 56. No authenticated INSERT on transactions (removed by hardening)
INSERT INTO _test_results VALUES (56, 'No INSERT on transactions for authenticated',
  (SELECT count(*) = 0 FROM information_schema.role_table_grants
   WHERE grantee = 'authenticated' AND table_name = 'financial_transactions'
   AND privilege_type = 'INSERT'), '');

-- 57. No authenticated UPDATE on transactions (removed by hardening)
INSERT INTO _test_results VALUES (57, 'No UPDATE on transactions for authenticated',
  (SELECT count(*) = 0 FROM information_schema.role_table_grants
   WHERE grantee = 'authenticated' AND table_name = 'financial_transactions'
   AND privilege_type = 'UPDATE'), '');

-- 58. No authenticated UPDATE on journal_entries (removed by hardening)
INSERT INTO _test_results VALUES (58, 'No UPDATE on journal_entries for authenticated',
  (SELECT count(*) = 0 FROM information_schema.role_table_grants
   WHERE grantee = 'authenticated' AND table_name = 'financial_journal_entries'
   AND privilege_type = 'UPDATE'), '');

-- 59. No authenticated INSERT on journal_lines (removed by hardening)
INSERT INTO _test_results VALUES (59, 'No INSERT on journal_lines for authenticated',
  (SELECT count(*) = 0 FROM information_schema.role_table_grants
   WHERE grantee = 'authenticated' AND table_name = 'financial_journal_lines'
   AND privilege_type = 'INSERT'), '');

-- 60. No authenticated UPDATE on journal_lines (removed by hardening)
INSERT INTO _test_results VALUES (60, 'No UPDATE on journal_lines for authenticated',
  (SELECT count(*) = 0 FROM information_schema.role_table_grants
   WHERE grantee = 'authenticated' AND table_name = 'financial_journal_lines'
   AND privilege_type = 'UPDATE'), '');

-- 61. Journal entries immutable trigger exists
INSERT INTO _test_results VALUES (61, 'Journal entries immutable trigger exists',
  (SELECT count(*) > 0 FROM pg_trigger
   WHERE tgname = 'trg_fje_immutable'
   AND tgrelid = 'financial_journal_entries'::regclass), '');

-- 62. Journal lines immutable trigger exists
INSERT INTO _test_results VALUES (62, 'Journal lines immutable trigger exists',
  (SELECT count(*) > 0 FROM pg_trigger
   WHERE tgname = 'trg_fjl_immutable'
   AND tgrelid = 'financial_journal_lines'::regclass), '');

-- 63. prevent_journal_entry_mutation function exists
INSERT INTO _test_results VALUES (63, 'prevent_journal_entry_mutation function exists',
  (SELECT count(*) > 0 FROM information_schema.routines
   WHERE routine_schema = 'public' AND routine_name = 'prevent_journal_entry_mutation'), '');

-- 64. prevent_journal_line_mutation function exists
INSERT INTO _test_results VALUES (64, 'prevent_journal_line_mutation function exists',
  (SELECT count(*) > 0 FROM information_schema.routines
   WHERE routine_schema = 'public' AND routine_name = 'prevent_journal_line_mutation'), '');

-- 65. is_admin function exists
INSERT INTO _test_results VALUES (65, 'is_admin function exists',
  (SELECT count(*) > 0 FROM information_schema.routines
   WHERE routine_schema = 'public' AND routine_name = 'is_admin'), '');

-- ===========================================================================
-- 66-72: IDEMPOTENCY KEY (new)
-- ===========================================================================

-- 66. idempotency_key column exists
INSERT INTO _test_results VALUES (66, 'idempotency_key column exists',
  (SELECT count(*) > 0 FROM information_schema.columns
   WHERE table_name = 'financial_transactions' AND column_name = 'idempotency_key'), '');

-- 67. Unique index on idempotency_key exists
INSERT INTO _test_results VALUES (67, 'Unique index on idempotency_key exists',
  (SELECT count(*) > 0 FROM pg_indexes
   WHERE indexname = 'idx_ft_idempotency_key'), '');

-- 68-70. Idempotency: create with same key returns same tx
DO $$
DECLARE
  _key text := 'test-idempotency-' || gen_random_uuid()::text;
  _tx1 uuid; _tx2 uuid;
BEGIN
  _tx1 := public.create_financial_transaction(
    'Idempotent Tx 1', '2026-05-01', '2026-05-01', 'APORTE', 1000.00,
    NULL, '00000000-0000-0000-0000-000000000001', NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, _key);

  _tx2 := public.create_financial_transaction(
    'Idempotent Tx 2 DUPLICATE', '2026-05-01', '2026-05-01', 'APORTE', 9999.00,
    NULL, '00000000-0000-0000-0000-000000000001', NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, _key);

  INSERT INTO _test_results VALUES (68, 'Idempotent: same key returns same UUID',
    _tx1 = _tx2, 'tx1=' || _tx1::text || ' tx2=' || _tx2::text);

  INSERT INTO _test_results VALUES (69, 'Idempotent: original data preserved',
    (SELECT description FROM public.financial_transactions WHERE id = _tx1) = 'Idempotent Tx 1', '');

  INSERT INTO _test_results VALUES (70, 'Idempotent: original amount preserved',
    (SELECT amount FROM public.financial_transactions WHERE id = _tx1) = 1000.00, '');

END $$;

-- 71-72. Idempotency: different keys create different txs
DO $$
DECLARE
  _tx1 uuid; _tx2 uuid;
BEGIN
  _tx1 := public.create_financial_transaction(
    'Unique Tx A', '2026-06-01', '2026-06-01', 'APORTE', 500.00,
    NULL, '00000000-0000-0000-0000-000000000001', NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'key-A');

  _tx2 := public.create_financial_transaction(
    'Unique Tx B', '2026-06-02', '2026-06-02', 'APORTE', 600.00,
    NULL, '00000000-0000-0000-0000-000000000001', NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'key-B');

  INSERT INTO _test_results VALUES (71, 'Different keys: different UUIDs',
    _tx1 IS DISTINCT FROM _tx2, '');

  INSERT INTO _test_results VALUES (72, 'Different keys: different amounts',
    (SELECT amount FROM public.financial_transactions WHERE id = _tx1) =
    500.00 AND
    (SELECT amount FROM public.financial_transactions WHERE id = _tx2) = 600.00, '');

END $$;

-- ===========================================================================
-- 73-78: GLOBAL BALANCE + LEDGER INTEGRITY (new)
-- ===========================================================================

-- 73. Global balance: total debits = total credits across all journal lines
INSERT INTO _test_results VALUES (73, 'Global balance: debits = credits',
  (SELECT abs(sum(debit) - sum(credit)) < 0.01 FROM public.financial_journal_lines), '');

-- 74. No orphan journal lines (all lines reference valid entry)
INSERT INTO _test_results VALUES (74, 'No orphan journal lines',
  (SELECT count(*) = 0 FROM public.financial_journal_lines l
   WHERE NOT EXISTS (SELECT 1 FROM public.financial_journal_entries e WHERE e.id = l.entry_id)), '');

-- 75. No orphan journal entries (all entries reference valid transaction)
INSERT INTO _test_results VALUES (75, 'No orphan journal entries',
  (SELECT count(*) = 0 FROM public.financial_journal_entries e
   WHERE NOT EXISTS (SELECT 1 FROM public.financial_transactions t WHERE t.id = e.transaction_id)), '');

-- 76. Every entry has balanced lines (SUM debit = SUM credit per entry)
INSERT INTO _test_results VALUES (76, 'Every entry balanced individually',
  (SELECT count(*) = 0 FROM public.financial_journal_entries e
   WHERE (SELECT abs(sum(l.debit) - sum(l.credit))
          FROM public.financial_journal_lines l WHERE l.entry_id = e.id) > 0.01
   AND (SELECT count(*) FROM public.financial_journal_lines l WHERE l.entry_id = e.id) > 0), '');

-- 77. All transactions have at least 1 journal entry
INSERT INTO _test_results VALUES (77, 'All transactions have journal entries',
  (SELECT count(*) = 0 FROM public.financial_transactions t
   WHERE NOT EXISTS (SELECT 1 FROM public.financial_journal_entries e WHERE e.transaction_id = t.id)), '');

-- 78. Settled transactions have at least 2 journal entries (append-only: original + settled)
INSERT INTO _test_results VALUES (78, 'Settled txs have >= 2 journal entries',
  (SELECT count(*) = 0 FROM public.financial_transactions t
   WHERE t.status = 'settled'
   AND (SELECT count(*) FROM public.financial_journal_entries e WHERE e.transaction_id = t.id) < 2), '');

-- ===========================================================================
-- RESULTS
-- ===========================================================================
SELECT test_id, description, passed,
  CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END as result
FROM _test_results ORDER BY test_id;

SELECT 'SUMMARY' as section,
  count(*) FILTER (WHERE passed) as passed_count,
  count(*) FILTER (WHERE NOT passed) as failed_count,
  count(*) as total
FROM _test_results;

SELECT 'FAILED' as section, test_id, description, detail
FROM _test_results WHERE NOT passed ORDER BY test_id;

ROLLBACK;
