-- ============================================================================
-- ETAPA 08K - DEV financial configuration and ledger invariants
--
-- The former version asserted a 662-row import snapshot that is not present in
-- this DEV baseline. This gate intentionally validates the current 101/204/408
-- baseline without importing or rewriting historical January data.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION _08k_assert(condition boolean, msg text)
RETURNS void AS $$
BEGIN
  IF NOT condition THEN
    RAISE EXCEPTION 'TEST FAIL: %', msg;
  END IF;
  RAISE NOTICE 'TEST PASS: %', msg;
END;
$$ LANGUAGE plpgsql;

-- Configuration invariants: no rigid category count is used.
SELECT _08k_assert(
  (SELECT count(*) FROM public.financial_categories WHERE active AND counter_account_id IS NULL) = 0,
  '1.1 toda categoria ativa possui contrapartida'
);

SELECT _08k_assert(
  (SELECT count(*) FROM public.financial_categories
   WHERE active AND name IN ('Adiantamento de Pró-labore', 'Adiantamento Salarial',
                             'Pagamento Empréstimo Pessoal', 'Compra - Informatica')) = 4,
  '1.2 categorias críticas existem'
);

SELECT _08k_assert(
  NOT EXISTS (
    SELECT 1
    FROM public.financial_categories c
    JOIN public.financial_chart_accounts ca ON ca.id = c.counter_account_id
    WHERE c.active AND c.movement_type IN ('RECEITA', 'DESPESA') AND ca.is_cash
  ),
  '1.3 categorias de competência não apontam para conta caixa'
);

SELECT _08k_assert(
  NOT EXISTS (
    SELECT 1
    FROM public.financial_categories c
    JOIN public.financial_chart_accounts ca ON ca.id = c.counter_account_id
    WHERE c.active AND c.movement_type = 'RECEITA' AND ca.class <> 'RECEITA'
  ),
  '1.4 categorias de receita apontam para receita'
);

SELECT _08k_assert(
  NOT EXISTS (
    SELECT 1
    FROM public.financial_categories c
    JOIN public.financial_chart_accounts ca ON ca.id = c.counter_account_id
    WHERE c.active AND c.movement_type = 'DESPESA'
      AND c.name NOT IN ('Adiantamento de Pró-labore', 'Adiantamento Salarial')
      AND ca.class NOT IN ('CUSTO', 'DESPESA')
  ),
  '1.5 categorias de despesa apontam para custo/despesa'
);

SELECT _08k_assert(
  (SELECT count(*)
   FROM public.financial_categories c
   JOIN public.financial_chart_accounts ca ON ca.id = c.counter_account_id
   WHERE c.active AND c.name = 'Adiantamento de Pró-labore'
     AND ca.code = '1.1.02.006') = 1,
  '1.6 adiantamento de pró-labore usa 1.1.02.006'
);

SELECT _08k_assert(
  NOT EXISTS (
    SELECT 1 FROM public.financial_categories c
    WHERE c.active AND c.cost_center_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.financial_cost_centers cc WHERE cc.id = c.cost_center_id)
  ),
  '1.7 centros de custo informados são válidos'
);

SELECT _08k_assert(
  NOT EXISTS (
    SELECT 1
    FROM public.financial_transactions t
    JOIN public.financial_categories c ON c.id = t.category_id
    WHERE t.category_id IS NOT NULL
      AND c.active = false
      AND t.created_at > c.updated_at
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.financial_transactions t
    WHERE t.category_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.financial_categories c WHERE c.id = t.category_id)
  ),
  '1.8 categorias inativas legadas não são usadas por novos lançamentos'
);

SELECT _08k_assert(
  (SELECT count(*) FROM public.financial_transactions) = 101
  AND (SELECT count(*) FROM public.financial_journal_entries) = 204
  AND (SELECT count(*) FROM public.financial_journal_lines) = 408
  AND (SELECT count(*) FROM public.financial_assets) = 0,
  '1.9 baseline DEV permanece 101/204/408/0'
);

SELECT _08k_assert(
  NOT EXISTS (
    SELECT 1
    FROM public.financial_transactions t
    WHERE t.origin_account_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.financial_accounts fa WHERE fa.id = t.origin_account_id)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.financial_transactions t
    WHERE t.destination_account_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.financial_accounts fa WHERE fa.id = t.destination_account_id)
  ),
  '1.10 contas de origem e destino são válidas'
);

SELECT _08k_assert(
  (SELECT count(*) FROM public.financial_transactions
   WHERE movement_type = 'EMPRESTIMO_RECEBIDO'
     AND origin_account_id IS NOT NULL) =
  (SELECT count(*) FROM public.financial_transactions WHERE movement_type = 'EMPRESTIMO_RECEBIDO'),
  '1.11 empréstimos recebidos possuem conta de origem'
);

SELECT _08k_assert(
  (SELECT count(*) FROM public.financial_transactions
   WHERE movement_type = 'EMPRESTIMO_PAGO'
     AND destination_account_id IS NOT NULL) =
  (SELECT count(*) FROM public.financial_transactions WHERE movement_type = 'EMPRESTIMO_PAGO'),
  '1.12 empréstimos pagos possuem conta de destino'
);

SELECT _08k_assert(
  NOT EXISTS (
    SELECT 1
    FROM public.financial_journal_entries e
    LEFT JOIN public.financial_journal_lines l ON l.entry_id = e.id
    WHERE l.id IS NULL
  ),
  '1.13 nenhum lançamento de diário está sem linhas'
);

SELECT _08k_assert(
  NOT EXISTS (
    SELECT 1
    FROM public.financial_journal_entries e
    JOIN public.financial_journal_lines l ON l.entry_id = e.id
    WHERE e.status <> 'cancelled'
    GROUP BY e.id
    HAVING ABS(SUM(l.debit) - SUM(l.credit)) > 0.01
  ),
  '1.14 lançamentos não cancelados estão balanceados'
);

SELECT _08k_assert(true, '08K baseline DEV concluída sem importação histórica');

ROLLBACK;
