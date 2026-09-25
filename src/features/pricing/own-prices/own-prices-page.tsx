import { History, Plus, Search, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drawer } from '@/components/ui/drawer'
import { EmptyState, ErrorState, PageHeader, selectClassName, TableShell, TableSkeleton } from '@/components/shared/operational-ui'
import { useAuth } from '@/features/auth/auth-context'
import { formatComparisonCurrency, formatComparisonDate } from '@/features/pricing/comparison/comparison-helpers'
import { useOnlineStatus } from '@/hooks/use-online-status'
import type { OwnPriceProposalInsert, OwnPriceProposalItem } from '@/types/database'

import { OwnPriceDecisionDrawer, OwnPriceRetireDrawer } from './own-price-decision-drawer'
import { OwnPriceHistoryDrawer } from './own-price-history-drawer'
import { OwnPriceProposalForm } from './own-price-proposal-form'
import { useCreateOwnPriceProposal, useOwnPriceCatalogItems, useOwnPriceProposals } from './own-prices-queries'
import type { OwnCatalogItem, OwnPriceRowState, OwnPriceStatusFilter, OwnPriceViewRow } from './own-prices.types'

type FormDrawer = { mode: 'create' | 'reajuste'; item: OwnCatalogItem | null } | null

function StateBadge({ state }: { state: OwnPriceRowState }) {
  if (state === 'pending') return <Badge variant="warning">Proposta pendente</Badge>
  if (state === 'approved') return <Badge>Preco aprovado</Badge>
  if (state === 'inactive') return <Badge variant="secondary">Preco inativo</Badge>
  return <Badge variant="outline">Sem preco</Badge>
}

function buildRows(items: OwnCatalogItem[], proposals: OwnPriceProposalItem[]): OwnPriceViewRow[] {
  return items.map((item) => {
    const itemProposals = proposals.filter((proposal) => proposal.catalog_item_id === item.id)
    const pending = itemProposals.find((proposal) => proposal.status === 'pending') ?? null
    const approvedList = itemProposals
      .filter((proposal) => proposal.status === 'approved')
      .sort((a, b) => (b.approved_at ?? '').localeCompare(a.approved_at ?? ''))
    const currentApproved = approvedList[0] ?? null
    const hasInactive = itemProposals.some((proposal) => proposal.status === 'inactive')
    const state: OwnPriceRowState = pending ? 'pending' : currentApproved ? 'approved' : hasInactive ? 'inactive' : 'no_price'
    return { item, state, currentApproved, pending, proposals: itemProposals }
  })
}

