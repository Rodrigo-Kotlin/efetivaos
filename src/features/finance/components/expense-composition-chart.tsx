import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import type { ExpenseCompositionRow } from '../api/finance-api'
import { sortExpenseComposition } from './expense-composition-chart-helpers'

const COLORS = ['#0B6B3A', '#2E7D5B', '#4D9A73', '#76B88F', '#A2D0B4', '#D0E6D9', '#557A68', '#879F93']

const fmt = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const fmtPct = (value: number) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

type ExpenseCompositionChartProps = {
  rows?: ExpenseCompositionRow[]
  isLoading: boolean
  isError: boolean
}

export function ExpenseCompositionChart({ rows, isLoading, isError }: ExpenseCompositionChartProps) {
  const sortedRows = sortExpenseComposition(rows ?? [])
  const total = sortedRows.reduce((sum, row) => sum + row.amount, 0)

  if (isLoading) {
    return <div aria-label="Carregando composição das despesas" className="h-[300px] animate-pulse rounded-lg bg-slate-100" />
  }

  if (isError) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Erro ao carregar a composição das despesas.</div>
  }

  if (sortedRows.length === 0) {
    return <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Nenhuma despesa operacional encontrada para este período.</div>
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(240px,0.9fr)_minmax(260px,1.1fr)] md:items-center">
        <div
          role="img"
          aria-label="Gráfico de composição das despesas operacionais por conta contábil no período selecionado."
          className="h-[260px] min-w-0"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sortedRows}
                dataKey="amount"
                nameKey="account_name"
                innerRadius="56%"
                outerRadius="82%"
                paddingAngle={2}
                stroke="#FFFFFF"
                strokeWidth={2}
              >
                {sortedRows.map((row, index) => (
                  <Cell key={row.account_code} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as ExpenseCompositionRow | undefined
                  if (!active || !row) return null
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                      <p className="font-semibold text-slate-800">{row.account_name}</p>
                      <p className="text-slate-500">{row.account_code}</p>
                      <p className="mt-1 font-medium text-slate-800">{fmt(row.amount)}</p>
                      <p className="text-slate-500">{fmtPct(row.percentage)}</p>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2" aria-label="Detalhamento da composição das despesas">
          {sortedRows.map((row, index) => (
            <div key={row.account_code} className="flex min-w-0 items-start gap-2 text-sm">
              <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-700" title={`${row.account_name} (${row.account_code})`}>{row.account_name}</p>
                <p className="text-xs text-slate-500">{row.account_code}</p>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <p className="font-medium text-slate-800">{fmt(row.amount)}</p>
                <p className="text-xs text-slate-500">{fmtPct(row.percentage)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-3 text-right text-sm">
        <span className="text-slate-500">Total despesas operacionais</span>{' '}
        <strong className="tabular-nums text-slate-800">{fmt(total)}</strong>
      </div>
      <p className="sr-only">Total reconciliado pela soma das contas exibidas: {fmt(total)}.</p>
    </div>
  )
}
