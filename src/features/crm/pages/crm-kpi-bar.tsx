import { AlertTriangle, CircleOff } from 'lucide-react'
import type { CrmOpportunityBoardRowExtended } from '@/types/database'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

type Props = {
  opportunities: CrmOpportunityBoardRowExtended[]
}

export function CrmKpiBar({ opportunities }: Props) {
  const openOpps = opportunities.filter(o => o.status === 'open')
  const totalValue = openOpps.reduce((s, o) => s + o.value, 0)
  const weightedValue = openOpps.reduce((s, o) => s + o.value * (o.probability / 100), 0)

  const overdueCount = openOpps.filter(o => o.next_activity_status_semantic === 'overdue').length
  const noNextCount = openOpps.filter(o => o.next_activity_status_semantic === 'none').length

  return (
    <div className="grid grid-cols-2 gap-3 px-6 py-2 sm:grid-cols-5">
      <KpiCard label="Pipeline aberto" value={fmt(totalValue)} />
      <KpiCard label="Pipeline ponderado" value={fmt(weightedValue)} />
      <KpiCard label="Oportunidades abertas" value={String(openOpps.length)} />
      <KpiCard
        label="Atividades atrasadas"
        value={String(overdueCount)}
        icon={<AlertTriangle className="size-3.5 text-red-500" />}
        alert={overdueCount > 0}
      />
      <KpiCard
        label="Sem próxima atividade"
        value={String(noNextCount)}
        icon={<CircleOff className="size-3.5 text-slate-400" />}
        muted
      />
    </div>
  )
}

function KpiCard({ label, value, icon, alert, muted }: { label: string; value: string; icon?: React.ReactNode; alert?: boolean; muted?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        {icon}
        <p className={`text-lg font-semibold ${alert ? 'text-red-600' : muted ? 'text-slate-400' : 'text-slate-800'}`}>{value}</p>
      </div>
    </div>
  )
}
