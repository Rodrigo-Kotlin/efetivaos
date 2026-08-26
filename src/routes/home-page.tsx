import { ArrowUpRight, Building2, CircleDollarSign, LayoutDashboard, Tag, ArrowLeftRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/features/auth/auth-context'

const modules = [
  { title: 'Motor de Precos', description: 'Cotacoes, comparacao e formacao de precos comerciais.', icon: Tag, to: '/pricing', status: 'MVP concluido', active: true },
  { title: 'CRM leve', description: 'Clientes e contatos da operacao.', icon: Building2, to: '/crm', status: 'Disponivel', active: true },
  { title: 'Financeiro', description: 'Plano de contas, centros de custo e categorias.', icon: CircleDollarSign, to: '/finance', status: 'ETAPA 08A', active: true },
  { title: 'Transacoes', description: 'Motor de lancamentos e partidas dobradas.', icon: ArrowLeftRight, to: '/finance/transactions', status: 'ETAPA 08B', active: true },
  { title: 'Dashboard', description: 'Indicadores e alertas operacionais.', icon: LayoutDashboard, status: 'No Motor de Precos' },
]

export default function HomePage() {
  const { profile, user } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuario'

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <Badge className="mb-4">Ambiente conectado</Badge>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Bom dia, <span className="capitalize">{firstName}</span>.</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600">Acesse os modulos operacionais disponiveis e acompanhe as proximas entregas do Efetiva OS.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span className="text-slate-500">Perfil atual</span>
          <strong className="ml-2 capitalize text-emerald-800">{profile?.role ?? 'carregando'}</strong>
        </div>
      </div>

      <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Modulos</p>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map(({ title, description, icon: Icon, to, status, active }) => {
          const content = (
            <>
              <div className="flex items-start justify-between">
                <span className={active ? 'grid size-11 place-items-center rounded-xl bg-emerald-100 text-emerald-800' : 'grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-500'}><Icon className="size-5" /></span>
                {active && <ArrowUpRight className="size-5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
              </div>
              <h2 className="mt-7 font-serif text-xl font-semibold">{title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{description}</p>
              <div className="mt-5 border-t border-slate-100 pt-4"><Badge variant={active ? 'default' : 'secondary'}>{status}</Badge></div>
            </>
          )
          const classes = 'group block rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,.04)] transition hover:-translate-y-0.5 hover:shadow-lg'
          return to ? <Link key={title} to={to} className={classes}>{content}</Link> : <article key={title} className={`${classes} opacity-75`}>{content}</article>
        })}
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl bg-emerald-950 text-white">
        <div className="grid gap-8 p-7 md:grid-cols-[1fr_auto] md:items-center md:p-9">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-300">Motor de Precos</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold">Fluxo comercial completo e rastreavel</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100/75">Fornecedores, cotacoes, comparacao, regras de acrescimo, aprovacao e tabela comercial reunidos em um unico modulo.</p>
          </div>
          <Link to="/pricing" className="inline-flex h-11 items-center justify-center rounded-lg bg-lime-300 px-5 text-sm font-bold text-emerald-950 hover:bg-lime-200">Abrir modulo <ArrowUpRight className="ml-2 size-4" /></Link>
        </div>
      </section>
    </div>
  )
}
