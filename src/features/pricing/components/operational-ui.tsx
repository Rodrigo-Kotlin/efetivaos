import { AlertCircle, CheckCircle2, Inbox, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const selectClassName = 'h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:cursor-not-allowed disabled:opacity-50'
export const textareaClassName = 'min-h-24 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:cursor-not-allowed disabled:opacity-50'

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}

export function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge><CheckCircle2 className="size-3.5" /> Ativo</Badge>
  ) : (
    <Badge variant="secondary"><AlertCircle className="size-3.5" /> Inativo</Badge>
  )
}

export function TableSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="Carregando registros" role="status">
      <div className="h-12 animate-pulse border-b border-slate-200 bg-slate-100" />
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="grid gap-4 border-b border-slate-100 px-5 py-4 last:border-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, column) => <span key={column} className="h-4 animate-pulse rounded bg-slate-100" />)}
        </div>
      ))}
      <span className="sr-only">Carregando...</span>
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><Inbox className="size-6" /></span>
      <h2 className="mt-4 font-serif text-2xl font-semibold text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-6">{action}</div>
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center" role="alert">
      <AlertCircle className="mx-auto size-7 text-red-700" />
      <h2 className="mt-3 text-lg font-bold text-red-950">Nao foi possivel carregar os dados</h2>
      <p className="mt-1 text-sm text-red-800">Verifique sua conexao e tente novamente.</p>
      <Button className="mt-5" variant="outline" onClick={onRetry}><RotateCw className="size-4" /> Tentar novamente</Button>
    </div>
  )
}

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null
  return <p id={id} className="mt-1.5 text-sm text-red-700">{children}</p>
}

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>
}
