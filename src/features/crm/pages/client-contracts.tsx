import { Archive, CalendarDays, Download, ExternalLink, FileText, History, Pencil, Plus, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, ErrorState, selectClassName, TableSkeleton, textareaClassName } from '@/components/shared/operational-ui'
import { getContractDocumentUrl, type ContractInput } from '@/features/crm/api/contracts-api'
import { useArchiveContract, useClientContracts, useContractDocuments, useContractEvents, useCreateContract, useRecordContractEvent, useUpdateContract, useUploadContractDocument } from '@/features/crm/queries/contract-queries'
import type { ClientContract, ContractStatus } from '@/types/database'
import { useAuth } from '@/features/auth/auth-context'
import { useDiscardContractDocument } from '@/features/crm/queries/contract-queries'

const blank: ContractInput = { contract_number: '', title: '', contract_type: '', description: null, contracted_services: null, commercial_owner: null, contracted_value: null, modality: 'recurring', billing_period: 'monthly', payment_terms: null, first_billing_date: null, signed_at: null, starts_at: new Date().toISOString().slice(0, 10), ends_at: null, auto_renewal: false, notice_period_days: null, status: 'draft', internal_notes: null }
const statusLabel: Record<ContractStatus, string> = { draft: 'Rascunho', active: 'Vigente', suspended: 'Suspenso', closed: 'Encerrado', terminated: 'Rescindido' }
const modalityLabel = { recurring: 'Recorrente', one_off: 'Pontual' } as const

function expiration(c: ClientContract) {
  if (!c.ends_at || c.status !== 'active') return null
  const days = Math.ceil((new Date(`${c.ends_at}T23:59:59`).getTime() - Date.now()) / 86400000)
  return days < 0 ? 'Vencido' : days <= 30 ? `Vence em ${days} dias` : null
}

function formatDate(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informado'
}

function formatMoney(value: string | null, modality: ClientContract['modality']) {
  if (value === null || value === '') return 'Valor não informado'
  return `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))} ${modality === 'recurring' ? '/ período' : 'total'}`
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`text-sm font-semibold ${className}`}>{label}{children}</label>
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <fieldset className="rounded-xl border border-slate-200 bg-white p-4"><legend className="px-1 font-semibold text-slate-950">{title}</legend><p className="mb-4 text-xs text-slate-500">{description}</p>{children}</fieldset>
}

