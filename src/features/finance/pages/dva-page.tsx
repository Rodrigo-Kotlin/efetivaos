import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDva } from '../queries/finance-queries'
import { generateStatementPdf, downloadPdf } from '../lib/pdf-utils'

const fmt = (v: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))

export default function DvaPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: rows, isLoading } = useDva(dateFrom || null, dateTo || null)

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          DVA - Demonstração do Valor Adicionado
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Geracao e distribuicao do valor adicionado.
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
        {rows?.length ? (
          <Button variant="outline" size="sm" onClick={() => {
            const period = `${dateFrom || 'início'} a ${dateTo || 'hoje'}`
            const statementRows = rows.map(r => ({ label: r.row_label, amount: Number(r.amount), bold: r.row_label.startsWith('=') }))
            const doc = generateStatementPdf('DVA - Demonstração do Valor Adicionado', period, statementRows)
            downloadPdf(doc, 'dva')
          }}>PDF</Button>
        ) : null}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-slate-400">Carregando...</div>
        </div>
      )}

      {/* Content */}
      {!isLoading && rows && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="space-y-4">
            {rows.map((row, i) => {
              const isSubtotal = row.row_label.startsWith('=')
              const isDistribuicao = row.row_label.startsWith('Distribuicao')
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between py-3 ${
                    isSubtotal ? 'border-t border-slate-200 font-semibold' : ''
                  } ${isDistribuicao ? 'pl-6' : ''}`}
                >
                  <span className="text-slate-800">{row.row_label}</span>
                  <span className={`text-right ${isSubtotal ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                    {fmt(row.amount)}
                  </span>
                </div>
              )
            })}
          </div>
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