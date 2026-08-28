import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDmpl } from '../queries/finance-queries'

const fmt = (v: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))

const TOTAL_ROWS = new Set(['Saldo Inicial', '= Saldo Final'])

export default function DmplPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: rows, isLoading } = useDmpl(dateFrom || null, dateTo || null)

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          DMPL - Demonstração das Mutações do Patrimônio Líquido
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Movimentação das contas de Patrimônio Líquido no período.
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
        <Button variant="outline" size="sm" onClick={() => { setDateFrom(''); setDateTo('') }}>
          Limpar
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-slate-400">Carregando...</div>
        </div>
      )}

      {/* Table */}
      {!isLoading && rows && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">Movimento</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Capital Social</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Reservas</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Lucros/Prejuizos</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Resultado Exercicio</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Outros Componentes</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Total PL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isTotal = TOTAL_ROWS.has(row.row_label)
                return (
                  <tr
                    key={i}
                    className={`border-b border-slate-100 ${isTotal ? 'bg-slate-50 font-semibold' : ''}`}
                  >
                    <td className="px-4 py-3 text-slate-800">{row.row_label}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(row.capital_social)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(row.reservas)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(row.lucros_prejuizos_acumulados)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(row.resultado_exercicio)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(row.outros_componentes)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{fmt(row.total_pl)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && rows && rows.length === 0 && (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200">
          <div className="text-center">
            <p className="text-sm text-slate-500">Nenhum dado encontrado para o periodo selecionado.</p>
          </div>
        </div>
      )}
    </div>
  )
}