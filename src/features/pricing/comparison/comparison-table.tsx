import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table'
import { ArrowUpDown, ListChecks } from 'lucide-react'
import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableShell } from '@/components/shared/operational-ui'

import { formatComparisonCurrency, formatComparisonDate, formatRuleScope, formatRuleValue } from './comparison-helpers'
import { ComparisonStatusBadge } from './comparison-status'
import type { ComparisonRow, ComparisonStatus } from './comparison-types'
import { CommercialStatusBadge } from './commercial-status'
import { reviewReasonLabel } from './commercial-status-helpers'

import { cn } from '@/lib/utils'

type ComparisonTableProps = {
  rows: ComparisonRow[]
  sorting: SortingState
  onSortingChange: (state: SortingState) => void
  globalFilter: string
  onOpenOffers: (row: ComparisonRow) => void
  onOpenReview: (row: ComparisonRow) => void
  canEditRules: boolean
  isAdmin: boolean
  onEditRule: () => void
}

function statusForRow(row: ComparisonRow): ComparisonStatus {
  if (row.best_cost === null) return 'no_offer'
  if (row.resolved_margin_rule_id === null) return 'no_rule'
  if (row.best_validity_not_informed) return 'validity_not_informed'
  return 'suggestion_available'
}

function responsiveClass(id: string) {
  if (id === 'actions') return 'sticky right-0 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)]'
  if (id === 'unit') return 'hidden md:table-cell'
  if (id === 'category' || id === 'validity') return 'hidden lg:table-cell'
  if (id === 'other_offers' || id === 'rule') return 'hidden md:table-cell'
  if (id === 'suggested_price' || id === 'approved_price') return 'hidden lg:table-cell'
  return ''
}

