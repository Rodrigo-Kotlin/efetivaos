import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table'
import { ArrowUpDown, ListChecks, Star } from 'lucide-react'
import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableShell } from '@/features/pricing/components/operational-ui'
import { formatComparisonCurrency, formatComparisonDate } from './comparison-helpers'
import { ComparisonStatusBadge } from './comparison-status'
import type { ComparisonRow, ComparisonStatus } from './comparison-types'

import { cn } from '@/lib/utils'

type ComparisonTableProps = {
  rows: ComparisonRow[]
  sorting: SortingState
  onSortingChange: (state: SortingState) => void
  globalFilter: string
  onOpenOffers: (row: ComparisonRow) => void
}

function statusForRow(row: ComparisonRow): ComparisonStatus {
  if (row.best_unit_price === null) return 'no_offer'
  if (row.best_validity_not_informed) return 'validity_not_informed'
  return 'with_offer'
}

function responsiveClass(id: string) {
  if (id === 'actions') return 'sticky right-0 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)]'
  if (id === 'unit') return 'hidden md:table-cell'
  if (id === 'category_name' || id === 'validity') return 'hidden lg:table-cell'
  if (id === 'other_offers') return 'hidden md:table-cell'
  return ''
}

export function ComparisonTable({ rows, sorting, onSortingChange, globalFilter, onOpenOffers }: ComparisonTableProps) {
  const columns = useMemo<ColumnDef<ComparisonRow>[]>(() => [
    { accessorKey: 'code', header: 'Código', cell: ({ row }) => <span className="font-mono text-xs font-bold text-emerald-900">{row.original.code}</span> },
    { id: 'item_name', accessorFn: (row) => row.item_name, header: 'Item / serviço', cell: ({ row }) => <strong className="font-semibold text-slate-950">{row.original.item_name}</strong>, sortingFn: 'alphanumeric' },
    { id: 'category_name', accessorFn: (row) => row.category_name, header: 'Categoria', cell: ({ row }) => row.original.category_name },
    { id: 'unit', accessorKey: 'unit', header: 'Unidade' },
    {
      id: 'best_cost',
      accessorFn: (row) => (row.best_unit_price === null ? Number.POSITIVE_INFINITY : Number(row.best_unit_price)),
      header: 'Menor custo vigente',
      cell: ({ row }) => {
        const item = row.original
        const status = statusForRow(item)
        if (status === 'no_offer') {
          return <span className="text-sm text-slate-500">Sem oferta vigente</span>
        }
        return (
          <div className="space-y-1">
            <p className="font-serif text-base font-bold text-slate-950">{formatComparisonCurrency(item.best_unit_price)}</p>
            <p className="text-xs font-semibold text-slate-600">{item.best_supplier_name}</p>
          </div>
        )
      },
    },
    {
      id: 'best_supplier',
      accessorFn: (row) => row.best_supplier_name,
      header: 'Fornecedor',
      cell: ({ row }) => row.original.best_supplier_name ?? '—',
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
      id: 'validity',
      accessorFn: (row) => row.best_valid_until ?? '9999-12-31',
      header: 'Validade',
      cell: ({ row }) => {
        const item = row.original
        if (item.best_unit_price === null) return <span className="text-xs text-slate-500">—</span>
        if (item.best_validity_not_informed || item.best_valid_until === null) {
          return <Badge variant="outline" className="border-amber-300 text-amber-800">Validade não informada</Badge>
        }
        return <span className="text-sm text-slate-700">{formatComparisonDate(item.best_valid_until)}</span>
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = statusForRow(row.original)
        if (status === 'with_offer') {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
              <Star className="size-3.5" /> Melhor custo
            </span>
          )
        }
        return <ComparisonStatusBadge status={status} />
      },
    },
    {
      id: 'actions',
      enableSorting: false,
      header: () => <span className="sr-only">Ações</span>,
      cell: ({ row }) => (
        <Button type="button" size="sm" variant="ghost" onClick={() => onOpenOffers(row.original)} aria-label={`Abrir ofertas de ${row.original.item_name}`}>
          Ver ofertas
        </Button>
      ),
    },
  ], [onOpenOffers])

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
      <table className="w-full min-w-[1080px] text-left text-sm" aria-label="Comparação de custos">
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
