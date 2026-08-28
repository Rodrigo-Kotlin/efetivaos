import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { CrmOpportunityBoardRow } from '@/types/database'

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

type Props = {
  opportunity: CrmOpportunityBoardRow
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? 'opacity-40' : ''
      } ${isDragOverlay ? 'shadow-lg' : ''}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1.5 cursor-grab text-slate-300 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Arrastar"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Client + Title */}
      <div className="cursor-pointer pl-4" onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
        <p className="text-xs font-medium text-slate-500 truncate">{opportunity.client_name}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-800 line-clamp-2">{opportunity.title}</p>
      </div>

      {/* Value + Date + Responsible */}
      <div className="mt-2 flex items-center justify-between pl-4">
        <span className="text-xs font-semibold text-emerald-700">
          {opportunity.value > 0 ? fmt(opportunity.value) : ''}
        </span>
        <div className="flex items-center gap-2">
          {opportunity.expected_close_date && (
            <span className="text-[10px] text-slate-400">
              {fmtDate(opportunity.expected_close_date)}
            </span>
          )}
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
    </div>
  )
}
