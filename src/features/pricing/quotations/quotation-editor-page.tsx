import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Circle, ExternalLink, Power, Save } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ErrorState, PageHeader, TableSkeleton } from '@/components/shared/operational-ui'
import { useCatalogItems } from '@/features/pricing/catalog/catalog.queries'
import type { CatalogItemRow } from '@/features/pricing/catalog/catalog.types'
import { useSuppliers } from '@/features/pricing/suppliers/supplier-queries'
import { useOnlineStatus } from '@/hooks/use-online-status'
import type { Supplier } from '@/types/database'

import { QuotationDetail } from './quotation-detail'
import { QuotationHeaderForm } from './quotation-header-form'
import { QuotationItemsGrid } from './quotation-items-grid'
import { useActivateQuotation, useCancelQuotation, useDiscardPendingQuotationAttachment, useQuotation, useSaveQuotationDraft } from './quotation.queries'
import { getQuotationAttachmentUrl } from './quotation.service'
import { normalizeQuotationValues, parseBrlDecimal, quotationDefaults, quotationSchema, type QuotationFormValues } from './quotation.schemas'
import { QuotationStatusBadge } from './quotation-badges'

const acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const maxFileSize = 10 * 1024 * 1024

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
}

function supplierFallback(quotation: NonNullable<ReturnType<typeof useQuotation>['data']>): Supplier {
  return { ...quotation.supplier, legal_name: null, tax_id: null, category: null, contact_name: null, email: null, phone: null, notes: null, created_at: quotation.created_at, created_by: null, updated_at: quotation.updated_at, updated_by: null }
}

function catalogFallbacks(quotation: NonNullable<ReturnType<typeof useQuotation>['data']>): CatalogItemRow[] {
  return quotation.quotation_items.flatMap((line) => line.catalog_item ? [{ ...line.catalog_item, description: null, updated_at: line.updated_at, category: { ...line.catalog_item.category, active: true } }] : [])
}

function PrerequisiteState({ hasSuppliers, hasCatalog }: { hasSuppliers: boolean; hasCatalog: boolean }) {
  return <div className="mx-auto max-w-3xl space-y-4">
    {!hasSuppliers && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="font-serif text-2xl font-semibold text-amber-950">Nenhum fornecedor ativo disponível</h1><p className="mt-2 text-sm text-amber-900">Você precisa cadastrar um fornecedor ativo antes de criar uma cotação.</p><Button className="mt-5" asChild><Link to="/pricing/suppliers">Ir para Fornecedores</Link></Button></section>}
    {!hasCatalog && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="font-serif text-2xl font-semibold text-amber-950">Nenhum item ativo no Catálogo Efetiva</h1><p className="mt-2 text-sm text-amber-900">Você precisa cadastrar itens no Catálogo Efetiva antes de adicionar produtos ou serviços à cotação.</p><Button className="mt-5" asChild><Link to="/pricing/catalog">Ir para o Catálogo Efetiva</Link></Button></section>}
  </div>
}

function ActivationChecklist({ issues, onReview }: { issues: Record<string, string>; onReview: () => void }) {
  const checks = [
    ['supplier', 'Fornecedor ativo', issues.supplier],
    ['received', 'Data recebida e validade coerentes', issues.received || issues.validity],
    ['items', 'Ao menos um item adicionado', issues.items],
    ['mapping', 'Todos os itens vinculados ao Catálogo Efetiva', issues.mapping],
    ['prices', 'Todos os valores unitários válidos', issues.prices],
    ['catalog', 'Todos os itens do catálogo ativos', issues.catalog],
  ]
  const invalid = checks.some((check) => check[2])
  return <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Requisitos para ativação"><h2 className="font-serif text-xl font-semibold">Regras antes de ativar</h2><ul className="mt-4 space-y-3">{checks.map(([key, label, issue]) => <li className={`flex gap-3 rounded-lg p-3 text-sm ${issue ? 'bg-amber-50 text-amber-950' : 'bg-emerald-50 text-emerald-950'}`} key={key}>{issue ? <Circle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}<span><strong>{label}</strong>{issue && <span className="mt-0.5 block">{issue}</span>}</span></li>)}</ul>{invalid && <Button className="mt-4 w-full" type="button" variant="outline" onClick={onReview}>Revisar pendências</Button>}</aside>
}

