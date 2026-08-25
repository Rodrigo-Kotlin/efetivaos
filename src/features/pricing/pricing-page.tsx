import { ArrowRight, Building2, ClipboardList, LibraryBig, ListTree, Scale, Tag } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/shared/operational-ui'
import { useQuotations } from '@/features/pricing/quotations/quotation.queries'
import { isExpired } from '@/features/pricing/quotations/quotation.helpers'
import { useComparison } from '@/features/pricing/comparison/comparison-queries'
import { formatComparisonCurrency } from '@/features/pricing/comparison/comparison-helpers'
import { useAuth } from '@/features/auth/auth-context'

const sections = [
  { to: '/pricing/comparison', label: 'Comparação de custos', description: 'Veja o menor custo vigente e abra o histórico de ofertas por item do Catálogo Efetiva.', icon: Scale, primary: true },
  { to: '/pricing/prices', label: 'Tabela de Preços', description: 'Consulte os preços comerciais aprovados, status e origem de cada decisão.', icon: ListTree },
  { to: '/pricing/quotations', label: 'Cotações', description: 'Registre documentos de fornecedores e ative ou cancele cada cotação.', icon: ClipboardList },
  { to: '/pricing/suppliers', label: 'Fornecedores', description: 'Gerencie os fornecedores usados como origem das cotações.', icon: Building2 },
  { to: '/pricing/catalog', label: 'Catálogo Efetiva', description: 'Mantenha a referência canônica de itens e categorias usadas na comparação.', icon: LibraryBig },
  { to: '/pricing/rules', label: 'Regras de preço', description: 'Configure o acréscimo sobre custo por item, categoria ou regra global.', icon: Tag, adminOnly: true },
]

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`
}

export default function PricingPage() {
  const { profile, user } = useAuth()
  const comparisonQuery = useComparison()
  const quotationsQuery = useQuotations()

  const comparison = useMemo(() => (comparisonQuery.data ?? []).filter((row) => row.catalog_item_active), [comparisonQuery.data])
  const approvedPrices = useMemo(() => comparison.filter((row) => row.effective_status === 'approved').length, [comparison])
  const pricesInReview = useMemo(() => comparison.filter((row) => row.effective_status === 'review_required').length, [comparison])
  const itemsWithoutRule = useMemo(() => comparison.filter((row) => row.resolved_margin_rule_id === null).length, [comparison])
  const itemsWithoutOffer = useMemo(() => comparison.filter((row) => row.best_cost === null).length, [comparison])
  const expiringSoon = useMemo(
    () => (quotationsQuery.data ?? []).filter((quotation) => {
      if (quotation.status !== 'active' || !quotation.valid_until) return false
      if (isExpired(quotation.valid_until)) return false
      return quotation.valid_until <= addDays(new Date(), 7)
    }),
    [quotationsQuery.data],
  )
  const topOffers = useMemo(
    () => comparison
      .filter((row) => row.best_cost !== null)
      .slice(0, 5),
    [comparison],
  )

  const isLoading = comparisonQuery.isLoading || quotationsQuery.isLoading
  const isError = comparisonQuery.isError || quotationsQuery.isError
  const indicators = [
    { label: 'Preços aprovados', value: approvedPrices },
    { label: 'Em revisão', value: pricesInReview },
    { label: 'Itens sem regra', value: itemsWithoutRule },
    { label: 'Itens sem oferta vigente', value: itemsWithoutOffer },
    { label: 'Cotações vencendo em 7 dias', value: expiringSoon.length },
  ]
  const visibleSections = sections.filter((section) => !section.adminOnly || profile?.role === 'admin')
  const retryDashboard = () => {
    void Promise.all([comparisonQuery.refetch(), quotationsQuery.refetch()])
  }

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Motor de Preços"
        title="Visão operacional"
        description="Acompanhe preços comerciais, pendências de revisão, cobertura do catálogo e validade das cotações."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/pricing/quotations">Cotações</Link></Button>
            <Button asChild><Link to="/pricing/quotations/new">Nova cotação</Link></Button>
          </>
        }
      />

      {isError ? (
        <section className="mb-6" aria-label="Indicadores do Motor de Preços"><ErrorState onRetry={retryDashboard} /></section>
      ) : (
        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores do Motor de Preços">
          {isLoading
            ? Array.from({ length: 5 }, (_, index) => (
                <article key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" role="status" aria-label="Carregando indicador">
                  <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                  <div className="mt-3 h-8 w-12 animate-pulse rounded bg-slate-100" />
                </article>
              ))
            : indicators.map((indicator) => (
                <article key={indicator.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{indicator.label}</p>
                  <p className="mt-2 font-serif text-2xl font-semibold text-slate-950">{indicator.value}</p>
                </article>
              ))}
        </section>
      )}

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-950 p-6 text-white shadow-sm sm:p-8">
          <Badge className="bg-white/10 text-white">Fluxo comercial</Badge>
          <h2 className="mt-4 font-serif text-2xl font-semibold">Do menor custo ao preço aprovado</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-100/80">
            Compare ofertas vigentes por item do Catálogo Efetiva, revise o acréscimo sobre custo e acompanhe separadamente custo, preço sugerido e preço aprovado.
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

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Áreas do Motor de Preços">
        {visibleSections.map(({ to, label, description, icon: Icon, primary }) => (
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

      {!comparisonQuery.isError && <section aria-label="Ofertas vigentes em destaque" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">Ofertas vigentes em destaque</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/pricing/comparison">Ver comparação completa <ArrowRight className="size-4" /></Link></Button>
        </header>
        {isLoading ? (
          <TableSkeleton columns={4} />
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
      </section>}
    </div>
  )
}
