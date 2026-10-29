import { useId, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, ArrowDownRight, ArrowLeftRight, List, CalendarDays, Wallet, TrendingUp, TrendingDown, Activity, Scale, CircleDollarSign, CircleHelp, ChevronDown, AlertTriangle } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CashflowRealizedRow } from '@/types/database'
import { toFiniteMoney } from '../api/finance-api'
import { useCashflowRealized, useExpenseComposition, useFinancialDashboard, usePayables, useReceivables, useTransactions } from '../queries/finance-queries'
import { ExpenseCompositionChart } from '../components/expense-composition-chart'
import { FinancialMovementsList } from '../components/financial-movements-list'
import { DashboardCollectionPreview } from '../components/dashboard-collection-preview'

const fmt = (v: unknown) => {
  const value = toFiniteMoney(v)
  return value === null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const pct = (v: number) => `${v.toFixed(1)}%`

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

type Period = { year: number; month: number }

function currentPeriod(): Period {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function readPeriod(params: URLSearchParams): Period {
  const fallback = currentPeriod()
  const year = Number(params.get('year'))
  const month = Number(params.get('month'))
  return Number.isInteger(year) && year >= 2000 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12
    ? { year, month }
    : fallback
}

function periodDates(period: Period) {
  const month = String(period.month).padStart(2, '0')
  const lastDay = new Date(period.year, period.month, 0).getDate()
  const today = new Date()
  const isCurrentMonth = period.year === today.getFullYear() && period.month === today.getMonth() + 1
  const endDate = isCurrentMonth ? localDate(today) : `${period.year}-${month}-${String(lastDay).padStart(2, '0')}`
  return {
    from: `${period.year}-${month}-01`,
    to: endDate,
  }
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const YEAR_OPTIONS = Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 3 + index)

function previousPeriod(period: Period): Period {
  const previous = new Date(period.year, period.month - 2, 1)
  return { year: previous.getFullYear(), month: previous.getMonth() + 1 }
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function comparisonLabel(current: number | null, previous: number | null): string {
  if (current === null || previous === null || previous === 0 || (current < 0 && previous > 0) || (current > 0 && previous < 0)) return '— vs mês anterior'
  return `${((current - previous) / Math.abs(previous) * 100).toFixed(1)}% vs mês anterior`
}

type KpiVariant = 'cash' | 'revenue' | 'net-revenue' | 'cost' | 'expense' | 'profit-positive' | 'profit-negative' | 'profit-neutral' | 'analytics' | 'margin' | 'margin-secondary' | 'liquidity'

function resultVariant(value: number): KpiVariant {
  if (value > 0) return 'profit-positive'
  if (value < 0) return 'profit-negative'
  return 'profit-neutral'
}

type DailyCashflowPoint = {
  date: string
  inflows: number
  outflows: number
  balance: number | null
}

function buildDailyCashflow(rows: CashflowRealizedRow[], openingBalance: number | null): DailyCashflowPoint[] {
  const grouped = new Map<string, { inflows: number; outflows: number }>()

  for (const row of rows) {
    const amount = Math.abs(Number(row.amount))
    if (!row.entry_date || !Number.isFinite(amount)) continue
    const current = grouped.get(row.entry_date) ?? { inflows: 0, outflows: 0 }
    if (row.direction === 'INFLOW') current.inflows += amount
    if (row.direction === 'OUTFLOW') current.outflows += amount
    grouped.set(row.entry_date, current)
  }

  let balance = openingBalance
  return Array.from(grouped.entries())
    .sort(([left], [right]) => new Date(left + 'T00:00:00').getTime() - new Date(right + 'T00:00:00').getTime())
    .map(([date, values]) => {
      if (balance !== null) balance += values.inflows - values.outflows
      return { date, ...values, balance }
    })
}

function CashflowChart({ rows, openingBalance, isLoading, isError }: {
  rows?: CashflowRealizedRow[]
  openingBalance: number | null
  isLoading: boolean
  isError: boolean
}) {
  const points = useMemo(() => buildDailyCashflow(rows ?? [], openingBalance), [rows, openingBalance])
  const totals = useMemo(() => points.reduce((result, point) => ({
    inflows: result.inflows + point.inflows,
    outflows: result.outflows + point.outflows,
  }), { inflows: 0, outflows: 0 }), [points])

  if (isLoading) {
    return <div aria-label="Carregando fluxo de caixa" className="h-[280px] animate-pulse rounded-lg bg-slate-100" />
  }

  if (isError) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Erro ao carregar o fluxo de caixa realizado.</div>
  }

  if (!rows?.length) {
    return <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Nenhuma movimentação realizada encontrada para este período.</div>
  }

  return (
    <div className="min-w-0 space-y-3">
      <div
        role="img"
        aria-label="Gráfico de fluxo de caixa com entradas e saídas realizadas no período selecionado."
        className="h-[280px] w-full min-w-0"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="#E3EAE6" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={24} tick={{ fontSize: 11, fill: '#64748B' }} />
            <YAxis tickFormatter={value => fmt(Number(value))} width={88} tick={{ fontSize: 11, fill: '#64748B' }} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const labels: Record<string, { label: string; color: string }> = {
                  inflows: { label: 'Entradas', color: '#16A34A' },
                  outflows: { label: 'Saídas', color: '#DC2626' },
                  balance: { label: 'Saldo', color: '#2563EB' },
                }
                return (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                    <p className="mb-1 font-semibold text-slate-800">Data: {formatDate(String(label))}</p>
                    <div className="space-y-1">
                      {payload.map(item => {
                        const tone = labels[String(item.dataKey)] ?? { label: String(item.dataKey), color: '#475569' }
                        return (
                          <div key={String(item.dataKey)} className="flex items-center justify-between gap-5">
                            <span className="flex items-center gap-1.5 text-slate-600"><span className="size-2 rounded-full" style={{ backgroundColor: tone.color }} aria-hidden="true" />{tone.label}</span>
                            <strong className="tabular-nums text-slate-900">{fmt(Number(item.value ?? 0))}</strong>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={value => value === 'inflows' ? 'Entradas' : value === 'outflows' ? 'Saídas' : 'Saldo'} />
            <Bar dataKey="inflows" name="inflows" fill="#16A34A" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="outflows" name="outflows" fill="#DC2626" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Line type="monotone" dataKey="balance" name="balance" stroke="#2563EB" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">
        Entradas realizadas no gráfico: {fmt(totals.inflows)}. Saídas realizadas no gráfico: {fmt(totals.outflows)}. Saldo inicial: {fmt(openingBalance)}. Saldo final: {fmt(points.at(-1)?.balance ?? openingBalance)}.
      </p>
    </div>
  )
}

const PRESETS = [
  { label: 'Este mês', from: () => { const d = new Date(); return localDate(new Date(d.getFullYear(), d.getMonth(), 1)) }, to: () => localDate(new Date()) },
  { label: 'Mês anterior', from: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return localDate(new Date(d.getFullYear(), d.getMonth(), 1)) }, to: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return localDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) } },
  { label: 'Este trimestre', from: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3); return localDate(new Date(d.getFullYear(), q * 3, 1)) }, to: () => localDate(new Date()) },
  { label: 'Este ano', from: () => `${new Date().getFullYear()}-01-01`, to: () => localDate(new Date()) },
]

function Skeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  )
}

