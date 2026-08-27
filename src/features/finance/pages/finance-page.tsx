import { ArrowUpRight, BookOpen, Building2, CreditCard, DollarSign, FileText, Layers, Receipt, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'

const sections = [
  { title: 'Plano de Contas', description: 'Classes, naturezas, grupos BP, DRE, DFC e DVA.', icon: BookOpen, to: '/finance/chart-accounts', status: 'Disponivel', active: true },
  { title: 'Centros de Custo', description: 'Organizacao por area de atuacao.', icon: Building2, to: '/finance/cost-centers', status: 'Disponivel', active: true },
  { title: 'Linhas de Servico', description: 'Linhagem de receita e custo por servico.', icon: Layers, to: '/finance/service-lines', status: 'Disponivel', active: true },
  { title: 'Categorias', description: 'Regras de classificacao e mapeamento contabil.', icon: FileText, to: '/finance/categories', status: 'Disponivel', active: true },
  { title: 'Contas Financeiras', description: 'Caixa, bancos e equivalentes.', icon: CreditCard, to: '/finance/accounts', status: 'Disponivel', active: true },
  { title: 'Formas de Pagamento', description: 'PIX, boleto, cartao, transferencia.', icon: Receipt, to: '/finance/payment-methods', status: 'Planejado' },
  { title: 'Lancamentos', description: 'Motor de partidas dobradas.', icon: DollarSign, status: 'ETAPA 08B' },
  { title: 'DRE', description: 'Demonstracao do Resultado do Exercicio.', icon: FileText, to: '/finance/dre', status: 'Disponivel', active: true },
  { title: 'Demonstracoes', description: 'BP, DMPL, DVA.', icon: Settings, status: 'ETAPA 08F-08G' },
]

export default function FinancePage() {
  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <Badge className="mb-4">Modulo Financeiro</Badge>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Financeiro</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600">
            Fundacao contabil-gerencial. Plano de contas, centros de custo, linhas de servico e categorias com mapeamento para partidas dobradas.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <strong>Aviso gerencial:</strong> As demonstracoes e classificacoes para escrituracao oficial devem ser conciliadas e validadas pela contabilidade responsavel.
      </section>

      <p className="mb-4 mt-8 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Cadastros Mestres</p>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sections.map(({ title, description, icon: Icon, to, status, active }) => {
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
    </div>
  )
}
