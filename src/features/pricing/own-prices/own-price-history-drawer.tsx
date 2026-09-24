import { Badge } from '@/components/ui/badge'
import { Drawer } from '@/components/ui/drawer'
import { formatComparisonCurrency, formatComparisonDate } from '@/features/pricing/comparison/comparison-helpers'
import type { OwnPriceProposalItem } from '@/types/database'

type OwnPriceHistoryDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemCode: string
  itemName: string
  proposals: OwnPriceProposalItem[]
  isAdmin: boolean
  currentProposalId?: string | null
  viewer?: { id: string; fullName: string | null } | null
}

type PriceChange = {
  previousPrice: string
  difference: number
  percentage: number | null
}

function proposalTimestamp(proposal: OwnPriceProposalItem): string {
  return proposal.submitted_at || proposal.created_at
}

export function sortOwnPriceHistory(proposals: OwnPriceProposalItem[]): OwnPriceProposalItem[] {
  return [...proposals].sort((a, b) => {
    const byDate = proposalTimestamp(b).localeCompare(proposalTimestamp(a))
    return byDate || a.id.localeCompare(b.id)
  })
}

export function ownPriceChangeFor(
  proposal: OwnPriceProposalItem,
  proposals: OwnPriceProposalItem[],
): PriceChange | null {
  if (proposal.status === 'inactive') return null

  const referenceDate = proposal.status === 'approved'
    ? proposal.approved_at ?? proposalTimestamp(proposal)
    : proposalTimestamp(proposal)
  const previous = proposals
    .filter((candidate) => (
      candidate.id !== proposal.id
      && candidate.status === 'approved'
      && candidate.approved_at !== null
      && candidate.approved_at < referenceDate
    ))
    .sort((a, b) => (b.approved_at ?? '').localeCompare(a.approved_at ?? ''))[0]

  if (!previous) return null
  const previousValue = Number(previous.sale_price)
  const newValue = Number(proposal.sale_price)
  if (!Number.isFinite(previousValue) || !Number.isFinite(newValue)) return null

  const difference = newValue - previousValue
  return {
    previousPrice: previous.sale_price,
    difference,
    percentage: previousValue === 0 ? null : (difference / previousValue) * 100,
  }
}

function ProposalStatus({ status }: { status: OwnPriceProposalItem['status'] }) {
  if (status === 'pending') return <Badge variant="warning">Pendente</Badge>
  if (status === 'approved') return <Badge>Aprovado</Badge>
  return <Badge variant="secondary">Inativo</Badge>
}

function responsibleLabel(userId: string | null, viewer: OwnPriceHistoryDrawerProps['viewer']): string {
  if (!userId) return 'Nao informado'
  if (viewer?.id === userId) return viewer.fullName || 'Voce'
  return userId
}

function PriceChangeSummary({ proposal, proposals }: { proposal: OwnPriceProposalItem; proposals: OwnPriceProposalItem[] }) {
  const change = ownPriceChangeFor(proposal, proposals)
  if (!change) return null

  return (
    <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3" aria-label="Variacao do preco">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">Comparacao com o preco aprovado anterior</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-slate-500">Preco anterior</dt><dd className="font-semibold">{formatComparisonCurrency(change.previousPrice)}</dd></div>
        <div><dt className="text-xs text-slate-500">Novo preco</dt><dd className="font-semibold">{formatComparisonCurrency(proposal.sale_price)}</dd></div>
        <div><dt className="text-xs text-slate-500">Diferenca</dt><dd className="font-semibold">{formatComparisonCurrency(change.difference.toFixed(2))}</dd></div>
        <div><dt className="text-xs text-slate-500">Variacao</dt><dd className="font-semibold">{change.percentage === null ? 'Nao calculada' : `${change.percentage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}</dd></div>
      </dl>
    </section>
  )
}

export function OwnPriceHistoryDrawer({
  open,
  onOpenChange,
  itemCode,
  itemName,
  proposals,
  isAdmin,
  currentProposalId = null,
  viewer = null,
}: OwnPriceHistoryDrawerProps) {
  const history = sortOwnPriceHistory(proposals)

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Historico de precos · ${itemCode}`}
      description={itemName}
      className="max-w-3xl"
    >
      {history.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
          <p className="font-semibold text-slate-900">Nenhuma proposta anterior</p>
          <p className="mt-1 text-sm text-slate-600">Este servico ainda nao possui historico de precos proprios.</p>
        </div>
      ) : (
        <div className="space-y-4" aria-label="Propostas em ordem cronologica decrescente">
          {history.map((proposal) => (
            <article key={proposal.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ProposalStatus status={proposal.status} />
                    {proposal.id === currentProposalId && <Badge variant="outline">Preco vigente</Badge>}
                    <span className="text-xs font-semibold text-slate-500">Revisao {proposal.revision}</span>
                  </div>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Preco proposto</p>
                  <p className="font-serif text-2xl font-bold text-emerald-950">{formatComparisonCurrency(proposal.sale_price)}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Preco aprovado</p>
                  <p className="mt-1 font-serif text-lg font-bold text-slate-950">
                    {proposal.status === 'approved' ? formatComparisonCurrency(proposal.sale_price) : '—'}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-semibold uppercase text-slate-500">Submetida em</dt><dd className="mt-1">{formatComparisonDate(proposal.submitted_at)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-slate-500">Responsavel pela submissao</dt><dd className="mt-1 break-all font-mono text-xs">{responsibleLabel(proposal.submitted_by, viewer)}</dd></div>
                {proposal.status === 'approved' && (
                  <div><dt className="text-xs font-semibold uppercase text-slate-500">Aprovada em</dt><dd className="mt-1">{formatComparisonDate(proposal.approved_at)}</dd></div>
                )}
                {proposal.status === 'inactive' && proposal.approved_at && (
                  <div><dt className="text-xs font-semibold uppercase text-slate-500">Decidida em</dt><dd className="mt-1">{formatComparisonDate(proposal.approved_at)}</dd></div>
                )}
                {proposal.approved_by && (
                  <div><dt className="text-xs font-semibold uppercase text-slate-500">Responsavel pela decisao</dt><dd className="mt-1 break-all font-mono text-xs">{responsibleLabel(proposal.approved_by, viewer)}</dd></div>
                )}
                {isAdmin && (
                  <div><dt className="text-xs font-semibold uppercase text-slate-500">Custo interno</dt><dd className="mt-1">{proposal.internal_cost === null ? 'Nao informado' : formatComparisonCurrency(proposal.internal_cost)}</dd></div>
                )}
                <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">Justificativa</dt><dd className="mt-1 whitespace-pre-wrap break-words">{proposal.decision_notes || 'Nao informada.'}</dd></div>
              </dl>

              <PriceChangeSummary proposal={proposal} proposals={history} />
            </article>
          ))}
        </div>
      )}
    </Drawer>
  )
}