function KpiTooltip({ label, description }: { label: string; description: string }) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`Informação sobre ${label}`}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onKeyDown={event => {
          if (event.key === 'Escape') setOpen(false)
        }}
        className="rounded-full p-0.5 text-slate-400 outline-none transition hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-700/40"
      >
        <CircleHelp className="size-3.5" aria-hidden="true" />
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute right-0 top-full z-20 mt-2 w-56 rounded-md bg-slate-800 px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-white shadow-lg"
        >
          {description}
        </span>
      )}
    </span>
  )
}

function KpiCard({ label, value, variant = 'cash', subtitle, comparison, icon, description }: {
  label: string
  value: string
  variant?: KpiVariant
  subtitle?: string
  comparison?: string
  icon?: React.ReactNode
  description: string
}) {
  const colors: Record<KpiVariant, { card: string; icon: string; value: string }> = {
    cash: { card: 'border border-blue-200 border-t-2 border-t-blue-600 bg-blue-50/30', icon: 'bg-blue-50 text-blue-700', value: 'text-slate-900' },
    revenue: { card: 'border border-emerald-200 border-t-2 border-t-emerald-600 bg-emerald-50/30', icon: 'bg-emerald-50 text-emerald-700', value: 'text-slate-900' },
    'net-revenue': { card: 'border border-teal-200 border-t-2 border-t-teal-600 bg-teal-50/30', icon: 'bg-teal-50 text-teal-700', value: 'text-slate-900' },
    cost: { card: 'border border-amber-200 border-t-2 border-t-amber-600 bg-amber-50/30', icon: 'bg-amber-50 text-amber-700', value: 'text-slate-900' },
    expense: { card: 'border border-red-200 border-t-2 border-t-red-600 bg-red-50/30', icon: 'bg-red-50 text-red-700', value: 'text-slate-900' },
    'profit-positive': { card: 'border border-emerald-200 border-t-2 border-t-emerald-600 bg-emerald-50/30', icon: 'bg-emerald-50 text-emerald-700', value: 'text-emerald-700' },
    'profit-negative': { card: 'border border-red-200 border-t-2 border-t-red-600 bg-red-50/30', icon: 'bg-red-50 text-red-700', value: 'text-red-700' },
    'profit-neutral': { card: 'border border-slate-200 border-t-2 border-t-slate-500 bg-slate-50', icon: 'bg-slate-100 text-slate-600', value: 'text-slate-700' },
    analytics: { card: 'border border-indigo-200 border-t-2 border-t-indigo-600 bg-indigo-50/30', icon: 'bg-indigo-50 text-indigo-700', value: 'text-slate-900' },
    margin: { card: 'border border-violet-200 border-t-2 border-t-violet-600 bg-violet-50/30', icon: 'bg-violet-50 text-violet-700', value: 'text-slate-900' },
    'margin-secondary': { card: 'border border-purple-200 border-t-2 border-t-purple-600 bg-purple-50/30', icon: 'bg-purple-50 text-purple-700', value: 'text-slate-900' },
    liquidity: { card: 'border border-cyan-200 border-t-2 border-t-cyan-600 bg-cyan-50/30', icon: 'bg-cyan-50 text-cyan-700', value: 'text-slate-900' },
  }
  const color = colors[variant]
  return (
    <div className={`min-w-0 rounded-xl p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${color.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">{label}</p>
          <KpiTooltip label={label} description={description} />
        </div>
        {icon && <span className={`rounded-lg p-2 ${color.icon}`} aria-hidden="true">{icon}</span>}
      </div>
      <p className={`mt-3 min-w-0 whitespace-nowrap font-serif text-xl font-semibold tabular-nums sm:text-2xl ${color.value}`}>{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      {comparison && <p className="mt-2 text-xs font-medium text-slate-500">{comparison}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:border-slate-300 hover:shadow-md sm:p-6">
      <h3 className="font-serif text-lg font-semibold tracking-tight text-slate-800">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function StatementLinks() {
  const links = [
    { to: '/finance/dre', label: 'DRE', desc: 'Demonstração do Resultado', tone: 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 group-hover:text-emerald-700' },
    { to: '/finance/cash-flow-statement', label: 'DFC', desc: 'Demonstração dos Fluxos de Caixa', tone: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50 group-hover:text-blue-700' },
    { to: '/finance/balance-sheet', label: 'Balanço Patrimonial', desc: 'Posição patrimonial', tone: 'border-violet-200 hover:border-violet-400 hover:bg-violet-50 group-hover:text-violet-700' },
    { to: '/finance/dmpl', label: 'DMPL', desc: 'Mutacoes do PL', tone: 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 group-hover:text-indigo-700' },
    { to: '/finance/dlpa', label: 'DLPA', desc: 'Lucros/Prejuizos Acumulados', tone: 'border-amber-200 hover:border-amber-400 hover:bg-amber-50 group-hover:text-amber-700' },
    { to: '/finance/dva', label: 'DVA', desc: 'Demonstração do Valor Adicionado', tone: 'border-cyan-200 hover:border-cyan-400 hover:bg-cyan-50 group-hover:text-cyan-700' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {links.map(l => (
        <Link
          key={l.to}
          to={l.to}
          className={`group rounded-lg border p-3 transition hover:-translate-y-0.5 ${l.tone}`}
        >
          <span className="text-sm font-medium text-slate-700">{l.label}</span>
          <span className="mt-0.5 block text-xs text-slate-500">{l.desc}</span>
        </Link>
      ))}
    </div>
  )
}

export default function FinanceDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [period, setPeriod] = useState<Period | null>(() => readPeriod(searchParams))
  const initialDates = periodDates(period ?? currentPeriod())
  const [dateFrom, setDateFrom] = useState(initialDates.from)
  const [dateTo, setDateTo] = useState(initialDates.to)
  const [asOf, setAsOf] = useState(initialDates.to)
  const [activePreset, setActivePreset] = useState<number | null>(() => searchParams.has('month') ? null : 0)
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)
  const navigate = useNavigate()

  const filters = useMemo(() => ({
    from: dateFrom || null,
    to: dateTo || null,
    asOfDate: asOf || null,
  }), [dateFrom, dateTo, asOf])

  const cashflowFilters = useMemo(() => ({
    from: dateFrom || null,
    to: dateTo || null,
  }), [dateFrom, dateTo])
  const movementFilters = useMemo(() => ({
    page: 1,
    pageSize: 8,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sort: 'transaction_date' as const,
    direction: 'desc' as const,
  }), [dateFrom, dateTo])
  const collectionPreviewFilters = useMemo(() => ({
    page: 1,
    pageSize: 5,
    dueDateFrom: dateFrom || undefined,
    dueDateTo: dateTo || undefined,
    sort: 'due_date' as const,
    direction: 'asc' as const,
  }), [dateFrom, dateTo])

  const previousFilters = period ? periodDates(previousPeriod(period)) : null
  const { data: dash, isLoading, isError } = useFinancialDashboard(filters)
  const { data: realizedCashflow, isLoading: isCashflowLoading, isFetching: isCashflowFetching, isError: isCashflowError } = useCashflowRealized(cashflowFilters)
  const { data: movements, isLoading: isMovementsLoading, isFetching: isMovementsFetching, isError: isMovementsError } = useTransactions(movementFilters)
  const { data: receivables, isLoading: isReceivablesLoading, isFetching: isReceivablesFetching, isError: isReceivablesError } = useReceivables(collectionPreviewFilters)
  const { data: payables, isLoading: isPayablesLoading, isFetching: isPayablesFetching, isError: isPayablesError } = usePayables(collectionPreviewFilters)
  const expenseCompositionFilters = useMemo(() => ({
    from: dateFrom || null,
    to: dateTo || null,
    costCenterId: null,
    serviceLineId: null,
  }), [dateFrom, dateTo])
  const { data: expenseComposition, isLoading: isExpenseCompositionLoading, isFetching: isExpenseCompositionFetching, isError: isExpenseCompositionError } = useExpenseComposition(expenseCompositionFilters)
  const { data: previousDash } = useFinancialDashboard(
    previousFilters ? { ...previousFilters, asOfDate: previousFilters.to } : {},
    { enabled: !!previousFilters },
  )

  const applyPreset = (idx: number) => {
    const p = PRESETS[idx]
    setDateFrom(p.from())
    setDateTo(p.to())
    setAsOf(p.to())
    setActivePreset(idx)
    setPeriod(idx < 2 ? (() => {
      const date = new Date(`${p.from()}T00:00:00`)
      return { year: date.getFullYear(), month: date.getMonth() + 1 }
    })() : null)
  }

  const changePeriod = (next: Period) => {
    const dates = periodDates(next)
    setPeriod(next)
    setDateFrom(dates.from)
    setDateTo(dates.to)
    setAsOf(dates.to)
    setActivePreset(null)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('year', String(next.year))
    nextParams.set('month', String(next.month))
    setSearchParams(nextParams, { replace: true })
  }

  const clearFilters = () => {
    changePeriod(currentPeriod())
    setActivePreset(0)
  }

  const movementsHref = useMemo(() => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    return `/finance/transactions${params.toString() ? `?${params.toString()}` : ''}`
  }, [dateFrom, dateTo])

  if (isLoading) return <Skeleton />

  if (isError || !dash) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[1480px]">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Financeiro 360</h1>
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm font-medium text-red-800">Nao foi possivel carregar o dashboard financeiro.</p>
            <Button variant="outline" className="mt-3" onClick={clearFilters}>Tentar novamente</Button>
          </div>
        </div>
      </div>
    )
  }

  const cf = dash.cashflow
  const ar = dash.receivables
  const ap = dash.payables
  const is = dash.income_statement
  const bs = dash.balance_sheet
  const previousCf = previousDash?.cashflow
  const previousIs = previousDash?.income_statement
  const previousBs = previousDash?.balance_sheet
  const periodReference = dash.period.as_of_date || asOf
  const currentCash = cf.closing_balance
  const currentCosts = Math.abs(is.cogs)
  const currentExpenses = Math.abs(is.opex)
  const currentNetRevenue = is.net_revenue
  const currentNetResult = is.net_result

  const alerts: { level: 'critical' | 'warning'; text: string }[] = []
  if (ar.overdue > 0) alerts.push({ level: 'warning', text: `Recebíveis vencidos: ${fmt(ar.overdue)}` })
  if (ap.overdue > 0) alerts.push({ level: 'warning', text: `Pagáveis vencidos: ${fmt(ap.overdue)}` })
  if (cf.projected_balance !== null && cf.projected_balance < 0) alerts.push({ level: 'critical', text: `Saldo projetado negativo: ${fmt(cf.projected_balance)}` })
  if (bs.current_ratio > 0 && bs.current_ratio < 1) alerts.push({ level: 'warning', text: `Liquidez corrente abaixo de 1: ${bs.current_ratio.toFixed(2)}` })
  if (is.net_result < 0) alerts.push({ level: 'warning', text: `Resultado líquido negativo: ${fmt(is.net_result)}` })

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-[1480px] space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Financeiro 360</h1>
          {period && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{MONTHS[period.month - 1]} {period.year}</span>}
        </div>
        <p className="mt-1 hidden text-sm text-slate-500 sm:block">
          Visão consolidada de caixa, resultado, obrigações e posição patrimonial.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button size="sm" onClick={() => navigate('/finance/transactions?create=RECEITA')}><Plus className="mr-1 size-3.5" />+ Receita</Button>
        <Button size="sm" variant="outline" onClick={() => navigate('/finance/transactions?create=DESPESA')}><ArrowDownRight className="mr-1 size-3.5" />+ Despesa</Button>
        <Button size="sm" variant="outline" onClick={() => navigate('/finance/transactions?create=TRANSFERENCIA')}><ArrowLeftRight className="mr-1 size-3.5" />Transferir</Button>
        <Button size="sm" variant="ghost" onClick={() => navigate('/finance/transactions')}><List className="mr-1 size-3.5" />Ver lançamentos</Button>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex w-full items-end gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-2 sm:w-auto">
            <CalendarDays className="mb-2 size-4 text-emerald-700" aria-hidden="true" />
            <label className="text-xs font-medium text-slate-600">
              Mês
              <select
                aria-label="Mês de referência"
                value={period?.month ?? ''}
                onChange={e => period && changePeriod({ ...period, month: Number(e.target.value) })}
                className="mt-1 block h-9 rounded-md border border-emerald-200 bg-white px-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-700/20"
              >
                {!period && <option value="">Personalizado</option>}
                {MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Ano
              <select
                aria-label="Ano de referência"
                value={period?.year ?? ''}
                onChange={e => period && changePeriod({ ...period, year: Number(e.target.value) })}
                className="mt-1 block h-9 rounded-md border border-emerald-200 bg-white px-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-700/20"
              >
                {!period && <option value="">-</option>}
                {YEAR_OPTIONS.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
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
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={advancedFiltersOpen}
          aria-controls="finance-advanced-filters"
          onClick={() => setAdvancedFiltersOpen(value => !value)}
          className="w-full justify-between sm:w-auto"
        >
          Filtros avançados
          <ChevronDown className={`size-4 transition-transform ${advancedFiltersOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </Button>
        {advancedFiltersOpen && (
          <div id="finance-advanced-filters" className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-2 text-xs text-slate-500">
              De:
              <Input aria-label="Data inicial" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPeriod(null); setActivePreset(null) }} className="w-36 bg-white" />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Até:
              <Input aria-label="Data final" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPeriod(null); setActivePreset(null) }} className="w-36 bg-white" />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Posição:
              <Input aria-label="Data de posição" type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="w-36 bg-white" />
            </label>
            {(dateFrom || dateTo || asOf) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
            )}
          </div>
        )}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} role="alert" className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
              a.level === 'critical' ? 'border-red-300 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}>
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPIs Row 1: Receita e operação */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Saldo Cora"
          value={fmt(currentCash)}
          variant="cash"
          subtitle={`Posição em ${formatDate(periodReference)}`}
          comparison={previousCf ? comparisonLabel(currentCash, previousCf.closing_balance) : undefined}
          icon={<Wallet className="size-4" />}
          description={currentCash === null ? 'Saldo histórico não disponível para este período.' : 'Saldo da conta Cora no encerramento do período selecionado.'}
        />
        <KpiCard
          label="Receita Bruta"
          value={fmt(is.revenue)}
          variant="revenue"
          comparison={previousIs ? comparisonLabel(is.revenue, previousIs.revenue) : undefined}
          icon={<TrendingUp className="size-4" />}
          description="Receita Bruta da DRE oficial no período selecionado."
        />
        <KpiCard
          label="Receita Líquida"
          value={fmt(currentNetRevenue)}
          variant="net-revenue"
          comparison={previousIs ? comparisonLabel(currentNetRevenue, previousIs.net_revenue) : undefined}
          icon={<Activity className="size-4" />}
          description="Receita Bruta menos deduções da receita na DRE oficial."
        />
        <KpiCard
          label="Custos"
          value={fmt(currentCosts)}
          variant="cost"
          comparison={previousIs ? comparisonLabel(currentCosts, Math.abs(previousIs.cogs)) : undefined}
          icon={<TrendingDown className="size-4" />}
          description="Custos dos Serviços Prestados na apresentação oficial da DRE."
        />
        <KpiCard
          label="Despesas"
          value={fmt(currentExpenses)}
          variant="expense"
          comparison={previousIs ? comparisonLabel(currentExpenses, Math.abs(previousIs.opex)) : undefined}
          icon={<TrendingDown className="size-4" />}
          description="Despesas Operacionais na apresentação oficial da DRE."
        />
      </div>

      {/* KPIs Row 2: Resultado e indicadores suportados */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Resultado Líquido"
          value={fmt(currentNetResult)}
          variant={resultVariant(currentNetResult)}
          comparison={previousIs ? comparisonLabel(currentNetResult, previousIs.net_result) : undefined}
          icon={<CircleDollarSign className="size-4" />}
          description="Resultado da DRE oficial no período selecionado."
        />
        <KpiCard
          label="EBITDA"
          value={fmt(is.ebitda)}
          variant="analytics"
          subtitle={`Margem: ${pct(is.margin_ebitda)}`}
          comparison={previousIs ? comparisonLabel(is.ebitda, previousIs.ebitda) : undefined}
          icon={<Activity className="size-4" />}
          description="EBITDA Gerencial da DRE oficial no período selecionado."
        />
        <KpiCard
          label="Margem EBITDA"
          value={pct(is.margin_ebitda)}
          variant="margin"
          comparison={previousIs ? comparisonLabel(is.margin_ebitda, previousIs.margin_ebitda) : undefined}
          icon={<TrendingUp className="size-4" />}
          description="EBITDA dividido pela Receita Líquida, conforme a DRE oficial."
        />
        <KpiCard
          label="Margem Líquida"
          value={pct(is.margin_net)}
          variant="margin-secondary"
          comparison={previousIs ? comparisonLabel(is.margin_net, previousIs.margin_net) : undefined}
          icon={<TrendingUp className="size-4" />}
          description="Resultado Líquido dividido pela Receita Líquida, conforme a DRE oficial."
        />
        <KpiCard
          label="Liquidez Corrente"
          value={bs.current_ratio.toFixed(2)}
          variant="liquidity"
          comparison={previousBs ? comparisonLabel(bs.current_ratio, previousBs.current_ratio) : undefined}
          icon={<Scale className="size-4" />}
          description="Ativo Circulante dividido pelo Passivo Circulante no BP até a data de referência."
        />
      </div>

      <Section title="Resumo do Fluxo de Caixa">
        <div className="grid gap-5 text-sm md:grid-cols-2 md:gap-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Realizado</p>
            <div className="flex justify-between gap-4"><span className="text-slate-600">Saldo inicial</span><span className="font-medium tabular-nums text-blue-700">{fmt(cf.opening_balance)}</span></div>
            <div className="flex justify-between gap-4 text-emerald-700"><span>Entradas realizadas</span><span className="font-medium tabular-nums">{fmt(cf.realized_inflows)}</span></div>
            <div className="flex justify-between gap-4 text-red-700"><span>Saídas realizadas</span><span className="font-medium tabular-nums">{fmt(cf.realized_outflows)}</span></div>
            <div className="flex justify-between gap-4 border-t border-blue-100 pt-3 font-semibold"><span>Saldo realizado</span><span className="tabular-nums text-blue-700">{fmt(cf.closing_balance)}</span></div>
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-4 md:border-l md:border-t-0 md:pl-8 md:pt-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Projetado</p>
            <div className="flex justify-between gap-4 text-emerald-600"><span>Entradas previstas</span><span className="tabular-nums">{fmt(cf.projected_inflows)}</span></div>
            <div className="flex justify-between gap-4 text-red-600"><span>Saídas previstas</span><span className="tabular-nums">{fmt(cf.projected_outflows)}</span></div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 font-semibold"><span>Saldo projetado</span><span className={`tabular-nums ${cf.projected_balance !== null && cf.projected_balance < 0 ? 'text-red-700' : 'text-blue-700'}`}>{fmt(cf.projected_balance)}</span></div>
          </div>
        </div>
      </Section>

      <Section title="Fluxo de Caixa">
        <p className="mb-4 text-sm text-slate-500">Entradas, saídas e evolução do saldo no período selecionado.</p>
        <CashflowChart
          rows={realizedCashflow}
          openingBalance={cf.opening_balance}
          isLoading={isCashflowLoading || isCashflowFetching}
          isError={isCashflowError}
        />
      </Section>

      <Section title="Composição das Despesas">
        <p className="mb-4 text-sm text-slate-500">Distribuição das despesas operacionais por conta contábil no período selecionado.</p>
        <ExpenseCompositionChart
          rows={expenseComposition}
          isLoading={isExpenseCompositionLoading || isExpenseCompositionFetching}
          isError={isExpenseCompositionError}
        />
      </Section>

      <Section title="Movimentações Financeiras">
        <p className="mb-4 text-sm text-slate-500">Últimos lançamentos do período selecionado.</p>
        <FinancialMovementsList
          rows={movements?.rows}
          isLoading={isMovementsLoading || isMovementsFetching}
          isError={isMovementsError}
          viewHref={movementsHref}
        />
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Contas a Receber">
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
             <div><p className="text-xs text-blue-600">Em aberto</p><p className="font-semibold text-blue-700">{fmt(ar.open)}</p></div>
            <div><p className="text-xs text-red-600">Vencidos</p><p className="font-semibold text-red-700">{fmt(ar.overdue)}</p></div>
          </div>
          <DashboardCollectionPreview rows={receivables?.rows} isLoading={isReceivablesLoading || isReceivablesFetching} isError={isReceivablesError} emptyMessage="Nenhuma conta a receber neste período." errorMessage="Erro ao carregar as contas a receber." viewHref="/finance/receivables" viewLabel="Ver contas a receber" />
        </Section>

        <Section title="Contas a Pagar">
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
             <div><p className="text-xs text-blue-600">Em aberto</p><p className="font-semibold text-blue-700">{fmt(ap.open)}</p></div>
            <div><p className="text-xs text-red-600">Vencidos</p><p className="font-semibold text-red-700">{fmt(ap.overdue)}</p></div>
          </div>
          <DashboardCollectionPreview rows={payables?.rows} isLoading={isPayablesLoading || isPayablesFetching} isError={isPayablesError} emptyMessage="Nenhuma conta a pagar neste período." errorMessage="Erro ao carregar as contas a pagar." viewHref="/finance/payables" viewLabel="Ver contas a pagar" />
        </Section>
      </div>

      {/* Resultado + Patrimonio */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Resultado do Período">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-emerald-700">Receita Bruta</span><span className="text-emerald-700">{fmt(is.revenue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">(-) Deduções</span><span>{fmt(is.revenue_deductions)}</span></div>
            <div className="flex justify-between font-medium"><span className="text-teal-700">Receita Líquida</span><span className="text-teal-700">{fmt(is.net_revenue)}</span></div>
            <div className="flex justify-between"><span className="text-amber-700">(-) Custos dos Serviços</span><span className="text-amber-700">{fmt(is.cogs)}</span></div>
            <div className="flex justify-between font-medium"><span>Lucro Bruto</span><span>{fmt(is.gross_profit)}</span></div>
            <div className="flex justify-between"><span className="text-red-700">(-) Despesas Operacionais</span><span className="text-red-700">{fmt(is.opex)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">(-) Depreciacao</span><span>{fmt(is.depreciation)}</span></div>
            <div className="flex justify-between font-medium border-t border-indigo-100 pt-1"><span className="text-indigo-700">EBITDA</span><span className="text-indigo-700">{fmt(is.ebitda)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Resultado Financeiro</span><span>{fmt(is.financial_result)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">(-) Impostos</span><span>{fmt(is.tax)}</span></div>
            <div className="-mx-2 mt-2 flex justify-between rounded-lg border-t border-slate-200 bg-slate-50/70 px-2 pt-3 text-lg font-semibold"><span>Resultado Líquido</span><span className={is.net_result > 0 ? 'text-emerald-700' : is.net_result < 0 ? 'text-red-700' : 'text-slate-600'}>{fmt(is.net_result)}</span></div>
          </div>
        </Section>

        <Section title="Posição Patrimonial">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between rounded-lg bg-cyan-50/50 px-2 py-1"><span className="font-medium text-cyan-700">Ativo Total</span><span className="font-semibold text-cyan-700">{fmt(bs.total_assets)}</span></div>
            <div className="flex justify-between"><span className="text-amber-700">Passivo Circulante</span><span>{fmt(bs.current_liabilities)}</span></div>
            <div className="flex justify-between"><span className="text-amber-700">Passivo Não Circulante</span><span>{fmt(bs.non_current_liabilities)}</span></div>
            <div className="flex justify-between font-medium"><span>Passivo Total</span><span>{fmt(bs.total_liabilities)}</span></div>
            <div className="flex justify-between rounded-lg border-t border-violet-100 bg-violet-50/40 px-2 pt-3 font-semibold"><span className="text-violet-700">Patrimônio Líquido</span><span className="text-violet-700">{fmt(bs.equity)}</span></div>
            <div className="flex justify-between border-t pt-1"><span>Capital Circulante Líquido</span><span className={bs.working_capital < 0 ? 'text-red-700 font-medium' : 'font-medium'}>{fmt(bs.working_capital)}</span></div>
            <div className="flex justify-between"><span className="text-cyan-700">Liquidez Corrente</span><span className={bs.current_ratio > 0 && bs.current_ratio < 1 ? 'text-amber-700 font-medium' : 'font-medium text-cyan-700'}>{bs.current_ratio.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Endividamento Geral</span><span>{bs.leverage.toFixed(2)}</span></div>
          </div>
        </Section>
      </div>

      {/* Statement Shortcuts */}
      <Section title="Demonstrações Financeiras">
        <StatementLinks />
      </Section>
      </div>
    </div>
  )
}
