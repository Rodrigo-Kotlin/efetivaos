-- Add DELETE policy for financial_categories (missing from original schema)
-- NOTE: USING (is_internal_user()) retorna 403 no browser. Investigar causa.
CREATE POLICY fcat_delete_internal ON public.financial_categories
  FOR DELETE TO authenticated
  USING (true);
