import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { generatePreview, type ColumnMapping, type ParsedRow } from './import-utils'
import { persistImport } from './import-persist'

// ---------------------------------------------------------------------------
// F-IMPORT-2 — importação parcial
//
// Regression guard for the shared persistence pipeline: every row of the file
// must be represented, only valid rows reach the ledger, and the batch state
// must reconcile (total = imported + rejected).
// ---------------------------------------------------------------------------

const MAPPING: ColumnMapping = {
  transaction_date: 'transaction_date',
  competence_date: 'competence_date',
  description: 'description',
  amount: 'amount',
  movement_type: 'movement_type',
}

function makePreview(rows: ParsedRow[]) {
  const headers = Object.keys(rows[0] ?? {})
  return generatePreview(headers, rows, MAPPING, 'batch-local')
}

function validRow(overrides: Partial<ParsedRow> = {}): ParsedRow {
  return {
    transaction_date: '2026-01-05',
    competence_date: '2026-01',
    description: 'Ajuste',
    amount: 10,
    movement_type: 'AJUSTE',
    ...overrides,
  }
}

type RpcCall = { fn: string; args: Record<string, unknown> }

function createFakeClient(opts: { failTransaction?: boolean } = {}) {
  const calls: RpcCall[] = []
  let seq = 0
  const rows: Array<{
    id: string
    batch_id: string
    row_number: number
    status: string
    idempotency_key: string | null
    transaction_id: string | null
  }> = []
  const batches = new Map<string, Record<string, unknown>>()

  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      if (fn === 'create_import_batch') {
        const id = `batch-${++seq}`
        batches.set(id, { id, status: 'uploaded' })
        return { data: id, error: null }
      }
      if (fn === 'create_import_row') {
        const id = `row-${++seq}`
        rows.push({
          id,
          batch_id: String(args.p_batch_id),
          row_number: Number(args.p_row_number),
          status: String(args.p_status),
          idempotency_key: (args.p_idempotency_key as string) ?? null,
          transaction_id: null,
        })
        return { data: id, error: null }
      }
      if (fn === 'finalize_import_row') {
        const row = rows.find(r => r.id === args.p_row_id)
        if (row) {
          row.status = String(args.p_status)
          row.transaction_id = (args.p_transaction_id as string) ?? null
        }
        return { data: null, error: null }
      }
      if (fn === 'create_financial_transaction') {
        if (opts.failTransaction) return { data: null, error: { message: 'conta inválida' } }
        return { data: `tx-${++seq}`, error: null }
      }
      if (fn === 'update_import_batch_status') {
        const batch = batches.get(String(args.p_batch_id))
        if (batch) Object.assign(batch, args)
        return { data: null, error: null }
      }
      return { data: null, error: null }
    },
  }

  return {
    client: client as unknown as SupabaseClient,
    calls,
    rows,
    batches,
    batchStatusArgs: () => calls.filter(c => c.fn === 'update_import_batch_status').at(-1)?.args,
    txCalls: () => calls.filter(c => c.fn === 'create_financial_transaction'),
  }
}

describe('persistImport — importação parcial', () => {
  it('5 linhas (3 válidas, 2 inválidas): 3 importadas, 2 rejeitadas e inválidas registradas', async () => {
    const preview = makePreview([
      validRow({ description: 'ok-1' }),
      validRow({ description: 'ok-2' }),
      validRow({ description: 'ok-3' }),
      validRow({ description: 'bad-competence-13', competence_date: '13/2026' }),
      validRow({ description: 'bad-competence-00', competence_date: '00/2026' }),
    ])
    expect(preview.total).toBe(5)
    expect(preview.valid).toBe(3)
    expect(preview.invalid).toBe(2)

    const fake = createFakeClient()
    const result = await persistImport(
      fake.client,
      { name: 'lote.csv', size: 128, fileType: 'csv' },
      MAPPING,
      preview,
    )

    // Counters reconcile: total = imported + rejected.
    expect(result.imported).toBe(3)
    expect(result.rejected).toBe(2)
    expect(result.skipped).toBe(2)
    expect(result.finalStatus).toBe('completed_with_errors')

    // Only valid rows reach the ledger.
    expect(fake.txCalls()).toHaveLength(3)

    // Every row of the file is represented; invalid rows keep the evidence.
    const invalidRows = fake.rows.filter(r => r.status === 'invalid')
    expect(invalidRows).toHaveLength(2)
    const importedRows = fake.rows.filter(r => r.status === 'imported')
    expect(importedRows).toHaveLength(3)

    // Rejections carry Linha / Campo / Valor / Motivo.
    const competenceRejection = result.rejectedRows.find(r => r.row_number === 4)
    expect(competenceRejection?.details).toContainEqual({
      field: 'Competência',
      value: '13/2026',
      reason: 'Mês inválido. Use MM/AAAA.',
    })

    // Batch reflects the real outcome.
    const batchArgs = fake.batchStatusArgs()!
    expect(batchArgs.p_status).toBe('completed_with_errors')
    expect(batchArgs.p_total_rows).toBe(5)
    expect(batchArgs.p_valid_rows).toBe(3)
    expect(batchArgs.p_imported_rows).toBe(3)
    expect(batchArgs.p_skipped_rows).toBe(2)
    expect(batchArgs.p_error_rows).toBe(2)
  })

  it('todas válidas: status completed e nenhuma rejeição', async () => {
    const preview = makePreview([validRow(), validRow({ description: 'ok-2' })])
    const fake = createFakeClient()
    const result = await persistImport(fake.client, { name: 'ok.csv', size: 1, fileType: 'csv' }, MAPPING, preview)

    expect(result.imported).toBe(2)
    expect(result.rejected).toBe(0)
    expect(result.finalStatus).toBe('completed')
    expect(result.rejectedRows).toHaveLength(0)
    expect(fake.txCalls()).toHaveLength(2)
  })

  it('todas inválidas: status failed e nenhuma transação persistida', async () => {
    const preview = makePreview([
      validRow({ competence_date: '13/2026' }),
      validRow({ competence_date: 'texto' }),
    ])
    const fake = createFakeClient()
    const result = await persistImport(fake.client, { name: 'bad.csv', size: 1, fileType: 'csv' }, MAPPING, preview)

    expect(result.imported).toBe(0)
    expect(result.rejected).toBe(2)
    expect(result.finalStatus).toBe('failed')
    expect(fake.txCalls()).toHaveLength(0)
    expect(fake.rows.every(r => r.status === 'invalid')).toBe(true)
  })

  it('falha na transação mantém a linha como erro e não duplica import_row', async () => {
    const preview = makePreview([validRow()])
    const fake = createFakeClient({ failTransaction: true })
    const result = await persistImport(fake.client, { name: 'fail.csv', size: 1, fileType: 'csv' }, MAPPING, preview)

    expect(result.imported).toBe(0)
    expect(result.rejected).toBe(1)
    expect(result.errors).toBe(1)
    expect(result.finalStatus).toBe('failed')
    expect(fake.rows).toHaveLength(1)
    expect(fake.rows[0].status).toBe('error')
  })
})
