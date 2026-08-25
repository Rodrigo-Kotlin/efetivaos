import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnDef, type FilterFn, type SortingState } from '@tanstack/react-table'
import { ArrowUpDown, Eye, Pencil, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, PageHeader, selectClassName, TableShell, TableSkeleton } from '@/components/shared/operational-ui'

import { formatDate, formatDateTime, matchesValidity, type ValidityFilter } from './quotation.helpers'
import { useQuotations } from './quotation.queries'
import { QuotationStatusBadge, QuotationValidityBadge } from './quotation-badges'
import type { QuotationListRow } from './quotation.types'

type StatusFilter = 'all' | QuotationListRow['status']

const quotationSearch: FilterFn<QuotationListRow> = (row, _columnId, value: string) => {
  const term = value.toLocaleLowerCase('pt-BR').trim()
  return !term || row.original.reference_number?.toLocaleLowerCase('pt-BR').includes(term) || row.original.supplier.name.toLocaleLowerCase('pt-BR').includes(term)
}

function responsiveColumnClass(id: string) {
  if (id === 'actions') return 'sticky right-0 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)]'
  if (id === 'updated_at' || id === 'item_count') return 'hidden lg:table-cell'
  if (id === 'received_at') return 'hidden md:table-cell'
  return ''
}

function QuotationCard({ quotation }: { quotation: QuotationListRow }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Referência</p><h2 className="mt-1 font-serif text-xl font-semibold">{quotation.reference_number || 'Sem referência'}</h2><p className="mt-1 text-sm font-medium text-slate-700">{quotation.supplier.name}</p></div><QuotationStatusBadge status={quotation.status} /></div>
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs font-semibold text-slate-500">Recebida</dt><dd>{formatDate(quotation.received_at)}</dd></div><div><dt className="text-xs font-semibold text-slate-500">Validade</dt><dd>{formatDate(quotation.valid_until)}</dd></div><div><dt className="text-xs font-semibold text-slate-500">Itens</dt><dd>{quotation.quotation_items.length}</dd></div><div><dt className="text-xs font-semibold text-slate-500">Atualizada</dt><dd>{formatDateTime(quotation.updated_at)}</dd></div></dl>
    <div className="mt-3"><QuotationValidityBadge validUntil={quotation.valid_until} /></div>
    <Button className="mt-4 w-full" asChild variant="outline"><Link to={`/pricing/quotations/${quotation.id}`}>{quotation.status === 'draft' ? <Pencil className="size-4" /> : <Eye className="size-4" />}{quotation.status === 'draft' ? 'Editar cotação' : 'Ver detalhes'}</Link></Button>
  </article>
}

