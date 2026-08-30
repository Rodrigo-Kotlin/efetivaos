-- CAUSE: GRANT DELETE ausente na tabela financial_categories para role authenticated.
-- has_table_privilege('authenticated', 'public.financial_categories', 'DELETE') = false
-- RLS policy é verificada DEPOIS do GRANT. Sem GRANT, o PostgreSQL rejeita antes de avaliar RLS.

-- 1. Conceder DELETE ao role authenticated
GRANT DELETE ON TABLE public.financial_categories TO authenticated;

-- 2. Remover policy temporária (USING (true) — excessivamente permissiva)
DROP POLICY IF EXISTS fcat_delete_internal ON public.financial_categories;

-- 3. Criar policy segura: somente interno autenticado (admin/equipe, ativo)
CREATE POLICY fcat_delete_internal ON public.financial_categories
  FOR DELETE TO authenticated
  USING (public.is_internal_user());

-- 4. Recarregar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
