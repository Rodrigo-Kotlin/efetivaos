import { ArrowUpDown, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { useCatalogCategories } from '@/features/pricing/catalog/catalog.queries'
import { CommercialStatusBadge } from '@/features/pricing/comparison/commercial-status'
import { reviewReasonLabel } from '@/features/pricing/comparison/commercial-status-helpers'
import { formatComparisonCurrency, formatComparisonDate, formatRuleValue } from '@/features/pricing/comparison/comparison-helpers'
import { useComparison } from '@/features/pricing/comparison/comparison-queries'
import { ReviewDrawer } from '@/features/pricing/comparison/review-drawer'
import type { CommercialSourceFilter, CommercialStatusFilter, ComparisonRow } from '@/features/pricing/comparison/comparison-types'
import { EmptyState, ErrorState, PageHeader, selectClassName, TableShell, TableSkeleton } from '@/features/pricing/components/operational-ui'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { isExpired } from '@/features/pricing/quotations/quotation.helpers'

type PriceListSortKey = 'item' | 'final_price' | 'approved_at'

function SourceValidity({ validUntil }: { validUntil: string | null }) {
  if (!validUntil) return <Badge variant="warning">Validade nao informada</Badge>
  const expired = isExpired(validUntil)
  return <div><span>{formatComparisonDate(validUntil)}</span><p className={`text-xs font-semibold ${expired ? 'text-amber-800' : 'text-emerald-800'}`}>{expired ? 'Fonte vencida' : 'Fonte vigente'}</p></div>
}

function PriceCard({ row, onTrace }: { row: ComparisonRow; onTrace: (row: ComparisonRow) => void }) {
  const reason = reviewReasonLabel(row.review_reason)
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
       <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-emerald-900">{row.code}</p><h2 className="font-serif text-lg font-semibold">{row.item_name}</h2><p className="text-xs text-slate-500">{row.category_name} · {row.unit}</p>{!row.catalog_item_active && <Badge className="mt-2" variant="secondary">Item do catalogo inativo</Badge>}</div><CommercialStatusBadge status={row.effective_status} /></div>
      <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Preco final aprovado</p>
      <p className="font-serif text-2xl font-bold text-emerald-950">{formatComparisonCurrency(row.approved_final_price)}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs font-semibold text-slate-500">Custo aprovado</dt><dd>{formatComparisonCurrency(row.approved_cost_price)}</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">Fonte</dt><dd>{row.approved_supplier_name ?? '—'} · {row.manual_source ? 'Manual' : 'Automatica'}</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">Acrescimo</dt><dd>{formatRuleValue(row.approved_adjustment_type, row.approved_adjustment_value)}</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">Aprovado em</dt><dd>{formatComparisonDate(row.approved_at)}</dd></div>
        <div className="col-span-2"><dt className="text-xs font-semibold text-slate-500">Validade da fonte</dt><dd className="mt-1"><SourceValidity validUntil={row.approved_source_valid_until} /></dd></div>
      </dl>
      {reason && <p className="mt-3 text-xs font-semibold text-amber-900">{reason}</p>}
      <Button className="mt-4 w-full" type="button" variant="outline" onClick={() => onTrace(row)}>Ver rastreabilidade</Button>
    </article>
  )
}

