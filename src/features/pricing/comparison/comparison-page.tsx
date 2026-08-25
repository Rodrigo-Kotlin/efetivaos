import { ArrowUpDown, ListChecks, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, PageHeader, selectClassName, TableSkeleton } from '@/components/shared/operational-ui'
import { useCatalogCategories } from '@/features/pricing/catalog/catalog.queries'
import { useQuotations } from '@/features/pricing/quotations/quotation.queries'
import { isExpired } from '@/features/pricing/quotations/quotation.helpers'
import { useAuth } from '@/features/auth/auth-context'
import { useOnlineStatus } from '@/hooks/use-online-status'

import { ComparisonTable } from './comparison-table'
import { formatComparisonCurrency, formatComparisonDate } from './comparison-helpers'
import { OffersDrawer } from './offers-drawer'
import { ReviewDrawer } from './review-drawer'
import { CommercialStatusBadge } from './commercial-status'
import { reviewReasonLabel } from './commercial-status-helpers'
import { useComparison } from './comparison-queries'
import type { ComparisonRow, OfferFilter, ComparisonSortKey } from './comparison-types'

function ComparisonCard({ row, onOpen, onReview, isAdmin }: { row: ComparisonRow; onOpen: (row: ComparisonRow) => void; onReview: (row: ComparisonRow) => void; isAdmin: boolean }) {
  const hasOffer = row.best_cost !== null
  const hasRule = row.resolved_margin_rule_id !== null
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
          <dd className="font-serif text-lg font-bold text-emerald-900">{formatComparisonCurrency(row.best_cost)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preco aprovado</dt>
          <dd className="text-right font-serif text-lg font-bold text-emerald-950">{row.approved_final_price === null ? 'Ainda nao aprovado' : formatComparisonCurrency(row.approved_final_price)}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status comercial</dt>
          <dd className="text-right"><CommercialStatusBadge status={row.effective_status} />{row.review_reason && <p className="mt-1 max-w-48 text-xs text-amber-800">{reviewReasonLabel(row.review_reason)}</p>}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fornecedor</dt>
          <dd className="text-sm font-medium text-slate-800">{row.best_supplier_name ?? '—'}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Validade</dt>
          <dd className="text-sm font-medium text-slate-800">
            {row.best_validity_not_informed || row.best_valid_until === null
              ? <span className="text-amber-800">Validade nao informada</span>
              : formatComparisonDate(row.best_valid_until)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Regra</dt>
          <dd className="text-sm font-medium text-slate-800">
            {hasOffer ? (hasRule ? 'Aplicada' : <span className="text-amber-800">Sem regra</span>) : '—'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preco sugerido</dt>
          <dd>
            {row.suggested_price === null
              ? <span className="text-sm font-medium text-amber-800">Sem regra</span>
              : <button type="button" className="font-serif text-lg font-bold text-emerald-900 hover:underline" onClick={() => onReview(row)}>{formatComparisonCurrency(row.suggested_price)}</button>}
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
      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="flex-1" type="button" variant="outline" onClick={() => onOpen(row)}>Ver ofertas</Button>
        {(row.suggested_price !== null || row.price_list_id !== null) && (
          <Button className="flex-1" type="button" variant="ghost" onClick={() => onReview(row)}>{isAdmin ? 'Decidir preco' : 'Ver detalhes'}</Button>
        )}
        {!isAdmin && !hasRule && hasOffer && (
          <span className="text-xs text-amber-800">Sem regra de acrescimo.</span>
        )}
      </div>
    </article>
  )
}

export default function ComparisonPage() {
  const { profile } = useAuth()
  const online = useOnlineStatus()
  const navigate = useNavigate()
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
  const [reviewItemId, setReviewItemId] = useState<string | null>(null)

  const isAdmin = profile?.role === 'admin'
  const rows = useMemo(() => (query.data ?? []).filter((row) => row.catalog_item_active), [query.data])
  const drawerRow = useMemo(() => rows.find((row) => row.catalog_item_id === drawerItemId) ?? null, [rows, drawerItemId])
  const reviewRow = useMemo(() => rows.find((row) => row.catalog_item_id === reviewItemId) ?? null, [rows, reviewItemId])

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
        if (offer === 'with_offer') return row.best_cost !== null
        if (offer === 'no_offer') return row.best_cost === null
        if (offer === 'validity_not_informed') return Boolean(row.best_validity_not_informed) || row.best_valid_until === null
        if (offer === 'with_rule') return row.best_cost !== null && row.resolved_margin_rule_id !== null
        if (offer === 'without_rule') return row.best_cost !== null && row.resolved_margin_rule_id === null
        if (offer === 'approved' || offer === 'review_required' || offer === 'inactive') return row.effective_status === offer
        return true
      })()
      return matchesSearch && matchesCategory && matchesSupplier && matchesOffer
    })
    const direction = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'best_cost': {
          const an = a.best_cost === null ? Number.POSITIVE_INFINITY : Number(a.best_cost)
          const bn = b.best_cost === null ? Number.POSITIVE_INFINITY : Number(b.best_cost)
          return (an - bn) * direction
        }
        case 'suggested_price': {
          const an = a.suggested_price === null ? Number.POSITIVE_INFINITY : Number(a.suggested_price)
          const bn = b.suggested_price === null ? Number.POSITIVE_INFINITY : Number(b.suggested_price)
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

  const itemsWithOffer = rows.filter((row) => row.best_cost !== null).length
  const itemsWithoutOffer = rows.length - itemsWithOffer
  const approvedItems = rows.filter((row) => row.effective_status === 'approved').length
  const reviewItems = rows.filter((row) => row.effective_status === 'review_required').length
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
      setSortDir('asc')
    }
  }

  const categories = categoriesQuery.data ?? []
  const mobileSortValue = `${sortKey}:${sortDir}`

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Motor de Precos"
        title="Comparacao de precos"
        description="Acompanhe o menor custo vigente, a regra aplicada e o preco sugerido por item do Catalogo Efetiva."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/pricing/quotations">Cotacoes</Link></Button>
            {isAdmin && <Button asChild variant="outline"><Link to="/pricing/rules">Regras de preco</Link></Button>}
            <Button asChild><Link to="/pricing/quotations/new">Nova cotacao</Link></Button>
          </>
        }
      />

      {!online && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          Voce esta sem conexao. A comparacao pode exibir dados ja carregados, mas novas acoes exigem reconexao.
        </div>
      )}

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de comparacao">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Itens com oferta</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-slate-950">{itemsWithOffer}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Precos aprovados</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-slate-950">{approvedItems}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Revisao necessaria</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-slate-950">{reviewItems}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sem oferta / vencendo 7 dias</p><p className="mt-2 font-serif text-2xl font-semibold text-slate-950">{itemsWithoutOffer} / {expiringSoon.length}</p></article>
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
            <option value="all">Situacao: todas</option>
            <option value="with_offer">Com oferta vigente</option>
            <option value="no_offer">Sem oferta vigente</option>
            <option value="validity_not_informed">Validade nao informada</option>
            <option value="with_rule">Com regra</option>
            <option value="without_rule">Sem regra</option>
            <option value="approved">Preco aprovado</option>
            <option value="review_required">Revisao necessaria</option>
            <option value="inactive">Preco inativo</option>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Ordenar por">
          {([
            ['item', 'Item'],
            ['best_cost', 'Menor custo'],
            ['suggested_price', 'Preco sugerido'],
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
        <TableSkeleton columns={10} />
      ) : query.isError || categoriesQuery.isError ? (
        <ErrorState onRetry={() => { void query.refetch(); void categoriesQuery.refetch() }} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Ainda não há itens no Catálogo Efetiva"
          description="Cadastre itens e cotações para iniciar a comparação de preços."
          action={<Button asChild><Link to="/pricing/catalog">Ir para o Catálogo</Link></Button>}
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          title="Nenhum item encontrado"
          description="Ajuste a busca ou os filtros para ver outros itens."
          action={<Button variant="outline" onClick={clearFilters}><X className="size-4" /> Limpar filtros</Button>}
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden" aria-label="Comparacao em cartoes">
            {sorted.map((row) => <ComparisonCard key={row.catalog_item_id} row={row} onOpen={(item) => setDrawerItemId(item.catalog_item_id)} onReview={(item) => setReviewItemId(item.catalog_item_id)} isAdmin={isAdmin} />)}
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
              onOpenReview={(row) => setReviewItemId(row.catalog_item_id)}
              canEditRules={isAdmin}
              isAdmin={isAdmin}
              onEditRule={() => navigate('/pricing/rules')}
            />
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-slate-500 md:hidden" aria-label="Ordenar comparacao no celular">
        Ordenacao atual: {mobileSortValue}
      </p>

      <OffersDrawer
        catalogItemId={drawerItemId}
        itemCode={drawerRow?.code}
        itemName={drawerRow?.item_name}
        onOpenChange={(open) => {
          if (!open) setDrawerItemId(null)
        }}
      />

      <ReviewDrawer
        row={reviewRow}
        isAdmin={isAdmin}
        online={online}
        onOpenChange={(open) => {
          if (!open) setReviewItemId(null)
        }}
        onConfigureRule={() => navigate('/pricing/rules')}
      />
    </div>
  )
}
