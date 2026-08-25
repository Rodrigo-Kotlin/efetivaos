import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnDef, type FilterFn, type SortingState } from '@tanstack/react-table'
import { ArrowUpDown, Eye, Pencil, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, PageHeader, selectClassName, StatusBadge, TableShell, TableSkeleton } from '@/components/shared/operational-ui'

import ClientForm from '@/features/crm/pages/ClientForm'
import ClientDetails from '@/features/crm/pages/ClientDetails'

import { useOnlineStatus } from '@/hooks/use-online-status'
import { useClientLists, useCreateClientMutation, useSetClientStatusMutation, useUpdateClientMutation } from '@/features/crm/queries/client-queries'
import type { ClientListRow } from '@/types/database'

type StatusFilter = 'all' | 'active' | 'inactive'
type TypeFilter = 'all' | 'company' | 'individual'

const clientSearch: FilterFn<ClientListRow> = (row, _columnId, value: string) => {
  const term = value.toLocaleLowerCase('pt-BR').trim()
  if (!term) return true
  return [
    row.original.legal_name?.toLocaleLowerCase('pt-BR') || '',
    row.original.trade_name?.toLocaleLowerCase('pt-BR') || '',
    row.original.tax_id?.toLocaleLowerCase('pt-BR') || '',
    row.original.email?.toLocaleLowerCase('pt-BR') || '',
    row.original.phone?.toLocaleLowerCase('pt-BR') || '',
  ].some((field) => field.includes(term))
}

function responsiveColumnClass(columnId: string) {
  if (columnId === 'actions') return 'sticky right-0 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)]'
  if (columnId === 'state') return 'hidden lg:table-cell'
  if (columnId === 'city') return 'hidden lg:table-cell'
  if (columnId === 'tax_id' || columnId === 'phone') return 'hidden xl:table-cell'
  return ''
}