export default function PriceListPage() {
  const { profile } = useAuth()
  const online = useOnlineStatus()
  const navigate = useNavigate()
  const query = useComparison()
  const categoriesQuery = useCatalogCategories()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState<CommercialStatusFilter>('all')
  const [source, setSource] = useState<CommercialSourceFilter>('all')
  const [supplier, setSupplier] = useState('all')
  const [sortKey, setSortKey] = useState<PriceListSortKey>('item')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [traceItemId, setTraceItemId] = useState<string | null>(null)
  const commercialRows = useMemo(() => (query.data ?? []).filter((row) => row.price_list_id !== null), [query.data])
  const traceRow = commercialRows.find((row) => row.catalog_item_id === traceItemId) ?? null
  const suppliers = useMemo(() => {
    const values = new Map<string, string>()
    for (const row of commercialRows) if (row.approved_supplier_id && row.approved_supplier_name) values.set(row.approved_supplier_id, row.approved_supplier_name)
    return Array.from(values, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [commercialRows])
  const filtered = commercialRows.filter((row) => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    const matchesSearch = !term || [row.code, row.item_name, row.category_name, row.approved_supplier_name ?? ''].some((field) => field.toLocaleLowerCase('pt-BR').includes(term))
    const matchesCategory = category === 'all' || row.category_id === category
    const matchesStatus = status === 'all' || row.effective_status === status
    const matchesSource = source === 'all' || (source === 'manual' ? row.manual_source === true : row.manual_source === false)
    const matchesSupplier = supplier === 'all' || row.approved_supplier_id === supplier
    return matchesSearch && matchesCategory && matchesStatus && matchesSource && matchesSupplier
  }).sort((a, b) => {
    const direction = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'final_price') return (Number(a.approved_final_price) - Number(b.approved_final_price)) * direction
    if (sortKey === 'approved_at') return (a.approved_at ?? '').localeCompare(b.approved_at ?? '') * direction
    return a.item_name.localeCompare(b.item_name, 'pt-BR') * direction
  })
  const clearFilters = () => { setSearch(''); setCategory('all'); setStatus('all'); setSource('all'); setSupplier('all') }
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader eyebrow="Motor de Precos" title="Tabela de Precos" description="Uma linha comercial atual por item, com preco final aprovado, status e rastreabilidade da decisao." actions={<Button asChild variant="outline"><Link to="/pricing/comparison">Abrir comparacao</Link></Button>} />
      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_repeat(5,minmax(10rem,13rem))_auto]">
        <label className="relative"><span className="sr-only">Buscar na tabela de precos</span><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" /><Input className="pl-9" placeholder="Buscar item, codigo ou fonte..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label><span className="sr-only">Filtrar tabela por categoria</span><select className={`${selectClassName} w-full`} value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Categorias: todas</option>{(categoriesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span className="sr-only">Filtrar tabela por status</span><select className={`${selectClassName} w-full`} value={status} onChange={(event) => setStatus(event.target.value as CommercialStatusFilter)}><option value="all">Status: todos</option><option value="approved">Aprovado</option><option value="review_required">Revisao necessaria</option><option value="inactive">Inativo</option></select></label>
        <label><span className="sr-only">Filtrar tabela por fonte</span><select className={`${selectClassName} w-full`} value={source} onChange={(event) => setSource(event.target.value as CommercialSourceFilter)}><option value="all">Fontes: todas</option><option value="automatic">Automatica</option><option value="manual">Manual</option></select></label>
        <label><span className="sr-only">Filtrar tabela por fornecedor</span><select className={`${selectClassName} w-full`} value={supplier} onChange={(event) => setSupplier(event.target.value)}><option value="all">Fornecedores: todos</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span className="sr-only">Ordenar tabela de precos por</span><select className={`${selectClassName} w-full`} value={sortKey} onChange={(event) => setSortKey(event.target.value as PriceListSortKey)}><option value="item">Ordenar: item</option><option value="final_price">Ordenar: preco final</option><option value="approved_at">Ordenar: aprovacao</option></select></label>
        <Button type="button" variant="outline" aria-label={sortDir === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'} onClick={() => setSortDir((current) => current === 'asc' ? 'desc' : 'asc')}><ArrowUpDown className="size-4" /> {sortDir === 'asc' ? 'Crescente' : 'Decrescente'}</Button>
      </div>

      {query.isLoading || categoriesQuery.isLoading ? <TableSkeleton columns={9} /> : query.isError || categoriesQuery.isError ? <ErrorState onRetry={() => { void query.refetch(); void categoriesQuery.refetch() }} /> : commercialRows.length === 0 ? (
        <EmptyState title="Nenhum preco comercial aprovado" description="A tabela comercial e preenchida somente por uma aprovacao explicita de Admin na comparacao." action={<Button asChild><Link to="/pricing/comparison">Ir para comparacao</Link></Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum preco encontrado" description="Ajuste a busca ou os filtros para consultar outros precos." action={<Button variant="outline" onClick={clearFilters}><X className="size-4" /> Limpar filtros</Button>} />
      ) : <>
        <div className="space-y-3 md:hidden">{filtered.map((row) => <PriceCard key={row.catalog_item_id} row={row} onTrace={(item) => setTraceItemId(item.catalog_item_id)} />)}</div>
        <div className="hidden md:block"><TableShell><table className="w-full min-w-[1240px] text-left text-sm" aria-label="Tabela de Precos"><thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Custo aprovado</th><th className="px-4 py-3">Fonte aprovada</th><th className="px-4 py-3">Validade da fonte</th><th className="px-4 py-3">Acrescimo</th><th className="px-4 py-3">Preco final aprovado</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aprovacao</th><th className="px-4 py-3"><span className="sr-only">Acoes</span></th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((row) => <tr key={row.catalog_item_id}><td className="px-4 py-4"><p className="font-mono text-xs font-bold text-emerald-900">{row.code}</p><strong>{row.item_name}</strong>{!row.catalog_item_active && <Badge className="mt-1 block w-fit" variant="secondary">Catalogo inativo</Badge>}</td><td className="px-4 py-4">{row.category_name}</td><td className="px-4 py-4">{formatComparisonCurrency(row.approved_cost_price)}</td><td className="px-4 py-4"><strong>{row.approved_supplier_name ?? '—'}</strong><p className="text-xs text-slate-500">{row.manual_source ? 'Manual' : 'Automatica'}</p></td><td className="px-4 py-4"><SourceValidity validUntil={row.approved_source_valid_until} /></td><td className="px-4 py-4">{formatRuleValue(row.approved_adjustment_type, row.approved_adjustment_value)}</td><td className="px-4 py-4 font-serif text-base font-bold text-emerald-950">{formatComparisonCurrency(row.approved_final_price)}</td><td className="px-4 py-4"><CommercialStatusBadge status={row.effective_status} />{row.review_reason && <p className="mt-1 max-w-44 text-xs text-amber-800">{reviewReasonLabel(row.review_reason)}</p>}</td><td className="px-4 py-4">{formatComparisonDate(row.approved_at)}</td><td className="px-4 py-4"><Button type="button" size="sm" variant="ghost" onClick={() => setTraceItemId(row.catalog_item_id)}>Rastreabilidade</Button></td></tr>)}</tbody></table></TableShell></div>
      </>}

      <ReviewDrawer row={traceRow} isAdmin={isAdmin} online={online} onOpenChange={(open) => { if (!open) setTraceItemId(null) }} onConfigureRule={() => navigate('/pricing/rules')} />
    </div>
  )
}
