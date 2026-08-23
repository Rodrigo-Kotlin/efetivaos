import { cn } from '@/lib/utils'

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)} aria-label="Efetiva OS">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-800 font-serif text-lg font-bold text-white shadow-sm">
        EF
      </span>
      {!compact && (
        <span className="leading-tight">
          <strong className="block font-serif text-lg text-slate-950">Efetiva OS</strong>
          <span className="text-xs text-slate-500">Gestao administrativa</span>
        </span>
      )}
    </div>
  )
}
