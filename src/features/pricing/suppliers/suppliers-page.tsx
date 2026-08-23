import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnDef, type FilterFn, type SortingState } from '@tanstack/react-table'
import { ArrowUpDown, Building2, Eye, Pencil, Plus, Power, PowerOff, Search } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, PageHeader, selectClassName, StatusBadge, TableShell, TableSkeleton } from '@/features/pricing/components/operational-ui'
import { useOnlineStatus } from '@/hooks/use-online-status'
import type { Supplier } from '@/types/database'

import { SupplierForm } from './supplier-form'
import { useCreateSupplier, useSetSupplierStatus, useSuppliers, useUpdateSupplier } from './supplier-queries'
import type { SupplierInput } from './supplier-schema'

type DrawerState = { mode: 'create' } | { mode: 'edit' | 'detail'; supplier: Supplier } | null
type StatusFilter = 'all' | 'active' | 'inactive'

const supplierSearch: FilterFn<Supplier> = (row, _columnId, value: string) => {
  const term = value.toLocaleLowerCase('pt-BR').trim()
  if (!term) return true
  return [row.original.name, row.original.legal_name, row.original.tax_id, row.original.category, row.original.contact_name, row.original.email, row.original.phone]
    .some((field) => field?.toLocaleLowerCase('pt-BR').includes(term))
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Nao foi possivel concluir a operacao.'
}

function confirmInactivation(supplier: Supplier) {
  return window.confirm(`Inativar o fornecedor ${supplier.name}? O historico sera preservado.`)
}

function responsiveColumnClass(columnId: string) {
  if (columnId === 'actions') return 'sticky right-0 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)]'
  if (columnId === 'category') return 'hidden md:table-cell'
  if (columnId === 'contact_name') return 'hidden lg:table-cell'
  if (columnId === 'tax_id' || columnId === 'phone') return 'hidden xl:table-cell'
  return ''
}

