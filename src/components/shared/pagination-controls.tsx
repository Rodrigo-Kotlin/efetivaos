import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

type PaginationControlsProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

function pageItems(page: number, pageCount: number) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)
  if (page <= 4) return [1, 2, 3, 4, 5, 'ellipsis-right'] as const
  if (page >= pageCount - 3) return ['ellipsis-left', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount] as const
  return ['ellipsis-left', page - 1, page, page + 1, 'ellipsis-right'] as const
}

export function PaginationControls({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationControlsProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-slate-600" aria-live="polite">{start}–{end} de {total}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="mr-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
          Por página
          <select className="rounded-lg border border-slate-300 bg-white px-2 py-1.5" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} aria-label="Registros por página">
            {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="size-4" /> Anterior</Button>
        {pageItems(page, pageCount).map((item) => typeof item === 'string' ? <span key={item} className="px-2 text-slate-400">…</span> : <Button key={item} type="button" size="sm" variant={item === page ? 'default' : 'outline'} aria-current={item === page ? 'page' : undefined} onClick={() => onPageChange(item)}>{item}</Button>)}
        <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Próxima <ChevronRight className="size-4" /></Button>
      </div>
    </div>
  )
}
