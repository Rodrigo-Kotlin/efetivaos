import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table'
import { ArrowUpDown, Pencil, Power, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { StatusBadge, TableShell } from '@/components/shared/operational-ui'
import { cn } from '@/lib/utils'

import type { CatalogCategoryRow, CatalogItemRow } from './catalog.types'

const headerClassName = 'border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500'
const cellClassName = 'border-b border-slate-100 px-4 py-3.5 text-sm text-slate-700 last:border-b-0'
const coreRowModel = getCoreRowModel()
const sortedRowModel = getSortedRowModel()

function DataTable<T>({ data, columns, label }: { data: T[]; columns: ColumnDef<T>[]; label: string }) {
  const [sorting, setSorting] = useState<SortingState>([])
  // TanStack Table intentionally exposes non-memoizable functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: coreRowModel, getSortedRowModel: sortedRowModel })

  return (
    <TableShell>
      <table className="w-full min-w-[760px]" aria-label={label}>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const direction = header.column.getIsSorted()
                return (
                  <th key={header.id} aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : undefined} className={cn(headerClassName, header.column.id === 'actions' && 'sticky right-0 bg-slate-50 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)]')}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
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
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/70">
              {row.getVisibleCells().map((cell) => <td key={cell.id} className={cn(cellClassName, cell.column.id === 'actions' && 'sticky right-0 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)]')}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

export function CatalogItemsTable({ items, statusPending, onEdit, onStatus }: { items: CatalogItemRow[]; statusPending: boolean; onEdit: (item: CatalogItemRow) => void; onStatus: (item: CatalogItemRow) => void }) {
  const columns = useMemo<ColumnDef<CatalogItemRow>[]>(() => [
    { accessorKey: 'code', header: 'Codigo', cell: ({ row }) => <span className="font-mono text-xs font-bold text-emerald-900">{row.original.code}</span> },
    { accessorKey: 'name', header: 'Item / servico', cell: ({ row }) => <div><strong className="font-semibold text-slate-950">{row.original.name}</strong>{row.original.description && <p className="mt-0.5 max-w-sm truncate text-xs text-slate-500">{row.original.description}</p>}</div> },
    { id: 'category', accessorFn: (item) => item.category.name, header: 'Categoria', cell: ({ row }) => <span>{row.original.category.name}{!row.original.category.active && <span className="ml-1 text-xs text-slate-500">(inativa)</span>}</span> },
    { accessorKey: 'unit', header: 'Unidade' },
    { accessorKey: 'active', header: 'Status', cell: ({ row }) => <StatusBadge active={row.original.active} /> },
    {
      id: 'actions',
      enableSorting: false,
      header: () => <span className="sr-only">Acoes</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" aria-label={`Editar item ${row.original.name}`} onClick={() => onEdit(row.original)}><Pencil className="size-4" /><span className="hidden lg:inline">Editar</span></Button>
          <Button size="sm" variant="ghost" disabled={statusPending} aria-label={`${row.original.active ? 'Inativar' : 'Reativar'} item ${row.original.name}`} onClick={() => onStatus(row.original)}>
            {row.original.active ? <Power className="size-4" /> : <RotateCcw className="size-4" />}<span className="hidden lg:inline">{row.original.active ? 'Inativar' : 'Reativar'}</span>
          </Button>
        </div>
      ),
    },
  ], [statusPending, onEdit, onStatus])
  return <DataTable data={items} columns={columns} label="Itens do catalogo" />
}

export function CatalogCategoriesTable({ categories, statusPending, onEdit, onStatus }: { categories: CatalogCategoryRow[]; statusPending: boolean; onEdit: (category: CatalogCategoryRow) => void; onStatus: (category: CatalogCategoryRow) => void }) {
  const columns = useMemo<ColumnDef<CatalogCategoryRow>[]>(() => [
    { accessorKey: 'name', header: 'Categoria', cell: ({ row }) => <strong className="font-semibold text-slate-950">{row.original.name}</strong> },
    { accessorKey: 'active', header: 'Status', cell: ({ row }) => <StatusBadge active={row.original.active} /> },
    {
      id: 'actions',
      enableSorting: false,
      header: () => <span className="sr-only">Acoes</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" aria-label={`Editar categoria ${row.original.name}`} onClick={() => onEdit(row.original)}><Pencil className="size-4" /><span className="hidden lg:inline">Editar</span></Button>
          <Button size="sm" variant="ghost" disabled={statusPending} aria-label={`${row.original.active ? 'Inativar' : 'Reativar'} categoria ${row.original.name}`} onClick={() => onStatus(row.original)}>
            {row.original.active ? <Power className="size-4" /> : <RotateCcw className="size-4" />}<span className="hidden lg:inline">{row.original.active ? 'Inativar' : 'Reativar'}</span>
          </Button>
        </div>
      ),
    },
  ], [statusPending, onEdit, onStatus])
  return <DataTable data={categories} columns={columns} label="Categorias do catalogo" />
}
