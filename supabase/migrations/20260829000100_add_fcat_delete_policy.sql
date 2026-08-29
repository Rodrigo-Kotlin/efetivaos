-- Add DELETE policy for financial_categories (missing from original schema)
CREATE POLICY fcat_delete_internal ON public.financial_categories
  FOR DELETE TO authenticated
  USING (is_internal_user());