function ContractForm({ initial, clientName, pending, onCancel, onSubmit }: { initial: ContractInput; clientName: string; pending: boolean; onCancel: () => void; onSubmit: (input: ContractInput) => Promise<void> }) {
  const [form, setForm] = useState<ContractInput>(initial)
  const set = (key: keyof ContractInput, value: unknown) => setForm((old) => ({ ...old, [key]: value }))
  const text = (key: keyof ContractInput) => (form[key] as string | null) ?? ''
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    void onSubmit({ ...form, contracted_value: text('contracted_value') || null, notice_period_days: text('notice_period_days') ? Number(text('notice_period_days')) : null, billing_period: form.modality === 'one_off' ? null : text('billing_period') || null })
  }
  return <form className="space-y-4" onSubmit={submit}>
    <Section title="Informações gerais" description="Identificação e contexto comercial do contrato.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Número do contrato"><input required className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" value={text('contract_number')} onChange={(e) => set('contract_number', e.target.value)} /></Field>
        <Field label="Título"><input required className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" value={text('title')} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Tipo"><input required className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" value={text('contract_type')} onChange={(e) => set('contract_type', e.target.value)} /></Field>
        <Field label="Modalidade"><select aria-label="Modalidade" className={`${selectClassName} mt-1 w-full`} value={form.modality} onChange={(e) => set('modality', e.target.value)}><option value="recurring">Recorrente</option><option value="one_off">Pontual</option></select></Field>
        <Field label="Cliente vinculado" className="sm:col-span-2"><input className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-600" value={clientName} readOnly aria-readonly="true" /></Field>
        <Field label="Descrição" className="sm:col-span-2"><textarea className={`${textareaClassName} mt-1`} value={text('description')} onChange={(e) => set('description', e.target.value || null)} /></Field>
      </div>
    </Section>

    <Section title="Informações financeiras" description="Valores e condições comerciais acordadas.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={form.modality === 'recurring' ? 'Valor contratado por período' : 'Valor total contratado'}><input type="number" min="0" step="0.01" inputMode="decimal" className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" value={text('contracted_value')} onChange={(e) => set('contracted_value', e.target.value)} /></Field>
        <Field label="Periodicidade"><input className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 disabled:bg-slate-50" value={text('billing_period')} disabled={form.modality === 'one_off'} placeholder={form.modality === 'one_off' ? 'Não se aplica' : 'Ex.: mensal'} onChange={(e) => set('billing_period', e.target.value)} /></Field>
        <Field label="Condições de pagamento"><textarea className={`${textareaClassName} mt-1`} value={text('payment_terms')} onChange={(e) => set('payment_terms', e.target.value || null)} /></Field>
        <Field label="Primeira cobrança"><input type="date" className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" value={text('first_billing_date')} onChange={(e) => set('first_billing_date', e.target.value || null)} /></Field>
      </div>
    </Section>

    <Section title="Vigência" description="Datas de assinatura, validade e renovação.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Data da assinatura"><input type="date" className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" value={text('signed_at')} onChange={(e) => set('signed_at', e.target.value || null)} /></Field>
        <Field label="Início"><input required type="date" className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" value={text('starts_at')} onChange={(e) => set('starts_at', e.target.value)} /></Field>
        <Field label="Término"><input type="date" className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" value={text('ends_at')} onChange={(e) => set('ends_at', e.target.value || null)} /></Field>
        <Field label="Aviso prévio (dias)"><input type="number" min="0" className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" value={text('notice_period_days')} onChange={(e) => set('notice_period_days', e.target.value)} /></Field>
        <Field label="Situação"><select aria-label="Situação" className={`${selectClassName} mt-1 w-full`} value={form.status} onChange={(e) => set('status', e.target.value)}>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.auto_renewal} onChange={(e) => set('auto_renewal', e.target.checked)} /> Renovação automática</label>
    </Section>

    <Section title="Serviços e observações" description="Escopo contratado e informações internas da equipe.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Serviços contratados"><textarea className={`${textareaClassName} mt-1`} value={text('contracted_services')} onChange={(e) => set('contracted_services', e.target.value || null)} /></Field>
        <Field label="Responsável comercial"><input className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3" value={text('commercial_owner')} onChange={(e) => set('commercial_owner', e.target.value || null)} /></Field>
        <Field label="Observações internas" className="sm:col-span-2"><textarea className={`${textareaClassName} mt-1`} value={text('internal_notes')} onChange={(e) => set('internal_notes', e.target.value || null)} /></Field>
      </div>
    </Section>

    <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button><Button disabled={pending} type="submit">{pending ? 'Salvando...' : 'Salvar contrato'}</Button></div>
  </form>
}

function ContractDocument({ path, name, type, createdAt, size, status, discardStarted, onDiscard, discarding }: { path: string; name: string; type: string; createdAt: string; size: number; status: 'pending' | 'ready' | 'failed'; discardStarted?: boolean; onDiscard?: () => void; discarding: boolean }) {
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  async function openViewer() {
    setLoading(true)
    try { setViewerUrl(await getContractDocumentUrl(path)) } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível visualizar o documento.') } finally { setLoading(false) }
  }
  async function download() {
    try { const url = await getContractDocumentUrl(path, true); setDownloadUrl(url); window.open(url, '_blank', 'noopener,noreferrer') } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível baixar o documento.') }
  }
  const incomplete = status !== 'ready'
  return <>
    {incomplete && onDiscard && <Button size="sm" variant="outline" disabled={discarding} onClick={onDiscard}>{discarding ? 'Descartando...' : discardStarted ? 'Retomar descarte' : 'Descartar documento incompleto'}</Button>}
    <div className="rounded-lg bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{name}</p><p className="mt-1 text-xs text-slate-500">{type} · {formatDate(createdAt.slice(0, 10))} · {formatBytes(size)}</p><p className={`mt-1 text-xs font-semibold ${status === 'failed' ? 'text-red-700' : status === 'pending' ? 'text-amber-700' : 'text-emerald-700'}`}>{status === 'ready' ? 'Concluído' : status === 'pending' ? 'Processamento pendente' : 'Falha no processamento'}</p></div><div className="flex shrink-0 flex-wrap gap-1">{!incomplete && <><Button size="sm" variant="ghost" onClick={() => void openViewer()} disabled={loading}>{loading ? 'Abrindo...' : <><ExternalLink className="size-4" /> Visualizar</>}</Button><Button size="sm" variant="ghost" onClick={() => void download()}><Download className="size-4" /> Baixar</Button></>}</div></div>
    </div>
    {downloadUrl ? <span className="sr-only">Download temporário preparado.</span> : null}
    <Dialog open={Boolean(viewerUrl)} onOpenChange={(open) => { if (!open) setViewerUrl(null) }}><DialogContent className="max-w-5xl p-3 sm:p-5"><DialogHeader><DialogTitle className="pr-8 text-left">{name}</DialogTitle><DialogDescription>Visualização temporária autorizada. O acesso expira após 60 segundos.</DialogDescription></DialogHeader>{viewerUrl ? <iframe title={`Visualização de ${name}`} src={viewerUrl} className="h-[65vh] min-h-[360px] w-full rounded-lg border border-slate-200" /> : null}</DialogContent></Dialog>
  </>
}

function formatBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`; return `${(value / (1024 * 1024)).toFixed(1)} MB` }

function ContractExtras({ contract }: { contract: ClientContract }) {
  const { user } = useAuth()
  const discard = useDiscardContractDocument(contract.id)
  const docs = useContractDocuments(contract.id); const events = useContractEvents(contract.id); const upload = useUploadContractDocument(contract.id); const event = useRecordContractEvent(contract.id); const [type, setType] = useState<'main' | 'addendum' | 'other'>('main'); const [fileKey, setFileKey] = useState(0)
  const typeLabel = { main: 'Principal', addendum: 'Aditivo', other: 'Outro' } as const
  return <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
    <div><h4 className="flex items-center gap-2 text-sm font-bold"><FileText className="size-4" /> Documentos</h4><div className="mt-2 space-y-2">{(docs.data ?? []).map((doc) => <ContractDocument key={doc.id} path={doc.storage_path} name={doc.name} type={typeLabel[doc.document_type]} createdAt={doc.created_at} size={doc.size_bytes} status={doc.upload_status} discardStarted={Boolean(doc.discard_started_at)} discarding={discard.isPending} onDiscard={doc.created_by === user?.id ? () => discard.mutate(doc.id, { onSuccess: () => toast.success('Descarte confirmado pela API Storage.'), onError: (error) => toast.error(error.message) }) : undefined} />)}{docs.data?.length === 0 && <p className="text-sm text-slate-500">Nenhum documento anexado.</p>}</div><div className="mt-3 flex flex-wrap items-center gap-2"><select aria-label="Tipo do documento" className={selectClassName} value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="main">Principal</option><option value="addendum">Aditivo</option><option value="other">Outro</option></select><label className="inline-flex"><span className="sr-only">Anexar PDF</span><input key={fileKey} className="hidden" type="file" accept="application/pdf" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; upload.mutate({ file, type }, { onSuccess: () => { setFileKey((key) => key + 1); toast.success('Documento anexado.') }, onError: (error) => toast.error(error.message) }) }} /><Button asChild size="sm" variant="outline" disabled={upload.isPending}><span><Upload className="size-4" /> {upload.isPending ? 'Enviando...' : 'Anexar PDF'}</span></Button></label>{upload.isPending && <span className="text-xs text-slate-500" role="status">Processando documento…</span>}</div></div>
    <div><h4 className="flex items-center gap-2 text-sm font-bold"><History className="size-4" /> Histórico</h4><div className="mt-2 space-y-2">{(events.data ?? []).slice(0, 8).map((item) => <div className="rounded-lg bg-slate-50 p-2 text-sm" key={item.id}><strong>{item.summary}</strong><span className="ml-2 text-xs text-slate-500">{new Date(item.created_at).toLocaleString('pt-BR')}</span></div>)}{events.data?.length === 0 && <p className="text-sm text-slate-500">Nenhum evento registrado.</p>}</div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={event.isPending} onClick={() => event.mutate({ type: 'renewal', summary: 'Renovação registrada' }, { onSuccess: () => toast.success('Renovação registrada.') })}>Registrar renovação</Button><Button size="sm" variant="outline" disabled={event.isPending} onClick={() => event.mutate({ type: 'addendum', summary: 'Aditivo registrado' }, { onSuccess: () => toast.success('Aditivo registrado.') })}>Registrar aditivo</Button></div></div>
  </div>
}

export default function ClientContracts({ clientId, clientName }: { clientId: string; clientName: string }) {
  const query = useClientContracts(clientId); const create = useCreateContract(clientId); const update = useUpdateContract(clientId); const archive = useArchiveContract(clientId); const [editing, setEditing] = useState<ClientContract | 'new' | null>(null); const [expanded, setExpanded] = useState<string | null>(null); const [archiveTarget, setArchiveTarget] = useState<ClientContract | null>(null)
  async function save(input: ContractInput) { try { if (editing === 'new') { await create.mutateAsync(input); toast.success('Contrato cadastrado.') } else if (editing) { await update.mutateAsync({ id: editing.id, input }); toast.success('Contrato atualizado.') } setEditing(null) } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o contrato.') } }
  return <section id="contratos" className="mt-8 scroll-mt-6 border-t border-slate-200 pt-8"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-2xl font-semibold">Contratos</h2><p className="text-sm text-slate-600">Contratos comerciais vinculados a este cliente.</p></div><Button size="sm" onClick={() => setEditing('new')}><Plus className="size-4" /> Novo contrato</Button></div>{editing && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-semibold">{editing === 'new' ? 'Cadastrar contrato' : 'Editar contrato'}</h3><Button size="icon" variant="ghost" onClick={() => setEditing(null)} aria-label="Fechar formulário"><X className="size-4" /></Button></div><ContractForm initial={editing === 'new' ? blank : editing} clientName={clientName} pending={create.isPending || update.isPending} onCancel={() => setEditing(null)} onSubmit={save} /></div>}{query.isLoading ? <TableSkeleton columns={4} /> : query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : query.data?.length === 0 ? <EmptyState title="Nenhum contrato" description="Este cliente ainda não possui contratos comerciais." action={<Button onClick={() => setEditing('new')}><Plus className="size-4" /> Cadastrar contrato</Button>} /> : <div className="space-y-3">{query.data?.filter((c) => !c.archived_at).map((contract) => { const warning = expiration(contract); return <article className="rounded-xl border border-slate-200 p-4" key={contract.id}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{contract.contract_number} · {contract.contract_type}</p><h3 className="mt-1 break-words font-semibold">{contract.title}</h3><p className="mt-1 text-sm text-slate-600">{modalityLabel[contract.modality]} · início {formatDate(contract.starts_at)}{contract.ends_at ? ` · término ${formatDate(contract.ends_at)}` : ''}</p><p className="mt-1 text-sm font-semibold text-slate-800">{formatMoney(contract.contracted_value, contract.modality)}{contract.billing_period ? ` · ${contract.billing_period}` : ''}</p>{contract.auto_renewal && <p className="mt-1 text-xs font-semibold text-emerald-700">Renovação automática ativa</p>}{warning && <p className={`mt-1 text-sm font-semibold ${warning === 'Vencido' ? 'text-red-700' : 'text-amber-700'}`}><CalendarDays className="mr-1 inline size-4" />{warning}</p>}</div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{statusLabel[contract.status]}</span><Button size="sm" variant="ghost" onClick={() => setEditing(contract)}><Pencil className="size-4" /> Editar</Button><Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === contract.id ? null : contract.id)}><History className="size-4" /> {expanded === contract.id ? 'Ocultar detalhes' : 'Documentos e histórico'}</Button><Button size="sm" variant="ghost" disabled={archive.isPending} onClick={() => setArchiveTarget(contract)}><Archive className="size-4" /> Arquivar</Button></div></div>{expanded === contract.id && <ContractExtras contract={contract} />}</article> })}</div>}<Dialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open) setArchiveTarget(null) }}><DialogContent><DialogHeader><DialogTitle>Arquivar contrato?</DialogTitle><DialogDescription>O contrato “{archiveTarget?.title}” será arquivado e deixará de aparecer na lista ativa. Nenhum dado será excluído.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setArchiveTarget(null)}>Cancelar</Button><Button disabled={archive.isPending} onClick={() => { if (!archiveTarget) return; archive.mutate(archiveTarget.id, { onSuccess: () => { setArchiveTarget(null); toast.success('Contrato arquivado.') }, onError: (error) => toast.error(error.message) }) }}>{archive.isPending ? 'Arquivando...' : 'Confirmar arquivamento'}</Button></DialogFooter></DialogContent></Dialog></section>
}
