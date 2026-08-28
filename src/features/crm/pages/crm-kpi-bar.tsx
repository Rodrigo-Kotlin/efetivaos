import type { CrmOpportunityBoardRow } from '@/types/database'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

type Props = {
  opportunities: CrmOpportunityBoardRow[]
}

export function CrmKpiBar({ opportunities }: Props) {
  const openOpps = opportunities.filter(o => o.status === 'open')
  const totalValue = openOpps.reduce((s, o) => s + o.value, 0)
  const weightedValue = openOpps.reduce((s, o) => s + o.value * (o.probability / 100), 0)
  const negotiationCount = openOpps.filter(o =>
    o.stage_name?.toLowerCase().includes('negocia')
  ).length

  return (
    <div className="grid grid-cols-2 gap-3 px-6 py-2 sm:grid-cols-4">
      <KpiCard label="Pipeline aberto" value={fmt(totalValue)} />
      <KpiCard label="Pipeline ponderado" value={fmt(weightedValue)} />
      <KpiCard label="Oportunidades abertas" value={String(openOpps.length)} />
      <KpiCard label="Em negociação" value={String(negotiationCount)} />
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-800">{value}</p>
    </div>
  )
}
