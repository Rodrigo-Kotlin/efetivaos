import { ArrowDownRight, ArrowUpRight, ArrowLeftRight, Clock, CheckCircle, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { FinancialMovementType, FinancialTransactionList } from '../types/finance-types'
import { getStatusLabel, MOVEMENT_TYPE_LABELS } from '../schemas/finance-schemas'

const STATUS_ICONS = { pending: Clock, settled: CheckCircle, cancelled: XCircle } as const
const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  settled: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-slate-100 text-slate-600',
} as const

const INCOMING_TYPES: FinancialMovementType[] = ['RECEITA', 'APORTE', 'EMPRESTIMO_RECEBIDO']
const OUTGOING_TYPES: FinancialMovementType[] = ['DESPESA', 'EMPRESTIMO_PAGO', 'RETIRADA']

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function sourceLabel(row: FinancialTransactionList) {
  if (row.category_name) return row.category_name
  if (row.origin_account_name && row.destination_account_name) {
    return `${row.origin_account_name} -> ${row.destination_account_name}`
  }
  return row.origin_account_name || row.destination_account_name || row.party_name || 'Sem origem informada'
}

function amountTone(type: FinancialMovementType) {
  if (INCOMING_TYPES.includes(type)) return 'text-emerald-700'
  if (OUTGOING_TYPES.includes(type)) return 'text-red-700'
  return 'text-slate-800'
}

function movementTone(type: FinancialMovementType) {
  if (type === 'RECEITA' || type === 'APORTE') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (type === 'DESPESA') return 'border-red-200 bg-red-50 text-red-700'
  if (type === 'TRANSFERENCIA') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (type === 'EMPRESTIMO_RECEBIDO') return 'border-indigo-200 bg-indigo-50 text-indigo-700'
  if (type === 'EMPRESTIMO_PAGO' || type === 'RETIRADA') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function statusTone(row: FinancialTransactionList) {
  if (row.status !== 'settled') return STATUS_COLORS[row.status] || 'bg-slate-100 text-slate-600'
  if (INCOMING_TYPES.includes(row.movement_type)) return 'bg-emerald-100 text-emerald-800'
  if (OUTGOING_TYPES.includes(row.movement_type)) return 'bg-red-100 text-red-800'
  if (row.movement_type === 'TRANSFERENCIA') return 'bg-blue-100 text-blue-800'
  return STATUS_COLORS.settled
}

function Amount({ row }: { row: FinancialTransactionList }) {
  const isIncoming = INCOMING_TYPES.includes(row.movement_type)
  const isOutgoing = OUTGOING_TYPES.includes(row.movement_type)
  const Icon = isIncoming ? ArrowUpRight : isOutgoing ? ArrowDownRight : ArrowLeftRight

  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap font-medium tabular-nums ${amountTone(row.movement_type)}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {formatCurrency(row.amount)}
    </span>
  )
}

function StatusBadge({ row }: { row: FinancialTransactionList }) {
  const StatusIcon = STATUS_ICONS[row.status] || Clock
  return (
    <Badge className={`px-2 py-0.5 text-[11px] ${statusTone(row)}`}>
      <StatusIcon className="mr-1 size-3" aria-hidden="true" />
      {getStatusLabel(row.status, row.movement_type)}
    </Badge>
  )
}

type FinancialMovementsListProps = {
  rows?: FinancialTransactionList[]
  isLoading: boolean
  isError: boolean
  viewHref: string
}

export function FinancialMovementsList({ rows, isLoading, isError, viewHref }: FinancialMovementsListProps) {
  if (isLoading) {
    return (
      <div aria-label="Carregando movimentações financeiras" className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-lg bg-slate-100" />)}
      </div>
    )
  }

  if (isError) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Erro ao carregar as movimentações financeiras.</div>
  }

  if (!rows?.length) {
    return <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Nenhuma movimentação encontrada neste período.</div>
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="hidden w-full text-sm md:table">
          <caption className="sr-only">Movimentações financeiras mais recentes do período</caption>
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="px-3 py-2.5">Data</th>
              <th scope="col" className="px-3 py-2.5">Descrição</th>
              <th scope="col" className="px-3 py-2.5">Tipo</th>
              <th scope="col" className="px-3 py-2.5">Categoria/Origem</th>
              <th scope="col" className="px-3 py-2.5">Status</th>
              <th scope="col" className="px-3 py-2.5 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-t border-slate-100 align-middle transition-colors hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{formatDate(row.transaction_date)}</td>
                <td className="max-w-[240px] px-3 py-2.5 font-medium text-slate-800" title={row.description}><span className="block truncate">{row.description}</span></td>
                <td className="px-3 py-2.5"><Badge variant="outline" className={`px-2 py-0.5 text-[11px] ${movementTone(row.movement_type)}`}>{MOVEMENT_TYPE_LABELS[row.movement_type]}</Badge></td>
                <td className="max-w-[190px] px-3 py-2.5 text-slate-600" title={sourceLabel(row)}><span className="block truncate">{sourceLabel(row)}</span></td>
                <td className="px-3 py-2.5"><StatusBadge row={row} /></td>
                <td className="px-3 py-2.5 text-right"><Amount row={row} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-slate-100 md:hidden" aria-label="Movimentações financeiras">
          {rows.map(row => (
            <li key={row.id} className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800" title={row.description}>{row.description}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(row.transaction_date)} · {sourceLabel(row)}</p>
                </div>
                <Amount row={row} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`px-2 py-0.5 text-[11px] ${movementTone(row.movement_type)}`}>{MOVEMENT_TYPE_LABELS[row.movement_type]}</Badge>
                <StatusBadge row={row} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link to={viewHref}>Ver lançamentos</Link>
        </Button>
      </div>
    </div>
  )
}
