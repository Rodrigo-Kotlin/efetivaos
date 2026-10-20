import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { getStatusLabel } from '../schemas/finance-schemas'
import type { FinancialPayableList, FinancialReceivableList } from '@/types/database'

type CollectionRow = FinancialReceivableList | FinancialPayableList

const STATUS_ICONS = { pending: Clock, settled: CheckCircle, cancelled: XCircle } as const
const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  settled: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-600',
} as const

function fmt(value: string | number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

function fmtDate(value: string | null) {
  if (!value) return '-'
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function CollectionRowPreview({ row, viewHref }: { row: CollectionRow; viewHref: string }) {
  const StatusIcon = STATUS_ICONS[row.status]
  const amount = row.status === 'pending' ? row.open_amount : row.status === 'settled' ? row.settled_amount : row.original_amount
  const amountLabel = row.status === 'pending' ? 'Em aberto' : row.status === 'settled' ? 'Liquidado' : 'Valor'

  return (
    <Link
      to={viewHref}
      className="block rounded-lg border border-slate-100 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{row.description}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{row.party_name || 'Pessoa nao informada'}</p>
        </div>
        <Badge className={STATUS_COLORS[row.status]}>
          <StatusIcon className="mr-1 size-3" />
          {getStatusLabel(row.status, row.movement_type)}
        </Badge>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3 text-xs">
        <span className={row.overdue ? 'font-medium text-red-700' : 'text-slate-500'}>
          {row.overdue && <AlertTriangle className="mr-1 inline size-3" />}
          {fmtDate(row.due_date)}
        </span>
        <span className="text-right">
          <span className="block text-slate-500">{amountLabel}</span>
          <span className="font-mono font-medium text-slate-900">{fmt(amount)}</span>
        </span>
      </div>
    </Link>
  )
}

export function DashboardCollectionPreview({
  rows,
  isLoading,
  isError,
  emptyMessage,
  errorMessage,
  viewHref,
  viewLabel,
}: {
  rows?: CollectionRow[]
  isLoading: boolean
  isError: boolean
  emptyMessage: string
  errorMessage: string
  viewHref: string
  viewLabel: string
}) {
  if (isLoading) {
    return <div aria-label="Carregando contas financeiras" className="space-y-2"><div className="h-16 animate-pulse rounded-lg bg-slate-100" /><div className="h-16 animate-pulse rounded-lg bg-slate-100" /></div>
  }

  if (isError) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
  if (!rows?.length) return <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">{emptyMessage}</div>

  return (
    <>
      <div className="space-y-2">{rows.slice(0, 5).map(row => <CollectionRowPreview key={row.transaction_id} row={row} viewHref={viewHref} />)}</div>
      <Link to={viewHref} className="mt-3 block text-xs font-medium text-emerald-700 hover:underline">{viewLabel} &rarr;</Link>
    </>
  )
}
