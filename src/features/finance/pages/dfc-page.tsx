import { useState } from 'react'
import { ArrowRightLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCashflowStatement } from '../queries/finance-queries'

const fmt = (v: string | number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))

const CLASS_ICONS: Record<string, React.ReactNode> = {
  OPERACIONAL: <ArrowRightLeft className="h-4 w-4" />,
  INVESTIMENTO: <TrendingUp className="h-4 w-4" />,
  FINANCIAMENTO: <TrendingDown className="h-4 w-4" />,
}

const CLASS_COLORS: Record<string, string> = {
  OPERACIONAL: 'bg-blue-50 text-blue-700 border-blue-200',
  INVESTIMENTO: 'bg-amber-50 text-amber-700 border-amber-200',
  FINANCIAMENTO: 'bg-purple-50 text-purple-700 border-purple-200',
}

export default function DfcPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: statement, isLoading } = useCashflowStatement()

  const saldoInicial = statement?.find(r => r.dfc_class === 'SALDO_INICIAL')
  const variacao = statement?.find(r => r.dfc_class === 'VARIACAO')
  const saldoFinal = statement?.find(r => r.dfc_class === 'SALDO_FINAL')
  const classes = statement?.filter(r => ['OPERACIONAL', 'INVESTIMENTO', 'FINANCIAMENTO'].includes(r.dfc_class)) ?? []

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          DFC - Demonstracao dos Fluxos de Caixa
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Regime de caixa, classificado por atividades operacionais, de investimento e de financiamento.
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

      {/* DFC Statement */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : !statement?.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">Dados de DFC indisponiveis.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Opening Balance */}
          <DfcRow
            label="Saldo Inicial de Caixa"
            value={saldoInicial?.opening_balance ?? '0'}
            type="opening"
          />

          {/* Activity Classes */}
          {classes.map(c => (
            <DfcClassCard key={c.dfc_class} data={c} />
          ))}

          {/* Net Variation */}
          <DfcRow
            label="Variacao Liquida de Caixa"
            value={variacao?.net_amount ?? '0'}
            type="variation"
          />

          {/* Closing Balance */}
          <DfcRow
            label="Saldo Final de Caixa"
            value={saldoFinal?.net_amount ?? '0'}
            type="closing"
          />

          {/* Reconciliation */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-700">
              Conciliacao: Saldo Inicial ({fmt(saldoInicial?.opening_balance ?? '0')}) + Variacao ({fmt(variacao?.net_amount ?? '0')}) = Saldo Final ({fmt(saldoFinal?.net_amount ?? '0')})
            </p>
            <p className="mt-1 text-xs text-emerald-600">
              Diferenca: {fmt(Number(saldoFinal?.net_amount ?? 0) - (Number(saldoInicial?.opening_balance ?? 0) + Number(variacao?.net_amount ?? 0)))}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DFC Row (opening / variation / closing)
// ---------------------------------------------------------------------------

function DfcRow({ label, value, type }: { label: string; value: string; type: 'opening' | 'variation' | 'closing' }) {
  const numValue = Number(value)
  const isNeg = numValue < 0
  const colors = type === 'opening' ? 'border-slate-200 bg-slate-50'
    : type === 'variation' ? (isNeg ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50')
    : (isNeg ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50')

  return (
    <div className={`flex items-center justify-between rounded-xl border p-4 ${colors}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`text-lg font-semibold ${isNeg ? 'text-red-600' : 'text-slate-900'}`}>
        {fmt(value)}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DFC Class Card (Operacional / Investimento / Financiamento)
// ---------------------------------------------------------------------------

function DfcClassCard({ data }: { data: { dfc_class: string; dfc_class_label: string; inflows: string; outflows: string; net_amount: string } }) {
  const net = Number(data.net_amount)
  const isNeg = net < 0

  return (
    <div className={`rounded-xl border p-4 ${CLASS_COLORS[data.dfc_class] ?? 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {CLASS_ICONS[data.dfc_class]}
          <span className="text-sm font-semibold">{data.dfc_class_label}</span>
        </div>
        <span className={`text-lg font-semibold ${isNeg ? 'text-red-600' : ''}`}>
          {fmt(data.net_amount)}
        </span>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-600">
        <span>Entradas: <strong className="text-emerald-700">{fmt(data.inflows)}</strong></span>
        <span>Saidas: <strong className="text-red-700">{fmt(data.outflows)}</strong></span>
      </div>
    </div>
  )
}