import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Wallet, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCashflowRealized, useCashflowForecast, useCashflow13Weeks, useCashflowSummary } from '../queries/finance-queries'
import type { CashflowFilters } from '../api/finance-api'
import { useFinancialAccounts, useCostCenters, useServiceLines } from '../queries/finance-queries'
import { generateStatementPdf, downloadPdf } from '../lib/pdf-utils'

const fmt = (v: string | number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
const fmtDate = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-'

type Tab = 'realizado' | 'projetado' | 'semanas'

export default function CashflowPage() {
  const [tab, setTab] = useState<Tab>('realizado')
  const [filters, setFilters] = useState<CashflowFilters>({})
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: accounts } = useFinancialAccounts()
  const { data: costCenters } = useCostCenters()
  const { data: serviceLines } = useServiceLines()

  const effectiveFilters: CashflowFilters = useMemo(() => ({
    ...filters,
    from: dateFrom || null,
    to: dateTo || null,
  }), [filters, dateFrom, dateTo])

  const { data: summary, isLoading: lSummary, isError: eSummary } = useCashflowSummary(effectiveFilters)
  const { data: realized, isLoading: lRealized } = useCashflowRealized(effectiveFilters)
  const { data: forecast, isLoading: lForecast } = useCashflowForecast(effectiveFilters)
  const { data: weeks, isLoading: lWeeks } = useCashflow13Weeks(dateFrom || null)

  // COR-17: quick presets
  const applyPreset = (preset: 'today' | 'month' | 'year' | 'total') => {
    const today = new Date().toISOString().slice(0, 10)
    const firstOfMonth = today.slice(0, 7) + '-01'
    const firstOfYear = today.slice(0, 4) + '-01-01'
    switch (preset) {
      case 'today': setDateFrom(today); setDateTo(today); break
      case 'month': setDateFrom(firstOfMonth); setDateTo(today); break
      case 'year': setDateFrom(firstOfYear); setDateTo(today); break
      case 'total': setDateFrom(''); setDateTo(''); break
    }
  }

  const applyFilter = (key: keyof CashflowFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value || null }))
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'realizado', label: 'Realizado' },
    { key: 'projetado', label: 'Projetado' },
    { key: 'semanas', label: '13 Semanas' },
  ]

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Fluxo de Caixa</h1>
        <p className="mt-1 text-sm text-slate-500">
          Movimentacoes realizadas, compromissos previstos e projecao financeira.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* COR-17: quick presets */}
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => applyPreset('today')}>Hoje</Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset('month')}>Mes</Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset('year')}>Ano</Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset('total')}>Total</Button>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">De</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[150px]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Ate</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[150px]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Conta</label>
          <select
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
            value={filters.financialAccountId ?? ''}
            onChange={e => applyFilter('financialAccountId', e.target.value)}
          >
            <option value="">Todas</option>
            {accounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Centro de Custo</label>
          <select
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
            value={filters.costCenterId ?? ''}
            onChange={e => applyFilter('costCenterId', e.target.value)}
          >
            <option value="">Todos</option>
            {costCenters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Linha de Servico</label>
          <select
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
            value={filters.serviceLineId ?? ''}
            onChange={e => applyFilter('serviceLineId', e.target.value)}
          >
            <option value="">Todas</option>
            {serviceLines?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setFilters({}); setDateFrom(''); setDateTo('') }}>
          Limpar
        </Button>
        {realized?.length ? (
          <Button variant="outline" size="sm" onClick={() => {
            const period = `${dateFrom || 'início'} a ${dateTo || 'hoje'}`
            const statementRows = realized.map(r => ({ label: r.entry_description, amount: Number(r.amount), bold: false }))
            const doc = generateStatementPdf('Fluxo de Caixa - Realizado', period, statementRows)
            downloadPdf(doc, 'fluxo-de-caixa')
          }}>PDF</Button>
        ) : null}
      </div>

      {/* KPI Cards — all values from backend summary */}
      {eSummary ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar resumo do fluxo de caixa.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <KpiCard
            icon={<Wallet className="h-4 w-4" />}
            label="Saldo Inicial"
            value={lSummary ? null : fmt(summary?.opening_balance ?? 0)}
            loading={lSummary}
          />
          <KpiCard
            icon={<ArrowDownToLine className="h-4 w-4 text-emerald-600" />}
            label="Entradas Realizadas"
            value={lSummary ? null : fmt(summary?.realized_inflows ?? 0)}
            loading={lSummary}
          />
          <KpiCard
            icon={<ArrowUpFromLine className="h-4 w-4 text-red-600" />}
            label="Saídas Realizadas"
            value={lSummary ? null : fmt(summary?.realized_outflows ?? 0)}
            loading={lSummary}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Saldo Final"
            value={lSummary ? null : fmt(summary?.closing_balance ?? 0)}
            loading={lSummary}
            highlight={Number(summary?.closing_balance ?? 0) >= 0}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            label="Entradas Previstas"
            value={lSummary ? null : fmt(summary?.projected_inflows ?? 0)}
            loading={lSummary}
          />
          <KpiCard
            icon={<TrendingDown className="h-4 w-4 text-red-600" />}
            label="Saídas Previstas"
            value={lSummary ? null : fmt(summary?.projected_outflows ?? 0)}
            loading={lSummary}
          />
          <KpiCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Saldo Projetado"
            value={lSummary ? null : fmt(summary?.projected_balance ?? 0)}
            loading={lSummary}
            highlight={Number(summary?.projected_balance ?? 0) >= 0}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'realizado' && (
        <RealizedTable data={realized ?? []} loading={lRealized} />
      )}
      {tab === 'projetado' && (
        <ForecastTable data={forecast ?? []} loading={lForecast} />
      )}
      {tab === 'semanas' && (
        <WeeksTable data={weeks ?? []} loading={lWeeks} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ icon, label, value, highlight, loading }: {
  icon: React.ReactNode; label: string; value: string | null; highlight?: boolean; loading?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}{label}
      </div>
      {loading ? (
        <div className="mt-1 h-6 w-20 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className={`mt-1 text-lg font-semibold ${highlight === false ? 'text-red-600' : highlight ? 'text-emerald-600' : ''}`}>
          {value ?? '-'}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Realized Table
// ---------------------------------------------------------------------------

function RealizedTable({ data, loading }: { data: { entry_date: string; direction: string; dfc_class: string; entry_description: string; party_name: string | null; cash_accounts: string; amount: string; cash_effect: string }[]; loading: boolean }) {
  const runningBalances = useMemo(() => {
    const balances: number[] = []
    let acc = 0
    for (const r of data) {
      acc = acc + Number(r.cash_effect)
      balances.push(acc)
    }
    return balances
  }, [data])

  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>
  }
  if (!data.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-sm text-slate-500">Nenhuma movimentacao realizada no periodo.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Descricao</th>
            <th className="px-4 py-3">Parte</th>
            <th className="px-4 py-3">Conta</th>
            <th className="px-4 py-3">Classe DFC</th>
            <th className="px-4 py-3 text-right">Entrada</th>
            <th className="px-4 py-3 text-right">Saida</th>
            <th className="px-4 py-3 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => {
            const running = runningBalances[i]
            return (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-2 whitespace-nowrap">{fmtDate(r.entry_date)}</td>
                <td className="px-4 py-2 max-w-[250px] truncate">{r.entry_description}</td>
                <td className="px-4 py-2">{r.party_name ?? '-'}</td>
                <td className="px-4 py-2">{r.cash_accounts}</td>
                <td className="px-4 py-2"><Badge variant="secondary">{r.dfc_class}</Badge></td>
                <td className="px-4 py-2 text-right text-emerald-600">
                  {r.direction === 'INFLOW' ? fmt(r.amount) : ''}
                </td>
                <td className="px-4 py-2 text-right text-red-600">
                  {r.direction === 'OUTFLOW' ? fmt(r.amount) : ''}
                </td>
                <td className={`px-4 py-2 text-right font-medium ${running >= 0 ? '' : 'text-red-600'}`}>
                  {fmt(running)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Forecast Table
// ---------------------------------------------------------------------------

function ForecastTable({ data, loading }: { data: { due_date: string | null; movement_type: string; party_name: string | null; description: string; projected_inflow: string; projected_outflow: string; overdue: boolean; days_overdue: number | null; due_bucket: string }[]; loading: boolean }) {
  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>
  }
  if (!data.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-sm text-slate-500">Nenhum titulo pendente com valor em aberto.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">Vencimento</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Parte</th>
            <th className="px-4 py-3">Descricao</th>
            <th className="px-4 py-3 text-right">Entrada</th>
            <th className="px-4 py-3 text-right">Saida</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Bucket</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="px-4 py-2 whitespace-nowrap">{fmtDate(r.due_date ?? '')}</td>
              <td className="px-4 py-2">{r.movement_type === 'RECEITA' ? 'Receber' : 'Pagar'}</td>
              <td className="px-4 py-2">{r.party_name ?? '-'}</td>
              <td className="px-4 py-2 max-w-[250px] truncate">{r.description}</td>
              <td className="px-4 py-2 text-right text-emerald-600">
                {Number(r.projected_inflow) > 0 ? fmt(r.projected_inflow) : ''}
              </td>
              <td className="px-4 py-2 text-right text-red-600">
                {Number(r.projected_outflow) > 0 ? fmt(r.projected_outflow) : ''}
              </td>
              <td className="px-4 py-2">
                {r.overdue ? (
                  <Badge variant="warning">Vencido {r.days_overdue}d</Badge>
                ) : (
                  <Badge variant="outline">Pendente</Badge>
                )}
              </td>
              <td className="px-4 py-2"><Badge variant="secondary">{r.due_bucket}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 13 Weeks Table
// ---------------------------------------------------------------------------

function WeeksTable({ data, loading }: { data: { week_number: number; week_label: string; opening_balance: string; inflows: string; outflows: string; closing_balance: string }[]; loading: boolean }) {
  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>
  }
  if (!data.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-sm text-slate-500">Dados de projecao indisponiveis.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">Semana</th>
            <th className="px-4 py-3">Período</th>
            <th className="px-4 py-3 text-right">Saldo Inicial</th>
            <th className="px-4 py-3 text-right">Entradas</th>
            <th className="px-4 py-3 text-right">Saídas</th>
            <th className="px-4 py-3 text-right">Saldo Final</th>
          </tr>
        </thead>
        <tbody>
          {data.map(w => (
            <tr key={w.week_number} className={`border-b border-slate-50 hover:bg-slate-50 ${Number(w.closing_balance) < 0 ? 'bg-red-50' : ''}`}>
              <td className="px-4 py-2 font-medium">{w.week_number}</td>
              <td className="px-4 py-2">{w.week_label}</td>
              <td className="px-4 py-2 text-right">{fmt(w.opening_balance)}</td>
              <td className="px-4 py-2 text-right text-emerald-600">{Number(w.inflows) > 0 ? fmt(w.inflows) : '-'}</td>
              <td className="px-4 py-2 text-right text-red-600">{Number(w.outflows) > 0 ? fmt(w.outflows) : '-'}</td>
              <td className={`px-4 py-2 text-right font-medium ${Number(w.closing_balance) < 0 ? 'text-red-600' : ''}`}>
                {fmt(w.closing_balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}