export default function OwnPricesPage() {
  const { profile } = useAuth()
  const online = useOnlineStatus()
  const isAdmin = profile?.role === 'admin'

  const catalogQuery = useOwnPriceCatalogItems()
  const proposalsQuery = useOwnPriceProposals()
  const createMutation = useCreateOwnPriceProposal()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OwnPriceStatusFilter>('all')
  const [category, setCategory] = useState('all')
  const [form, setForm] = useState<FormDrawer>(null)
  const [decisionProposal, setDecisionProposal] = useState<OwnPriceProposalItem | null>(null)
  const [retireProposal, setRetireProposal] = useState<OwnPriceProposalItem | null>(null)
  const [historyRow, setHistoryRow] = useState<OwnPriceViewRow | null>(null)

  const rows = useMemo(() => buildRows(catalogQuery.data ?? [], proposalsQuery.data ?? []), [catalogQuery.data, proposalsQuery.data])
  const categories = useMemo(() => {
    const values = new Map<string, string>()
    for (const row of rows) if (row.item.category_name) values.set(row.item.category_id, row.item.category_name)
    return Array.from(values, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [rows])

  const filtered = rows.filter((row) => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    const matchesSearch = !term || [row.item.code, row.item.name, row.item.category_name ?? ''].some((field) => field.toLocaleLowerCase('pt-BR').includes(term))
    const matchesCategory = category === 'all' || row.item.category_id === category
    const matchesStatus = status === 'all' || row.state === status
    return matchesSearch && matchesCategory && matchesStatus
  })

  const formItem = form?.item ?? null
  const formItems = form?.mode === 'reajuste' ? (formItem ? [formItem] : []) : rows.filter((row) => row.state !== 'pending').map((row) => row.item)
  const formCurrentPrice = form?.mode === 'reajuste' ? (rows.find((row) => row.item.id === formItem?.id)?.currentApproved?.sale_price ?? null) : null
  const decisionRow = decisionProposal ? rows.find((row) => row.item.id === decisionProposal.catalog_item_id) ?? null : null

  const clearFilters = () => { setSearch(''); setStatus('all'); setCategory('all') }

  const submitProposal = async (input: OwnPriceProposalInsert) => {
    if (!online) {
      toast.error('Sem conexao. Reconecte para enviar a proposta.')
      return
    }
    try {
      await createMutation.mutateAsync(input)
      toast.success(form?.mode === 'reajuste' ? 'Reajuste enviado para aprovação.' : 'Proposta enviada para aprovação.')
      setForm(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel enviar a proposta.')
    }
  }

  const isLoading = catalogQuery.isLoading || proposalsQuery.isLoading
  const isError = catalogQuery.isError || proposalsQuery.isError
  const retry = () => { void catalogQuery.refetch(); void proposalsQuery.refetch() }

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Motor de Precos"
        title="Precos Proprios"
        description="Propostas de preco de venda para servicos proprios, sem fornecedor e sem cotacao. A Equipe propoe; o Admin aprova."
        actions={<Button disabled={!online || rows.length === 0} onClick={() => setForm({ mode: 'create', item: null })}><Plus className="size-4" /> Definir preco proprio</Button>}
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_repeat(2,minmax(10rem,13rem))_auto]">
        <label className="relative"><span className="sr-only">Buscar preco proprio</span><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" /><Input className="pl-9" placeholder="Buscar servico, codigo ou categoria..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label><span className="sr-only">Filtrar precos proprios por status</span><select className={`${selectClassName} w-full`} value={status} onChange={(event) => setStatus(event.target.value as OwnPriceStatusFilter)}><option value="all">Status: todos</option><option value="pending">Proposta pendente</option><option value="approved">Preco aprovado</option><option value="inactive">Preco inativo</option><option value="no_price">Sem preco</option></select></label>
        <label><span className="sr-only">Filtrar precos proprios por categoria</span><select className={`${selectClassName} w-full`} value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Categorias: todas</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <Button type="button" variant="outline" aria-label="Limpar filtros" onClick={clearFilters} disabled={!search && status === 'all' && category === 'all'}><X className="size-4" /> Limpar</Button>
      </div>

      {isLoading ? <TableSkeleton columns={6} /> : isError ? <ErrorState onRetry={retry} /> : rows.length === 0 ? (
        <EmptyState
          title="Nenhum servico proprio cadastrado"
          description="Itens do Catalogo Efetiva com origem propria (sem fornecedor) aparecem aqui para receber proposta de preco. Crie itens de servico proprio no catalogo para comecar."
          action={<Button asChild variant="outline"><Link to="/pricing/catalog">Abrir catalogo</Link></Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum preco proprio encontrado" description="Ajuste a busca ou os filtros para consultar outros precos." action={<Button variant="outline" onClick={clearFilters}><X className="size-4" /> Limpar filtros</Button>} />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((row) => (
              <article key={row.item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-emerald-900">{row.item.code}</p>
                    <h2 className="break-words font-serif text-lg font-semibold">{row.item.name}</h2>
                    <p className="text-xs text-slate-500">{row.item.category_name ?? 'Sem categoria'} · {row.item.unit}</p>
                    {!row.item.active && <Badge className="mt-2" variant="secondary">Item do catalogo inativo</Badge>}
                  </div>
                  <StateBadge state={row.state} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs font-semibold text-slate-500">Preco atual</dt><dd className="font-bold text-emerald-950">{formatComparisonCurrency(row.currentApproved?.sale_price ?? null)}</dd></div>
                  <div><dt className="text-xs font-semibold text-slate-500">Aprovado em</dt><dd>{formatComparisonDate(row.currentApproved?.approved_at ?? null)}</dd></div>
                  {row.pending && (<div className="col-span-2"><dt className="text-xs font-semibold text-slate-500">Proposta pendente</dt><dd className="font-bold text-amber-900">{formatComparisonCurrency(row.pending.sale_price)}</dd></div>)}
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">{renderRowActions({ row, isAdmin, online, setForm, setDecisionProposal, setRetireProposal, setHistoryRow })}</div>
              </article>
            ))}
          </div>

          <div className="hidden md:block"><TableShell><table className="w-full min-w-[1100px] text-left text-sm" aria-label="Precos Proprios"><thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Servico</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Preco atual</th><th className="px-4 py-3">Proposta pendente</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ultima aprovacao</th><th className="relative px-4 py-3"><span className="sr-only">Acoes</span></th></tr></thead><tbody className="divide-y divide-slate-100">
            {filtered.map((row) => (
              <tr key={row.item.id}>
                <td className="px-4 py-4"><p className="font-mono text-xs font-bold text-emerald-900">{row.item.code}</p><strong>{row.item.name}</strong>{row.item.unit && <p className="text-xs text-slate-500">Unidade: {row.item.unit}</p>}{!row.item.active && <Badge className="mt-1 block w-fit" variant="secondary">Catalogo inativo</Badge>}</td>
                <td className="px-4 py-4">{row.item.category_name ?? '—'}</td>
                <td className="px-4 py-4 font-serif text-base font-bold text-emerald-950">{formatComparisonCurrency(row.currentApproved?.sale_price ?? null)}</td>
                <td className="px-4 py-4">{row.pending ? <span className="font-bold text-amber-900">{formatComparisonCurrency(row.pending.sale_price)}</span> : <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-4"><StateBadge state={row.state} /></td>
                <td className="px-4 py-4">{formatComparisonDate(row.currentApproved?.approved_at ?? null)}</td>
                <td className="px-4 py-4"><div className="flex min-w-max justify-end gap-1">{renderRowActions({ row, isAdmin, online, setForm, setDecisionProposal, setRetireProposal, setHistoryRow })}</div></td>
              </tr>
            ))}
          </tbody></table></TableShell></div>
        </>
      )}

      <Drawer
        open={Boolean(form)}
        onOpenChange={(open) => { if (!open) setForm(null) }}
        title={form?.mode === 'reajuste' ? 'Propor reajuste do preco proprio' : 'Definir preco proprio'}
        description={form?.mode === 'reajuste' ? 'A nova proposta substitui o preco atual somente apos aprovacao do Admin.' : 'Informe o preco de venda do servico proprio. O custo interno e opcional e visivel apenas ao Admin.'}
      >
        <OwnPriceProposalForm
          key={`${form?.mode}-${formItem?.id ?? 'new'}`}
          mode={form?.mode ?? 'create'}
          items={formItems}
          item={formItem ?? undefined}
          currentPrice={formCurrentPrice}
          pending={createMutation.isPending}
          onCancel={() => setForm(null)}
          onSubmit={submitProposal}
        />
      </Drawer>

      <OwnPriceDecisionDrawer proposal={decisionProposal} currentPrice={decisionRow?.currentApproved?.sale_price ?? null} online={online} onClose={() => setDecisionProposal(null)} />
      <OwnPriceRetireDrawer proposal={retireProposal} online={online} onClose={() => setRetireProposal(null)} />
      <OwnPriceHistoryDrawer
        open={Boolean(historyRow)}
        onOpenChange={(open) => { if (!open) setHistoryRow(null) }}
        itemCode={historyRow?.item.code ?? ''}
        itemName={historyRow?.item.name ?? ''}
        proposals={historyRow?.proposals ?? []}
        isAdmin={isAdmin}
        currentProposalId={historyRow?.currentApproved?.id ?? null}
        viewer={profile ? { id: profile.id, fullName: profile.full_name } : null}
      />
    </div>
  )
}

