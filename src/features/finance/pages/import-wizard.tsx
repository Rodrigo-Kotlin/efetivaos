import { useCallback, useMemo, useState } from 'react'
import { Upload, FileText, ArrowRight, Check, X, AlertTriangle, Download, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Drawer } from '@/components/ui/drawer'
import {
  parseFile,
  guessColumnMapping,
  generatePreview,
  downloadTemplate,
  TEMPLATE_COLUMNS,
  type ColumnMapping,
  type ImportPreview,
  type ImportFileType,
  type ParsedRow,
} from '../lib/import-utils'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'upload' | 'mapping' | 'preview' | 'processing' | 'result'

type Props = {
  open: boolean
  onClose: () => void
}

type ImportResult = {
  total: number
  imported: number
  skipped: number
  duplicate: number
  errors: number
  errorMessages: string[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportWizard({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<ImportFileType>('csv')
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<ParsedRow[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importOnlyValid, setImportOnlyValid] = useState(true)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [processing, setProcessing] = useState(false)
  const qc = useQueryClient()

  const reset = useCallback(() => {
    setStep('upload')
    setFile(null)
    setHeaders([])
    setRawRows([])
    setMapping({})
    setPreview(null)
    setResult(null)
    setProcessing(false)
  }, [])

  const handleClose = useCallback(() => {
    if (step === 'processing') return
    reset()
    onClose()
  }, [step, reset, onClose])

  // Step 1: Upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    try {
      const { headers: h, rows, fileType: ft } = await parseFile(f)
      setHeaders(h)
      setRawRows(rows)
      setFileType(ft)
      const guessed = guessColumnMapping(h)
      setMapping(guessed)
      setStep('mapping')
    } catch (err: any) {
      alert(err.message || 'Failed to parse file')
    }
  }, [])

  // Step 2: Mapping → Preview
  const handleMappingConfirm = useCallback(() => {
    // Create a temporary batch ID for idempotency key generation
    const batchId = crypto.randomUUID()
    const p = generatePreview(headers, rawRows, mapping, batchId)
    setPreview(p)
    setStep('preview')
  }, [headers, rawRows, mapping])

  // Step 3: Preview → Process
  const handleImport = useCallback(async () => {
    if (!preview || !file) return
    setStep('processing')
    setProcessing(true)

    try {
      // 1. Create batch record
      const { data: batchId, error: batchErr } = await (supabase.rpc as any)('create_import_batch', {
        p_file_name: file.name,
        p_file_type: fileType,
        p_file_size: file.size,
        p_column_mapping: mapping,
      })
      if (batchErr) throw batchErr

      // 2. Filter rows to import
      const rowsToImport = importOnlyValid
        ? preview.rows.filter(r => r.valid)
        : preview.rows

      let imported = 0
      let skipped = 0
      let duplicate = 0
      let errors = 0
      const errorMessages: string[] = []

      // 3. Process each row
      for (const row of rowsToImport) {
        // Create import row record
        const { data: rowId, error: rowErr } = await (supabase.rpc as any)('create_import_row', {
          p_batch_id: batchId,
          p_row_number: row.row_number,
          p_raw_data: row.raw,
          p_mapped_data: row.mapped,
          p_status: row.valid ? 'valid' : 'invalid',
          p_errors: row.errors.length > 0 ? row.errors : null,
          p_idempotency_key: row.idempotency_key,
        })
        if (rowErr) { errors++; errorMessages.push(`Row ${row.row_number}: ${rowErr.message}`); continue }

        const rowIdStr = String(rowId || '')

        // Check if row is duplicate
        if (rowIdStr.includes('duplicate')) {
          duplicate++
          continue
        }

        if (!row.valid) {
          skipped++
          continue
        }

        // 4. Create transaction via RPC
        const m = row.mapped as Record<string, any>
        const { data: txId, error: txErr } = await supabase.rpc('create_financial_transaction', {
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
          errorMessages.push(`Row ${row.row_number}: ${txErr.message}`)
          await (supabase.rpc as any)('create_import_row', {
            p_batch_id: batchId,
            p_row_number: row.row_number,
            p_raw_data: row.raw,
            p_mapped_data: row.mapped,
            p_status: 'error',
            p_errors: [txErr.message],
            p_idempotency_key: row.idempotency_key,
          })
        } else {
          imported++
          // Finalize row
          await (supabase.rpc as any)('finalize_import_row', {
            p_row_id: rowIdStr,
            p_transaction_id: txId,
            p_status: 'imported',
          })
        }
      }

      // 5. Update batch status
      await (supabase.rpc as any)('update_import_batch_status', {
        p_batch_id: batchId,
        p_status: errors > 0 ? 'completed_with_errors' : 'completed',
        p_total_rows: preview.total,
        p_valid_rows: preview.valid,
        p_imported_rows: imported,
        p_skipped_rows: skipped,
        p_duplicate_rows: duplicate,
        p_error_rows: errors,
        p_errors: errorMessages.length > 0 ? errorMessages : null,
      })

      setResult({ total: preview.total, imported, skipped, duplicate, errors, errorMessages })
      setStep('result')

      // Invalidate queries
      qc.invalidateQueries({ queryKey: ['finance'] })
    } catch (err: any) {
      setResult({ total: 0, imported: 0, skipped: 0, duplicate: 0, errors: 1, errorMessages: [err.message] })
      setStep('result')
    } finally {
      setProcessing(false)
    }
  }, [preview, file, fileType, mapping, importOnlyValid, qc])

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) handleClose() }} title="Importar Lançamentos">
      <div className="space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {(['upload', 'mapping', 'preview', 'result'] as Step[]).map((s, i) => (
            <span key={s} className={`flex items-center gap-1 ${step === s ? 'font-medium text-emerald-700' : ''}`}>
              <span className={`inline-flex size-5 items-center justify-center rounded-full border ${
                step === s ? 'border-emerald-500 bg-emerald-50 text-emerald-700' :
                ['mapping', 'preview', 'result'].indexOf(step) > ['upload', 'mapping', 'preview', 'result'].indexOf(s)
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-slate-200'
              }`}>
                {['mapping', 'preview', 'result'].indexOf(step) > ['upload', 'mapping', 'preview', 'result'].indexOf(s)
                  ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s === 'upload' ? 'Upload' : s === 'mapping' ? 'Mapeamento' : s === 'preview' ? 'Preview' : 'Resultado'}</span>
              {i < 3 && <ArrowRight className="size-3 text-slate-300" />}
            </span>
          ))}
        </div>

        {/* STEP: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Selecione um arquivo CSV ou XLSX com os lançamentos a importar.
              Nenhum dado será gravado antes da confirmação.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadTemplate('csv')}>
                <Download className="mr-1 size-3.5" /> Modelo CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadTemplate('xlsx')}>
                <Download className="mr-1 size-3.5" /> Modelo XLSX
              </Button>
            </div>

            <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center hover:border-emerald-300 transition">
              <Upload className="mx-auto size-8 text-slate-400" />
              <p className="mt-2 text-sm text-slate-600">Arraste ou clique para selecionar</p>
              <p className="mt-1 text-xs text-slate-400">CSV ou XLSX (máx. 10MB)</p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={handleFileUpload}
              />
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              <p className="font-medium">Colunas aceitas:</p>
              <p className="mt-1">{TEMPLATE_COLUMNS.join(', ')}</p>
            </div>
          </div>
        )}

        {/* STEP: Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Mapeie as colunas do arquivo para os campos de lançamento.
              As colunas foram detectadas automaticamente — ajuste se necessário.
            </p>

            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {['transaction_date', 'competence_date', 'description', 'amount', 'movement_type', 'category', 'origin_account', 'destination_account', 'party', 'cost_center', 'service_line', 'payment_method', 'due_date', 'notes'].map(field => (
                <div key={field} className="flex items-center gap-3">
                  <label className="w-40 shrink-0 text-xs font-medium text-slate-600">
                    {field.replace(/_/g, ' ')}
                  </label>
                  <select
                    className="h-8 flex-1 rounded border border-slate-200 px-2 text-xs"
                    value={(mapping as Record<string, string>)[field] || ''}
                    onChange={e => setMapping(p => ({ ...p, [field]: e.target.value || undefined }))}
                  >
                    <option value="">— Ignorar —</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('upload')}>Voltar</Button>
              <Button size="sm" onClick={handleMappingConfirm}>
                Gerar Preview ({rawRows.length} linhas)
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Preview */}
        {step === 'preview' && preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-600">Total: <strong>{preview.total}</strong></span>
              <span className="text-emerald-700">Válidas: <strong>{preview.valid}</strong></span>
              {preview.invalid > 0 && (
                <span className="text-red-600">Inválidas: <strong>{preview.invalid}</strong></span>
              )}
            </div>

            {preview.invalid > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={importOnlyValid}
                  onChange={e => setImportOnlyValid(e.target.checked)}
                  className="rounded"
                />
                Importar apenas linhas válidas ({preview.valid})
              </label>
            )}

            <div className="max-h-[300px] overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">Descrição</th>
                    <th className="px-2 py-1.5">Tipo</th>
                    <th className="px-2 py-1.5 text-right">Valor</th>
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 50).map(r => (
                    <tr key={r.row_number} className={`border-b border-slate-50 ${!r.valid ? 'bg-red-50' : ''}`}>
                      <td className="px-2 py-1 text-slate-500">{r.row_number}</td>
                      <td className="px-2 py-1 max-w-[200px] truncate">{String(r.mapped.description || '')}</td>
                      <td className="px-2 py-1">{String(r.mapped.movement_type || '')}</td>
                      <td className="px-2 py-1 text-right font-mono">{r.mapped.amount != null ? Number(r.mapped.amount).toLocaleString('pt-BR') : ''}</td>
                      <td className="px-2 py-1">
                        {r.valid ? (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Válido</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 text-[10px]">
                            <AlertTriangle className="mr-0.5 inline size-2.5" />
                            {r.errors[0]}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 50 && (
                <p className="p-2 text-center text-xs text-slate-400">
                  ... e mais {preview.rows.length - 50} linhas
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>Voltar</Button>
              <Button size="sm" onClick={handleImport} disabled={processing}>
                {processing ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Check className="mr-1 size-3.5" />}
                Confirmar Importação ({importOnlyValid ? preview.valid : preview.total} linhas)
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="size-8 animate-spin text-emerald-600" />
            <p className="text-sm text-slate-600">Processando importação...</p>
          </div>
        )}

        {/* STEP: Result */}
        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-50 p-4 text-center">
              <Check className="mx-auto size-8 text-emerald-600" />
              <p className="mt-2 font-medium text-emerald-800">Importação concluída</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-lg font-semibold">{result.total}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs text-emerald-600">Importados</p>
                <p className="text-lg font-semibold text-emerald-800">{result.imported}</p>
              </div>
              {result.skipped > 0 && (
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-xs text-amber-600">Ignorados</p>
                  <p className="text-lg font-semibold text-amber-800">{result.skipped}</p>
                </div>
              )}
              {result.duplicate > 0 && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Duplicados</p>
                  <p className="text-lg font-semibold">{result.duplicate}</p>
                </div>
              )}
              {result.errors > 0 && (
                <div className="rounded-lg bg-red-50 p-3">
                  <p className="text-xs text-red-600">Erros</p>
                  <p className="text-lg font-semibold text-red-800">{result.errors}</p>
                </div>
              )}
            </div>

            {result.errorMessages.length > 0 && (
              <div className="max-h-[200px] overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="mb-1 text-xs font-medium text-red-700">Erros:</p>
                {result.errorMessages.map((msg, i) => (
                  <p key={i} className="text-xs text-red-600">{msg}</p>
                ))}
              </div>
            )}

            <Button className="w-full" onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </div>
    </Drawer>
  )
}
