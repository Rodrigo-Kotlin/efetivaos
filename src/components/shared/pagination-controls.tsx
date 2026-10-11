import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { pageItems } from './pagination-utils'

type PaginationControlsProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function PaginationControls({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationControlsProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(page, 1), pageCount)
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, total)

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-slate-600" aria-live="polite">{start}–{end} de {total} resultados</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="mr-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
          Por página
          <select className="rounded-lg border border-slate-300 bg-white px-2 py-1.5" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} aria-label="Registros por página">
            {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <Button type="button" variant="outline" size="sm" aria-label="Página anterior" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}><ChevronLeft aria-hidden="true" className="size-4" /> Anterior</Button>
        {pageItems(safePage, pageCount).map((item) => typeof item === 'string' ? <span key={item} aria-hidden="true" className="px-2 text-slate-400">…</span> : <Button key={item} type="button" size="sm" variant={item === safePage ? 'default' : 'outline'} aria-current={item === safePage ? 'page' : undefined} aria-label={`Página ${item}`} onClick={() => onPageChange(item)}>{item}</Button>)}
        <Button type="button" variant="outline" size="sm" aria-label="Próxima página" disabled={safePage >= pageCount} onClick={() => onPageChange(safePage + 1)}>Próxima <ChevronRight aria-hidden="true" className="size-4" /></Button>
      </div>
    </div>
  )
}
