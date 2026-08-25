import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table'
import { AlertTriangle, ArrowUpDown, FileQuestion, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Drawer } from '@/components/ui/drawer'
import { TableShell } from '@/components/shared/operational-ui'
import { formatComparisonCurrency, formatComparisonDate, isOfferStillValid } from './comparison-helpers'
import { useComparisonOffers } from './comparison-queries'
import type { ComparisonOffer } from './comparison-types'

import { TableSkeleton, ErrorState } from '@/components/shared/operational-ui'

type OffersDrawerProps = {
  catalogItemId: string | null
  itemCode?: string
  itemName?: string
  onOpenChange: (open: boolean) => void
}

function ValidityBadge({ offer }: { offer: ComparisonOffer }) {
  if (offer.quotation_status === 'cancelled') return <Badge variant="warning">Cancelada</Badge>
  if (offer.quotation_status === 'draft') return <Badge variant="secondary">Rascunho</Badge>
  if (offer.is_expired) return <Badge variant="warning">Vencida</Badge>
  if (offer.validity_not_informed) return <Badge variant="outline"><FileQuestion className="size-3.5" /> Validade não informada</Badge>
  return <Badge>Vigente</Badge>
}

function OfferRow({ offer, highlight }: { offer: ComparisonOffer; highlight: boolean }) {
  return (
    <article className={`rounded-xl border ${highlight ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-white'} p-4 shadow-sm`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fornecedor</p>
          <h3 className="font-serif text-base font-semibold text-slate-950">{offer.supplier_name}</h3>
          <p className="mt-1 text-xs text-slate-500">Cotação {offer.reference_number || 'sem referência'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Valor unitário</p>
          <p className="font-serif text-xl font-semibold text-emerald-900">{formatComparisonCurrency(offer.unit_price)}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div><dt className="font-bold text-slate-500">Recebida</dt><dd>{formatComparisonDate(offer.received_at)}</dd></div>
        <div><dt className="font-bold text-slate-500">Validade</dt><dd>{formatComparisonDate(offer.valid_until)}</dd></div>
        <div><dt className="font-bold text-slate-500">Status</dt><dd><ValidityBadge offer={offer} /></dd></div>
        <div><dt className="font-bold text-slate-500">Descrição original</dt><dd>{offer.supplier_description || '—'}</dd></div>
      </dl>
      <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
        <div><dt className="font-bold text-slate-500">Código do fornecedor</dt><dd>{offer.supplier_item_code || '—'}</dd></div>
        <div>
          <dt className="font-bold text-slate-500">Validade real</dt>
          <dd>
            {offer.validity_not_informed
              ? <span className="inline-flex items-center gap-1 text-amber-800"><AlertTriangle className="size-3.5" /> Validade não informada</span>
              : isOfferStillValid(offer.valid_until)
                ? <span className="text-emerald-800">Vigente</span>
                : <span className="text-amber-800">Vencida</span>}
          </dd>
        </div>
      </div>
    </article>
  )
}

function OffersTable({ offers }: { offers: ComparisonOffer[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'unit_price', desc: false }])
  // TanStack Table intentionally exposes non-memoizable functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: offers,
    columns: useMemo<ColumnDef<ComparisonOffer>[]>(() => [
      { id: 'supplier_name', header: 'Fornecedor', cell: ({ row }) => <strong className="font-semibold text-slate-950">{row.original.supplier_name}</strong> },
      { accessorKey: 'unit_price', header: 'Valor unitário', cell: ({ row }) => <span className="font-semibold text-emerald-900">{formatComparisonCurrency(row.original.unit_price)}</span> },
      { id: 'reference_number', header: 'Cotação', cell: ({ row }) => row.original.reference_number || '—' },
      { accessorKey: 'received_at', header: 'Recebida', cell: ({ row }) => formatComparisonDate(row.original.received_at) },
      { accessorKey: 'valid_until', header: 'Validade', cell: ({ row }) => formatComparisonDate(row.original.valid_until) },
      { id: 'status', header: 'Status', cell: ({ row }) => <ValidityBadge offer={row.original} /> },
    ], []),
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return (
    <TableShell>
      <table className="w-full min-w-[720px] text-left text-sm" aria-label="Ofertas vigentes">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const direction = header.column.getIsSorted()
                return (
                  <th key={header.id} className="px-4 py-3" aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}>
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
              {row.getVisibleCells().map((cell) => <td className="px-4 py-3.5 align-top text-slate-700" key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

export function OffersDrawer({ catalogItemId, itemCode, itemName, onOpenChange }: OffersDrawerProps) {
  const open = Boolean(catalogItemId)
  const query = useComparisonOffers(catalogItemId)
  const offers = query.data ?? []
  const eligible = offers.filter((offer) => offer.is_eligible)
  const historical = offers.filter((offer) => !offer.is_eligible)
  const titleSuffix = itemCode ? ` · ${itemCode}` : ''
  const title = itemName ? `${itemName}${titleSuffix}` : 'Ofertas'

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Ofertas vigentes ordenadas do menor custo para o maior. O histórico permanece disponível para auditoria."
    >
      {query.isLoading ? (
        <TableSkeleton columns={6} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : offers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">Nenhuma oferta registrada para este item.</p>
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="eligible-heading">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="eligible-heading" className="font-serif text-base font-semibold text-slate-950">Ofertas vigentes</h3>
              <span className="text-xs font-semibold text-slate-500">{eligible.length} elegíveis</span>
            </div>
            <div className="space-y-3 md:hidden">
              {eligible.map((offer) => <OfferRow key={offer.quotation_item_id} offer={offer} highlight={false} />)}
            </div>
            <div className="hidden md:block">
              <OffersTable offers={eligible} />
            </div>
          </section>

          {historical.length > 0 && (
            <section aria-labelledby="historical-heading">
              <div className="mb-3 flex items-center justify-between">
                <h3 id="historical-heading" className="font-serif text-base font-semibold text-slate-950">Histórico</h3>
                <span className="text-xs font-semibold text-slate-500">{historical.length} inelegíveis</span>
              </div>
              <div className="space-y-3 md:hidden">
                {historical.map((offer) => <OfferRow key={offer.quotation_item_id} offer={offer} highlight={false} />)}
              </div>
              <div className="hidden md:block space-y-3">
                {historical.map((offer) => <OfferRow key={offer.quotation_item_id} offer={offer} highlight={false} />)}
              </div>
            </section>
          )}

          <button
            type="button"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </Drawer>
  )
}
