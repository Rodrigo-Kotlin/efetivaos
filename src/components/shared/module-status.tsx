import { cn } from '@/lib/utils'

export type ModuleStatus = 'available' | 'in_progress' | 'planned' | 'disabled'

type StatusConfig = {
  label: string
  className: string
}

const statusConfigs: Record<ModuleStatus, StatusConfig> = {
  available: {
    label: 'Disponível',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  in_progress: {
    label: 'Em desenvolvimento',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  planned: {
    label: 'Planejado',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  disabled: {
    label: 'Indisponível',
    className: 'bg-slate-50 text-slate-400 border-slate-200',
  },
}

export function getModuleStatusConfig(status: ModuleStatus): StatusConfig {
  return statusConfigs[status]
}

export function ModuleStatusBadge({ status }: { status: ModuleStatus }) {
  const config = getModuleStatusConfig(status)
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}