export default function QuotationEditorPage() {
  const { quotationId } = useParams()
  const editing = Boolean(quotationId)
  const online = useOnlineStatus()
  const navigate = useNavigate()
  const query = useQuotation(quotationId)
  const suppliersQuery = useSuppliers()
  const catalogQuery = useCatalogItems()
  const saveMutation = useSaveQuotationDraft()
  const activateMutation = useActivateQuotation()
  const cancelMutation = useCancelQuotation()
  const discardPendingAttachmentMutation = useDiscardPendingQuotationAttachment()
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string>()
  const [navigationAllowed, setNavigationAllowed] = useState(false)
  const initializedQuotationId = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const quotation = query.data
  const readonly = quotation?.status === 'active' || quotation?.status === 'cancelled'
  const persistedAttachmentPending = quotation?.source_file_pending === true

  const form = useForm<QuotationFormValues>({ resolver: zodResolver(quotationSchema), defaultValues: quotationDefaults() })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const values = useWatch({ control: form.control }) as QuotationFormValues
  const dirty = form.formState.isDirty || Boolean(file)
  const blocker = useBlocker(dirty && !navigationAllowed)

  useEffect(() => {
    if (!quotation) return
    const differentQuotation = initializedQuotationId.current !== quotation.id
    if (differentQuotation || (!form.formState.isDirty && !file)) {
      form.reset(quotationDefaults(quotation))
      initializedQuotationId.current = quotation.id
      if (differentQuotation) setFile(null)
    }
  }, [quotation, form, form.formState.isDirty, file])

  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('Descartar alterações não salvas?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const suppliers = [...(suppliersQuery.data ?? [])]
  if (quotation && !suppliers.some((item) => item.id === quotation.supplier.id)) suppliers.push(supplierFallback(quotation))
  const catalogItems = [...(catalogQuery.data ?? [])]
  for (const fallback of quotation ? catalogFallbacks(quotation) : []) if (!catalogItems.some((item) => item.id === fallback.id)) catalogItems.push(fallback)
  const selectedSupplier = suppliers.find((supplier) => supplier.id === values.supplier_id)
  const selectedItems = values.items.map((item) => catalogItems.find((catalogItem) => catalogItem.id === item.catalog_item_id))
  const duplicateCatalog = values.items.map((item) => item.catalog_item_id).filter(Boolean).some((id, index, ids) => ids.indexOf(id) !== index)
  const activationIssues: Record<string, string> = {}
  if (!values.supplier_id) activationIssues.supplier = 'Selecione um fornecedor.'
  else if (!selectedSupplier?.active) activationIssues.supplier = 'O fornecedor selecionado está inativo. Reative-o para ativar a cotação.'
  if (!values.received_at) activationIssues.received = 'Informe a data de recebimento.'
  else if (values.valid_until && values.valid_until < values.received_at) activationIssues.validity = 'A validade deve ser igual ou posterior ao recebimento.'
  if (!values.items.length) activationIssues.items = 'Adicione ao menos um item.'
  const unmapped = values.items.map((item, index) => !item.catalog_item_id ? index : -1).filter((index) => index >= 0)
  if (unmapped.length) activationIssues.mapping = `Mapeamento pendente nas linhas ${unmapped.map((index) => index + 1).join(', ')}.`
  if (duplicateCatalog) {
    activationIssues.mapping = 'O mesmo item do catálogo foi selecionado mais de uma vez.'
    values.items.forEach((item, index) => {
      if (item.catalog_item_id && values.items.findIndex((candidate) => candidate.catalog_item_id === item.catalog_item_id) !== index) activationIssues[`items.${index}.catalog_item_id`] = `Linha ${index + 1}: este item do catálogo já foi selecionado.`
    })
  }
  const invalidPrices = values.items.map((item, index) => !parseBrlDecimal(item.unit_price) ? index : -1).filter((index) => index >= 0)
  if (invalidPrices.length) activationIssues.prices = `Valor inválido nas linhas ${invalidPrices.map((index) => index + 1).join(', ')}.`
  const inactiveItems = selectedItems.map((item, index) => item && !item.active ? index : -1).filter((index) => index >= 0)
  if (inactiveItems.length) activationIssues.catalog = `Item inativo nas linhas ${inactiveItems.map((index) => index + 1).join(', ')}. Reative-o no catálogo ou selecione outro item.`
  unmapped.forEach((index) => { activationIssues[`items.${index}.catalog_item_id`] = `Linha ${index + 1}: vincule um item do Catálogo Efetiva.` })
  inactiveItems.forEach((index) => { activationIssues[`items.${index}.catalog_item_id`] = `Linha ${index + 1}: o item selecionado está inativo.` })
  invalidPrices.forEach((index) => { activationIssues[`items.${index}.unit_price`] = `Linha ${index + 1}: informe um valor positivo com até duas casas decimais.` })
  const activationReady = Object.keys(activationIssues).length === 0

  function focusFirstActivationIssue() {
    if (activationIssues.supplier) form.setFocus('supplier_id')
    else if (activationIssues.received) form.setFocus('received_at')
    else if (activationIssues.validity) form.setFocus('valid_until')
    else if (activationIssues.items) document.getElementById('add-quotation-item')?.focus()
    else if (activationIssues.mapping) form.setFocus(`items.${unmapped[0] >= 0 ? unmapped[0] : 0}.catalog_item_id`)
    else if (activationIssues.prices) form.setFocus(`items.${invalidPrices[0]}.unit_price`)
    else if (activationIssues.catalog) form.setFocus(`items.${inactiveItems[0]}.catalog_item_id`)
  }

  function chooseFile(selected?: File) {
    setFile(null)
    setFileError(undefined)
    if (!selected) return
    if (!acceptedTypes.includes(selected.type)) { setFileError('Use PDF, JPEG, PNG ou WEBP.'); return }
    if (selected.size > maxFileSize) { setFileError('O arquivo deve ter no máximo 10 MB.'); return }
    setFile(selected)
  }

  async function persist(formValues: QuotationFormValues) {
    if (!online) throw new Error('Sem conexão. Reconecte para salvar a cotação.')
    const normalized = normalizeQuotationValues(formValues)
    return saveMutation.mutateAsync({ ...normalized, id: quotationId, expectedUpdatedAt: quotation?.updated_at ?? null, expectedRevision: quotation?.revision ?? null, file })
  }

  async function saveDraft(formValues: QuotationFormValues) {
    try {
      const result = await persist(formValues)
      flushSync(() => setNavigationAllowed(true))
      form.reset(formValues)
      setFile(null)
      setFileError(undefined)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (result.attachmentWarning) toast.warning(result.attachmentWarning)
      else toast.success('Cotação salva como rascunho.')
      if (!quotationId) navigate(`/pricing/quotations/${result.quotation.id}`, { replace: true })
      else setNavigationAllowed(false)
    } catch (error) { toast.error(message(error)) }
  }

  async function activate(formValues: QuotationFormValues) {
    if (!activationReady) return
    try {
      const result = await persist(formValues)
      if (result.attachmentWarning) {
        flushSync(() => setNavigationAllowed(true))
        form.reset(formValues)
        setFile(null)
        setFileError(undefined)
        if (fileInputRef.current) fileInputRef.current.value = ''
        toast.warning(result.attachmentWarning)
        if (!quotationId) navigate(`/pricing/quotations/${result.quotation.id}`, { replace: true })
        else setNavigationAllowed(false)
        return
      }
      await activateMutation.mutateAsync({ id: result.quotation.id, expectedRevision: result.quotation.revision })
      flushSync(() => setNavigationAllowed(true))
      setFile(null)
      setFileError(undefined)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success('Cotação ativada com sucesso.')
      navigate(`/pricing/quotations/${result.quotation.id}`, { replace: true })
    } catch (error) { toast.error(message(error)) }
  }

  async function cancel() {
    if (!quotationId || !quotation || !window.confirm('Cancelar esta cotação? Esta ação não pode ser desfeita.')) return
    if (!online) { toast.error('Sem conexão. Reconecte para cancelar a cotação.'); return }
    try {
      await cancelMutation.mutateAsync({ id: quotationId, expectedRevision: quotation.revision })
      flushSync(() => {
        setFile(null)
        setFileError(undefined)
        setNavigationAllowed(true)
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      form.reset(form.getValues())
      toast.success('Cotação cancelada.')
    } catch (error) { toast.error(message(error)) }
  }

  async function discardPendingAttachment() {
    if (!quotationId || !quotation || !window.confirm('Descartar o envio pendente? O anexo incompleto será removido da cotação.')) return
    if (!online) { toast.error('Sem conexão. Reconecte para descartar o envio pendente.'); return }
    try {
      await discardPendingAttachmentMutation.mutateAsync({ id: quotationId, expectedRevision: quotation.revision })
      setFile(null)
      setFileError(undefined)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success('Envio pendente descartado. O rascunho foi liberado.')
    } catch (error) { toast.error(message(error)) }
  }

  async function openAttachment() {
    if (!quotation?.source_file_path) return
    try {
      const url = await getQuotationAttachmentUrl(quotation.source_file_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) { toast.error(message(error)) }
  }

  if (editing && query.isLoading) return <TableSkeleton columns={3} />
  if (editing && query.isError) return <ErrorState onRetry={() => void query.refetch()} />
  if (editing && !quotation) return null

  const pending = saveMutation.isPending || activateMutation.isPending || cancelMutation.isPending || discardPendingAttachmentMutation.isPending
  const title = !quotation ? 'Nova cotação' : quotation.reference_number || 'Cotação sem referência'
  const actions = <><Button asChild variant="outline"><Link to="/pricing/quotations"><ArrowLeft className="size-4" /> Voltar</Link></Button>{!readonly && <Button type="button" variant="outline" disabled={pending || !online || persistedAttachmentPending} onClick={() => void form.handleSubmit(saveDraft)()}><Save className="size-4" /> Salvar rascunho</Button>}{!readonly && <Button type="button" disabled={pending || !online || persistedAttachmentPending || !activationReady} aria-describedby="activation-button-help" onClick={() => void form.handleSubmit(activate)()}><Power className="size-4" /> Ativar</Button>}{quotation && quotation.status !== 'cancelled' && <Button type="button" variant="destructive" disabled={pending || !online || persistedAttachmentPending} onClick={() => void cancel()}><Ban className="size-4" /> Cancelar cotação</Button>}</>

  if (readonly && quotation) return <div className="mx-auto max-w-[1480px]"><PageHeader eyebrow="Cotações" title={title} description="Registro histórico somente para leitura." actions={actions} /><QuotationDetail quotation={quotation} onOpenAttachment={() => void openAttachment()} /></div>

  const mastersLoading = suppliersQuery.isLoading || catalogQuery.isLoading
  const mastersError = suppliersQuery.isError || catalogQuery.isError
  if (!editing && mastersLoading) return <TableSkeleton columns={3} />
  if (!editing && mastersError) return <ErrorState onRetry={() => { void suppliersQuery.refetch(); void catalogQuery.refetch() }} />
  const hasActiveSuppliers = suppliers.some((supplier) => supplier.active)
  const hasActiveCatalog = catalogItems.some((item) => item.active)
  if (!editing && (!hasActiveSuppliers || !hasActiveCatalog)) return <PrerequisiteState hasSuppliers={hasActiveSuppliers} hasCatalog={hasActiveCatalog} />
  const historicalWarning = quotation && (!quotation.supplier.active || quotation.quotation_items.some((line) => line.catalog_item && !line.catalog_item.active))

  return <div className="mx-auto max-w-[1480px]">
    <PageHeader eyebrow="Cotações" title={title} description="Salve como rascunho, mapeie os itens e só então ative." actions={actions} />
    {quotation && <div className="mb-5"><QuotationStatusBadge status={quotation.status} /></div>}
    {persistedAttachmentPending && <section className="mb-5 flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between" role="alert" aria-labelledby="pending-attachment-title"><div><h2 id="pending-attachment-title" className="font-semibold">Envio de anexo pendente</h2><p className="mt-1">Um envio anterior foi interrompido ou ainda está em andamento. Descarte-o para liberar o rascunho.</p></div><Button className="shrink-0" type="button" variant="destructive" disabled={pending || !online} onClick={() => void discardPendingAttachment()}>Descartar envio pendente</Button></section>}
    {(mastersError || historicalWarning) && <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><span>{mastersError ? 'Não foi possível atualizar os cadastros mestres. Os vínculos históricos desta cotação foram preservados; tente novamente antes de ativar.' : 'Esta cotação possui fornecedor ou item histórico inativo. Você pode salvar o rascunho, mas deve reativar o cadastro ou selecionar outro registro antes de ativar.'}</span></div>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form className="space-y-5" noValidate onSubmit={(event) => event.preventDefault()}>
        <QuotationHeaderForm register={form.register} errors={form.formState.errors} suppliers={suppliers} currentSupplierId={quotation?.supplier_id} supplierWarning={!selectedSupplier?.active && values.supplier_id ? activationIssues.supplier : undefined} />
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><label className="text-sm font-semibold" htmlFor="source_file">Arquivo original (opcional)</label><input ref={fileInputRef} id="source_file" className="mt-2 block w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:font-semibold file:text-emerald-900" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" disabled={pending || persistedAttachmentPending} aria-invalid={Boolean(fileError) || undefined} aria-describedby="source-file-help source-file-error" aria-errormessage={fileError ? 'source-file-error' : undefined} onChange={(event) => chooseFile(event.target.files?.[0])} /><p id="source-file-help" className="mt-2 text-xs text-slate-500">PDF, JPEG, PNG ou WEBP, até 10 MB. Armazenamento privado, sem OCR.</p><p id="source-file-error" className="mt-2 text-sm text-red-700">{fileError}</p>{quotation?.source_file_path && <Button className="mt-3" type="button" variant="outline" disabled={persistedAttachmentPending} onClick={() => void openAttachment()}><ExternalLink className="size-4" /> Abrir anexo atual</Button>}</section>
        <QuotationItemsGrid fields={fields} register={form.register} errors={form.formState.errors} catalogItems={catalogItems} selectedCatalogIds={values.items.map((item) => item.catalog_item_id)} activationIssues={activationIssues} onAdd={() => { const index = fields.length; append({ catalog_item_id: '', supplier_description: '', supplier_item_code: '', unit_price: '', notes: '' }); window.setTimeout(() => document.getElementById(`items.${index}.catalog_item_id`)?.focus(), 0) }} onRemove={remove} />
      </form>
      <div className="xl:sticky xl:top-24"><ActivationChecklist issues={activationIssues} onReview={focusFirstActivationIssue} /><p id="activation-button-help" className="mt-2 text-xs text-slate-500">A ativação fica disponível quando todos os requisitos forem atendidos.</p></div>
    </div>
  </div>
}