export function ComparisonTable({ rows, sorting, onSortingChange, globalFilter, onOpenOffers, onOpenReview, canEditRules, isAdmin, onEditRule }: ComparisonTableProps) {
  const columns = useMemo<ColumnDef<ComparisonRow>[]>(() => [
    { accessorKey: 'code', header: 'Codigo', cell: ({ row }) => <span className="font-mono text-xs font-bold text-emerald-900">{row.original.code}</span> },
    { id: 'item', accessorFn: (row) => row.item_name, header: 'Item / servico', cell: ({ row }) => <strong className="font-semibold text-slate-950">{row.original.item_name}</strong>, sortingFn: 'alphanumeric' },
    { id: 'category', accessorFn: (row) => row.category_name, header: 'Categoria', cell: ({ row }) => row.original.category_name },
    { id: 'unit', accessorKey: 'unit', header: 'Unidade' },
    {
      id: 'approved_price',
      accessorFn: (row) => (row.approved_final_price === null ? Number.POSITIVE_INFINITY : Number(row.approved_final_price)),
      header: 'Preco aprovado',
      cell: ({ row }) => row.original.approved_final_price === null
        ? <span className="text-xs text-slate-500">Ainda nao aprovado</span>
        : <div><p className="font-serif text-base font-bold text-emerald-950">{formatComparisonCurrency(row.original.approved_final_price)}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Valor comercial</p></div>,
    },
    {
      id: 'best_cost',
      accessorFn: (row) => (row.best_cost === null ? Number.POSITIVE_INFINITY : Number(row.best_cost)),
      header: 'Menor custo',
      cell: ({ row }) => {
        const item = row.original
        if (item.best_cost === null) {
          return <span className="text-sm text-slate-500">Sem oferta vigente</span>
        }
        return (
          <div className="space-y-0.5">
            <p className="font-serif text-base font-bold text-slate-950">{formatComparisonCurrency(item.best_cost)}</p>
            <p className="text-xs font-semibold text-slate-600">{item.best_supplier_name}</p>
          </div>
        )
      },
    },
    {
      id: 'rule',
      header: 'Regra',
      cell: ({ row }) => {
        const item = row.original
        if (item.best_cost === null) return <span className="text-xs text-slate-500">—</span>
        if (item.resolved_margin_rule_id === null) {
          return canEditRules
            ? <Button type="button" size="sm" variant="ghost" onClick={onEditRule}><span className="font-semibold text-amber-800">Sem regra</span></Button>
            : <Badge variant="warning">Sem regra</Badge>
        }
        return (
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-slate-800">{formatRuleValue(item.resolved_adjustment_type, item.resolved_adjustment_value)}</p>
            <p className="text-xs text-slate-500">{formatRuleScope(item.resolved_rule_scope, { category_name: item.category_name, item_name: item.item_name })}</p>
          </div>
        )
      },
    },
    {
      id: 'suggested_price',
      accessorFn: (row) => (row.suggested_price === null ? Number.POSITIVE_INFINITY : Number(row.suggested_price)),
      header: 'Preco sugerido',
      cell: ({ row }) => {
        const item = row.original
        if (item.best_cost === null) return <span className="text-xs text-slate-500">—</span>
        if (item.suggested_price === null) return <span className="text-xs text-amber-800">Sem regra</span>
        return (
          <button
            type="button"
            className="text-left"
            onClick={() => onOpenReview(item)}
            aria-label={`${isAdmin ? 'Revisar calculo' : 'Ver detalhes'} de preco sugerido para ${item.item_name}`}
          >
            <p className="font-serif text-base font-bold text-slate-950">{formatComparisonCurrency(item.suggested_price)}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">{isAdmin ? 'Revisar calculo' : 'Ver detalhes'}</p>
          </button>
        )
      },
    },
    {
      id: 'validity',
      accessorFn: (row) => row.best_valid_until ?? '9999-12-31',
      header: 'Validade',
      cell: ({ row }) => {
        const item = row.original
        if (item.best_cost === null) return <span className="text-xs text-slate-500">—</span>
        if (item.best_validity_not_informed || item.best_valid_until === null) {
          return <Badge variant="outline" className="border-amber-300 text-amber-800">Validade nao informada</Badge>
        }
        return <span className="text-sm text-slate-700">{formatComparisonDate(item.best_valid_until)}</span>
      },
    },
    {
      id: 'status',
      header: 'Status comercial',
      cell: ({ row }) => {
        const item = row.original
        const reason = reviewReasonLabel(item.review_reason)
        if (item.effective_status) return <div className="space-y-1"><CommercialStatusBadge status={item.effective_status} />{reason && <p className="max-w-40 text-xs text-amber-800">{reason}</p>}</div>
        return <ComparisonStatusBadge status={statusForRow(item)} />
      },
    },
    {
      id: 'other_offers',
      accessorFn: (row) => row.eligible_offer_count,
      header: 'Outras ofertas',
      cell: ({ row }) => {
        if (row.original.eligible_offer_count === 0) return <span className="text-xs text-slate-500">—</span>
        return (
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenOffers(row.original)} aria-label={`Ver ${row.original.eligible_offer_count} ofertas de ${row.original.item_name}`}>
            <ListChecks className="size-4" /> {row.original.eligible_offer_count} {row.original.eligible_offer_count === 1 ? 'oferta' : 'ofertas'}
          </Button>
        )
      },
    },
    {
      id: 'actions',
      enableSorting: false,
      header: () => <span className="sr-only">Acoes</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenOffers(row.original)} aria-label={`Abrir ofertas de ${row.original.item_name}`}>
            Ofertas
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenReview(row.original)} aria-label={`${isAdmin ? 'Revisar calculo' : 'Ver detalhes'} de preco sugerido para ${row.original.item_name}`}>
            {isAdmin ? 'Decidir' : 'Detalhes'}
          </Button>
        </div>
      ),
    },
  ], [onOpenOffers, onOpenReview, canEditRules, isAdmin, onEditRule])

  // TanStack Table intentionally exposes non-memoizable functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: (updater) => {
      if (typeof updater === 'function') {
        onSortingChange(updater(sorting))
      } else {
        onSortingChange(updater)
      }
    },
    globalFilterFn: (row, _id, value: string) => {
      const term = String(value ?? '').toLocaleLowerCase('pt-BR').trim()
      if (!term) return true
      const item = row.original as ComparisonRow
      return [item.code, item.item_name, item.category_name, item.best_supplier_name ?? '']
        .some((field) => field.toLocaleLowerCase('pt-BR').includes(term))
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <TableShell>
      <table className="w-full min-w-[1360px] text-left text-sm" aria-label="Comparacao de precos">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const direction = header.column.getIsSorted()
                return (
                  <th key={header.id} className={cn('px-4 py-3', responsiveClass(header.column.id))} aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {header.column.getCanSort() ? (
                      <button className="inline-flex items-center gap-1.5 hover:text-slate-900" type="button" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}<ArrowUpDown className="size-3.5" />
                      </button>
                    ) : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/70">
              {row.getVisibleCells().map((cell) => (
                <td className={cn('px-4 py-4 align-top text-slate-700', responsiveClass(cell.column.id))} key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}
