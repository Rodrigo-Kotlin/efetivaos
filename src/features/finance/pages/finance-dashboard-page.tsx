import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, ArrowDownRight, ArrowLeftRight, List } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFinancialDashboard } from '../queries/finance-queries'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const pct = (v: number) => `${v.toFixed(1)}%`

const PRESETS = [
  { label: 'Este mes', from: () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10), to: () => new Date().toISOString().slice(0, 10) },
  { label: 'Mes anterior', from: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }, to: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10) } },
  { label: 'Este trimestre', from: () => { const q = Math.floor(new Date().getMonth() / 3); return new Date(new Date().getFullYear(), q * 3, 1).toISOString().slice(0, 10) }, to: () => new Date().toISOString().slice(0, 10) },
  { label: 'Este ano', from: () => `${new Date().getFullYear()}-01-01`, to: () => new Date().toISOString().slice(0, 10) },
]

function Skeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  )
}

function KpiCard({ label, value, variant = 'default', subtitle }: { label: string; value: string; variant?: 'default' | 'warning' | 'danger' | 'success'; subtitle?: string }) {
  const colors = {
    default: 'border-slate-200 bg-white',
    warning: 'border-amber-200 bg-amber-50',
    danger: 'border-red-200 bg-red-50',
    success: 'border-emerald-200 bg-emerald-50',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[variant]}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-slate-900">{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-serif text-lg font-semibold text-slate-800">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function StatementLinks() {
  const links = [
    { to: '/finance/dre', label: 'DRE', desc: 'Demonstração do Resultado' },
    { to: '/finance/cash-flow-statement', label: 'DFC', desc: 'Demonstração dos Fluxos de Caixa' },
    { to: '/finance/balance-sheet', label: 'Balanço Patrimonial', desc: 'Posição patrimonial' },
    { to: '/finance/dmpl', label: 'DMPL', desc: 'Mutacoes do PL' },
    { to: '/finance/dlpa', label: 'DLPA', desc: 'Lucros/Prejuizos Acumulados' },
    { to: '/finance/dva', label: 'DVA', desc: 'Demonstração do Valor Adicionado' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {links.map(l => (
        <Link
          key={l.to}
          to={l.to}
          className="group rounded-lg border border-slate-200 p-3 transition hover:border-emerald-300 hover:bg-emerald-50"
        >
          <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700">{l.label}</span>
          <span className="mt-0.5 block text-xs text-slate-500">{l.desc}</span>
        </Link>
      ))}
    </div>
  )
}

export default function FinanceDashboardPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [asOf, setAsOf] = useState('')
  const [activePreset, setActivePreset] = useState<number | null>(0)
  const navigate = useNavigate()

  const filters = useMemo(() => ({
    from: dateFrom || null,
    to: dateTo || null,
    asOfDate: asOf || null,
  }), [dateFrom, dateTo, asOf])

  const { data: dash, isLoading, isError } = useFinancialDashboard(filters)

  const applyPreset = (idx: number) => {
    const p = PRESETS[idx]
    setDateFrom(p.from())
    setDateTo(p.to())
    setAsOf('')
    setActivePreset(idx)
  }

  const clearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setAsOf('')
    setActivePreset(0)
  }

  if (isLoading) return <Skeleton />

  if (isError || !dash) {
    return (
      <div className="mx-auto max-w-[1480px] p-6">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Financeiro 360</h1>
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-800">Nao foi possivel carregar o dashboard financeiro.</p>
          <Button variant="outline" className="mt-3" onClick={clearFilters}>Tentar novamente</Button>
        </div>
      </div>
    )
  }

  const cf = dash.cashflow
  const ar = dash.receivables
  const ap = dash.payables
  const is = dash.income_statement
  const bs = dash.balance_sheet

  const alerts: { level: 'critical' | 'warning'; text: string }[] = []
  if (ar.overdue > 0) alerts.push({ level: 'warning', text: `Recebíveis vencidos: ${fmt(ar.overdue)}` })
  if (ap.overdue > 0) alerts.push({ level: 'warning', text: `Pagáveis vencidos: ${fmt(ap.overdue)}` })
  if (cf.projected_balance < 0) alerts.push({ level: 'critical', text: `Saldo projetado negativo: ${fmt(cf.projected_balance)}` })
  if (bs.current_ratio > 0 && bs.current_ratio < 1) alerts.push({ level: 'warning', text: `Liquidez corrente abaixo de 1: ${bs.current_ratio.toFixed(2)}` })
  if (is.net_result < 0) alerts.push({ level: 'warning', text: `Resultado líquido negativo: ${fmt(is.net_result)}` })

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Financeiro 360</h1>
        <p className="mt-1 text-sm text-slate-500">
          Visão consolidada de caixa, resultado, obrigações e posição patrimonial.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => navigate('/finance/transactions?create=RECEITA')}><Plus className="mr-1 size-3.5" />+ Receita</Button>
        <Button size="sm" variant="outline" onClick={() => navigate('/finance/transactions?create=DESPESA')}><ArrowDownRight className="mr-1 size-3.5" />+ Despesa</Button>
        <Button size="sm" variant="outline" onClick={() => navigate('/finance/transactions?create=TRANSFERENCIA')}><ArrowLeftRight className="mr-1 size-3.5" />Transferir</Button>
        <Button size="sm" variant="ghost" onClick={() => navigate('/finance/transactions')}><List className="mr-1 size-3.5" />Ver lançamentos</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {PRESETS.map((p, i) => (
            <Button
              key={p.label}
              variant={activePreset === i ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyPreset(i)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">De:</span>
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActivePreset(null) }} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Ate:</span>
          <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActivePreset(null) }} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Posição:</span>
          <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="w-36" />
        </div>
        {(dateFrom || dateTo || asOf) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
        )}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              a.level === 'critical' ? 'border-red-300 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}>
              {a.text}
            </div>
          ))}
        </div>
      )}

      {/* KPIs Row 1: Caixa + Resultado */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Caixa Atual" value={fmt(cf.closing_balance)} />
        <KpiCard label="Resultado Líquido" value={fmt(is.net_result)} variant={is.net_result < 0 ? 'danger' : 'default'} />
        <KpiCard label="Receita Líquida" value={fmt(is.net_revenue)} />
        <KpiCard label="EBITDA" value={fmt(is.ebitda)} subtitle={`Margem: ${pct(is.margin_ebitda)}`} />
      </div>

      {/* KPIs Row 2: Margens + Indicadores */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Margem EBITDA" value={pct(is.margin_ebitda)} variant={is.margin_ebitda < 0 ? 'danger' : is.margin_ebitda > 10 ? 'success' : 'default'} />
        <KpiCard label="Margem Líquida" value={pct(is.margin_net)} variant={is.margin_net < 0 ? 'danger' : 'default'} />
        <KpiCard label="Liquidez Corrente" value={bs.current_ratio.toFixed(2)} variant={bs.current_ratio > 0 && bs.current_ratio < 1 ? 'warning' : 'default'} />
        <KpiCard label="Endividamento" value={bs.leverage.toFixed(2)} subtitle="Passivo / PL" />
      </div>

      {/* Caixa + Receber/Pagar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section title="Fluxo de Caixa">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Saldo inicial</span><span className="font-medium">{fmt(cf.opening_balance)}</span></div>
            <div className="flex justify-between text-emerald-700"><span>Entradas realizadas</span><span className="font-medium">{fmt(cf.realized_inflows)}</span></div>
            <div className="flex justify-between text-red-700"><span>Saídas realizadas</span><span className="font-medium">{fmt(cf.realized_outflows)}</span></div>
            <div className="border-t pt-2 font-medium"><span>Saldo realizado</span><span>{fmt(cf.closing_balance)}</span></div>
            <div className="flex justify-between text-emerald-600"><span>Entradas previstas</span><span>{fmt(cf.projected_inflows)}</span></div>
            <div className="flex justify-between text-red-600"><span>Saídas previstas</span><span>{fmt(cf.projected_outflows)}</span></div>
            <div className="border-t pt-2 font-semibold"><span>Saldo projetado</span><span className={cf.projected_balance < 0 ? 'text-red-700' : ''}>{fmt(cf.projected_balance)}</span></div>
          </div>
        </Section>

        <Section title="Contas a Receber">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Em aberto</span><span className="font-medium">{fmt(ar.open)}</span></div>
            <div className="flex justify-between"><span className="text-red-600">Vencidos</span><span className="font-medium text-red-700">{fmt(ar.overdue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Vence em 7 dias</span><span>{fmt(ar.due_in_7_days)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Vence em 30 dias</span><span>{fmt(ar.due_in_30_days)}</span></div>
          </div>
          <Link to="/finance/transactions" className="mt-3 block text-xs font-medium text-emerald-700 hover:underline">
            Ver lançamentos &rarr;
          </Link>
        </Section>

        <Section title="Contas a Pagar">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Em aberto</span><span className="font-medium">{fmt(ap.open)}</span></div>
            <div className="flex justify-between"><span className="text-red-600">Vencidos</span><span className="font-medium text-red-700">{fmt(ap.overdue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Vence em 7 dias</span><span>{fmt(ap.due_in_7_days)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Vence em 30 dias</span><span>{fmt(ap.due_in_30_days)}</span></div>
          </div>
          <Link to="/finance/transactions" className="mt-3 block text-xs font-medium text-emerald-700 hover:underline">
            Ver lançamentos &rarr;
          </Link>
        </Section>
      </div>

      {/* Resultado + Patrimonio */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Resultado do Período">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Receita Bruta</span><span>{fmt(is.revenue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">(-) Deduções</span><span>{fmt(is.revenue_deductions)}</span></div>
            <div className="flex justify-between font-medium"><span>Receita Líquida</span><span>{fmt(is.net_revenue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">(-) Custos dos Serviços</span><span>{fmt(is.cogs)}</span></div>
            <div className="flex justify-between font-medium"><span>Lucro Bruto</span><span>{fmt(is.gross_profit)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">(-) Despesas Operacionais</span><span>{fmt(is.opex)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">(-) Depreciacao</span><span>{fmt(is.depreciation)}</span></div>
            <div className="flex justify-between font-medium border-t pt-1"><span>EBITDA</span><span>{fmt(is.ebitda)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Resultado Financeiro</span><span>{fmt(is.financial_result)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">(-) Impostos</span><span>{fmt(is.tax)}</span></div>
            <div className="flex justify-between border-t pt-1 font-semibold text-lg"><span>Resultado Líquido</span><span className={is.net_result < 0 ? 'text-red-700' : 'text-emerald-700'}>{fmt(is.net_result)}</span></div>
          </div>
        </Section>

        <Section title="Posição Patrimonial">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Ativo Total</span><span className="font-medium">{fmt(bs.total_assets)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Passivo Circulante</span><span>{fmt(bs.current_liabilities)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Passivo Não Circulante</span><span>{fmt(bs.non_current_liabilities)}</span></div>
            <div className="flex justify-between font-medium"><span>Passivo Total</span><span>{fmt(bs.total_liabilities)}</span></div>
            <div className="flex justify-between font-medium border-t pt-1"><span>Patrimônio Líquido</span><span>{fmt(bs.equity)}</span></div>
            <div className="flex justify-between border-t pt-1"><span>Capital Circulante Líquido</span><span className={bs.working_capital < 0 ? 'text-red-700 font-medium' : 'font-medium'}>{fmt(bs.working_capital)}</span></div>
            <div className="flex justify-between"><span>Liquidez Corrente</span><span className={bs.current_ratio > 0 && bs.current_ratio < 1 ? 'text-amber-700 font-medium' : 'font-medium'}>{bs.current_ratio.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Endividamento Geral</span><span>{bs.leverage.toFixed(2)}</span></div>
          </div>
        </Section>
      </div>

      {/* Statement Shortcuts */}
      <Section title="Demonstrações Financeiras">
        <StatementLinks />
      </Section>
    </div>
  )
}
