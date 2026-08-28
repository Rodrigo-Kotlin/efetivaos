-- ETAPA 08I — Financial Import/Export/PDF
-- Migration: import batches, import rows, storage bucket

-- ============================================================================
-- TABLE: financial_import_batches
-- Audit trail for import operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.financial_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'xlsx')),
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded', 'validated', 'processing', 'completed', 'completed_with_errors', 'failed', 'cancelled'
  )),
  total_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  duplicate_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  column_mapping JSONB,
  errors JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.financial_import_batches IS 'Audit trail for financial data import operations (ETAPA 08I). Not a financial source.';

-- ============================================================================
-- TABLE: financial_import_rows
-- Individual row tracking from imports
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.financial_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.financial_import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL,
  mapped_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'valid', 'invalid', 'imported', 'skipped', 'duplicate', 'error'
  )),
  errors JSONB,
  warnings JSONB,
  transaction_id UUID REFERENCES public.financial_transactions(id),
  idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.financial_import_rows IS 'Individual row tracking from financial imports. Links to transactions via transaction_id.';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_import_batches_user ON public.financial_import_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON public.financial_import_batches(status);
CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON public.financial_import_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_status ON public.financial_import_rows(status);
CREATE INDEX IF NOT EXISTS idx_import_rows_idempotency ON public.financial_import_rows(idempotency_key);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.financial_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_import_rows ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "import_batches_admin_all" ON public.financial_import_batches
  FOR ALL USING (public.is_admin());

CREATE POLICY "import_rows_admin_all" ON public.financial_import_rows
  FOR ALL USING (public.is_admin());

-- Equipe can read their own batches
CREATE POLICY "import_batches_equipe_read" ON public.financial_import_batches
  FOR SELECT USING (public.is_internal_user());

CREATE POLICY "import_rows_equipe_read" ON public.financial_import_rows
  FOR SELECT USING (public.is_internal_user());

-- ============================================================================
-- STORAGE BUCKET: finance-imports
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'finance-imports',
  'finance-imports',
  false,
  10485760,
  ARRAY['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "finance_imports_select_internal" ON storage.objects
  FOR SELECT USING (bucket_id = 'finance-imports' AND public.is_internal_user());

CREATE POLICY "finance_imports_insert_internal" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'finance-imports' AND public.is_internal_user());

CREATE POLICY "finance_imports_delete_admin" ON storage.objects
  FOR DELETE USING (bucket_id = 'finance-imports' AND public.is_admin());

-- ============================================================================
-- RPC: create_import_batch
-- Creates a batch record for tracking imports
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_import_batch(
  p_file_name TEXT,
  p_file_type TEXT,
  p_file_size INTEGER,
  p_column_mapping JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_batch_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create import batches';
  END IF;

  INSERT INTO public.financial_import_batches (user_id, file_name, file_type, file_size, column_mapping)
  VALUES (auth.uid(), p_file_name, p_file_type, p_file_size, p_column_mapping)
  RETURNING id INTO v_batch_id;

  RETURN v_batch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_import_batch TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_import_batch FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_import_batch FROM anon;

-- ============================================================================
-- RPC: update_import_batch_status
-- Updates batch status and counts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_import_batch_status(
  p_batch_id UUID,
  p_status TEXT,
  p_total_rows INTEGER DEFAULT NULL,
  p_valid_rows INTEGER DEFAULT NULL,
  p_imported_rows INTEGER DEFAULT NULL,
  p_skipped_rows INTEGER DEFAULT NULL,
  p_duplicate_rows INTEGER DEFAULT NULL,
  p_error_rows INTEGER DEFAULT NULL,
  p_errors JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can update import batches';
  END IF;

  UPDATE public.financial_import_batches
  SET
    status = p_status,
    total_rows = COALESCE(p_total_rows, total_rows),
    valid_rows = COALESCE(p_valid_rows, valid_rows),
    imported_rows = COALESCE(p_imported_rows, imported_rows),
    skipped_rows = COALESCE(p_skipped_rows, skipped_rows),
    duplicate_rows = COALESCE(p_duplicate_rows, duplicate_rows),
    error_rows = COALESCE(p_error_rows, error_rows),
    errors = COALESCE(p_errors, errors),
    updated_at = now()
  WHERE id = p_batch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_import_batch_status TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_import_batch_status FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_import_batch_status FROM anon;

-- ============================================================================
-- RPC: create_import_row
-- Creates a row record for tracking individual import rows
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_import_row(
  p_batch_id UUID,
  p_row_number INTEGER,
  p_raw_data JSONB,
  p_mapped_data JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'pending',
  p_errors JSONB DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_row_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create import rows';
  END IF;

  -- Check for duplicate idempotency key within same batch
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.financial_import_rows
      WHERE batch_id = p_batch_id AND idempotency_key = p_idempotency_key
    ) THEN
      INSERT INTO public.financial_import_rows (batch_id, row_number, raw_data, mapped_data, status, errors, idempotency_key)
      VALUES (p_batch_id, p_row_number, p_raw_data, p_mapped_data, 'duplicate', '{"error": "Duplicate row"}', p_idempotency_key)
      RETURNING id INTO v_row_id;
      RETURN v_row_id;
    END IF;
  END IF;

  INSERT INTO public.financial_import_rows (batch_id, row_number, raw_data, mapped_data, status, errors, idempotency_key)
  VALUES (p_batch_id, p_row_number, p_raw_data, p_mapped_data, p_status, p_errors, p_idempotency_key)
  RETURNING id INTO v_row_id;

  RETURN v_row_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_import_row TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_import_row FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_import_row FROM anon;

-- ============================================================================
-- RPC: finalize_import_row
-- Links an imported row to a transaction
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finalize_import_row(
  p_row_id UUID,
  p_transaction_id UUID,
  p_status TEXT DEFAULT 'imported'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can finalize import rows';
  END IF;

  UPDATE public.financial_import_rows
  SET transaction_id = p_transaction_id, status = p_status
  WHERE id = p_row_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_import_row TO authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_import_row FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_import_row FROM anon;
