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
  type ReferenceIssue,
  type ReferenceResolution,
  type ReferenceOption,
} from '../lib/import-utils'
import { persistImport, type ImportRejection } from '../lib/import-persist'
import {
  fetchCategories,
  fetchFinancialAccounts,
  fetchParties,
  fetchCostCenters,
  fetchServiceLines,
  fetchPaymentMethods,
  fetchChartAccounts,
  createCategory,
  createFinancialAccount,
  createCostCenter,
  createServiceLine,
  createPaymentMethod,
  createFinancialParty,
} from '../api/finance-api'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import type { FinancialDfcClass, FinancialMovementType } from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'upload' | 'mapping' | 'reconciliation' | 'preview' | 'processing' | 'result'

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
  const [batchId, setBatchId] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [references, setReferences] = useState<ReferenceLists | null>(null)
  const [chartAccounts, setChartAccounts] = useState<ReferenceOption[]>([])
  const [resolutions, setResolutions] = useState<ReferenceResolution>({})
  const [categoryCounterAccounts, setCategoryCounterAccounts] = useState<Record<string, string>>({})
  const [categoryCashFlowClasses, setCategoryCashFlowClasses] = useState<Record<string, FinancialDfcClass>>({})
  const [newReferenceNames, setNewReferenceNames] = useState<Record<string, string>>({})
  const [creatingReferenceKey, setCreatingReferenceKey] = useState<string | null>(null)
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
    setBatchId('')
    setPreview(null)
    setReferences(null)
    setChartAccounts([])
    setResolutions({})
    setCategoryCounterAccounts({})
    setCategoryCashFlowClasses({})
    setNewReferenceNames({})
    setCreatingReferenceKey(null)
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
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to parse file')
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
      const [categories, accounts, parties, costCenters, serviceLines, paymentMethods, chartAccounts] = await Promise.all([
        fetchCategories(),
        fetchFinancialAccounts(),
        fetchParties(),
        fetchCostCenters(),
        fetchServiceLines(),
        fetchPaymentMethods(),
        fetchChartAccounts(),
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
      const nextBatchId = crypto.randomUUID()
      const p = generatePreview(headers, rawRows, mapping, nextBatchId, references)
      setBatchId(nextBatchId)
      setReferences(references)
      setChartAccounts(chartAccounts.filter(account => account.active && account.posting).map(account => ({ id: account.id, name: `${account.code} — ${account.name}` })))
      setResolutions({})
      setPreview(p)
      setStep(p.referenceIssues.length > 0 ? 'reconciliation' : 'preview')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao carregar os cadastros financeiros para validação')
    } finally {
      setLoadingRefs(false)
    }
  }, [headers, rawRows, mapping])

  const rebuildPreview = useCallback((nextResolutions: ReferenceResolution, nextReferences = references) => {
    if (!nextReferences) return
    const p = generatePreview(headers, rawRows, mapping, batchId, {
      ...nextReferences,
      resolutions: nextResolutions,
    })
    setPreview(p)
  }, [headers, rawRows, mapping, batchId, references])

  const handleResolution = useCallback((issue: ReferenceIssue, value: string) => {
    const next = { ...resolutions }
    if (value === '__ignore__') next[issue.key] = null
    else if (value) next[issue.key] = value
    else delete next[issue.key]
    setResolutions(next)
    rebuildPreview(next)
  }, [resolutions, rebuildPreview])

  const handleCreateReference = useCallback(async (issue: ReferenceIssue) => {
    const name = newReferenceNames[issue.key]?.trim()
    if (!name || !references) return
    setCreatingReferenceKey(issue.key)
    try {
      let created: { id: string; name: string }
      if (issue.list === 'categories') {
        const counterAccountId = categoryCounterAccounts[issue.key]
        if (!counterAccountId) throw new Error('Selecione a conta contábil de contrapartida antes de criar a categoria.')
        const cashFlowClass = categoryCashFlowClasses[issue.key]
        if (!cashFlowClass) throw new Error('Selecione a classificação DFC antes de criar a categoria.')
        if (issue.movementTypes.length !== 1) throw new Error('Esta referência aparece em mais de um tipo de movimento; corrija manualmente antes de criar.')
        created = await createCategory({
          name,
          movement_type: issue.movementTypes[0] as FinancialMovementType,
          counter_account_id: counterAccountId,
          cost_center_id: null,
          service_line_id: null,
          cash_flow_class: cashFlowClass,
          active: true,
        })
      } else if (issue.list === 'accounts') {
        const chartAccountId = categoryCounterAccounts[issue.key]
        if (!chartAccountId) throw new Error('Selecione a conta contábil antes de criar a conta financeira.')
        created = await createFinancialAccount({
          name,
          chart_account_id: chartAccountId,
          account_type: 'CONTA_CORRENTE',
          active: true,
          institution: null,
          opening_date: null,
          notes: null,
        })
      } else if (issue.list === 'costCenters') {
        created = await createCostCenter({ name, code: null, active: true, description: null })
      } else if (issue.list === 'serviceLines') {
        created = await createServiceLine({ name, active: true, description: null })
      } else if (issue.list === 'paymentMethods') {
        created = await createPaymentMethod({ name, active: true })
      } else if (issue.list === 'parties') {
        created = await createFinancialParty({ name, party_type: 'CLIENTE_FORNECEDOR', active: true })
      } else {
        throw new Error('Tipo de cadastro não suportado nesta etapa.')
      }

      const nextReferences = {
        ...references,
        [issue.list]: [...(references[issue.list] ?? []), { id: created.id, name: created.name }],
      } as ReferenceLists
      const nextResolutions = { ...resolutions, [issue.key]: created.id }
      setReferences(nextReferences)
      setResolutions(nextResolutions)
      setNewReferenceNames(previous => ({ ...previous, [issue.key]: '' }))
      rebuildPreview(nextResolutions, nextReferences)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível criar o cadastro')
    } finally {
      setCreatingReferenceKey(null)
    }
  }, [categoryCashFlowClasses, categoryCounterAccounts, newReferenceNames, references, resolutions, rebuildPreview])

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

  const stepSequence: Step[] = ['upload', 'mapping', 'reconciliation', 'preview', 'result']

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) handleClose() }} title="Importar Lançamentos">
      <div className="space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {stepSequence.map((s, i) => (
            <span key={s} className={`flex items-center gap-1 ${step === s ? 'font-medium text-emerald-700' : ''}`}>
              <span className={`inline-flex size-5 items-center justify-center rounded-full border ${
                step === s ? 'border-emerald-500 bg-emerald-50 text-emerald-700' :
                stepSequence.indexOf(step) > stepSequence.indexOf(s)
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-slate-200'
              }`}>
                {stepSequence.indexOf(step) > stepSequence.indexOf(s)
                  ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s === 'upload' ? 'Upload' : s === 'mapping' ? 'Mapeamento' : s === 'reconciliation' ? 'Revisar cadastros' : s === 'preview' ? 'Preview' : 'Resultado'}</span>
              {i < stepSequence.length - 1 && <ArrowRight className="size-3 text-slate-300" />}
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

        {/* STEP: Reconciliation */}
        {step === 'reconciliation' && preview && references && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-800">Revisar cadastros</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Vincule referências existentes, ignore campos opcionais ou crie cadastros simples com confirmação explícita.
                Categorias e contas exigem classificação contábil e só são criadas após confirmação explícita.
              </p>
            </div>

            <div className="max-h-[420px] space-y-3 overflow-y-auto">
              {preview.referenceIssues.map(issue => {
                const options = references[issue.list] ?? []
                const canCreate = ['categories', 'accounts', 'parties', 'costCenters', 'serviceLines', 'paymentMethods'].includes(issue.list)
                const selected = resolutions[issue.key] === null ? '__ignore__' : resolutions[issue.key] ?? ''

                return (
                  <div key={issue.key} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{issue.label}: {issue.value}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {issue.required ? 'Obrigatória' : 'Opcional'} · {issue.movementTypes.join(', ') || 'diversos tipos'}
                        </p>
                        {issue.variants.length > 1 && (
                          <p className="mt-1 text-xs text-amber-700">Variações no arquivo: {issue.variants.join(' · ')}</p>
                        )}
                      </div>
                      <Badge className={issue.required ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>
                        {issue.required ? 'Pendente' : 'Revisar'}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <select
                        className="h-9 min-w-0 flex-1 rounded border border-slate-200 px-2 text-xs"
                        value={selected}
                        onChange={event => handleResolution(issue, event.target.value)}
                      >
                        <option value="">Vincular a cadastro existente...</option>
                        {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                        {!issue.required && <option value="__ignore__">Ignorar campo opcional</option>}
                      </select>
                    </div>

                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      {(issue.list === 'categories' || issue.list === 'accounts') && (
                        <select
                          className="h-9 min-w-0 flex-1 rounded border border-slate-200 px-2 text-xs"
                          value={categoryCounterAccounts[issue.key] ?? ''}
                          onChange={event => setCategoryCounterAccounts(previous => ({ ...previous, [issue.key]: event.target.value }))}
                        >
                          <option value="">{issue.list === 'categories' ? 'Conta contábil de contrapartida...' : 'Conta contábil da conta financeira...'}</option>
                          {chartAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                        </select>
                      )}
                      {issue.list === 'categories' && (
                        <select
                          className="h-9 min-w-0 flex-1 rounded border border-slate-200 px-2 text-xs"
                          value={categoryCashFlowClasses[issue.key] ?? ''}
                          onChange={event => setCategoryCashFlowClasses(previous => ({ ...previous, [issue.key]: event.target.value as FinancialDfcClass }))}
                        >
                          <option value="">Classificação DFC...</option>
                          <option value="OPERACIONAL">Operacional</option>
                          <option value="INVESTIMENTO">Investimento</option>
                          <option value="FINANCIAMENTO">Financiamento</option>
                          <option value="NAO_CAIXA">Não caixa</option>
                          <option value="TRANSFERENCIA">Transferência</option>
                        </select>
                      )}
                      <input
                        className="h-9 min-w-0 flex-1 rounded border border-slate-200 px-2 text-xs"
                        value={newReferenceNames[issue.key] ?? ''}
                        placeholder={canCreate ? `Novo ${issue.label.toLowerCase()}` : 'Cadastro não suportado nesta etapa'}
                        disabled={!canCreate || creatingReferenceKey === issue.key}
                        onChange={event => setNewReferenceNames(previous => ({ ...previous, [issue.key]: event.target.value }))}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canCreate || !newReferenceNames[issue.key]?.trim() || ((issue.list === 'categories' || issue.list === 'accounts') && !categoryCounterAccounts[issue.key]) || (issue.list === 'categories' && !categoryCashFlowClasses[issue.key]) || creatingReferenceKey === issue.key}
                        onClick={() => void handleCreateReference(issue)}
                      >
                        {creatingReferenceKey === issue.key ? 'Criando...' : 'Criar novo cadastro'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>Voltar</Button>
              <Button size="sm" onClick={() => setStep('preview')}>Continuar para preview</Button>
            </div>
          </div>
        )}

        {/* STEP: Preview */}
        {step === 'preview' && preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-600">Total: <strong>{preview.total}</strong></span>
              <span className="text-emerald-700">Válidas: <strong>{preview.valid}</strong></span>
              {preview.pending > 0 && (
                <span className="text-amber-700">Pendentes: <strong>{preview.pending}</strong></span>
              )}
              {preview.invalid > 0 && (
                <span className="text-red-600">Inválidas: <strong>{preview.invalid}</strong></span>
              )}
            </div>

            {(preview.invalid > 0 || preview.pending > 0) && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Linhas inválidas ou pendentes não serão importadas. Resolva as referências obrigatórias na etapa de cadastros antes da confirmação.
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
                        ) : r.referenceIssues.some(issue => issue.required) && r.errors.length === 0 ? (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px]">Pendente</Badge>
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
              <Button size="sm" onClick={handleImport} disabled={processing || preview.valid !== preview.total}>
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
