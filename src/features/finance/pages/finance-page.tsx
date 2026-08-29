import { ArrowUpRight, BookOpen, Building2, CreditCard, DollarSign, FileText, Layers, Receipt, Settings, Warehouse, PieChart } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'

const sections = [
  { title: 'Plano de Contas', description: 'Classes, naturezas, grupos BP, DRE, DFC e DVA.', icon: BookOpen, to: '/finance/chart-accounts', status: 'Disponível', active: true },
  { title: 'Centros de Custo', description: 'Organização por área de atuação.', icon: Building2, to: '/finance/cost-centers', status: 'Disponível', active: true },
  { title: 'Linhas de Serviço', description: 'Linhagem de receita e custo por serviço.', icon: Layers, to: '/finance/service-lines', status: 'Disponível', active: true },
  { title: 'Categorias Financeiras', description: 'Regras de classificação e mapeamento contábil.', icon: FileText, to: '/finance/categories', status: 'Disponível', active: true },
  { title: 'Contas Financeiras', description: 'Caixa, bancos e equivalentes.', icon: CreditCard, to: '/finance/accounts', status: 'Disponível', active: true },
  { title: 'Formas de Pagamento', description: 'PIX, boleto, cartão, transferência.', icon: Receipt, to: '/finance/payment-methods', status: 'Planejado' },
  { title: 'Lançamentos', description: 'Motor de partidas dobradas.', icon: DollarSign, status: 'ETAPA 08B' },
  { title: 'DRE', description: 'Demonstração do Resultado do Exercício.', icon: FileText, to: '/finance/dre', status: 'Disponível', active: true },
  { title: 'Demonstrações', description: 'BP, DMPL, DLPA, DVA.', icon: Settings, status: 'ETAPA 08F-08G' },
  { title: 'Ativos e Bens', description: 'Registro patrimonial, vida útil e depreciação gerencial.', icon: Warehouse, to: '/finance/assets', status: 'Disponível', active: true },
  { title: 'Balanço Patrimonial', description: 'Posição patrimonial consolidada por grupo contábil.', icon: PieChart, to: '/finance/balance-sheet', status: 'Disponível', active: true },
  { title: 'DMPL', description: 'Demonstração das Mutações do Patrimônio Líquido.', icon: FileText, to: '/finance/dmpl', status: 'Disponível', active: true },
  { title: 'DLPA', description: 'Demonstração de Lucros ou Prejuízos Acumulados.', icon: FileText, to: '/finance/dlpa', status: 'Disponível', active: true },
  { title: 'DVA', description: 'Demonstração do Valor Adicionado.', icon: FileText, to: '/finance/dva', status: 'Disponível', active: true },
  { title: 'Ajustes Contábeis', description: 'Lançamentos manuais de ajuste.', icon: Settings, to: '/finance/adjustments', status: 'Disponível', active: true },
  { title: 'Notas Gerenciais', description: 'Notas explicativas vinculadas às demonstrações.', icon: FileText, to: '/finance/notes', status: 'Disponível', active: true },
]

export default function FinancePage() {
  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <Badge className="mb-4">Módulo Financeiro</Badge>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Financeiro</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600">
            Fundação contábil-gerencial. Plano de contas, centros de custo, linhas de serviço e categorias com mapeamento para partidas dobradas.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <strong>Aviso gerencial:</strong> As demonstrações e classificações para escrituração oficial devem ser conciliadas e validadas pela contabilidade responsável.
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
