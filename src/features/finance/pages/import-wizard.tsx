import { useCallback, useState } from 'react'
import { Upload, ArrowRight, Check, X, AlertTriangle, Download, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
  type ReferenceLists,
} from '../lib/import-utils'
import { persistImport, type ImportRejection } from '../lib/import-persist'
import {
  fetchCategories,
  fetchFinancialAccounts,
  fetchParties,
  fetchCostCenters,
  fetchServiceLines,
  fetchPaymentMethods,
} from '../api/finance-api'
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
  rejected: number
  rejectedRows: ImportRejection[]
  error?: string
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
  const [result, setResult] = useState<ImportResult | null>(null)
  const [processing, setProcessing] = useState(false)
  const [loadingRefs, setLoadingRefs] = useState(false)
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
  const handleMappingConfirm = useCallback(async () => {
    setLoadingRefs(true)
    try {
      // Load the financial registries so textual references in the file
      // (category, accounts, party, cost center, service line, payment method)
      // can be resolved to UUIDs — the preview and the persistence share this
      // exact pipeline, so what is approved on the preview is what is sent.
      const [categories, accounts, parties, costCenters, serviceLines, paymentMethods] = await Promise.all([
        fetchCategories(),
        fetchFinancialAccounts(),
        fetchParties(),
        fetchCostCenters(),
        fetchServiceLines(),
        fetchPaymentMethods(),
      ])
      const references: ReferenceLists = {
        categories: categories.map(c => ({ id: c.id, name: c.name })),
        accounts: accounts.map(a => ({ id: a.id, name: a.name })),
        parties: parties.map(p => ({ id: p.id, name: p.name })),
        costCenters: costCenters.map(c => ({ id: c.id, name: c.name })),
        serviceLines: serviceLines.map(s => ({ id: s.id, name: s.name })),
        paymentMethods: paymentMethods.map(p => ({ id: p.id, name: p.name })),
      }

      // Create a temporary batch ID for idempotency key generation
      const batchId = crypto.randomUUID()
      const p = generatePreview(headers, rawRows, mapping, batchId, references)
      setPreview(p)
      setStep('preview')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao carregar os cadastros financeiros para validação')
    } finally {
      setLoadingRefs(false)
    }
  }, [headers, rawRows, mapping])

  // Step 3: Preview → Process
  const handleImport = useCallback(async () => {
    if (!preview || !file) return
    setStep('processing')
    setProcessing(true)

    try {
      // The shared persistence pipeline always walks every row of the preview:
      // invalid rows are recorded as evidence and reported as rejections, while
      // only valid rows reach the ledger. It returns reconciled counters so the
      // UI can state exactly what happened (total = imported + rejected).
      const persistence = await persistImport(
        supabase,
        { name: file.name, size: file.size, fileType },
        mapping,
        preview,
      )

      setResult({
        total: persistence.total,
        imported: persistence.imported,
        rejected: persistence.rejected,
        rejectedRows: persistence.rejectedRows,
      })
      setStep('result')

      // Invalidate queries
      qc.invalidateQueries({ queryKey: ['finance'] })
    } catch (err) {
      setResult({
        total: preview.total,
        imported: 0,
        rejected: preview.total,
        rejectedRows: [],
        error: err instanceof Error ? err.message : 'Falha ao importar as linhas',
      })
      setStep('result')
    } finally {
      setProcessing(false)
    }
  }, [preview, file, fileType, mapping, qc])

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
              <Button size="sm" onClick={handleMappingConfirm} disabled={loadingRefs}>
                {loadingRefs && <Loader2 className="mr-1 size-3.5 animate-spin" />}
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
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                As {preview.invalid} linhas inválidas não serão importadas, mas permanecerão
                listadas no resultado com o motivo da rejeição.
              </p>
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
                Confirmar Importação ({preview.total} linhas)
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
        {step === 'result' && result && (() => {
          const { total, imported, rejected, rejectedRows, error } = result
          const partial = imported > 0 && rejected > 0
          const success = imported > 0 && rejected === 0 && !error

          return (
            <div className="space-y-4">
              {error ? (
                <div className="rounded-lg bg-red-50 p-4 text-center">
                  <X className="mx-auto size-8 text-red-600" />
                  <p className="mt-2 font-medium text-red-800">Nenhum lançamento foi importado</p>
                  <p className="mt-1 text-xs text-red-600">{error}</p>
                </div>
              ) : success ? (
                <div className="rounded-lg bg-emerald-50 p-4 text-center">
                  <Check className="mx-auto size-8 text-emerald-600" />
                  <p className="mt-2 font-medium text-emerald-800">
                    {imported === 1 ? '1 lançamento importado.' : `${imported} lançamentos importados.`}
                  </p>
                </div>
              ) : partial ? (
                <div className="rounded-lg bg-amber-50 p-4 text-center">
                  <AlertTriangle className="mx-auto size-8 text-amber-600" />
                  <p className="mt-2 font-medium text-amber-800">
                    {imported} {imported === 1 ? 'lançamento importado' : 'lançamentos importados'} e{' '}
                    {rejected} {rejected === 1 ? 'rejeitado' : 'rejeitados'}.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-red-50 p-4 text-center">
                  <X className="mx-auto size-8 text-red-600" />
                  <p className="mt-2 font-medium text-red-800">Nenhum lançamento foi importado</p>
                  <p className="mt-1 text-xs text-red-600">
                    Verifique as datas, valores, tipos e os cadastros (categoria, contas) das linhas abaixo.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-lg font-semibold">{total}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-600">Importadas</p>
                  <p className="text-lg font-semibold text-emerald-800">{imported}</p>
                </div>
                <div className={`rounded-lg p-3 ${rejected > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                  <p className={`text-xs ${rejected > 0 ? 'text-amber-600' : 'text-slate-500'}`}>Rejeitadas</p>
                  <p className={`text-lg font-semibold ${rejected > 0 ? 'text-amber-800' : ''}`}>{rejected}</p>
                </div>
              </div>

              {rejectedRows.length > 0 && (
                <div className="max-h-[240px] overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-2 text-xs font-medium text-amber-800">Linhas rejeitadas:</p>
                  <ul className="space-y-2">
                    {rejectedRows.map(r => (
                      <li key={r.row_number} className="text-xs text-amber-900">
                        <span className="font-semibold">Linha {r.row_number}</span>
                        {r.details.length > 0 ? (
                          <ul className="mt-0.5 space-y-0.5 pl-3">
                            {r.details.map((d, i) => (
                              <li key={i}>
                                <span className="font-medium">{d.field}</span>
                                {d.value ? `: ${d.value}` : ''}
                                {' — '}
                                {d.reason}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <ul className="mt-0.5 space-y-0.5 pl-3">
                            {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button className="w-full" onClick={handleClose}>Fechar</Button>
            </div>
          )
        })()}
      </div>
    </Drawer>
  )
}
