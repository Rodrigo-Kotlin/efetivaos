import { useCallback, useMemo, useState } from 'react'
import { Upload, ArrowRight, Check, AlertTriangle, Download, Loader2 } from 'lucide-react'

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
  type ParsedRow,
  type ReferenceLists,
  type ReferenceResolution,
  type ReferenceOption,
  type ValidatedRow,
  isManualClassificationRow,
  manualClassificationGroupKey,
  manualResolutionKey,
  isCompatibleManualCategory,
} from '../lib/import-utils'
import {
  fetchCategories,
  fetchFinancialAccounts,
  fetchParties,
  fetchCostCenters,
  fetchServiceLines,
  fetchPaymentMethods,
  fetchChartAccounts,
} from '../api/finance-api'
import type { ChartAccount } from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'upload' | 'mapping' | 'reconciliation' | 'preview'

type Props = {
  open: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportWizard({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<ParsedRow[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [batchId, setBatchId] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [references, setReferences] = useState<ReferenceLists | null>(null)
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([])
  const [resolutions, setResolutions] = useState<ReferenceResolution>({})
  const [manualDecisions, setManualDecisions] = useState<Record<number, string | null>>({})
  const [loadingRefs, setLoadingRefs] = useState(false)

  const reset = useCallback(() => {
    setStep('upload')
    setHeaders([])
    setRawRows([])
    setMapping({})
    setBatchId('')
    setPreview(null)
    setReferences(null)
    setChartAccounts([])
    setResolutions({})
    setManualDecisions({})
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  // Step 1: Upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const { headers: h, rows } = await parseFile(f)
      setHeaders(h)
      setRawRows(rows)
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
        categories: categories.map(c => ({
          id: c.id,
          name: c.name,
          active: c.active,
          movement_type: c.movement_type,
          counter_account_id: c.counter_account_id,
          counter_account_code: c.counter_account_code,
          counter_account_name: c.counter_account_name,
          cash_flow_class: c.cash_flow_class,
        })),
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
      setChartAccounts(chartAccounts.filter(account => account.active && account.posting))
      setResolutions({})
      setManualDecisions({})
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

  const manualRows = useMemo(() => preview?.rows.filter(isManualClassificationRow) ?? [], [preview])

  const categoryMetadata = useCallback((category: ReferenceOption | undefined) => {
    if (!category) return null
    const account = chartAccounts.find(item => item.id === category.counter_account_id)
    return {
      account: category.counter_account_code && category.counter_account_name
        ? `${category.counter_account_code} — ${category.counter_account_name}`
        : category.counter_account_name ?? account?.name ?? 'Não vinculada',
      dre: account?.dre_class ?? 'Não informado',
      dfc: category.cash_flow_class ?? 'Não informado',
    }
  }, [chartAccounts])

  const compatibleCategories = useCallback((row: ValidatedRow) => (
    (references?.categories ?? []).filter(category => isCompatibleManualCategory(category, row.mapped.movement_type))
  ), [references])

  const applyManualDecision = useCallback((row: ValidatedRow, categoryId: string) => {
    const nextResolutions = {
      ...resolutions,
      [manualResolutionKey(row.row_number, String(row.mapped.category ?? row.raw.Categoria ?? ''))]: categoryId,
    }
    setManualDecisions(previous => ({ ...previous, [row.row_number]: categoryId }))
    setResolutions(nextResolutions)
    rebuildPreview(nextResolutions)
  }, [resolutions, rebuildPreview])

  const keepManualPending = useCallback((row: ValidatedRow) => {
    const nextResolutions = { ...resolutions }
    delete nextResolutions[manualResolutionKey(row.row_number, String(row.mapped.category ?? row.raw.Categoria ?? ''))]
    setManualDecisions(previous => ({ ...previous, [row.row_number]: null }))
    setResolutions(nextResolutions)
    rebuildPreview(nextResolutions)
  }, [resolutions, rebuildPreview])

  const applyToSimilar = useCallback((row: ValidatedRow, categoryId: string) => {
    const similarRows = manualRows.filter(candidate => manualClassificationGroupKey(candidate) === manualClassificationGroupKey(row))
    const category = (references?.categories ?? []).find(item => item.id === categoryId)
    const metadata = categoryMetadata(category)
    const confirmed = window.confirm([
      `Aplicar classificação às ${similarRows.length} linhas semelhantes?`,
      'Critério: mesma categoria original, tipo, centro de custo e linha de serviço.',
      `Categoria: ${category?.name ?? ''}`,
      `Conta contábil: ${metadata?.account ?? 'Não vinculada'}`,
      `DRE: ${metadata?.dre ?? 'Não informado'}`,
      `DFC: ${metadata?.dfc ?? 'Não informado'}`,
    ].join('\n'))
    if (!confirmed) return

    const nextResolutions = { ...resolutions }
    for (const candidate of similarRows) {
      nextResolutions[manualResolutionKey(candidate.row_number, String(candidate.mapped.category ?? candidate.raw.Categoria ?? ''))] = categoryId
    }
    setManualDecisions(previous => ({
      ...previous,
      ...Object.fromEntries(similarRows.map(candidate => [candidate.row_number, categoryId])),
    }))
    setResolutions(nextResolutions)
    rebuildPreview(nextResolutions)
  }, [manualRows, references, categoryMetadata, resolutions, rebuildPreview])

  const stepSequence: Step[] = ['upload', 'mapping', 'reconciliation', 'preview']

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
        {step === 'reconciliation' && preview && references && (() => {
          const categoryKey = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
          const manualIssueKeys = new Set(manualRows.map(row => `categories:${categoryKey(row.mapped.category ?? row.raw.Categoria)}`))
          const otherIssues = preview.referenceIssues.filter(issue => issue.field !== 'category' || !manualIssueKeys.has(issue.key))

          return (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-800">Revisar classificações</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Selecione somente categorias existentes e ativas. A categoria original permanece preservada e nenhuma pessoa ou categoria nova será criada neste gate.
                </p>
              </div>

              <div className="max-h-[480px] space-y-3 overflow-y-auto">
                {manualRows.map(row => {
                  const options = compatibleCategories(row)
                  const selectedId = manualDecisions[row.row_number] ?? ''
                  const selectedCategory = options.find(category => category.id === selectedId)
                  const currentCategory = references.categories?.find(category => category.id === row.mapped.category_id)
                  const metadata = categoryMetadata(selectedCategory ?? currentCategory)

                  return (
                    <div key={row.row_number} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">Linha {row.row_number}: {String(row.mapped.description ?? '')}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {String(row.mapped.transaction_date ?? '')} · R$ {Number(row.mapped.amount ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · {String(row.raw.Pessoa ?? 'Não informado')}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {String(row.raw['Centro de Custo'] ?? '')} · {String(row.raw['Linha de Serviço'] ?? '')} · Tipo {String(row.mapped.movement_type ?? '')}
                          </p>
                        </div>
                        <Badge className={row.valid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                          {row.valid ? 'Resolvida' : 'Pendente'}
                        </Badge>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded border border-slate-200 bg-white p-2 text-xs">
                          <p className="text-slate-500">Categoria original</p>
                          <p className="font-medium text-slate-800">{String(row.raw.Categoria ?? '')}</p>
                        </div>
                        <div className="rounded border border-slate-200 bg-white p-2 text-xs">
                          <p className="text-slate-500">Motivo</p>
                          <p className="font-medium text-slate-800">{row.referenceIssues.find(issue => issue.field === 'category')?.value ?? 'Classificação manual registrada'}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col gap-2">
                        <select
                          aria-label={`Categoria destino da linha ${row.row_number}`}
                          className="h-9 min-w-0 rounded border border-slate-200 bg-white px-2 text-xs"
                          value={selectedId}
                          onChange={event => event.target.value ? applyManualDecision(row, event.target.value) : keepManualPending(row)}
                        >
                          <option value="">Manter pendente...</option>
                          {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                        </select>
                        <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                          <span>Conta: {metadata?.account ?? 'Não informada'}</span>
                          <span>DRE: {metadata?.dre ?? 'Não informado'}</span>
                          <span>DFC: {metadata?.dfc ?? 'Não informado'}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!selectedCategory}
                            onClick={() => selectedCategory && applyToSimilar(row, selectedCategory.id)}
                          >
                            Aplicar às semelhantes
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => keepManualPending(row)}>
                            Manter pendente
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {otherIssues.length > 0 && (
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-800">Referências fora deste gate</p>
                  <p className="text-xs text-slate-500">Vales, parcelamentos, empréstimos e transferências permanecem pendentes ou inválidos. Nenhuma decisão manual está disponível para essas linhas.</p>
                  {otherIssues.map(issue => (
                    <div key={issue.key} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
                      <span>{issue.label}: {issue.value}</span>
                      <Badge className={issue.required ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>{issue.required ? 'Pendente preservada' : 'Informativa'}</Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>Voltar</Button>
                <Button size="sm" onClick={() => setStep('preview')}>Continuar para preview</Button>
              </div>
            </div>
          )
        })()}

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
              <Button size="sm" disabled>
                <Check className="mr-1 size-3.5" />
                Importação bloqueada neste gate
              </Button>
            </div>
          </div>
        )}

      </div>
    </Drawer>
  )
}