export default function QuotationsPage() {
  const query = useQuotations()
  const quotations = query.data ?? []
  const [search, setSearch] = useState('')
  const [supplier, setSupplier] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [validity, setValidity] = useState<ValidityFilter>('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'received_at', desc: true }])
  const suppliers = Array.from(new Map(quotations.map((quotation) => [quotation.supplier.id, quotation.supplier])).values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const columns = useMemo<ColumnDef<QuotationListRow>[]>(() => [
    { accessorKey: 'reference_number', header: 'Referência', cell: ({ row }) => <strong className="font-semibold text-slate-950">{row.original.reference_number || 'Sem referência'}</strong> },
    { id: 'supplier', accessorFn: (row) => row.supplier.name, header: 'Fornecedor', filterFn: (row, _id, value) => value === 'all' || row.original.supplier.id === value },
    { accessorKey: 'received_at', header: 'Recebida', cell: ({ getValue }) => formatDate(getValue<string>()) },
    {
      accessorKey: 'valid_until', header: 'Validade',
      cell: ({ row }) => <div className="space-y-1"><span className="block">{formatDate(row.original.valid_until)}</span><QuotationValidityBadge validUntil={row.original.valid_until} /></div>,
      filterFn: (row, _id, value: ValidityFilter) => matchesValidity(row.original.valid_until, value),
    },
    { id: 'item_count', accessorFn: (row) => row.quotation_items.length, header: 'Itens' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <QuotationStatusBadge status={row.original.status} />, filterFn: (row, _id, value: StatusFilter) => value === 'all' || row.original.status === value },
    { accessorKey: 'updated_at', header: 'Atualizada', cell: ({ getValue }) => formatDateTime(getValue<string>()) },
    {
      id: 'actions', header: () => <span className="sr-only">Ações</span>, enableSorting: false,
      cell: ({ row }) => <Button asChild variant="ghost" size="sm"><Link aria-label={`${row.original.status === 'draft' ? 'Editar' : 'Ver'} cotação ${row.original.reference_number || 'sem referência'}`} to={`/pricing/quotations/${row.original.id}`}>{row.original.status === 'draft' ? <Pencil className="size-4" /> : <Eye className="size-4" />}<span className="hidden xl:inline">{row.original.status === 'draft' ? 'Editar' : 'Detalhes'}</span></Link></Button>,
    },
  ], [])

  // TanStack Table intentionally exposes non-memoizable functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: quotations,
    columns,
    state: { globalFilter: search, columnFilters: [{ id: 'supplier', value: supplier }, { id: 'status', value: status }, { id: 'valid_until', value: validity }], sorting },
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    globalFilterFn: quotationSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  const rows = table.getRowModel().rows
  const clearFilters = () => { setSearch(''); setSupplier('all'); setStatus('all'); setValidity('all') }
  const mobileSort = `${sorting[0]?.id ?? 'received_at'}:${sorting[0]?.desc ? 'desc' : 'asc'}`

  function changeMobileSort(value: string) {
    const [id, direction] = value.split(':')
    setSorting([{ id, desc: direction === 'desc' }])
  }

  return <div className="mx-auto max-w-[1480px]">
    <PageHeader eyebrow="Motor de Preços" title="Cotações" description="Registre documentos recebidos e acompanhe validade e estado." actions={<Button asChild><Link to="/pricing/quotations/new"><Plus className="size-4" /> Nova cotação</Link></Button>} />
    <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_repeat(3,12rem)]">
      <label className="relative"><span className="sr-only">Buscar por referência ou fornecedor</span><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" /><Input className="pl-9" placeholder="Buscar referência ou fornecedor..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label><span className="sr-only">Filtrar por fornecedor</span><select className={`${selectClassName} w-full`} value={supplier} onChange={(event) => setSupplier(event.target.value)}><option value="all">Fornecedores: todos</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span className="sr-only">Filtrar por status</span><select className={`${selectClassName} w-full`} value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="all">Status: todos</option><option value="draft">Rascunho</option><option value="active">Ativa</option><option value="cancelled">Cancelada</option></select></label>
      <label><span className="sr-only">Filtrar por validade</span><select className={`${selectClassName} w-full`} value={validity} onChange={(event) => setValidity(event.target.value as ValidityFilter)}><option value="all">Validade: todas</option><option value="valid">Vigentes</option><option value="expired">Vencidas</option><option value="no-validity">Sem validade</option></select></label>
      <label className="md:hidden"><span className="sr-only">Ordenar cotações no celular</span><select className={`${selectClassName} w-full`} value={mobileSort} onChange={(event) => changeMobileSort(event.target.value)}><option value="received_at:desc">Recebida: mais recente</option><option value="received_at:asc">Recebida: mais antiga</option><option value="valid_until:asc">Validade: mais próxima</option><option value="valid_until:desc">Validade: mais distante</option><option value="supplier:asc">Fornecedor: A a Z</option><option value="supplier:desc">Fornecedor: Z a A</option><option value="updated_at:desc">Atualizada: mais recente</option><option value="updated_at:asc">Atualizada: mais antiga</option></select></label>
    </div>
    {query.isLoading ? <TableSkeleton columns={8} /> : query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : quotations.length === 0 ? <EmptyState title="Nenhuma cotação cadastrada" description="Registre a primeira cotação de fornecedor para começar a formar a base de preços." action={<Button asChild><Link to="/pricing/quotations/new"><Plus className="size-4" /> Nova cotação</Link></Button>} /> : rows.length === 0 ? <EmptyState title="Nenhuma cotação encontrada" description="Ajuste a busca ou os filtros para encontrar outras cotações." action={<Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>} /> : <><div className="space-y-3 md:hidden" aria-label="Cotações em cartões">{rows.map((row) => <QuotationCard key={row.id} quotation={row.original} />)}</div><TableShell className="hidden md:block"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => { const direction = header.column.getIsSorted(); return <th key={header.id} aria-sort={direction ? direction === 'asc' ? 'ascending' : 'descending' : undefined} className={`px-4 py-3 ${responsiveColumnClass(header.column.id)}`}>{header.column.getCanSort() ? <button className="inline-flex items-center gap-1.5 hover:text-slate-900" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<ArrowUpDown className="size-3.5" /></button> : flexRender(header.column.columnDef.header, header.getContext())}</th>})}</tr>)}</thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr className="hover:bg-slate-50/70" key={row.id}>{row.getVisibleCells().map((cell) => <td className={`px-4 py-4 align-top text-slate-700 ${responsiveColumnClass(cell.column.id)}`} key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></TableShell></>}
  </div>
}
