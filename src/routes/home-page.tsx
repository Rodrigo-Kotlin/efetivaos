import { ArrowUpRight, Building2, CircleDollarSign, LayoutDashboard, Tag, ArrowLeftRight, ClipboardList, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'

import { MetricCard } from '@/components/shared/metric-card'
import { ModuleStatusBadge, type ModuleStatus } from '@/components/shared/module-status'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/features/auth/auth-context'
import { useQuotations } from '@/features/pricing/quotations/quotation.queries'
import { useClientLists } from '@/features/crm/queries/client-queries'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getGreetingByHour(hour: number): string {
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModuleItem = {
  title: string
  description: string
  icon: typeof Tag
  to?: string
  status: ModuleStatus
}

const modules: ModuleItem[] = [
  { title: 'Motor de Preços', description: 'Cotações, comparação e formação de preços comerciais.', icon: Tag, to: '/pricing', status: 'available' },
  { title: 'CRM leve', description: 'Clientes e contatos da operação.', icon: Building2, to: '/crm', status: 'available' },
  { title: 'Financeiro', description: 'Plano de contas, centros de custo e categorias.', icon: CircleDollarSign, to: '/finance', status: 'available' },
  { title: 'Transações', description: 'Motor de lançamentos e partidas dobradas.', icon: ArrowLeftRight, to: '/finance/transactions', status: 'available' },
  { title: 'Dashboard', description: 'Indicadores e alertas operacionais.', icon: LayoutDashboard, status: 'planned' },
]

function useHomeMetrics() {
  const { data: quotations, isLoading: qLoading, isError: qError } = useQuotations()
  const { data: clients, isLoading: cLoading, isError: cError } = useClientLists({ status: 'active' })

  const openQuotations = qError ? null : (quotations?.filter((q) => q.status === 'draft').length ?? null)
  const activeClients = cError ? null : (clients?.length ?? null)

  return {
    openQuotations,
    activeClients,
    qLoading,
    cLoading,
    qError,
    cError,
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const { profile, user } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuário'
  const greeting = getGreetingByHour(new Date().getHours())
  const { openQuotations, activeClients, qLoading, cLoading, qError, cError } = useHomeMetrics()

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <Badge className="mb-4">Ambiente conectado</Badge>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{greeting}, <span className="capitalize">{firstName}</span>.</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600">Acesse os módulos operacionais disponíveis e acompanhe as próximas entregas do Efetiva OS.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span className="text-slate-500">Perfil atual</span>
          <strong className="ml-2 capitalize text-emerald-800">{profile?.role ?? 'carregando'}</strong>
        </div>
      </div>

      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Cotações abertas"
          value={openQuotations ?? '--'}
          icon={ClipboardList}
          supportingText={qError ? 'Não foi possível carregar' : 'Aguardando ativação'}
          isLoading={qLoading}
        />
        <MetricCard
          label="Clientes ativos"
          value={activeClients ?? '--'}
          icon={UsersRound}
          supportingText={cError ? 'Não foi possível carregar' : 'Cadastros ativos'}
          isLoading={cLoading}
        />
        <MetricCard
          label="Módulos"
          value={modules.filter((m) => m.status === 'available').length}
          icon={LayoutDashboard}
          supportingText="Disponíveis no sistema"
        />
      </section>

      <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Módulos</p>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {modules.map(({ title, description, icon: Icon, to, status }) => {
          const content = (
            <>
              <div className="flex items-start justify-between">
                <span className={status === 'available' ? 'grid size-11 place-items-center rounded-xl bg-emerald-100 text-emerald-800' : 'grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-500'}><Icon className="size-5" /></span>
                {to && <ArrowUpRight className="size-5 text-slate-500 transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5" />}
              </div>
              <h2 className="mt-5 font-serif text-lg font-semibold">{title}</h2>
              <p className="mt-1.5 min-h-10 text-sm leading-5 text-slate-600">{description}</p>
              <div className="mt-4 border-t border-slate-100 pt-3"><ModuleStatusBadge status={status} /></div>
            </>
          )
          const classes = 'group block rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)] transition motion-safe:hover:-translate-y-0.5 hover:shadow-lg'
          return to ? <Link key={title} to={to} className={classes}>{content}</Link> : <article key={title} className={`${classes} opacity-75`}>{content}</article>
        })}
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl bg-emerald-950 text-white">
        <div className="grid gap-8 p-7 md:grid-cols-[1fr_auto] md:items-center md:p-9">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-300">Motor de Preços</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold">Fluxo comercial completo e rastreável</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100/75">Fornecedores, cotações, comparação, regras de acréscimo, aprovação e tabela comercial reunidos em um único módulo.</p>
          </div>
          <Link to="/pricing" className="inline-flex h-11 items-center justify-center rounded-lg bg-lime-300 px-5 text-sm font-bold text-emerald-950 hover:bg-lime-200">Abrir módulo <ArrowUpRight className="ml-2 size-4" /></Link>
        </div>
      </section>
    </div>
  )
}
