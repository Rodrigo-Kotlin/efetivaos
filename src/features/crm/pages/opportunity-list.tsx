import { useMemo } from 'react'
import { AlertTriangle, Clock, Circle } from 'lucide-react'
import type { CrmOpportunityBoardRowExtended } from '@/types/database'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtDate = (d: string | null) => {
  if (!d) return '-'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

type SortKey = 'title' | 'client_name' | 'stage_name' | 'value' | 'probability' | 'next_activity' | 'expected_close_date' | 'stage_age_days' | 'updated_at'

type Props = {
  opportunities: CrmOpportunityBoardRowExtended[]
  onRowClick: (opp: CrmOpportunityBoardRowExtended) => void
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}

function AgingBadge({ days }: { days: number }) {
  if (days <= 3) return <span className="text-xs text-slate-500">{days}d</span>
  if (days <= 7) return <span className="text-xs font-medium text-amber-600">{days}d</span>
  return <span className="text-xs font-semibold text-red-600">{days}d</span>
}

function ActivityBadge({ opp }: { opp: CrmOpportunityBoardRowExtended }) {
  const s = opp.next_activity_status_semantic
  const typeShort: Record<string, string> = {
    'Ligação': 'Lig', 'WhatsApp': 'Wpp', 'E-mail': 'Email', 'Reunião': 'Reun',
    'Visita': 'Visita', 'Follow-up': 'Fup', 'Preparar proposta': 'Prop',
    'Enviar proposta': 'Prop', 'Solicitar documentos': 'Doc', 'Outro': 'Outro',
  }
  const label = typeShort[opp.next_activity_type ?? ''] ?? '-'

  if (s === 'none') return <span className="text-xs text-slate-400">Sem atividade</span>
  if (s === 'overdue') return <span className="flex items-center gap-0.5 text-xs font-medium text-red-600"><AlertTriangle className="size-3" />{label}</span>
  if (s === 'today') return <span className="flex items-center gap-0.5 text-xs font-medium text-amber-600"><Clock className="size-3" />{label}</span>
  return <span className="flex items-center gap-0.5 text-xs text-slate-500"><Clock className="size-3" />{label}</span>
}

const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => (
  <span className={`ml-1 inline-block ${active ? 'text-slate-800' : 'text-slate-300'}`}>
    {active ? (dir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
  </span>
)

export function OpportunityList({ opportunities, onRowClick, sortKey, sortDir, onSort }: Props) {
  const sorted = useMemo(() => {
    const arr = [...opportunities]
    arr.sort((a, b) => {
      let va: number | string
      let vb: number | string
      switch (sortKey) {
        case 'title': va = a.title; vb = b.title; break
        case 'client_name': va = a.client_name; vb = b.client_name; break
        case 'stage_name': va = a.stage_position; vb = b.stage_position; break
        case 'value': va = a.value; vb = b.value; break
        case 'probability': va = a.probability; vb = b.probability; break
        case 'expected_close_date': va = a.expected_close_date ?? 'z'; vb = b.expected_close_date ?? 'z'; break
        case 'stage_age_days': va = a.stage_age_days; vb = b.stage_age_days; break
        case 'updated_at': va = a.updated_at; vb = b.updated_at; break
        case 'next_activity':
          va = a.next_activity_due_at ?? 'z'
          vb = b.next_activity_due_at ?? 'z'
          break
        default: va = 0; vb = 0
      }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
    return arr
  }, [opportunities, sortKey, sortDir])

  if (opportunities.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <p className="text-sm text-slate-500">Nenhuma oportunidade encontrada.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto px-6 pb-4">
      {/* Desktop table */}
      <table className="hidden w-full text-left text-sm md:table">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            <th className="cursor-pointer py-2 pr-2 font-medium" onClick={() => onSort('title')}>Oportunidade<SortIcon active={sortKey === 'title'} dir={sortDir} /></th>
            <th className="cursor-pointer py-2 pr-2 font-medium" onClick={() => onSort('client_name')}>Cliente<SortIcon active={sortKey === 'client_name'} dir={sortDir} /></th>
            <th className="cursor-pointer py-2 pr-2 font-medium" onClick={() => onSort('stage_name')}>Etapa<SortIcon active={sortKey === 'stage_name'} dir={sortDir} /></th>
            <th className="cursor-pointer py-2 pr-2 text-right font-medium" onClick={() => onSort('value')}>Valor<SortIcon active={sortKey === 'value'} dir={sortDir} /></th>
            <th className="cursor-pointer py-2 pr-2 text-right font-medium" onClick={() => onSort('probability')}>Prob.<SortIcon active={sortKey === 'probability'} dir={sortDir} /></th>
            <th className="py-2 pr-2 font-medium">Ponderado</th>
            <th className="cursor-pointer py-2 pr-2 font-medium" onClick={() => onSort('next_activity')}>Próx. Atividade<SortIcon active={sortKey === 'next_activity'} dir={sortDir} /></th>
            <th className="py-2 pr-2 font-medium">Resp.</th>
            <th className="cursor-pointer py-2 pr-2 font-medium" onClick={() => onSort('expected_close_date')}>Previsão<SortIcon active={sortKey === 'expected_close_date'} dir={sortDir} /></th>
            <th className="cursor-pointer py-2 pr-2 text-right font-medium" onClick={() => onSort('stage_age_days')}>Aging<SortIcon active={sortKey === 'stage_age_days'} dir={sortDir} /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(opp => (
            <tr
              key={opp.opportunity_id}
              className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition-colors"
              onClick={() => onRowClick(opp)}
            >
              <td className="py-2.5 pr-2">
                <p className="font-medium text-slate-800 line-clamp-1">{opp.title}</p>
              </td>
              <td className="py-2.5 pr-2 text-slate-600">{opp.client_name}</td>
              <td className="py-2.5 pr-2">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {opp.stage_name}
                </span>
              </td>
              <td className="py-2.5 pr-2 text-right font-medium text-slate-800">{opp.value > 0 ? fmt(opp.value) : '-'}</td>
              <td className="py-2.5 pr-2 text-right text-slate-600">{opp.probability}%</td>
              <td className="py-2.5 pr-2 text-right text-slate-600">{fmt(opp.value * opp.probability / 100)}</td>
              <td className="py-2.5 pr-2"><ActivityBadge opp={opp} /></td>
              <td className="py-2.5 pr-2">
                {opp.responsible_name ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium text-slate-600" title={opp.responsible_name}>
                    {getInitials(opp.responsible_name)}
                  </span>
                ) : <span className="text-slate-300">-</span>}
              </td>
              <td className="py-2.5 pr-2 text-xs text-slate-500">{fmtDate(opp.expected_close_date)}</td>
              <td className="py-2.5 pr-2 text-right"><AgingBadge days={opp.stage_age_days} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {sorted.map(opp => (
          <div
            key={opp.opportunity_id}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            onClick={() => onRowClick(opp)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 line-clamp-1">{opp.title}</p>
                <p className="text-xs text-slate-500">{opp.client_name}</p>
              </div>
              <span className="text-sm font-semibold text-emerald-700">{opp.value > 0 ? fmt(opp.value) : ''}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                {opp.stage_name}
              </span>
              <div className="flex items-center gap-2">
                <ActivityBadge opp={opp} />
                <AgingBadge days={opp.stage_age_days} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
