import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useIncomeStatement } from '../queries/finance-queries'
import type { IncomeStatementFilters } from '../api/finance-api'
import { useCostCenters, useServiceLines } from '../queries/finance-queries'

const fmt = (v: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))

const pct = (v: string | number, base: string | number) => {
  const n = Number(v); const b = Number(base)
  if (!b) return '-'
  return `${((n / b) * 100).toFixed(1)}%`
}

const INDENT_CODES = new Set([
  'DEDUCOES', 'CUSTOS', 'DESPESAS_OPERACIONAIS', 'DEPRECIACAO',
  'RESULTADO_FINANCEIRO', 'OUTROS_RESULTADOS', 'IMPOSTOS',
])

const SUBTOTAL_CODES = new Set([
  'RECEITA_BRUTA', 'RECEITA_LIQUIDA', 'LUCRO_BRUTO', 'EBITDA', 'EBIT', 'ANTES_IMPOSTOS',
])

const TOTAL_CODES = new Set(['RESULTADO_LIQUIDO'])

export default function DrePage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [serviceLineId, setServiceLineId] = useState('')

  const { data: costCenters } = useCostCenters()
  const { data: serviceLines } = useServiceLines()

  const filters: IncomeStatementFilters = useMemo(() => ({
    from: dateFrom || null,
    to: dateTo || null,
    costCenterId: costCenterId || null,
    serviceLineId: serviceLineId || null,
  }), [dateFrom, dateTo, costCenterId, serviceLineId])

  const hasFilters = !!(dateFrom || dateTo || costCenterId || serviceLineId)

  const { data: rows, isLoading } = useIncomeStatement(filters)

  const summary = useMemo(() => {
    if (!rows?.length) return null
    const rl = rows.find(r => r.row_code === 'RECEITA_LIQUIDA')
    const lb = rows.find(r => r.row_code === 'LUCRO_BRUTO')
    const eb = rows.find(r => r.row_code === 'EBITDA')
    const rq = rows.find(r => r.row_code === 'RESULTADO_LIQUIDO')
    const rlVal = Number(rl?.amount ?? 0)
    const lbVal = Number(lb?.amount ?? 0)
    const ebVal = Number(eb?.amount ?? 0)
    const rqVal = Number(rq?.amount ?? 0)
    return {
      receitaLiquida: rlVal,
      lucroBruto: lbVal,
      ebitda: ebVal,
      resultadoLiquido: rqVal,
      margemBruta: rlVal ? (lbVal / rlVal) * 100 : 0,
      margemEbitda: rlVal ? (ebVal / rlVal) * 100 : 0,
      margemLiquida: rlVal ? (rqVal / rlVal) * 100 : 0,
    }
  }, [rows])

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          DRE - Demonstracao do Resultado
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Regime de competencia, com custos dos servicos e EBITDA gerencial.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">De</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[150px]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Ate</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[150px]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Centro de Custo</label>
          <select
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
            value={costCenterId}
            onChange={e => setCostCenterId(e.target.value)}
          >
            <option value="">Todos</option>
            {costCenters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Linha de Servico</label>
          <select
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
            value={serviceLineId}
            onChange={e => setServiceLineId(e.target.value)}
          >
            <option value="">Todas</option>
            {serviceLines?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setCostCenterId(''); setServiceLineId('') }}>
            Limpar
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Receita Liquida" value={fmt(summary.receitaLiquida)} />
          <KpiCard label="EBITDA" value={fmt(summary.ebitda)} />
          <KpiCard label="Resultado Liquido" value={fmt(summary.resultadoLiquido)} negative={summary.resultadoLiquido < 0} />
          <KpiCard label="Margem EBITDA" value={`${summary.margemEbitda.toFixed(1)}%`} />
          <KpiCard label="Margem Liquida" value={`${summary.margemLiquida.toFixed(1)}%`} negative={summary.margemLiquida < 0} />
        </div>
      )}

      {/* DRE Statement */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : !rows?.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">Nenhum dado de DRE para o periodo selecionado.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Demonstracao do Resultado do Exercicio</th>
                <th className="w-[180px] px-5 py-3 text-right">Valor (R$)</th>
                {summary && <th className="w-[100px] px-5 py-3 text-right">% RL</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isSub = SUBTOTAL_CODES.has(row.row_code)
                const isTotal = TOTAL_CODES.has(row.row_code)
                const isIndent = INDENT_CODES.has(row.row_code)
                const isNeg = Number(row.amount) < 0
                const isDetail = row.row_type === 'DETAIL'
                const isBeforeTotal = row.row_code === 'ANTES_IMPOSTOS'

                return (
                  <tr
                    key={row.row_code}
                    className={`${
                      isTotal
                        ? 'border-t-2 border-emerald-300 bg-emerald-50 font-bold'
                        : isBeforeTotal
                          ? 'border-t-2 border-slate-200 font-semibold'
                          : isSub
                            ? 'bg-slate-50/50 font-semibold'
                            : 'font-normal'
                    } ${isDetail ? 'text-slate-600' : 'text-slate-900'}`}
                  >
                    <td className={`px-5 py-3 ${isIndent ? 'pl-10' : ''}`}>
                      {isTotal ? row.label : isSub ? row.label : row.label}
                    </td>
                    <td className={`px-5 py-3 text-right tabular-nums ${isNeg ? 'text-red-600' : isTotal ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {fmt(row.amount)}
                    </td>
                    {summary && (
                      <td className="px-5 py-3 text-right text-xs text-slate-500">
                        {pct(row.amount, summary.receitaLiquida)}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Period info */}
      {rows?.length && (
        <div className="text-right text-xs text-slate-400">
          Periodo: {dateFrom || 'inicio'} a {dateTo || 'hoje'} - competencia
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${negative ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