function SupplierDetails({ supplier, onEdit }: { supplier: Supplier; onEdit: () => void }) {
  const details = [
    ['Razao social', supplier.legal_name],
    ['CPF/CNPJ', supplier.tax_id],
    ['Segmento', supplier.category],
    ['Contato', supplier.contact_name],
    ['E-mail', supplier.email],
    ['Telefone / WhatsApp', supplier.phone],
    ['Observacoes', supplier.notes],
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
        <StatusBadge active={supplier.active} />
        <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="size-4" /> Editar</Button>
      </div>
      <dl className="divide-y divide-slate-100">
        {details.map(([label, value]) => (
          <div className="py-4" key={label}>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">{value || 'Nao informado'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default function SuppliersPage() {
  const online = useOnlineStatus()
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const suppliersQuery = useSuppliers()
  const createMutation = useCreateSupplier()
  const updateMutation = useUpdateSupplier()
  const statusMutation = useSetSupplierStatus()
  const suppliers = suppliersQuery.data ?? []

  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: 'name',
      header: 'Fornecedor',
      cell: ({ row }) => <div><strong className="font-semibold text-slate-950">{row.original.name}</strong>{row.original.legal_name && <span className="mt-0.5 block text-xs text-slate-500">{row.original.legal_name}</span>}</div>,
    },
    { accessorKey: 'tax_id', header: 'CNPJ / CPF', cell: ({ getValue }) => getValue<string | null>() || 'Nao informado' },
    { accessorKey: 'category', header: 'Segmento', cell: ({ getValue }) => getValue<string | null>() || 'Nao informado' },
    { accessorKey: 'contact_name', header: 'Contato', cell: ({ getValue }) => getValue<string | null>() || 'Nao informado' },
    { accessorKey: 'phone', header: 'Telefone', cell: ({ getValue }) => getValue<string | null>() || 'Nao informado' },
    {
      accessorKey: 'active',
      header: 'Status',
      cell: ({ row }) => <StatusBadge active={row.original.active} />,
      filterFn: (row, _columnId, value: StatusFilter) => value === 'all' || row.original.active === (value === 'active'),
    },
    {
      id: 'actions',
      enableSorting: false,
      header: () => <span className="sr-only">Acoes</span>,
      cell: ({ row }) => (
        <div className="flex min-w-max justify-end gap-1">
          <Button aria-label={`Ver detalhes de ${row.original.name}`} size="sm" variant="ghost" onClick={() => setDrawer({ mode: 'detail', supplier: row.original })}><Eye className="size-4" /><span className="hidden 2xl:inline">Detalhes</span></Button>
          <Button aria-label={`Editar ${row.original.name}`} size="sm" variant="ghost" onClick={() => setDrawer({ mode: 'edit', supplier: row.original })}><Pencil className="size-4" /><span className="hidden 2xl:inline">Editar</span></Button>
          <Button
            aria-label={`${row.original.active ? 'Inativar' : 'Reativar'} ${row.original.name}`}
            size="sm"
            variant="ghost"
            disabled={statusMutation.isPending}
            onClick={() => void changeStatus(row.original)}
          >
            {row.original.active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
            <span className="hidden 2xl:inline">{row.original.active ? 'Inativar' : 'Reativar'}</span>
          </Button>
        </div>
      ),
    },
  ]

  // TanStack Table intentionally exposes non-memoizable functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: suppliers,
    columns,
    state: { globalFilter: search, columnFilters: [{ id: 'active', value: status }], sorting },
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    globalFilterFn: supplierSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  async function submitSupplier(input: SupplierInput) {
    if (!online) {
      toast.error('Sem conexao. Reconecte para salvar o fornecedor.')
      return
    }
    if (drawer?.mode === 'edit' && drawer.supplier.active && !input.active && !confirmInactivation(drawer.supplier)) return
    try {
      if (drawer?.mode === 'edit') {
        await updateMutation.mutateAsync({ id: drawer.supplier.id, input })
        toast.success('Fornecedor atualizado.')
      } else {
        await createMutation.mutateAsync(input)
        toast.success('Fornecedor cadastrado com sucesso.')
      }
      setDrawer(null)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function changeStatus(supplier: Supplier) {
    if (!online) {
      toast.error('Sem conexao. Reconecte para alterar o fornecedor.')
      return
    }
    if (supplier.active && !confirmInactivation(supplier)) return
    try {
      await statusMutation.mutateAsync({ id: supplier.id, active: !supplier.active })
      toast.success(supplier.active ? 'Fornecedor inativado.' : 'Fornecedor reativado.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const rows = table.getRowModel().rows
  const editingSupplier = drawer && drawer.mode !== 'create' ? drawer.supplier : undefined
  const formOpen = drawer?.mode === 'create' || drawer?.mode === 'edit'

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Motor de Precos"
        title="Fornecedores"
        description="Cadastros leves, sem apagar o historico das cotacoes."
        actions={<Button disabled={!online} onClick={() => setDrawer({ mode: 'create' })}><Plus className="size-4" /> Novo fornecedor</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar fornecedor</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar fornecedor..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          <span className="sr-only">Filtrar por status</span>
          <select className={`${selectClassName} w-full sm:w-44`} value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            <option value="all">Status: todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </label>
      </div>

      {suppliersQuery.isLoading ? <TableSkeleton columns={6} /> : suppliersQuery.isError ? (
        <ErrorState onRetry={() => void suppliersQuery.refetch()} />
      ) : suppliers.length === 0 ? (
        <EmptyState
          title="Nenhum fornecedor cadastrado"
          description="Cadastre o primeiro fornecedor para comecar a registrar cotacoes."
          action={<Button onClick={() => setDrawer({ mode: 'create' })}><Plus className="size-4" /> Cadastrar fornecedor</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nenhum fornecedor encontrado"
          description="Ajuste a busca ou o filtro de status para encontrar outros fornecedores."
          action={<Button variant="outline" onClick={() => { setSearch(''); setStatus('all') }}>Limpar filtros</Button>}
        />
      ) : (
        <TableShell>
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              {table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id}>{headerGroup.headers.map((header) => {
                const direction = header.column.getIsSorted()
                return (
                  <th aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : undefined} className={`px-4 py-3 ${responsiveColumnClass(header.column.id)}`} key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button className="inline-flex items-center gap-1.5 text-left hover:text-slate-900" type="button" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}<ArrowUpDown className="size-3.5" />
                      </button>
                    ) : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                )
              })}</tr>)}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => <tr className="hover:bg-slate-50/70" key={row.id}>{row.getVisibleCells().map((cell) => <td className={`px-4 py-4 text-slate-700 ${responsiveColumnClass(cell.column.id)}`} key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
            </tbody>
          </table>
        </TableShell>
      )}

      <Drawer
        open={Boolean(drawer)}
        onOpenChange={(open) => { if (!open) setDrawer(null) }}
        title={drawer?.mode === 'create' ? 'Novo fornecedor' : drawer?.mode === 'edit' ? 'Editar fornecedor' : editingSupplier?.name ?? 'Fornecedor'}
        description={drawer?.mode === 'detail' ? 'Dados cadastrais do fornecedor.' : 'Preencha os dados cadastrais. Apenas o nome e obrigatorio.'}
      >
        {formOpen ? (
          <SupplierForm
            key={`${drawer.mode}-${editingSupplier?.id ?? 'new'}`}
            supplier={editingSupplier}
            pending={createMutation.isPending || updateMutation.isPending}
            onCancel={() => setDrawer(null)}
            onSubmit={submitSupplier}
          />
        ) : editingSupplier ? <SupplierDetails supplier={editingSupplier} onEdit={() => setDrawer({ mode: 'edit', supplier: editingSupplier })} /> : <Building2 className="size-8 text-slate-400" />}
      </Drawer>
    </div>
  )
}
