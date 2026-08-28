import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useBalanceSheet } from '../queries/finance-queries'
import type { BalanceSheetRow } from '@/types/database'

const fmt = (v: string | number) => {
  const n = Number(v)
  const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(n))
  return n < 0 ? `(${formatted})` : formatted
}

const fmtPct = (v: string | number, base: string | number) => {
  const n = Number(v); const b = Number(base)
  if (!b) return '-'
  return `${((n / b) * 100).toFixed(1)}%`
}

function RowGroup({ title, rows, totalLabel }: { title: string; rows: BalanceSheetRow[]; totalLabel?: string }) {
  if (!rows.length) return null
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map(row => {
          const isTotal = row.row_type === 'TOTAL'
          const isSubtotal = row.row_type === 'SUBTOTAL'
          return (
            <div key={row.row_code} className={`flex items-center justify-between px-5 py-3 ${isTotal ? 'bg-slate-50 font-bold' : isSubtotal ? 'bg-slate-50/60 font-semibold' : ''}`}>
              <div>
                {row.level === 0 && <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{row.group_name}</p>}
                {row.level > 0 && <p className="text-sm" style={{ paddingLeft: `${(row.level - 1) * 16}px` }}>{row.label}</p>}
              </div>
              <p className={`font-mono text-sm ${isTotal ? 'font-bold' : isSubtotal ? 'font-semibold' : ''}`}>{fmt(row.amount)}</p>
            </div>
          )
        })}
        {totalLabel && (() => {
          const total = rows.find(r => r.row_type === 'TOTAL')
          if (!total) return null
          return (
            <div className="flex items-center justify-between bg-slate-100 px-5 py-3 font-bold">
              <p>{totalLabel}</p>
              <p className="font-mono">{fmt(total.amount)}</p>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10))

  const { data: rows, isLoading } = useBalanceSheet(asOfDate)

  const groups = useMemo(() => {
    if (!rows?.length) return null

    const ativo = rows.filter(r => r.class === 'ATIVO')
    const passivo = rows.filter(r => r.class === 'PASSIVO')
    const pl = rows.filter(r => r.class === 'PL')

    const totalAtivo = Number(ativo.find(r => r.row_type === 'TOTAL')?.amount ?? 0)
    const totalPassivo = Number(passivo.find(r => r.row_type === 'TOTAL')?.amount ?? 0)
    const totalPL = Number(pl.find(r => r.row_type === 'TOTAL')?.amount ?? 0)
    const isBalanced = Math.abs(totalAtivo - (totalPassivo + totalPL)) < 0.01

    // Compute circulante from group_name patterns
    const ativoCirculante = ativo
      .filter(r => r.group_name === 'Circulante' || r.group_name === 'Disponibilidades')
      .reduce((s, r) => s + Number(r.amount), 0)
    const passivoCirculante = passivo
      .filter(r => r.group_name === 'Circulante')
      .reduce((s, r) => s + Number(r.amount), 0)

    return {
      ativo, passivo, pl,
      totalAtivo, totalPassivo, totalPL, isBalanced,
      ativoCirculante, passivoCirculante,
    }
  }, [rows])

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <Badge className="mb-4">Financeiro</Badge>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Balan&ccedil;o Patrimonial</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600">
            Posição patrimonial consolidada por grupo contábil.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Data de referencia</label>
            <Input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="w-44" />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {groups && (
        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Ativo</p>
            <p className="mt-2 font-serif text-2xl font-semibold">{fmt(groups.totalAtivo)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Passivo</p>
            <p className="mt-2 font-serif text-2xl font-semibold">{fmt(groups.totalPassivo)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Patrimônio Líquido</p>
            <p className="mt-2 font-serif text-2xl font-semibold">{fmt(groups.totalPL)}</p>
          </div>
        </section>
      )}

      {/* Equation check */}
      {groups && (
        <div className={`mb-6 rounded-2xl border p-5 ${groups.isBalanced ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Equacao patrimonial</p>
              <p className="mt-1 font-mono text-sm">
                ATIVO {fmt(groups.totalAtivo)} = PASSIVO {fmt(groups.totalPassivo)} + PL {fmt(groups.totalPL)}
              </p>
            </div>
            <Badge variant={groups.isBalanced ? 'default' : 'warning'}>
              {groups.isBalanced ? 'Balancado' : 'Desbalancado!'}
            </Badge>
          </div>
          {!groups.isBalanced && (
            <p className="mt-2 text-sm text-red-700">
              Diferenca: {fmt(Math.abs(groups.totalAtivo - (groups.totalPassivo + groups.totalPL)))}
            </p>
          )}
        </div>
      )}

      {isLoading && <p className="py-12 text-center text-slate-500">Carregando balanco...</p>}

      {!isLoading && !rows?.length && (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
          <p className="text-slate-500">Nenhum dado encontrado para a data selecionada.</p>
        </div>
      )}

      {/* Two-column layout: Ativo | Passivo + PL */}
      {groups && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ATIVO */}
          <RowGroup title="ATIVO" rows={groups.ativo} totalLabel="TOTAL ATIVO" />

          {/* PASSIVO + PL */}
          <div className="space-y-6">
            <RowGroup title="PASSIVO" rows={groups.passivo} totalLabel="TOTAL PASSIVO" />
            <RowGroup title="PATRIMONIO LIQUIDO" rows={groups.pl} totalLabel="TOTAL PL" />
          </div>
        </div>
      )}

      {/* Indicators table */}
      {groups && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 font-serif text-lg font-semibold">Indicadores</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Capital Circulante Líquido</p>
              <p className="mt-1 font-serif text-xl font-semibold">
                {fmt(groups.ativoCirculante - groups.passivoCirculante)}
              </p>
              <p className="text-xs text-slate-500">AC - PC</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Liquidez Corrente</p>
              <p className="mt-1 font-serif text-xl font-semibold">
                {fmtPct(groups.ativoCirculante, groups.passivoCirculante)}
              </p>
              <p className="text-xs text-slate-500">AC / PC</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Endividamento Geral</p>
              <p className="mt-1 font-serif text-xl font-semibold">
                {fmtPct(groups.totalPassivo, groups.totalAtivo)}
              </p>
              <p className="text-xs text-slate-500">Passivo / Ativo</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Capital de Terceiros</p>
              <p className="mt-1 font-serif text-xl font-semibold">
                {fmtPct(groups.totalPassivo, groups.totalPL)}
              </p>
              <p className="text-xs text-slate-500">Passivo / PL</p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
