import { ArrowUpDown, ListChecks, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, PageHeader, selectClassName, TableSkeleton } from '@/features/pricing/components/operational-ui'
import { useCatalogCategories } from '@/features/pricing/catalog/catalog.queries'
import { useQuotations } from '@/features/pricing/quotations/quotation.queries'
import { isExpired } from '@/features/pricing/quotations/quotation.helpers'
import { useOnlineStatus } from '@/hooks/use-online-status'

import { ComparisonTable } from './comparison-table'
import { formatComparisonCurrency, formatComparisonDate } from './comparison-helpers'
import { OffersDrawer } from './offers-drawer'
import { useComparison } from './comparison-queries'
import type { ComparisonRow, OfferFilter, ComparisonSortKey } from './comparison-types'

function ComparisonCard({ row, onOpen }: { row: ComparisonRow; onOpen: (row: ComparisonRow) => void }) {
  const hasOffer = row.best_unit_price !== null
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-emerald-900">{row.code}</p>
          <h2 className="mt-1 font-serif text-lg font-semibold text-slate-950">{row.item_name}</h2>
          <p className="mt-1 text-xs text-slate-500">{row.category_name} · {row.unit}</p>
        </div>
        {hasOffer ? <Badge>Melhor custo</Badge> : <Badge variant="secondary">Sem oferta</Badge>}
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-baseline justify-between">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Menor custo</dt>
          <dd className="font-serif text-lg font-bold text-emerald-900">{formatComparisonCurrency(row.best_unit_price)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fornecedor</dt>
          <dd className="text-sm font-medium text-slate-800">{row.best_supplier_name ?? '—'}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Validade</dt>
          <dd className="text-sm font-medium text-slate-800">
            {row.best_validity_not_informed || row.best_valid_until === null
              ? <span className="text-amber-800">Validade não informada</span>
              : formatComparisonDate(row.best_valid_until)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outras ofertas</dt>
          <dd>
            {row.eligible_offer_count === 0
              ? <span className="text-xs text-slate-500">—</span>
              : (
                <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-900 hover:underline" onClick={() => onOpen(row)}>
                  <ListChecks className="size-4" /> {row.eligible_offer_count} {row.eligible_offer_count === 1 ? 'oferta' : 'ofertas'}
                </button>
              )}
          </dd>
        </div>
      </dl>
      <Button className="mt-4 w-full" type="button" variant="outline" onClick={() => onOpen(row)}>Ver ofertas</Button>
    </article>
  )
}

export default function ComparisonPage() {
  const online = useOnlineStatus()
  const query = useComparison()
  const categoriesQuery = useCatalogCategories()
  const quotationsQuery = useQuotations()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [supplier, setSupplier] = useState('all')
  const [offer, setOffer] = useState<OfferFilter>('all')
  const [sortKey, setSortKey] = useState<ComparisonSortKey>('item')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null)

  const rows = useMemo(() => query.data ?? [], [query.data])
  const drawerRow = useMemo(() => rows.find((row) => row.catalog_item_id === drawerItemId) ?? null, [rows, drawerItemId])

  const suppliers = useMemo(() => {
    const set = new Map<string, string>()
    for (const row of rows) {
      if (row.best_supplier_id && row.best_supplier_name) {
        set.set(row.best_supplier_id, row.best_supplier_name)
      }
    }
    return Array.from(set.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [rows])

  const sorted = useMemo(() => {
    const filtered = rows.filter((row) => {
      const term = search.trim().toLocaleLowerCase('pt-BR')
      const matchesSearch = !term
        || [row.code, row.item_name, row.category_name, row.best_supplier_name ?? '']
          .some((field) => field.toLocaleLowerCase('pt-BR').includes(term))
      const matchesCategory = category === 'all' || row.category_id === category
      const matchesSupplier = supplier === 'all' || row.best_supplier_id === supplier
      const matchesOffer = (() => {
        if (offer === 'all') return true
        if (offer === 'with_offer') return row.best_unit_price !== null
        if (offer === 'no_offer') return row.best_unit_price === null
        return Boolean(row.best_validity_not_informed) || row.best_valid_until === null
      })()
      return matchesSearch && matchesCategory && matchesSupplier && matchesOffer
    })
    const direction = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'best_cost': {
          const an = a.best_unit_price === null ? Number.POSITIVE_INFINITY : Number(a.best_unit_price)
          const bn = b.best_unit_price === null ? Number.POSITIVE_INFINITY : Number(b.best_unit_price)
          return (an - bn) * direction
        }
        case 'category':
          return a.category_name.localeCompare(b.category_name, 'pt-BR') * direction
        case 'validity': {
          const an = a.best_valid_until ?? '9999-12-31'
          const bn = b.best_valid_until ?? '9999-12-31'
          return an.localeCompare(bn) * direction
        }
        case 'item':
        default:
          return a.item_name.localeCompare(b.item_name, 'pt-BR') * direction
      }
    })
  }, [rows, search, category, supplier, offer, sortKey, sortDir])

  const itemsWithOffer = rows.filter((row) => row.best_unit_price !== null).length
  const itemsWithoutOffer = rows.length - itemsWithOffer
  const expiringSoon = (quotationsQuery.data ?? []).filter((quotation) => {
    if (quotation.status !== 'active' || !quotation.valid_until) return false
    if (isExpired(quotation.valid_until)) return false
    const today = new Date()
    const days = Math.floor((new Date(`${quotation.valid_until}T00:00:00Z`).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return days <= 7
  })

  const clearFilters = () => {
    setSearch('')
    setCategory('all')
    setSupplier('all')
    setOffer('all')
  }

  const changeSort = (key: ComparisonSortKey) => {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'best_cost' || key === 'validity' ? 'asc' : 'asc')
    }
  }

  const categories = categoriesQuery.data ?? []
  const mobileSortValue = `${sortKey}:${sortDir}`

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Motor de Preços"
        title="Comparação de custos"
        description="Acompanhe o menor custo vigente por item do Catálogo Efetiva e abra o histórico de ofertas."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/pricing/quotations">Cotações</Link></Button>
            <Button asChild><Link to="/pricing/quotations/new">Nova cotação</Link></Button>
          </>
        }
      />

      {!online && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          Você está sem conexão. A comparação pode exibir dados já carregados, mas novas ações exigem reconexão.
        </div>
      )}

      <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Indicadores de comparação">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Itens com oferta</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-slate-950">{itemsWithOffer}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Itens sem oferta</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-slate-950">{itemsWithoutOffer}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cotações vencendo (7 dias)</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-slate-950">{expiringSoon.length}</p>
        </article>
      </section>

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_repeat(3,14rem)_12rem]">
        <label className="relative">
          <span className="sr-only">Buscar por código, item ou fornecedor</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar item, código ou fornecedor..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          <span className="sr-only">Filtrar por categoria</span>
          <select className={`${selectClassName} w-full`} value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">Categorias: todas</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar por fornecedor</span>
          <select className={`${selectClassName} w-full`} value={supplier} onChange={(event) => setSupplier(event.target.value)}>
            <option value="all">Fornecedores: todos</option>
            {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar por situação da oferta</span>
          <select className={`${selectClassName} w-full`} value={offer} onChange={(event) => setOffer(event.target.value as OfferFilter)}>
            <option value="all">Situação: todas</option>
            <option value="with_offer">Com oferta vigente</option>
            <option value="no_offer">Sem oferta vigente</option>
            <option value="validity_not_informed">Validade não informada</option>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Ordenar por">
          {([
            ['item', 'Item'],
            ['best_cost', 'Menor custo'],
            ['category', 'Categoria'],
            ['validity', 'Validade'],
          ] as Array<[ComparisonSortKey, string]>).map(([key, label]) => {
            const active = sortKey === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => changeSort(key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${active ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {label}
                {active && <ArrowUpDown className="size-3.5" />}
              </button>
            )
          })}
        </div>
      </div>

      {query.isLoading || categoriesQuery.isLoading ? (
        <TableSkeleton columns={9} />
      ) : query.isError || categoriesQuery.isError ? (
        <ErrorState onRetry={() => { void query.refetch(); void categoriesQuery.refetch() }} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Ainda não há itens no Catálogo Efetiva"
          description="Cadastre itens e cotações para iniciar a comparação de custos."
          action={<Button asChild><Link to="/pricing/catalog">Ir para o Catálogo</Link></Button>}
        />
      ) : sorted.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title="Nenhum item encontrado"
            description="Ajuste a busca ou os filtros para ver outros itens."
            action={<Button variant="outline" onClick={clearFilters}><X className="size-4" /> Limpar filtros</Button>}
          />
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden" aria-label="Comparação em cartões">
            {sorted.map((row) => <ComparisonCard key={row.catalog_item_id} row={row} onOpen={(item) => setDrawerItemId(item.catalog_item_id)} />)}
          </div>
          <div className="hidden md:block">
            <ComparisonTable
              rows={sorted}
              sorting={[{ id: sortKey, desc: sortDir === 'desc' }]}
              onSortingChange={(state) => {
                const first = state[0]
                if (!first) return
                setSortKey(first.id as ComparisonSortKey)
                setSortDir(first.desc ? 'desc' : 'asc')
              }}
              globalFilter={search}
              onOpenOffers={(row) => setDrawerItemId(row.catalog_item_id)}
            />
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-slate-500 md:hidden" aria-label="Ordenar comparação no celular">
        Ordenação atual: {mobileSortValue}
      </p>

      <OffersDrawer
        catalogItemId={drawerItemId}
        itemCode={drawerRow?.code}
        itemName={drawerRow?.item_name}
        onOpenChange={(open) => {
          if (!open) setDrawerItemId(null)
        }}
      />
    </div>
  )
}
