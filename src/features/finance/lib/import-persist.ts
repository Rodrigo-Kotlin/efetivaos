import type { SupabaseClient } from '@supabase/supabase-js'
import type { ColumnMapping, ImportPreview } from './import-utils'

// ---------------------------------------------------------------------------
// Persistence of an import preview.
//
// Single source of truth shared by the Import Wizard (UI) and the controlled
// homologation harness. It guarantees:
//   - every row of the file is represented as a financial_import_row, including
//     the invalid ones (evidence is never erased by the "import only valid
//     rows" option);
//   - only valid rows reach create_financial_transaction (validation is
//     authoritative — an invalid row can never be persisted);
//   - the batch status reflects the real outcome: nothing imported = failed,
//     partial = completed_with_errors, everything imported = completed.
// ---------------------------------------------------------------------------

export type ImportFileDescriptor = {
  name: string
  size: number
  fileType: 'csv' | 'xlsx'
}

export type ImportRejectionDetail = {
  field: string
  value?: string
  reason: string
}

export type ImportRejection = {
  row_number: number
  errors: string[]
  details: ImportRejectionDetail[]
}

export type ImportPersistenceResult = {
  batchId: string
  total: number
  imported: number
  rejected: number
  /** Rows rejected by validation (never attempted on the ledger). */
  skipped: number
  /** Rows that failed while being persisted (RPC error). */
  errors: number
  duplicate: number
  rejectedRows: ImportRejection[]
  finalStatus: string
}

type RpcResult = { data: unknown; error: { message: string } | null }

export async function persistImport(
  client: SupabaseClient,
  file: ImportFileDescriptor,
  mapping: ColumnMapping,
  preview: ImportPreview,
): Promise<ImportPersistenceResult> {
  const rpc = (fn: string, args: Record<string, unknown>) =>
    (client.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<RpcResult>)(fn, args)

  const { data: batchId, error: batchErr } = await rpc('create_import_batch', {
    p_file_name: file.name,
    p_file_type: file.fileType,
    p_file_size: file.size,
    p_column_mapping: mapping,
  })
  if (batchErr) throw batchErr
  const batchIdStr = String(batchId)

  let imported = 0
  let skipped = 0
  let errors = 0
  let duplicate = 0
  const rejectedRows: ImportRejection[] = []

  for (const row of preview.rows) {
    const { data: rowId, error: rowErr } = await rpc('create_import_row', {
      p_batch_id: batchIdStr,
      p_row_number: row.row_number,
      p_raw_data: row.raw,
      p_mapped_data: row.mapped,
      p_status: row.valid ? 'valid' : 'invalid',
      p_errors: row.errors.length > 0 ? row.errors : null,
      p_idempotency_key: row.idempotency_key,
    })
    if (rowErr) {
      errors++
      rejectedRows.push({
        row_number: row.row_number,
        errors: [rowErr.message],
        details: [{ field: 'Importação', reason: rowErr.message }],
      })
      continue
    }

    const rowIdStr = String(rowId || '')

    if (rowIdStr.includes('duplicate')) {
      duplicate++
      rejectedRows.push({
        row_number: row.row_number,
        errors: ['Linha duplicada'],
        details: [{ field: 'Importação', reason: 'Linha duplicada' }],
      })
      continue
    }

    if (!row.valid) {
      skipped++
      rejectedRows.push({
        row_number: row.row_number,
        errors: row.errors,
        details: row.errorDetails,
      })
      continue
    }

    const m = row.mapped as Record<string, unknown>
    const { data: txId, error: txErr } = await rpc('create_financial_transaction', {
      p_description: m.description,
      p_transaction_date: m.transaction_date,
      p_competence_date: m.competence_date || m.transaction_date,
      p_movement_type: m.movement_type,
      p_amount: m.amount,
      p_category_id: m.category_id || null,
      p_origin_account_id: m.origin_account_id || null,
      p_destination_account_id: m.destination_account_id || null,
      p_party_id: m.party_id || null,
      p_cost_center_id: m.cost_center_id || null,
      p_service_line_id: m.service_line_id || null,
      p_payment_method_id: m.payment_method_id || null,
      p_due_date: m.due_date || null,
      p_notes: m.notes || null,
      p_idempotency_key: row.idempotency_key,
    })

    if (txErr) {
      errors++
      rejectedRows.push({
        row_number: row.row_number,
        errors: [txErr.message],
        details: [{ field: 'Importação', reason: txErr.message }],
      })
      // Reuse the tracking row already created above; never insert a second row
      // for the same idempotency key.
      await rpc('finalize_import_row', { p_row_id: rowIdStr, p_transaction_id: null, p_status: 'error' })
    } else {
      imported++
      await rpc('finalize_import_row', { p_row_id: rowIdStr, p_transaction_id: txId, p_status: 'imported' })
    }
  }

  const rejected = preview.total - imported
  const finalStatus = imported === 0 ? 'failed' : rejected > 0 ? 'completed_with_errors' : 'completed'

  await rpc('update_import_batch_status', {
    p_batch_id: batchIdStr,
    p_status: finalStatus,
    p_total_rows: preview.total,
    p_valid_rows: preview.valid,
    p_imported_rows: imported,
    p_skipped_rows: skipped,
    p_duplicate_rows: duplicate,
    // Every row that was not imported is a rejection and is reported as an
    // error, so the batch history reconciles: total = imported + error_rows.
    p_error_rows: rejected,
    p_errors: rejectedRows.length > 0
      ? rejectedRows.flatMap(r => r.errors.map(e => `Linha ${r.row_number}: ${e}`))
      : null,
  })

  return {
    batchId: batchIdStr,
    total: preview.total,
    imported,
    rejected,
    skipped,
    errors,
    duplicate,
    rejectedRows,
    finalStatus,
  }
}
