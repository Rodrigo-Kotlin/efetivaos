import { AlertCircle, CheckCircle, Clock, RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { ErrorState } from '@/components/shared/operational-ui'
import { getStatusLabel, MOVEMENT_TYPE_LABELS } from './schemas/finance-schemas'
import { useTransactionDetail } from './queries/finance-queries'
import type { FinancialTransactionList } from '@/types/database'

type FinancialTitleDetailDrawerProps = {
  transactionId: string | null
  title: string
  settleLabel: string
  onClose: () => void
  onSettle: () => void
  onReverse: () => void
}

const STATUS_ICONS: Record<string, typeof Clock> = { pending: Clock, settled: CheckCircle, cancelled: AlertCircle }
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  settled: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-600',
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value + 'T00:00:00').toLocaleDateString('pt-BR')
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-900">{value}</dd></div>
}

export function FinancialTitleDetailDrawer({ transactionId, title, settleLabel, onClose, onSettle, onReverse }: FinancialTitleDetailDrawerProps) {
  const { data: tx, isLoading, isError, refetch } = useTransactionDetail(transactionId)

  if (!transactionId) return null

  return (
    <Drawer open={!!transactionId} onOpenChange={(open) => { if (!open) onClose() }} title={title}>
      {isLoading ? (
        <div className="space-y-4" aria-label="Carregando detalhes" role="status">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
          <span className="sr-only">Carregando detalhes...</span>
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !tx ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">Registro nao encontrado.</div>
      ) : (
        <TitleDetailContent tx={tx} settleLabel={settleLabel} onSettle={onSettle} onReverse={onReverse} />
      )}
    </Drawer>
  )
}

function TitleDetailContent({ tx, settleLabel, onSettle, onReverse }: { tx: FinancialTransactionList; settleLabel: string; onSettle: () => void; onReverse: () => void }) {
  const StatusIcon = STATUS_ICONS[tx.status] || Clock

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold text-slate-950">{tx.description}</h2>
          <p className="mt-1 text-sm text-slate-500">{MOVEMENT_TYPE_LABELS[tx.movement_type]} · {formatDate(tx.transaction_date)}</p>
        </div>
        <Badge className={STATUS_COLORS[tx.status]}><StatusIcon className="mr-1 size-3" />{getStatusLabel(tx.status, tx.movement_type)}</Badge>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DetailField label="Valor" value={formatCurrency(tx.amount)} />
        <DetailField label="Competencia" value={formatDate(tx.competence_date)} />
        <DetailField label="Vencimento" value={formatDate(tx.due_date)} />
        <DetailField label="Data de pagamento/recebimento" value={formatDate(tx.payment_date)} />
        <DetailField label="Pessoa" value={tx.party_name} />
        <DetailField label="Conta financeira" value={tx.origin_account_name} />
        <DetailField label="Categoria" value={tx.category_name} />
        <DetailField label="Centro de custo" value={tx.cost_center_name} />
        <DetailField label="Linha de serviço" value={tx.service_line_name} />
        <DetailField label="Forma de pagamento" value={tx.payment_method_name} />
        <DetailField label="ID da transação" value={tx.id} />
        <DetailField label="Observacao" value={tx.notes} />
      </dl>

      {(tx.status === 'pending' || tx.status === 'settled') && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {tx.status === 'pending' && <Button onClick={onSettle}>{settleLabel}</Button>}
          {tx.status === 'settled' && <Button variant="outline" onClick={onReverse}><RotateCcw className="mr-1 size-3" />Estornar</Button>}
        </div>
      )}
    </div>
  )
}
