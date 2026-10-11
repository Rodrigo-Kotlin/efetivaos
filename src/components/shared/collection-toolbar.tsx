import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type CollectionToolbarProps = {
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export function CollectionToolbar({ children, actions, className }: CollectionToolbarProps) {
  return (
    <section aria-label="Ferramentas da coleção" className={cn('space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4', className)}>
      <div className="flex min-w-0 flex-wrap items-end gap-2">{children}</div>
      {actions && <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">{actions}</div>}
    </section>
  )
}

type CollectionSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function CollectionSearch({ value, onChange, placeholder, label = 'Buscar', disabled, className, id }: CollectionSearchProps) {
  const labelId = id ?? `${label.toLowerCase().replace(/\s+/g, '-')}-label`
  return (
    <div className={cn('min-w-0 flex-1 basis-64', className)}>
      <label id={labelId} htmlFor={`${labelId}-input`} className="sr-only">{label}</label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={`${labelId}-input`}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          disabled={disabled}
          className="pl-9"
        />
      </div>
    </div>
  )
}

export function CollectionFilters({ children, label = 'Filtros principais', className }: { children: ReactNode; label?: string; className?: string }) {
  return <div role="group" aria-label={label} className={cn('flex min-w-0 flex-wrap items-end gap-2', className)}>{children}</div>
}

export function CollectionActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>{children}</div>
}

export function CollectionResultsCount({ page, pageSize, total, label = 'resultados' }: { page: number; pageSize: number; total: number; label?: string }) {
  const start = total === 0 ? 0 : (Math.max(page, 1) - 1) * pageSize + 1
  const end = Math.min(Math.max(page, 1) * pageSize, total)
  return <p className="text-sm text-slate-600" aria-live="polite">{start}–{end} de {total} {label}</p>
}

type CollectionSortOption = { value: string; label: string }

export function CollectionSort({ value, onChange, options, label = 'Ordenar por', disabled }: { value: string; onChange: (value: string) => void; options: CollectionSortOption[]; label?: string; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="whitespace-nowrap">{label}</span>
      <select className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:cursor-not-allowed disabled:opacity-50" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} disabled={disabled}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1.5 pr-1">
      <span>{label}</span>
      <button type="button" className="rounded-full p-0.5 text-slate-600 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700" onClick={onRemove} aria-label={`Remover filtro ${label}`}>
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </Badge>
  )
}

export function ClearFiltersButton({ onClick, disabled = false, children = 'Limpar filtros' }: { onClick: () => void; disabled?: boolean; children?: ReactNode }) {
  return <Button type="button" variant="ghost" size="sm" onClick={onClick} disabled={disabled}>{children}</Button>
}
