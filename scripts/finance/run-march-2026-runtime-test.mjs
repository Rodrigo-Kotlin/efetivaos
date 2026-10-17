import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const manifestPath = 'artifacts/finance/march_2026_import_manifest.json'
const sqlFileArg = 'artifacts/finance/.fin-import-4-4-runtime-test.sql'
const sqlPath = resolve(sqlFileArg)
const manifest = readFileSync(manifestPath, 'utf8')
const hash = createHash('sha256').update(manifest, 'utf8').digest('hex')
const canonicalHash = 'a35fb5d177d8424c77373a0ef29eb12a2ad4c0ee0912f826d4b5960fb2f067fb'
const batchKey = `FIN-IMPORT-4::2026-03::${canonicalHash}`
if (hash !== canonicalHash) throw new Error(`Manifest hash mismatch: ${hash}`)
if (manifest.includes('$m$')) throw new Error('Manifest contains reserved SQL dollar-quote tag')

const sql = String.raw`BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"3014c86d-d84e-416d-ac3a-bb7dabb098c5"}';

DO $test$
DECLARE v_uid uuid; v_admin boolean;
BEGIN
  SELECT auth.uid(), public.is_admin() INTO v_uid, v_admin;
  IF v_uid IS NULL OR v_admin IS NOT TRUE THEN RAISE EXCEPTION 'Admin context unavailable'; END IF;
END;
$test$;

SAVEPOINT invalid_hash;
DO $test$
BEGIN
  BEGIN
    PERFORM public.execute_authoritative_financial_import_march_2026('invalid-hash', '${batchKey}', $m$${manifest}$m$);
    RAISE EXCEPTION 'Invalid hash was accepted';
  EXCEPTION WHEN others THEN
    IF position('manifesto ou batch key nao autorizado' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END;
$test$;
ROLLBACK TO SAVEPOINT invalid_hash;

SAVEPOINT invalid_batch;
DO $test$
BEGIN
  BEGIN
    PERFORM public.execute_authoritative_financial_import_march_2026('${canonicalHash}', 'FIN-IMPORT-4::2026-03::wrong', $m$${manifest}$m$);
    RAISE EXCEPTION 'Invalid batch key was accepted';
  EXCEPTION WHEN others THEN
    IF position('manifesto ou batch key nao autorizado' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END;
$test$;
ROLLBACK TO SAVEPOINT invalid_batch;

DO $test$
DECLARE v_result jsonb;
BEGIN
  v_result := public.execute_authoritative_financial_import_march_2026('${canonicalHash}', '${batchKey}', $m$${manifest}$m$);
  IF v_result->>'rows' <> '106' OR v_result->>'inflows' <> '75591.68' OR v_result->>'outflows' <> '59474.22' THEN
    RAISE EXCEPTION 'Success result mismatch: %', v_result;
  END IF;
END;
$test$;

DO $test$
DECLARE
  v_batches integer; v_rows integer; v_transactions integer; v_entries integer; v_lines integer;
  v_unbalanced integer; v_orphan_entries integer; v_orphan_lines integer;
  v_bank numeric; v_criffer numeric; v_asset numeric;
  v_received integer; v_received_amount numeric; v_paid integer; v_paid_amount numeric; v_excluded integer;
  v_revenue numeric; v_costs numeric; v_expenses numeric; v_net_income numeric;
  v_opening numeric; v_operating numeric; v_investing numeric; v_financing numeric; v_closing numeric;
  v_dmpl numeric; v_dlpa numeric; v_dva_available numeric; v_dva_distributed numeric;
BEGIN
  SELECT count(*) INTO v_batches FROM public.financial_import_batches WHERE column_mapping->>'scope' = 'FIN-IMPORT-4';
  SELECT count(*) INTO v_rows FROM public.financial_import_rows WHERE idempotency_key LIKE 'FIN-IMPORT-4%';
  SELECT count(*) INTO v_transactions FROM public.financial_transactions WHERE idempotency_key LIKE 'FIN-IMPORT-4%';
  SELECT count(*) INTO v_entries FROM public.financial_journal_entries WHERE idempotency_key LIKE 'FIN-IMPORT-4%::JOURNAL';
  SELECT count(*) INTO v_lines FROM public.financial_journal_lines jl JOIN public.financial_journal_entries je ON je.id=jl.entry_id WHERE je.idempotency_key LIKE 'FIN-IMPORT-4%::JOURNAL';
  SELECT count(*) INTO v_unbalanced FROM (SELECT entry_id FROM public.financial_journal_lines GROUP BY entry_id HAVING sum(debit) <> sum(credit)) x WHERE entry_id IN (SELECT id FROM public.financial_journal_entries WHERE idempotency_key LIKE 'FIN-IMPORT-4%::JOURNAL');
  SELECT count(*) INTO v_orphan_entries FROM public.financial_journal_entries je WHERE je.idempotency_key LIKE 'FIN-IMPORT-4%::JOURNAL' AND NOT EXISTS (SELECT 1 FROM public.financial_transactions t WHERE t.id=je.transaction_id);
  SELECT count(*) INTO v_orphan_lines FROM public.financial_journal_lines jl WHERE jl.entry_id IN (SELECT id FROM public.financial_journal_entries WHERE idempotency_key LIKE 'FIN-IMPORT-4%::JOURNAL') AND NOT EXISTS (SELECT 1 FROM public.financial_journal_entries je WHERE je.id=jl.entry_id);
  IF v_batches <> 1 OR v_rows <> 106 OR v_transactions <> 106 OR v_entries <> 106 OR v_lines <> 212 OR v_unbalanced <> 0 OR v_orphan_entries <> 0 OR v_orphan_lines <> 0 THEN
    RAISE EXCEPTION 'Temporary cardinality mismatch: batches %, rows %, tx %, entries %, lines %, unbalanced %, orphan entries %, orphan lines %', v_batches, v_rows, v_transactions, v_entries, v_lines, v_unbalanced, v_orphan_entries, v_orphan_lines;
  END IF;

  SELECT sum(jl.debit-jl.credit) INTO v_bank FROM public.financial_journal_lines jl JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id WHERE ca.code='1.1.01.002';
  SELECT sum(jl.debit-jl.credit) INTO v_criffer FROM public.financial_journal_lines jl JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id WHERE ca.code='2.1.09.001';
  SELECT sum(jl.debit-jl.credit) INTO v_asset FROM public.financial_journal_lines jl JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id WHERE ca.code='1.2.99.001';
  IF v_bank <> 18187.58 OR v_criffer <> 0 OR v_asset <> 1123.99 THEN RAISE EXCEPTION 'Temporary balance mismatch: bank %, Criffer %, asset %', v_bank, v_criffer, v_asset; END IF;

  SELECT amount INTO v_revenue FROM public.get_income_statement(date '2026-03-01', date '2026-03-31', null, null) WHERE row_code='RECEITA_BRUTA';
  SELECT -amount INTO v_costs FROM public.get_income_statement(date '2026-03-01', date '2026-03-31', null, null) WHERE row_code='CUSTOS';
  SELECT -amount INTO v_expenses FROM public.get_income_statement(date '2026-03-01', date '2026-03-31', null, null) WHERE row_code='DESPESAS_OPERACIONAIS';
  SELECT amount INTO v_net_income FROM public.get_income_statement(date '2026-03-01', date '2026-03-31', null, null) WHERE row_code='RESULTADO_LIQUIDO';
  IF v_revenue <> 75591.68 OR v_costs <> 24213.78 OR v_expenses <> 29253.29 OR v_net_income <> 22124.61 THEN RAISE EXCEPTION 'Temporary DRE mismatch: %, %, %, %', v_revenue, v_costs, v_expenses, v_net_income; END IF;

  SELECT max(net_amount) FILTER (WHERE dfc_class='OPERACIONAL'), max(net_amount) FILTER (WHERE dfc_class='INVESTIMENTO'), max(net_amount) FILTER (WHERE dfc_class='FINANCIAMENTO'), max(net_amount) FILTER (WHERE dfc_class='SALDO_INICIAL'), max(net_amount) FILTER (WHERE dfc_class='SALDO_FINAL') INTO v_operating, v_investing, v_financing, v_opening, v_closing FROM public.get_cash_flow_statement(date '2026-03-01', date '2026-03-31', null, null);
  IF v_opening <> 2070.12 OR v_operating <> 16924.61 OR v_investing <> -807.15 OR v_financing <> 0 OR v_closing <> 18187.58 THEN RAISE EXCEPTION 'Temporary DFC mismatch: %, %, %, %, %', v_opening, v_operating, v_investing, v_financing, v_closing; END IF;

  SELECT resultado_exercicio INTO v_dmpl FROM public.get_statement_of_changes_in_equity(date '2026-03-01', date '2026-03-31') WHERE row_label='Resultado do Periodo';
  SELECT amount INTO v_dlpa FROM public.get_retained_earnings_statement(date '2026-03-01', date '2026-03-31') WHERE row_label='(+) Resultado Liquido do Periodo';
  SELECT amount INTO v_dva_available FROM public.get_value_added_statement(date '2026-03-01', date '2026-03-31') WHERE row_label='= Valor Adicionado Total a Distribuir';
  SELECT amount INTO v_dva_distributed FROM public.get_value_added_statement(date '2026-03-01', date '2026-03-31') WHERE row_label='= Total Distribuido';
  IF v_dmpl <> 22124.61 OR v_dlpa <> 22124.61 OR v_dva_available <> v_dva_distributed THEN RAISE EXCEPTION 'DMPL/DLPA/DVA mismatch: %, %, %, %', v_dmpl, v_dlpa, v_dva_available, v_dva_distributed; END IF;

  SELECT count(*), coalesce(sum(original_amount),0) INTO v_received, v_received_amount FROM public.financial_receivables_v WHERE transaction_id IN (SELECT transaction_id FROM public.financial_import_rows WHERE idempotency_key LIKE 'FIN-IMPORT-4%');
  SELECT count(*), coalesce(sum(original_amount),0) INTO v_paid, v_paid_amount FROM public.financial_payables_v WHERE transaction_id IN (SELECT transaction_id FROM public.financial_import_rows WHERE idempotency_key LIKE 'FIN-IMPORT-4%');
  SELECT count(*) INTO v_excluded FROM public.financial_import_rows r WHERE r.idempotency_key LIKE 'FIN-IMPORT-4%' AND (r.mapped_data->>'movement_type') IN ('IMOBILIZADO','ADIANTAMENTO_EMPREGADO','ADIANTAMENTO_SOCIO_ADMIN') AND NOT EXISTS (SELECT 1 FROM public.financial_payables_v p WHERE p.transaction_id=r.transaction_id);

  IF NOT EXISTS (SELECT 1 FROM public.financial_import_rows r JOIN public.financial_transactions t ON t.id=r.transaction_id WHERE r.mapped_data->>'source_row'='107' AND r.mapped_data->>'debit_account_code'='5.9.01.001' AND r.mapped_data->>'credit_account_code'='1.1.01.002' AND t.movement_type='DESPESA' AND t.notes LIKE '%dre=DESPESA%dfc=OPERACIONAL%ar_ap=DIRECT_CASH%') THEN RAISE EXCEPTION 'Row 107 runtime mapping mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM public.financial_payables_v p JOIN public.financial_import_rows r ON r.transaction_id=p.transaction_id WHERE r.idempotency_key LIKE 'FIN-IMPORT-4%' AND r.mapped_data->>'source_row' IN ('81','91','118','119','128')) THEN
    RAISE EXCEPTION 'Patrimonial/advance rows exposed in payables: %', (SELECT string_agg(r.mapped_data->>'source_row' || ':' || t.movement_type::text || ':' || coalesce(t.notes, ''), ' | ') FROM public.financial_payables_v p JOIN public.financial_import_rows r ON r.transaction_id=p.transaction_id JOIN public.financial_transactions t ON t.id=r.transaction_id WHERE r.idempotency_key LIKE 'FIN-IMPORT-4%' AND r.mapped_data->>'source_row' IN ('81','91','118','119','128'));
  END IF;
  IF (SELECT count(*) FROM public.financial_import_rows WHERE mapped_data->>'movement_type'='CUSTO' AND transaction_id IN (SELECT id FROM public.financial_transactions WHERE movement_type='DESPESA' AND notes LIKE '%classification=CUSTO%')) = 0 THEN RAISE EXCEPTION 'CUSTO adaptation missing'; END IF;
  IF (SELECT count(*) FROM public.financial_import_rows WHERE mapped_data->>'movement_type'='ADIANTAMENTO_EMPREGADO' AND transaction_id IN (SELECT id FROM public.financial_transactions WHERE movement_type='DESPESA' AND notes LIKE '%classification=ADIANTAMENTO_EMPREGADO%')) = 0 THEN RAISE EXCEPTION 'Employee advance adaptation missing'; END IF;
  IF (SELECT count(*) FROM public.financial_import_rows WHERE mapped_data->>'movement_type'='ADIANTAMENTO_SOCIO_ADMIN' AND transaction_id IN (SELECT id FROM public.financial_transactions WHERE movement_type='DESPESA' AND notes LIKE '%classification=ADIANTAMENTO_SOCIO_ADMIN%')) <> 2 THEN RAISE EXCEPTION 'Partner advance adaptation missing'; END IF;

  RAISE NOTICE 'TEMP_STATE batches=%, rows=%, transactions=%, journals=%, lines=%, bank=%, received_count=%, received_amount=%, paid_count=%, paid_amount=%, excluded_patrimonial=%', v_batches, v_rows, v_transactions, v_entries, v_lines, v_bank, v_received, v_received_amount, v_paid, v_paid_amount, v_excluded;
END;
$test$;

SAVEPOINT duplicate_test;
DO $test$
BEGIN
  BEGIN
    PERFORM public.execute_authoritative_financial_import_march_2026('${canonicalHash}', '${batchKey}', $m$${manifest}$m$);
    RAISE EXCEPTION 'Duplicate call was accepted';
  EXCEPTION WHEN others THEN
    IF position('batch key ja executada' IN SQLERRM) = 0 AND position('idempotency key' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END;
$test$;
ROLLBACK TO SAVEPOINT duplicate_test;

SAVEPOINT atomic_failure;
DO $test$
BEGIN
  BEGIN
    PERFORM public.execute_authoritative_financial_import_march_2026('${canonicalHash}', '${batchKey}', $m$${manifest} $m$);
    RAISE EXCEPTION 'Invalid payload was accepted';
  EXCEPTION WHEN others THEN
    IF position('hash do payload diverge' IN SQLERRM) = 0 AND position('batch key ja executada' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END;
$test$;
ROLLBACK TO SAVEPOINT atomic_failure;

ROLLBACK;

SELECT jsonb_build_object(
  'march_transactions', (SELECT count(*) FROM public.financial_transactions WHERE idempotency_key LIKE 'FIN-IMPORT-4%'),
  'fin_import_4_batches', (SELECT count(*) FROM public.financial_import_batches WHERE column_mapping->>'scope'='FIN-IMPORT-4'),
  'fin_import_4_rows', (SELECT count(*) FROM public.financial_import_rows WHERE idempotency_key LIKE 'FIN-IMPORT-4%'),
  'bank', (SELECT coalesce(sum(jl.debit-jl.credit),0) FROM public.financial_journal_lines jl JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id WHERE ca.code='1.1.01.002'),
  'criffer_liability', (SELECT coalesce(sum(jl.credit-jl.debit),0) FROM public.financial_journal_lines jl JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id WHERE ca.code='2.1.09.001'),
  'historical_asset', (SELECT coalesce(sum(jl.debit-jl.credit),0) FROM public.financial_journal_lines jl JOIN public.financial_chart_accounts ca ON ca.id=jl.chart_account_id WHERE ca.code='1.2.99.001'),
  'ledger_imbalance', (SELECT coalesce(sum(debit),0)-coalesce(sum(credit),0) FROM public.financial_journal_lines)
) AS post_rollback_state;`

writeFileSync(sqlPath, sql, 'utf8')
try {
  process.stdout.write(execFileSync('npx', ['supabase', 'db', 'query', '--linked', '--file', sqlFileArg], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, shell: true }))
} finally {
  unlinkSync(sqlPath)
}
