import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, AlertTriangle, Clock, Circle } from 'lucide-react'
import type { CrmOpportunityBoardRowExtended } from '@/types/database'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtDate = (d: string | null) => {
  if (!d) return null
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

const typeShort: Record<string, string> = {
  'Ligação': 'Ligação',
  'WhatsApp': 'WhatsApp',
  'E-mail': 'E-mail',
  'Reunião': 'Reunião',
  'Visita': 'Visita',
  'Follow-up': 'Follow-up',
  'Preparar proposta': 'Proposta',
  'Enviar proposta': 'Proposta',
  'Solicitar documentos': 'Docs',
  'Outro': 'Atividade',
}

function formatDue(dueAt: string): string {
  const due = new Date(dueAt)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.floor((dueDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)}d atraso`
  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'amanhã'
  return `${diffDays}d`
}

function AgingLabel({ days }: { days: number }) {
  const text = days <= 1 ? `${days} dia nesta etapa` : `${days} dias nesta etapa`
  const cls = days > 7 ? 'text-red-600 font-medium' : days > 3 ? 'text-amber-600 font-medium' : 'text-slate-400'
  return <span className={`text-[11px] ${cls}`}>{text}</span>
}

type Props = {
  opportunity: CrmOpportunityBoardRowExtended
  onClick: () => void
  isDragOverlay?: boolean
}

export function OpportunityCard({ opportunity, onClick, isDragOverlay }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opportunity.opportunity_id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const semantic = opportunity.next_activity_status_semantic
  const typeLabel = typeShort[opportunity.next_activity_type ?? ''] ?? 'Atividade'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? 'opacity-40' : ''
      } ${isDragOverlay ? 'shadow-lg' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1.5 cursor-grab text-slate-300 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Arrastar"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical className="size-3.5" />
      </button>

      <div className="cursor-pointer pl-4" onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
        <p className="text-xs font-medium text-slate-500 truncate">{opportunity.client_name}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-800 line-clamp-2">{opportunity.title}</p>
      </div>

      <div className="mt-2 flex items-center justify-between pl-4">
        <span className="text-xs font-semibold text-emerald-700">
          {opportunity.value > 0 ? fmt(opportunity.value) : ''}
        </span>
        {opportunity.expected_close_date && (
          <span className="text-[10px] text-slate-400">
            {fmtDate(opportunity.expected_close_date)}
          </span>
        )}
      </div>

      {/* Activity status line */}
      <div className="mt-2 pl-4">
        {semantic === 'overdue' && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-red-600">
            <AlertTriangle className="size-3" />
            <span>{typeLabel} · atrasado {formatDue(opportunity.next_activity_due_at!)}</span>
          </div>
        )}
        {semantic === 'today' && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
            <Clock className="size-3" />
            <span>{typeLabel} · hoje</span>
          </div>
        )}
        {semantic === 'upcoming' && (
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Clock className="size-3" />
            <span>{typeLabel} · {formatDue(opportunity.next_activity_due_at!)}</span>
          </div>
        )}
        {semantic === 'none' && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Circle className="size-2.5" />
            <span>Sem próxima atividade</span>
          </div>
        )}
      </div>

      {/* Footer: aging + responsible */}
      <div className="mx-0 mt-2 flex items-center justify-between border-t border-slate-100 pt-2 pl-4">
        <AgingLabel days={opportunity.stage_age_days} />
        {opportunity.responsible_name && (
          <span
            className="flex size-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium text-slate-600"
            title={opportunity.responsible_name}
          >
            {getInitials(opportunity.responsible_name)}
          </span>
        )}
      </div>
    </div>
  )
}
