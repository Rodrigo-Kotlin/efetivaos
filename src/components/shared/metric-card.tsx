import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type MetricCardProps = {
  label: string
  value: string | number
  icon?: LucideIcon
  supportingText?: string
  isLoading?: boolean
  className?: string
}

export function MetricCard({ label, value, icon: Icon, supportingText, isLoading, className }: MetricCardProps) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
        {Icon && <Icon className="size-4 text-slate-400" />}
      </div>
      <div className="mt-2">
        {isLoading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-slate-100" />
        ) : (
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        )}
      </div>
      {supportingText && <p className="mt-1 text-xs text-slate-500">{supportingText}</p>}
    </div>
  )
}
