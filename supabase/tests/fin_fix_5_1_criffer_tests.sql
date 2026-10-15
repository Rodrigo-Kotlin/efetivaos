-- FIN-FIX-5.1 — post-migration assertions. Read-only; all test state rolls back.
BEGIN;

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE TEMPORARY TABLE tap_results (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  result text NOT NULL
) ON COMMIT DROP;

INSERT INTO pg_temp.tap_results (result) SELECT plan(16);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(count(*) = 1, 'FIN-FIX-5.1 transitória account exists exactly once')
FROM public.financial_chart_accounts
WHERE code = '1.2.99.001';

INSERT INTO pg_temp.tap_results (result)
SELECT ok(bool_and(class = 'ATIVO'), 'transitória account is ATIVO')
FROM public.financial_chart_accounts
WHERE code = '1.2.99.001';

INSERT INTO pg_temp.tap_results (result)
SELECT ok(bool_and(nature = 'DEBITO'), 'transitória account has debit nature')
FROM public.financial_chart_accounts
WHERE code = '1.2.99.001';

INSERT INTO pg_temp.tap_results (result)
SELECT ok(bool_and(is_cash = false), 'transitória account is not cash')
FROM public.financial_chart_accounts
WHERE code = '1.2.99.001';

INSERT INTO pg_temp.tap_results (result)
SELECT ok(bool_and(dfc_default = 'NAO_CAIXA'), 'regularization account is non-cash')
FROM public.financial_chart_accounts
WHERE code = '1.2.99.001';

INSERT INTO pg_temp.tap_results (result)
SELECT ok(count(*) = 1 AND bool_and(class = 'PASSIVO' AND nature = 'CREDITO'),
  'existing liability account is available and credit-natured')
FROM public.financial_chart_accounts
WHERE code = '2.1.09.001' AND name = 'Outras Obrigacoes a Pagar';

INSERT INTO pg_temp.tap_results (result)
SELECT ok(count(*) = 1, 'FIN-FIX-5.1 journal is unique by correction id')
FROM public.financial_journal_entries
WHERE idempotency_key = 'FIN-FIX-5::CRIFFER::2026-02::SOURCE-ROWS-101-102::282.18-284.66';

INSERT INTO pg_temp.tap_results (result)
SELECT ok(count(*) = 1 AND bool_and(transaction_date = date '2026-02-01' AND competence_date = date '2026-02-01'),
  'regularization is dated 2026-02-01')
FROM public.financial_transactions
WHERE description = 'FIN-FIX-5.1 - Regularizacao historica Criffer';

INSERT INTO pg_temp.tap_results (result)
SELECT is(coalesce(sum(debit), 0), 566.84::numeric, 'regularization debit totals 566.84')
FROM public.financial_journal_lines jl
JOIN public.financial_journal_entries je ON je.id = jl.entry_id
WHERE je.idempotency_key = 'FIN-FIX-5::CRIFFER::2026-02::SOURCE-ROWS-101-102::282.18-284.66';

INSERT INTO pg_temp.tap_results (result)
SELECT is(coalesce(sum(credit), 0), 566.84::numeric, 'regularization credit totals 566.84')
FROM public.financial_journal_lines jl
JOIN public.financial_journal_entries je ON je.id = jl.entry_id
WHERE je.idempotency_key = 'FIN-FIX-5::CRIFFER::2026-02::SOURCE-ROWS-101-102::282.18-284.66';

INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.financial_transactions
  WHERE description ILIKE '%Criffer%'
    AND transaction_date >= date '2026-02-01'
    AND movement_type <> 'AJUSTE'
), 'no Criffer February payment was created by FIN-FIX-5.1')
;

INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.financial_transactions
  WHERE description ILIKE '%Criffer%'
    AND amount IN (282.18, 284.66)
), 'February installment transactions remain uncreated')
;

INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.financial_journal_entries
  WHERE idempotency_key = 'FIN-IMPORT-3::CRIFFER::2026-02::101'
     OR idempotency_key = 'FIN-IMPORT-3::CRIFFER::2026-02::102'
), 'FIN-IMPORT-3 Criffer settlement entries remain uncreated')
;

INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.financial_journal_entries
  WHERE competence_date < date '2026-02-01'
    AND description ILIKE '%FIN-FIX-5.1%'
), 'January has no FIN-FIX-5.1 journal')
;

INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.financial_journal_entries
  WHERE idempotency_key = 'FIN-FIX-5::CRIFFER::2026-02::SOURCE-ROWS-101-102::282.18-284.66'
  GROUP BY idempotency_key
  HAVING count(*) > 1
), 'correction id prevents duplicate journals')
;

INSERT INTO pg_temp.tap_results (result)
SELECT ok(EXISTS (
  SELECT 1 FROM public.financial_notes n
  JOIN public.financial_journal_entries je ON je.id = n.journal_entry_id
  WHERE je.idempotency_key = 'FIN-FIX-5::CRIFFER::2026-02::SOURCE-ROWS-101-102::282.18-284.66'
    AND n.body LIKE '%documentation_status=incomplete%'
    AND n.body LIKE '%original_asset_value=unknown%'
    AND n.body LIKE '%asset_identification=UNKNOWN_DOCUMENTED_ASSET%'
), 'required incomplete-documentation metadata is recorded')
;

SELECT result AS tap_line FROM pg_temp.tap_results ORDER BY seq;

ROLLBACK;
