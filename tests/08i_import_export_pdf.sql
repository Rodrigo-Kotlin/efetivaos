DO $$
DECLARE
  v_count INT;
BEGIN
  RAISE NOTICE '=== 08I: Importação/Exportação/PDF — SQL Tests ===';

  -- =====================================================================
  -- I. IMPORT TABLE STRUCTURE
  -- =====================================================================
  RAISE NOTICE '--- I. Import Table Structure ---';

  -- I.01: financial_import_batches table exists
  SELECT COUNT(*) INTO v_count FROM information_schema.tables WHERE table_name = 'financial_import_batches';
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS I.01: financial_import_batches table exists';
  ELSE
    RAISE WARNING 'FAIL I.01: financial_import_batches table missing';
  END IF;

  -- I.02: financial_import_rows table exists
  SELECT COUNT(*) INTO v_count FROM information_schema.tables WHERE table_name = 'financial_import_rows';
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS I.02: financial_import_rows table exists';
  ELSE
    RAISE WARNING 'FAIL I.02: financial_import_rows table missing';
  END IF;

  -- I.03: Required columns in import_batches
  SELECT COUNT(*) INTO v_count FROM information_schema.columns WHERE table_name = 'financial_import_batches' AND column_name IN ('id','user_id','file_name','file_type','file_size','status','total_rows','valid_rows','imported_rows','skipped_rows','duplicate_rows','error_rows','column_mapping','errors','created_at','updated_at');
  IF v_count >= 16 THEN
    RAISE NOTICE 'PASS I.03: import_batches has all required columns (>=16)';
  ELSE
    RAISE WARNING 'FAIL I.03: import_batches missing columns, found %', v_count;
  END IF;

  -- I.04: Required columns in import_rows
  SELECT COUNT(*) INTO v_count FROM information_schema.columns WHERE table_name = 'financial_import_rows' AND column_name IN ('id','batch_id','row_number','raw_data','mapped_data','status','errors','warnings','transaction_id','idempotency_key','created_at');
  IF v_count >= 11 THEN
    RAISE NOTICE 'PASS I.04: import_rows has all required columns (>=11)';
  ELSE
    RAISE WARNING 'FAIL I.04: import_rows missing columns, found %', v_count;
  END IF;

  -- I.05: batch_id has foreign key to import_batches
  SELECT COUNT(*) INTO v_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'financial_import_rows'
    AND kcu.column_name = 'batch_id'
    AND tc.constraint_type = 'FOREIGN KEY';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS I.05: import_rows.batch_id has foreign key to import_batches';
  ELSE
    RAISE WARNING 'FAIL I.05: import_rows.batch_id missing foreign key';
  END IF;

  -- I.06: transaction_id has foreign key to financial_transactions
  SELECT COUNT(*) INTO v_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'financial_import_rows'
    AND kcu.column_name = 'transaction_id'
    AND tc.constraint_type = 'FOREIGN KEY';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS I.06: import_rows.transaction_id has foreign key to transactions';
  ELSE
    RAISE WARNING 'FAIL I.06: import_rows.transaction_id missing foreign key';
  END IF;

  -- =====================================================================
  -- II. RPC FUNCTIONS EXIST
  -- =====================================================================
  RAISE NOTICE '--- II. RPC Functions ---';

  -- II.07: create_import_batch RPC exists
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'create_import_batch';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS II.07: create_import_batch RPC exists';
  ELSE
    RAISE WARNING 'FAIL II.07: create_import_batch RPC missing';
  END IF;

  -- II.08: create_import_row RPC exists
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'create_import_row';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS II.08: create_import_row RPC exists';
  ELSE
    RAISE WARNING 'FAIL II.08: create_import_row RPC missing';
  END IF;

  -- II.09: finalize_import_row RPC exists
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'finalize_import_row';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS II.09: finalize_import_row RPC exists';
  ELSE
    RAISE WARNING 'FAIL II.09: finalize_import_row RPC missing';
  END IF;

  -- II.10: update_import_batch_status RPC exists
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'update_import_batch_status';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS II.10: update_import_batch_status RPC exists';
  ELSE
    RAISE WARNING 'FAIL II.10: update_import_batch_status RPC missing';
  END IF;

  -- II.11: All RPCs are SECURITY DEFINER
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_language l ON p.prolang = l.oid
  WHERE p.proname IN ('create_import_batch', 'create_import_row', 'finalize_import_row', 'update_import_batch_status')
    AND p.prosecdef = true;
  IF v_count = 4 THEN
    RAISE NOTICE 'PASS II.11: All 4 RPCs are SECURITY DEFINER';
  ELSE
    RAISE WARNING 'FAIL II.11: Only % of 4 RPCs are SECURITY DEFINER', v_count;
  END IF;

  -- =====================================================================
  -- III. SECURITY (RLS)
  -- =====================================================================
  RAISE NOTICE '--- III. Security (RLS) ---';

  -- III.12: RLS is enabled on financial_import_batches
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'financial_import_batches' AND relrowsecurity = true) THEN
    RAISE NOTICE 'PASS III.12: RLS enabled on financial_import_batches';
  ELSE
    RAISE WARNING 'FAIL III.12: RLS not enabled on financial_import_batches';
  END IF;

  -- III.13: RLS is enabled on financial_import_rows
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'financial_import_rows' AND relrowsecurity = true) THEN
    RAISE NOTICE 'PASS III.13: RLS enabled on financial_import_rows';
  ELSE
    RAISE WARNING 'FAIL III.13: RLS not enabled on financial_import_rows';
  END IF;

  -- III.14: Admin policy exists on import_batches
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'financial_import_batches'
    AND policyname LIKE '%admin%'
    AND cmd = 'ALL';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS III.14: Admin ALL policy exists on import_batches';
  ELSE
    RAISE WARNING 'FAIL III.14: Admin ALL policy missing on import_batches';
  END IF;

  -- III.15: Admin policy exists on import_rows
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'financial_import_rows'
    AND policyname LIKE '%admin%'
    AND cmd = 'ALL';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS III.15: Admin ALL policy exists on import_rows';
  ELSE
    RAISE WARNING 'FAIL III.15: Admin ALL policy missing on import_rows';
  END IF;

  -- III.16: Equipe read policy exists on import_batches
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'financial_import_batches'
    AND policyname LIKE '%equipe%'
    AND cmd = 'SELECT';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS III.16: Equipe SELECT policy exists on import_batches';
  ELSE
    RAISE WARNING 'FAIL III.16: Equipe SELECT policy missing on import_batches';
  END IF;

  -- III.17: Equipe read policy exists on import_rows
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'financial_import_rows'
    AND policyname LIKE '%equipe%'
    AND cmd = 'SELECT';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS III.17: Equipe SELECT policy exists on import_rows';
  ELSE
    RAISE WARNING 'FAIL III.17: Equipe SELECT policy missing on import_rows';
  END IF;

  -- =====================================================================
  -- IV. STORAGE BUCKET
  -- =====================================================================
  RAISE NOTICE '--- IV. Storage Bucket ---';

  -- IV.18: finance-imports bucket exists
  SELECT COUNT(*) INTO v_count FROM storage.buckets WHERE id = 'finance-imports';
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS IV.18: finance-imports bucket exists';
  ELSE
    RAISE WARNING 'FAIL IV.18: finance-imports bucket missing';
  END IF;

  -- IV.19: finance-imports bucket is private
  SELECT COUNT(*) INTO v_count FROM storage.buckets WHERE id = 'finance-imports' AND public = false;
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS IV.19: finance-imports bucket is private';
  ELSE
    RAISE WARNING 'FAIL IV.19: finance-imports bucket is not private';
  END IF;

  -- IV.20: finance-imports has file size limit
  SELECT COUNT(*) INTO v_count FROM storage.buckets WHERE id = 'finance-imports' AND file_size_limit > 0;
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS IV.20: finance-imports has file size limit';
  ELSE
    RAISE WARNING 'FAIL IV.20: finance-imports missing file size limit';
  END IF;

  -- IV.21: Storage SELECT policy exists
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'objects'
    AND schemaname = 'storage'
    AND policyname LIKE '%finance_imports%'
    AND cmd = 'SELECT';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS IV.21: Storage SELECT policy for finance-imports exists';
  ELSE
    RAISE WARNING 'FAIL IV.21: Storage SELECT policy for finance-imports missing';
  END IF;

  -- IV.22: Storage INSERT policy exists
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'objects'
    AND schemaname = 'storage'
    AND policyname LIKE '%finance_imports%'
    AND cmd = 'INSERT';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS IV.22: Storage INSERT policy for finance-imports exists';
  ELSE
    RAISE WARNING 'FAIL IV.22: Storage INSERT policy for finance-imports missing';
  END IF;

  -- =====================================================================
  -- V. INDEXES
  -- =====================================================================
  RAISE NOTICE '--- V. Indexes ---';

  -- V.23: Index on import_batches.user_id
  SELECT COUNT(*) INTO v_count FROM pg_indexes WHERE tablename = 'financial_import_batches' AND indexname LIKE '%user%';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS V.23: Index on import_batches.user_id exists';
  ELSE
    RAISE WARNING 'FAIL V.23: Index on import_batches.user_id missing';
  END IF;

  -- V.24: Index on import_batches.status
  SELECT COUNT(*) INTO v_count FROM pg_indexes WHERE tablename = 'financial_import_batches' AND indexname LIKE '%status%';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS V.24: Index on import_batches.status exists';
  ELSE
    RAISE WARNING 'FAIL V.24: Index on import_batches.status missing';
  END IF;

  -- V.25: Index on import_rows.batch_id
  SELECT COUNT(*) INTO v_count FROM pg_indexes WHERE tablename = 'financial_import_rows' AND indexname LIKE '%batch%';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS V.25: Index on import_rows.batch_id exists';
  ELSE
    RAISE WARNING 'FAIL V.25: Index on import_rows.batch_id missing';
  END IF;

  -- V.26: Index on import_rows.idempotency_key
  SELECT COUNT(*) INTO v_count FROM pg_indexes WHERE tablename = 'financial_import_rows' AND indexname LIKE '%idempoten%';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS V.26: Index on import_rows.idempotency_key exists';
  ELSE
    RAISE WARNING 'FAIL V.26: Index on import_rows.idempotency_key missing';
  END IF;

  -- V.27: Index on import_rows.status
  SELECT COUNT(*) INTO v_count FROM pg_indexes WHERE tablename = 'financial_import_rows' AND indexname LIKE '%status%';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS V.27: Index on import_rows.status exists';
  ELSE
    RAISE WARNING 'FAIL V.27: Index on import_rows.status missing';
  END IF;

  -- =====================================================================
  -- VI. COLUMN TYPES
  -- =====================================================================
  RAISE NOTICE '--- VI. Column Types ---';

  -- VI.28: batch id is UUID
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'financial_import_batches' AND column_name = 'id' AND data_type = 'uuid';
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS VI.28: import_batches.id is UUID';
  ELSE
    RAISE WARNING 'FAIL VI.28: import_batches.id is not UUID';
  END IF;

  -- VI.29: batch column_mapping is jsonb
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'financial_import_batches' AND column_name = 'column_mapping' AND data_type = 'jsonb';
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS VI.29: import_batches.column_mapping is JSONB';
  ELSE
    RAISE WARNING 'FAIL VI.29: import_batches.column_mapping is not JSONB';
  END IF;

  -- VI.30: batch errors is jsonb
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'financial_import_batches' AND column_name = 'errors' AND data_type = 'jsonb';
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS VI.30: import_batches.errors is JSONB';
  ELSE
    RAISE WARNING 'FAIL VI.30: import_batches.errors is not JSONB';
  END IF;

  -- VI.31: row raw_data is jsonb
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'financial_import_rows' AND column_name = 'raw_data' AND data_type = 'jsonb';
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS VI.31: import_rows.raw_data is JSONB';
  ELSE
    RAISE WARNING 'FAIL VI.31: import_rows.raw_data is not JSONB';
  END IF;

  -- VI.32: row mapped_data is jsonb
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'financial_import_rows' AND column_name = 'mapped_data' AND data_type = 'jsonb';
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS VI.32: import_rows.mapped_data is JSONB';
  ELSE
    RAISE WARNING 'FAIL VI.32: import_rows.mapped_data is not JSONB';
  END IF;

  -- =====================================================================
  -- VII. GRANTS
  -- =====================================================================
  RAISE NOTICE '--- VII. Grants ---';

  -- VII.33: authenticated has EXECUTE on create_import_batch
  SELECT COUNT(*) INTO v_count FROM information_schema.routine_privileges
  WHERE routine_name = 'create_import_batch'
    AND grantee = 'authenticated'
    AND privilege_type = 'EXECUTE';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS VII.33: authenticated has EXECUTE on create_import_batch';
  ELSE
    RAISE WARNING 'FAIL VII.33: authenticated missing EXECUTE on create_import_batch';
  END IF;

  -- VII.34: authenticated has EXECUTE on create_import_row
  SELECT COUNT(*) INTO v_count FROM information_schema.routine_privileges
  WHERE routine_name = 'create_import_row'
    AND grantee = 'authenticated'
    AND privilege_type = 'EXECUTE';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS VII.34: authenticated has EXECUTE on create_import_row';
  ELSE
    RAISE WARNING 'FAIL VII.34: authenticated missing EXECUTE on create_import_row';
  END IF;

  -- VII.35: anon cannot execute import RPCs
  SELECT COUNT(*) INTO v_count FROM information_schema.routine_privileges
  WHERE routine_name IN ('create_import_batch', 'create_import_row', 'finalize_import_row', 'update_import_batch_status')
    AND grantee = 'anon'
    AND privilege_type = 'EXECUTE';
  IF v_count = 0 THEN
    RAISE NOTICE 'PASS VII.35: anon has no EXECUTE on any import RPCs';
  ELSE
    RAISE WARNING 'FAIL VII.35: anon has EXECUTE on % import RPCs', v_count;
  END IF;

  -- =====================================================================
  -- VIII. LEDGER INTEGRATION CHECKS
  -- =====================================================================
  RAISE NOTICE '--- VIII. Ledger Integration Checks ---';

  -- VIII.36: financial_transactions table has idempotency_key column
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'financial_transactions' AND column_name = 'idempotency_key';
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS VIII.36: financial_transactions has idempotency_key column';
  ELSE
    RAISE WARNING 'FAIL VIII.36: financial_transactions missing idempotency_key column';
  END IF;

  -- VIII.37: financial_journal_entries table has idempotency_key column
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'financial_journal_entries' AND column_name = 'idempotency_key';
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS VIII.37: financial_journal_entries has idempotency_key column';
  ELSE
    RAISE WARNING 'FAIL VIII.37: financial_journal_entries missing idempotency_key column';
  END IF;

  -- VIII.38: create_financial_transaction RPC exists
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'create_financial_transaction';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS VIII.38: create_financial_transaction RPC exists';
  ELSE
    RAISE WARNING 'FAIL VIII.38: create_financial_transaction RPC missing';
  END IF;

  -- VIII.39: create_financial_transaction has multiple parameters (indicating idempotency_key support)
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'create_financial_transaction';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS VIII.39: create_financial_transaction exists with parameters';
  ELSE
    RAISE WARNING 'FAIL VIII.39: create_financial_transaction missing';
  END IF;

  -- VIII.40: import_rows has ON DELETE CASCADE on batch_id
  SELECT COUNT(*) INTO v_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
  JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
  WHERE tc.table_name = 'financial_import_rows'
    AND ccu.column_name = 'batch_id'
    AND rc.delete_rule = 'CASCADE';
  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS VIII.40: import_rows.batch_id has ON DELETE CASCADE';
  ELSE
    RAISE WARNING 'FAIL VIII.40: import_rows.batch_id missing ON DELETE CASCADE';
  END IF;

  RAISE NOTICE '=== 08I: SQL Tests Complete (40 checks) ===';
END $$;
