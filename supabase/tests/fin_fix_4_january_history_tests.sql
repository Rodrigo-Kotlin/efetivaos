-- FIN-FIX-4: post-saneamento January 2026 reconciliation. Rollback-only.
BEGIN;

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE TEMPORARY TABLE tap_results (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  result text NOT NULL
) ON COMMIT DROP;

INSERT INTO pg_temp.tap_results (result) SELECT plan(28);

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT count(*) FROM public.financial_transactions), 108::bigint,
  'FIN-FIX-4 plus FIN-FIX-5.1 transactions are append-only: 101 + 6 replacements + 1 regularization');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT count(*) FROM public.financial_journal_entries), 229::bigint,
  'FIN-FIX-4 plus FIN-FIX-5.1 journals are append-only: 204 + 24 + 1 regularization');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT count(*) FROM public.financial_journal_lines), 458::bigint,
  'FIN-FIX-4 plus FIN-FIX-5.1 journal lines are append-only: 408 + 48 + 2 regularization lines');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT count(*) FROM public.financial_assets), 0::bigint,
  'FIN-FIX-4 does not capitalize printer or TV support');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT count(*) FROM public.financial_transactions
           WHERE idempotency_key LIKE 'FIN-FIX-4::%'), 6::bigint,
  'six explicit FIN-FIX-4 replacements exist');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT count(*) FROM public.financial_transactions
           WHERE id IN (
             'f4633f24-69cf-45fd-a398-10e59ef88c0e',
             '6070253f-0cd7-4a25-984a-15f428d0923a',
             '9ec9b924-7556-45e2-919c-352714675eee',
             '6783c950-fc48-47bf-a00d-842e91c52dab',
             '16b8d7b1-66c1-4019-8d33-f92dc472f4cc',
             'd8465486-8cd9-4e7b-9fd3-7bd274fdca8f'
           ) AND status = 'cancelled'), 6::bigint,
  'all audited source facts were reversed, not updated or deleted');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT coalesce(sum(case when ca.nature = 'DEBITO' then jl.debit - jl.credit else jl.credit - jl.debit end), 0)
           FROM public.financial_journal_entries je
           JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
           JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
           WHERE ca.code = '1.1.01.002' AND je.competence_date <= '2026-01-31'
             AND je.status <> 'cancelled'), 2313.24::numeric,
  'Banco Cora closes at R$ 2,313.24');

INSERT INTO pg_temp.tap_results (result)
SELECT is(public.cashflow_opening_balance('2026-02-01', NULL), 2313.24::numeric,
  'February cash opening equals reconciled January Cora');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT coalesce(sum(case when r.direction = 'INFLOW' then r.amount else -r.amount end), 0)
           FROM public.financial_cashflow_realized_v r
           JOIN public.financial_transactions t ON t.id = r.transaction_id
           WHERE r.entry_date BETWEEN '2026-01-01' AND '2026-01-31'
             AND t.movement_type = 'RECEITA'), 50649.54::numeric,
  'January cash receipts reconcile with the XLSX source');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT coalesce(sum(case when r.direction = 'INFLOW' then r.amount else -r.amount end), 0)
           FROM public.financial_cashflow_realized_v r
           JOIN public.financial_transactions t ON t.id = r.transaction_id
           WHERE r.entry_date BETWEEN '2026-01-01' AND '2026-01-31'
             AND t.movement_type = 'DESPESA'), -42722.75::numeric,
  'January cash expenses reconcile with the XLSX source');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT coalesce(sum(case when r.direction = 'INFLOW' then r.amount else -r.amount end), 0)
           FROM public.financial_cashflow_realized_v r
           JOIN public.financial_transactions t ON t.id = r.transaction_id
           WHERE r.entry_date BETWEEN '2026-01-01' AND '2026-01-31'
             AND t.movement_type = 'EMPRESTIMO_PAGO'), -10000.00::numeric,
  'January loan principal is financing outflow, not expense');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT coalesce(sum(case when r.direction = 'INFLOW' then r.amount else -r.amount end), 0)
           FROM public.financial_cashflow_realized_v r
           JOIN public.financial_transactions t ON t.id = r.transaction_id
           WHERE r.entry_date BETWEEN '2026-01-01' AND '2026-01-31'
             AND t.movement_type = 'SALDO_INICIAL'), 4386.45::numeric,
  'January opening balance is classified as non-cash source');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT coalesce(sum(case when ca.nature = 'DEBITO' then jl.debit - jl.credit else jl.credit - jl.debit end), 0)
           FROM public.financial_journal_entries je
           JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
           JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
           WHERE ca.code = '1.1.02.003' AND je.competence_date <= '2026-01-31'
             AND je.status <> 'cancelled'), 2259.00::numeric,
  'Janderson plus Endrew remain employee advances');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT coalesce(sum(case when ca.nature = 'DEBITO' then jl.debit - jl.credit else jl.credit - jl.debit end), 0)
           FROM public.financial_journal_entries je
           JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
           JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
           WHERE ca.code = '1.1.02.006' AND je.competence_date <= '2026-01-31'
             AND je.status <> 'cancelled'), 1000.00::numeric,
  'Lene is one partner-administrator advance');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT coalesce(sum(case when ca.nature = 'DEBITO' then jl.debit - jl.credit else jl.credit - jl.debit end), 0)
           FROM public.financial_journal_entries je
           JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
           JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
           WHERE ca.code = '1.1.02.005' AND je.competence_date <= '2026-01-31'
             AND je.status <> 'cancelled'), 0::numeric,
  'Lene no longer remains in Outros Creditos');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT coalesce(sum(case when ca.nature = 'DEBITO' then jl.debit - jl.credit else jl.credit - jl.debit end), 0)
           FROM public.financial_journal_entries je
           JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
           JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
           WHERE ca.code = '2.1.01.001' AND je.competence_date <= '2026-01-31'
             AND je.status <> 'cancelled'), 0::numeric,
  'suppliers payable is fully settled');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT coalesce(sum(case when ca.nature = 'DEBITO' then jl.debit - jl.credit else jl.credit - jl.debit end), 0)
           FROM public.financial_journal_entries je
           JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
           JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
           WHERE ca.code = '2.1.06.001' AND je.competence_date <= '2026-01-31'
             AND je.status <> 'cancelled'), -10000.00::numeric,
  'loan principal remains a R$ 10,000 liability');

INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (
  SELECT 1
  FROM public.financial_transactions t
  JOIN public.financial_journal_entries je ON je.transaction_id = t.id
  JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE t.idempotency_key LIKE 'FIN-FIX-4::%'
    AND je.entry_type = 'competencia' AND ca.code = '1.1.01.002'
), 'replacements have no false Cora debit in competence');

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  (SELECT count(*) FROM public.financial_transactions
   WHERE id = '77375ffb-5b49-41a1-b9db-6b1d15e467bb' AND status = 'settled'
     AND category_id = 'c1ae004d-1ea3-4d6a-896b-871870c281aa') = 1
  AND (SELECT count(*) FROM public.financial_transactions
   WHERE id = 'f17692a2-e1af-402c-ae08-38c422cabe96' AND status = 'settled'
     AND category_id = 'c1ae004d-1ea3-4d6a-896b-871870c281aa') = 1,
  'Janderson and Endrew preserve the existing employee-advance facts');

INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (
  SELECT 1
  FROM public.financial_transactions t
  JOIN public.financial_journal_entries je ON je.transaction_id = t.id
  JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE t.idempotency_key LIKE 'FIN-FIX-4::%'
    AND t.description IN ('Aquisição de Impressora', 'Aquisição de Suporte TV')
    AND ca.class = 'ATIVO' AND ca.code <> '1.1.01.002'
), 'printer and TV support remain operating expenses');

INSERT INTO pg_temp.tap_results (result)
SELECT ok(NOT EXISTS (
  SELECT 1 FROM (
    SELECT e.id
    FROM public.financial_journal_entries e
    JOIN public.financial_journal_lines l ON l.entry_id = e.id
    WHERE e.status <> 'cancelled'
    GROUP BY e.id
    HAVING abs(sum(l.debit) - sum(l.credit)) > 0.01
  ) unbalanced
), 'all active journal entries remain balanced');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT count(*) FROM public.financial_journal_lines l
           LEFT JOIN public.financial_journal_entries e ON e.id = l.entry_id
           WHERE e.id IS NULL), 0::bigint, 'no orphan journal lines');

INSERT INTO pg_temp.tap_results (result)
SELECT is((SELECT count(*) FROM public.financial_journal_entries r
           WHERE r.entry_type = 'estorno'
             AND (r.reversal_of_entry_id IS NULL OR NOT EXISTS (
               SELECT 1 FROM public.financial_journal_entries o
               WHERE o.id = r.reversal_of_entry_id AND o.transaction_id = r.transaction_id
             ))), 0::bigint, 'no invalid reversal relationships');

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.financial_receivables_v WHERE open_amount < 0)
  AND NOT EXISTS (SELECT 1 FROM public.financial_payables_v WHERE open_amount < 0)
  AND NOT EXISTS (
    SELECT 1 FROM public.financial_receivables_v r
    JOIN public.financial_payables_v p ON p.transaction_id = r.transaction_id
  ),
  'AR/AP have no negative open amounts or overlap');

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_value_added_statement('2026-01-01', '2026-01-31')
   WHERE row_label = '= Valor Adicionado Total a Distribuir')
  - (SELECT amount FROM public.get_value_added_statement('2026-01-01', '2026-01-31')
   WHERE row_label = '= Total Distribuido'),
  0::numeric,
  'DVA total to distribute equals total distributed'
);

INSERT INTO pg_temp.tap_results (result)
SELECT is(
  (SELECT amount FROM public.get_retained_earnings_statement('2026-01-01', '2026-01-31')
   WHERE row_label = '= Saldo Final'),
  (SELECT amount FROM public.get_balance_sheet('2026-01-31') WHERE row_code = 'RE'),
  'DLPA final equals dynamic BP RE'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok((
  WITH balances AS (
    SELECT class, sum(amount) AS amount
    FROM public.get_balance_sheet('2026-01-31')
    GROUP BY class
  )
  SELECT abs(
    coalesce((SELECT amount FROM balances WHERE class = 'ATIVO'), 0)
    - coalesce((SELECT amount FROM balances WHERE class = 'PASSIVO'), 0)
    - coalesce((SELECT amount FROM balances WHERE class = 'PL'), 0)
  ) < 0.01
), 'BP equation closes after historical correction');

CREATE TEMPORARY TABLE idempotence_snapshot (transaction_count bigint) ON COMMIT DROP;
INSERT INTO idempotence_snapshot SELECT count(*) FROM public.financial_transactions;

SELECT public.correct_settled_transaction_to_operational_expense(
  'd8465486-8cd9-4e7b-9fd3-7bd274fdca8f',
  (SELECT id FROM public.financial_categories
   WHERE name = 'Adiantamento de Pró-labore' AND active),
  'idempotence test'
);

INSERT INTO pg_temp.tap_results (result)
SELECT ok(
  (SELECT count(*) FROM public.financial_transactions) =
  (SELECT transaction_count FROM idempotence_snapshot),
  'second FIN-FIX-4 execution is a safe no-op'
);

SELECT result AS tap_line FROM pg_temp.tap_results ORDER BY seq;

ROLLBACK;