export default function ClientsPage() {
  const online = useOnlineStatus()
  const [drawer, setDrawer] = useState<{ mode: 'create' | 'edit' | 'detail'; client?: ClientListRow } | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'legal_name', desc: false }])
  const filteredStatus = status === 'all' ? undefined : status
  const filteredType = type === 'all' ? undefined : type
  const clientsQuery = useClientLists({ search, status: filteredStatus, type: filteredType })

  const clients = clientsQuery.data ?? []
  const createClientMutation = useCreateClientMutation()
  const updateClientMutation = useUpdateClientMutation()
  const setClientStatusMutation = useSetClientStatusMutation()

  const isFormOpen = drawer?.mode === 'create' || drawer?.mode === 'edit'
  const editingClient = drawer && drawer.mode !== 'create' ? drawer.client : undefined

  const columnFilters = useMemo(
    () => [
      ...(status !== 'all' ? [{ id: 'status' as const, value: status }] : []),
      ...(type !== 'all' ? [{ id: 'type' as const, value: type }] : []),
    ],
    [status, type],
  )

  const columns = useMemo<ColumnDef<ClientListRow>[]>(() => [
      {
        accessorKey: 'legal_name',
        header: 'Cliente',
        cell: ({ row }) => {
          const cnpjCpf = row.original.tax_id?.replace(/^(\d{3})(\d{3})(\d{3})(\d{1})$/, '$1.$2.$3-$4') || 'N/A'
          return (
            <div>
              <strong className="font-semibold text-slate-950">{row.original.legal_name}</strong>
              {row.original.trade_name && <span className="mt-0.5 block text-xs text-slate-500">{row.original.trade_name}</span>}
              <div className="mt-1 text-xs text-slate-500">CPF/CNPJ: {cnpjCpf}</div>
            </div>
          )
        },
      },
      { accessorKey: 'tax_id', header: 'CPF/CNPJ', cell: ({ row }) => row.original.tax_id || 'N/A' },
      { accessorKey: 'city', header: 'Cidade', cell: ({ row }) => row.original.city || '—' },
      { accessorKey: 'state', header: 'UF', cell: ({ row }) => row.original.state || '—' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge active={row.original.status === 'active'} />,
      },
      {
        accessorKey: 'actions',
        enableSorting: false,
        header: () => <span className="sr-only">Ações</span>,
        cell: ({ row }) => {
          const onView = () => setDrawer({ mode: 'detail', client: row.original })
          const onEdit = () => setDrawer({ mode: 'edit', client: row.original })
          const onStatus = () => {
            const newStatus = row.original.status === 'active' ? 'inactive' : 'active'
            setClientStatusMutation.mutateAsync({ id: row.original.id, status: newStatus })
          }
          return (
            <div className="flex min-w-max justify-end gap-1">
              <Button aria-label={`Ver detalhes do cliente ${row.original.legal_name}`} size="sm" variant="ghost" onClick={onView}><Eye className="size-4" /><span className="hidden 2xl:inline">Detalhes</span></Button>
              <Button aria-label={`Editar ${row.original.legal_name}`} size="sm" variant="ghost" onClick={onEdit}><Pencil className="size-4" /><span className="hidden 2xl:inline">Editar</span></Button>
              <Button
                aria-label={`${row.original.status === 'active' ? 'Inativar' : 'Reativar'} ${row.original.legal_name}`}
                size="sm"
                variant="ghost"
                disabled={!online}
                onClick={onStatus}
              >
                {row.original.status === 'active' ? (
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="19" x2="19" y2="5"></line>
                    <line x1="1" y1="19" x2="12" y2="5"></line>
                    <line x1="12" y1="5" x2="19" y2="19"></line>
                  </svg>
                ) : (
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <line x1="12" y1="5" x2="19" y2="19"></line>
                    <line x1="5" y1="19" x2="12" y2="5"></line>
                  </svg>
                )}
                <span className="hidden 2xl:inline">{row.original.status === 'active' ? 'Inativar' : 'Reativar'}</span>
              </Button>
            </div>
          )
      },
    },
  ], [setClientStatusMutation, online])

  // TanStack Table intentionally exposes non-memoizable functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: clients,
    columns,
    state: { globalFilter: search, columnFilters, sorting },
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    globalFilterFn: clientSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const rows = table.getRowModel().rows

  async function openCreateDrawer() {
    setDrawer({ mode: 'create' })
  }

  async function submitClientInput(input: {
    legal_name: string
    trade_name: string | null
    client_type: 'company' | 'individual'
    tax_id: string
    email: string | null
    phone: string | null
    website: string | null
    zip_code: string | null
    street: string | null
    number: string | null
    complement: string | null
    district: string | null
    city: string | null
    state: string | null
    country: string
    notes: string | null
  }) {
    if (!online) {
      toast.error('Sem conexão. Reconecte para salvar o cliente.')
      return
    }
    try {
      if (drawer?.mode === 'edit' && drawer.client) {
        await updateClientMutation.mutateAsync({ id: drawer.client.id, input })
        toast.success('Cliente atualizado com sucesso.')
      } else {
        await createClientMutation.mutateAsync(input)
        toast.success('Cliente cadastrado com sucesso.')
      }
      setDrawer(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o cliente.')
    }
  }

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Motor de Precos"
        title="Clientes"
        description="Cadastros leves, sem apagar o histórico."
        actions={<Button disabled={!online} onClick={() => openCreateDrawer()}><Plus className="size-4" /> Novo cliente</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar cliente</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar por nome, CPF/CNPJ, e-mail..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          <span className="sr-only">Filtrar por tipo</span>
          <select className={`${selectClassName} w-full sm:w-80`} value={type} onChange={(event) => setType((event.target as HTMLSelectElement).value as TypeFilter)}>
            <option value="all">Tipo: todos</option>
            <option value="company">Pessoa Jurídica</option>
            <option value="individual">Pessoa Física</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar por status</span>
          <select className={`${selectClassName} w-full sm:w-80`} value={status} onChange={(event) => setStatus((event.target as HTMLSelectElement).value as StatusFilter)}>
            <option value="all">Status: todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </label>
      </div>

      {clientsQuery.isLoading ? (
        <TableSkeleton columns={8} />
      ) : clientsQuery.isError ? (
        <ErrorState onRetry={() => void clientsQuery.refetch()} />
      ) : clients.length === 0 ? (
        <EmptyState
          title="Nenhum cliente cadastrado"
          description="Cadastre o primeiro cliente para iniciar a base comercial do Efetiva OS."
          action={<Button onClick={() => openCreateDrawer()}><Plus className="size-4" /> Cadastrar cliente</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description="Ajuste a busca ou os filtros para encontrar outros clientes."
          action={<Button variant="outline" onClick={() => { setSearch(''); setType('all'); setStatus('all') }}>Limpar filtros</Button>}
        />
      ) : (
        <TableShell>
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const direction = header.column.getIsSorted()
                    return (
                      <th
                        aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
                        className={`px-4 py-3 ${responsiveColumnClass(header.column.id)}`}
                        key={header.id}
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button className="inline-flex items-center gap-1.5 text-left hover:text-slate-900" type="button" onClick={header.column.getToggleSortingHandler()}>
                            {flexRender(header.column.columnDef.header, header.getContext())}<ArrowUpDown className="size-3.5" aria-hidden="true" />
                          </button>
                        ) : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr className="hover:bg-slate-50/70" key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td className={`px-4 py-4 text-slate-700 ${responsiveColumnClass(cell.column.id)}`} key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}

      <Drawer
        open={Boolean(drawer)}
        onOpenChange={(open) => { if (!open) setDrawer(null) }}
        title={drawer?.mode === 'create' ? 'Novo cliente' : drawer?.mode === 'edit' ? 'Editar cliente' : drawer?.client?.legal_name ?? 'Cliente'}
        description={drawer?.mode === 'detail' ? 'Visualizar dados completos do cliente.' : 'Preencha os dados cadastrais. A Razão Social / Nome completo é obrigatória.'}
      >
        {isFormOpen ? (
          <ClientForm
            key={`${drawer?.mode ?? 'create'}-${drawer?.client?.id ?? 'new'}`}
            client={editingClient}
            pending={createClientMutation.isPending || updateClientMutation.isPending}
            onCancel={() => setDrawer(null)}
            onSubmit={submitClientInput}
          />
        ) : editingClient ? (
          <ClientDetails client={editingClient} onEdit={() => setDrawer({ mode: 'edit', client: editingClient })} />
        ) : null}
      </Drawer>
    </div>
  )
}