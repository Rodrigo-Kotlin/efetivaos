import { ArrowRight, ClipboardList, LibraryBig, Scale, Tag } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/features/pricing/components/operational-ui'
import { useCatalogCategories } from '@/features/pricing/catalog/catalog.queries'
import { useQuotations } from '@/features/pricing/quotations/quotation.queries'
import { isExpired } from '@/features/pricing/quotations/quotation.helpers'
import { useComparison } from '@/features/pricing/comparison/comparison-queries'
import { formatComparisonCurrency } from '@/features/pricing/comparison/comparison-helpers'
import { useAuth } from '@/features/auth/auth-context'
import { useOnlineStatus } from '@/hooks/use-online-status'

const sections = [
  { to: '/pricing/comparison', label: 'Comparação de custos', description: 'Veja o menor custo vigente e abra o histórico de ofertas por item do Catálogo Efetiva.', icon: Scale, primary: true },
  { to: '/pricing/quotations', label: 'Cotações', description: 'Registre documentos de fornecedores e ative ou cancele cada cotação.', icon: ClipboardList },
  { to: '/pricing/catalog', label: 'Catálogo Efetiva', description: 'Mantenha a referência canônica de itens e categorias usadas na comparação.', icon: LibraryBig },
]

export default function PricingPage() {
  const { profile, user } = useAuth()
  const online = useOnlineStatus()
  const comparisonQuery = useComparison()
  const quotationsQuery = useQuotations()
  const categoriesQuery = useCatalogCategories()

  const comparison = useMemo(() => comparisonQuery.data ?? [], [comparisonQuery.data])
  const itemsWithOffer = useMemo(() => comparison.filter((row) => row.best_cost !== null).length, [comparison])
  const itemsWithoutOffer = comparison.length - itemsWithOffer
  const expiringSoon = useMemo(
    () => (quotationsQuery.data ?? []).filter((quotation) => {
      if (quotation.status !== 'active' || !quotation.valid_until) return false
      if (isExpired(quotation.valid_until)) return false
      const today = new Date()
      const days = Math.floor((new Date(`${quotation.valid_until}T00:00:00Z`).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return days <= 7
    }),
    [quotationsQuery.data],
  )
  const topOffers = useMemo(
    () => comparison
      .filter((row) => row.best_cost !== null)
      .slice(0, 5),
    [comparison],
  )

  const isLoading = comparisonQuery.isLoading || quotationsQuery.isLoading || categoriesQuery.isLoading
  const isError = comparisonQuery.isError || quotationsQuery.isError || categoriesQuery.isError

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Motor de Preços"
        title="Fundação operacional"
        description="Acompanhe a comparação de custos, gerencie fornecedores, catálogo e cotações."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/pricing/quotations">Cotações</Link></Button>
            <Button asChild><Link to="/pricing/quotations/new">Nova cotação</Link></Button>
          </>
        }
      />

      {!online && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          Você está sem conexão. A página exibe apenas dados já carregados.
        </div>
      )}

      <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Indicadores do Motor de Preços">
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

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-950 p-6 text-white shadow-sm sm:p-8">
          <Badge className="bg-white/10 text-white">Sprint 3</Badge>
          <h2 className="mt-4 font-serif text-2xl font-semibold">Comparação automática de menor custo</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-100/80">
            A tela de comparação consolida as cotações ativas por <code>catalog_item_id</code>, identifica o menor custo vigente, aplica desempate por validade e received_at e mantém o histórico de cada oferta para auditoria.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-white text-emerald-900 hover:bg-emerald-50"><Link to="/pricing/comparison">Abrir comparação <ArrowRight className="size-4" /></Link></Button>
            <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10"><Link to="/pricing/quotations">Ver cotações</Link></Button>
          </div>
        </article>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Tag className="size-5" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Perfil</p>
              <p className="text-base font-semibold capitalize">{profile?.role === 'admin' ? 'Administrador' : 'Equipe'}</p>
            </div>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div><dt className="text-xs font-semibold text-slate-500">Nome</dt><dd className="font-semibold text-slate-950">{profile?.full_name || 'Não informado'}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">E-mail</dt><dd className="break-all font-semibold text-slate-950">{user?.email}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Role no banco</dt><dd className="font-semibold capitalize text-slate-950">{profile?.role}</dd></div>
          </dl>
        </aside>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-3" aria-label="Áreas do Motor de Preços">
        {sections.map(({ to, label, description, icon: Icon, primary }) => (
          <Link
            key={to}
            to={to}
            className={`group flex h-full flex-col rounded-2xl border p-5 shadow-sm transition-colors ${primary ? 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100' : 'border-slate-200 bg-white text-slate-900 hover:border-emerald-300'}`}
          >
            <div className="flex items-center gap-3">
              <span className={`grid size-10 place-items-center rounded-xl ${primary ? 'bg-white text-emerald-800' : 'bg-emerald-50 text-emerald-800'}`}>
                <Icon className="size-5" />
              </span>
              <h3 className="font-serif text-lg font-semibold">{label}</h3>
            </div>
            <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800">Abrir <ArrowRight className="size-4" /></span>
          </Link>
        ))}
      </section>

      <section aria-label="Top ofertas vigentes" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">Top ofertas vigentes</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/pricing/comparison">Ver comparação completa <ArrowRight className="size-4" /></Link></Button>
        </header>
        {isLoading ? (
          <TableSkeleton columns={4} />
        ) : isError ? (
          <ErrorState onRetry={() => { void comparisonQuery.refetch() }} />
        ) : topOffers.length === 0 ? (
          <EmptyState
            title="Nenhuma oferta vigente ainda"
            description="Ative cotações de fornecedores para que os itens do Catálogo Efetiva passem a competir."
            action={<Button asChild><Link to="/pricing/quotations">Ir para Cotações</Link></Button>}
          />
        ) : (
          <ol className="space-y-3">
            {topOffers.map((row) => (
              <li key={row.catalog_item_id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold uppercase text-emerald-900">{row.code}</p>
                  <p className="truncate text-sm font-semibold text-slate-950">{row.item_name}</p>
                  <p className="text-xs text-slate-500">{row.category_name} · {row.best_supplier_name}</p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-lg font-bold text-emerald-900">{formatComparisonCurrency(row.best_cost)}</p>
                  <p className="text-xs text-slate-500">{row.eligible_offer_count} {row.eligible_offer_count === 1 ? 'oferta' : 'ofertas'}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