function renderRowActions(params: {
  row: OwnPriceViewRow
  isAdmin: boolean
  online: boolean
  setForm: (value: FormDrawer) => void
  setDecisionProposal: (value: OwnPriceProposalItem) => void
  setRetireProposal: (value: OwnPriceProposalItem) => void
  setHistoryRow: (value: OwnPriceViewRow) => void
}): ReactNode {
  const { row, isAdmin, online, setForm, setDecisionProposal, setRetireProposal, setHistoryRow } = params
  const itemDisabled = !row.item.active || !online
  const titleSuffix = row.item.active ? '' : ' (item do catalogo inativo)'
  const historyAction = row.proposals.length > 0
    ? <Button size="sm" variant="ghost" aria-label={`Ver historico de ${row.item.name}`} onClick={() => setHistoryRow(row)}><History className="size-4" /> Ver historico</Button>
    : null

  if (row.state === 'no_price' || row.state === 'inactive') {
    return <>{historyAction}<Button size="sm" disabled={itemDisabled} aria-label={`Definir preco proprio para ${row.item.name}`} onClick={() => setForm({ mode: 'create', item: row.item })}><Plus className="size-4" /> Definir{titleSuffix}</Button></>
  }

  if (row.state === 'approved') {
    return (
      <>
        {historyAction}
        <Button size="sm" variant="outline" disabled={itemDisabled} aria-label={`Propor reajuste para ${row.item.name}`} onClick={() => setForm({ mode: 'reajuste', item: row.item })}>Propor reajuste</Button>
        {isAdmin && <Button size="sm" variant="outline" disabled={!row.currentApproved || !online} aria-label={`Inativar preco de ${row.item.name}`} onClick={() => { if (row.currentApproved) setRetireProposal(row.currentApproved) }}>Inativar</Button>}
      </>
    )
  }

  if (row.state === 'pending' && row.pending) {
    if (isAdmin) {
      return <>{historyAction}<Button size="sm" disabled={!online} aria-label={`Decidir proposta de ${row.item.name}`} onClick={() => setDecisionProposal(row.pending!)}>Aprovar / Recusar</Button></>
    }
    return <>{historyAction}<p className="px-1 text-xs font-semibold text-slate-500">Aguardando decisao do Admin</p></>
  }

  return null
}
