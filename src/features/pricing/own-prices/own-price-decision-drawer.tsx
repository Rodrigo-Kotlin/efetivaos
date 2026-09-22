import { AlertTriangle, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { textareaClassName } from '@/components/shared/operational-ui'
import { formatComparisonCurrency, formatComparisonDate } from '@/features/pricing/comparison/comparison-helpers'
import type { OwnPriceProposalItem } from '@/types/database'

import { useApproveOwnPriceProposal, useInactivateOwnPriceProposal, useOwnPriceDecisionToken, useUserDisplayName } from './own-prices-queries'

type Props = {
  proposal: OwnPriceProposalItem | null
  currentPrice?: string | null
  online: boolean
  onClose: () => void
}

function Facts({ proposal, currentPrice }: { proposal: OwnPriceProposalItem; currentPrice?: string | null }) {
  const { data: submitterName } = useUserDisplayName(proposal.submitted_by)
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      <div className="grid grid-cols-2 gap-2 py-3"><dt className="text-xs font-semibold text-slate-500">Servico</dt><dd className="text-right font-semibold text-slate-950">{proposal.item_name}</dd></div>
      <div className="grid grid-cols-2 gap-2 py-3"><dt className="text-xs font-semibold text-slate-500">Codigo do item</dt><dd className="font-mono text-right text-xs font-bold text-emerald-900">{proposal.item_code}</dd></div>
      <div className="grid grid-cols-2 gap-2 py-3"><dt className="text-xs font-semibold text-slate-500">Preco vigente</dt><dd className="text-right font-bold text-slate-950">{currentPrice ? formatComparisonCurrency(currentPrice) : 'Nao ha preco vigente'}</dd></div>
      <div className="grid grid-cols-2 gap-2 py-3"><dt className="text-xs font-semibold text-slate-500">Preco proposto</dt><dd className="text-right font-bold text-emerald-900">{formatComparisonCurrency(proposal.sale_price)}</dd></div>
      <div className="grid grid-cols-2 gap-2 py-3"><dt className="text-xs font-semibold text-slate-500">Custo interno</dt><dd className="text-right text-slate-950">{proposal.internal_cost ? formatComparisonCurrency(proposal.internal_cost) : 'Nao informado'}</dd></div>
      <div className="grid grid-cols-2 gap-2 py-3"><dt className="text-xs font-semibold text-slate-500">Justificativa</dt><dd className="text-right text-slate-950">{proposal.decision_notes || 'Nao informada'}</dd></div>
      <div className="grid grid-cols-2 gap-2 py-3"><dt className="text-xs font-semibold text-slate-500">Enviada em</dt><dd className="text-right text-slate-950">{formatComparisonDate(proposal.submitted_at)}</dd></div>
      <div className="grid grid-cols-2 gap-2 py-3"><dt className="text-xs font-semibold text-slate-500">Responsavel</dt><dd className="text-right text-slate-950">{submitterName || 'Equipe'}</dd></div>
    </dl>
  )
}

function DecisionWarning({ tokenReady, onReload }: { tokenReady: boolean; onReload: () => void }) {
  if (tokenReady) return null
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
      <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> Nao foi possivel preparar a decisao. A proposta pode ter mudado.</p>
      <Button className="shrink-0" size="sm" variant="outline" onClick={onReload}><ShieldCheck className="size-4" /> Recarregar</Button>
    </div>
  )
}

export function OwnPriceDecisionDrawer({ proposal, currentPrice, online, onClose }: Props) {
  const tokenQuery = useOwnPriceDecisionToken(proposal?.id ?? null)
  const approveMutation = useApproveOwnPriceProposal()
  const inactivateMutation = useInactivateOwnPriceProposal()
  const [rejecting, setRejecting] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const pending = approveMutation.isPending || inactivateMutation.isPending
  const tokenReady = Boolean(tokenQuery.data)

  const approve = async () => {
    if (!proposal || !tokenQuery.data) return
    if (!window.confirm(`Aprovar o preco de ${proposal.item_name} em ${formatComparisonCurrency(proposal.sale_price)}?`)) return
    try {
      await approveMutation.mutateAsync({ proposalId: proposal.id, expectedDecisionToken: tokenQuery.data })
      toast.success('Preco proprio aprovado.')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel aprovar a proposta.')
    }
  }

  const reject = async () => {
    if (!proposal || !tokenQuery.data) return
    const label = `Recusar a proposta de ${proposal.item_name}? O preco vigente (se houver) nao muda.`
    if (!window.confirm(rejectNotes ? `${label}\n\nObservacao: ${rejectNotes}` : label)) return
    try {
      await inactivateMutation.mutateAsync({ proposalId: proposal.id, expectedDecisionToken: tokenQuery.data, decisionNotes: rejectNotes || null })
      toast.success('Proposta recusada.')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel recusar a proposta.')
    }
  }

  return (
    <Drawer
      open={Boolean(proposal)}
      onOpenChange={(open) => { if (!open) onClose() }}
      title="Decidir proposta de preco proprio"
      description="Decisao exclusiva de Admin. Aprovar publica o preco na tabela; recusar mantem o preco vigente."
    >
      {proposal && (
        <div className="space-y-5">
          <Facts proposal={proposal} currentPrice={currentPrice} />
          <DecisionWarning tokenReady={tokenReady} onReload={() => void tokenQuery.refetch()} />
          {rejecting && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="reject-notes">Observacao da recusa <span className="font-normal text-slate-500">(opcional)</span></label>
              <textarea id="reject-notes" className={textareaClassName} value={rejectNotes} onChange={(event) => setRejectNotes(event.target.value)} placeholder="Motivo da recusa para registro" />
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            {rejecting ? (
              <>
                <Button type="button" variant="outline" onClick={() => setRejecting(false)}>Voltar</Button>
                <Button type="button" onClick={() => void reject()} disabled={pending || !tokenReady || !online}>Confirmar recusa</Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setRejecting(true)} disabled={pending || !tokenReady || !online}>Recusar proposta</Button>
            )}
            <Button type="button" onClick={() => void approve()} disabled={pending || !tokenReady || !online}>{pending ? 'Processando...' : 'Aprovar preco'}</Button>
          </div>
        </div>
      )}
    </Drawer>
  )
}

export function OwnPriceRetireDrawer({ proposal, online, onClose }: Props) {
  const tokenQuery = useOwnPriceDecisionToken(proposal?.id ?? null)
  const inactivateMutation = useInactivateOwnPriceProposal()
  const [notes, setNotes] = useState('')
  const tokenReady = Boolean(tokenQuery.data)

  const retire = async () => {
    if (!proposal || !tokenQuery.data) return
    const label = `Inativar o preco de ${proposal.item_name} (${formatComparisonCurrency(proposal.sale_price)})? O preco sai da tabela comercial.`
    if (!window.confirm(notes ? `${label}\n\nObservacao: ${notes}` : label)) return
    try {
      await inactivateMutation.mutateAsync({ proposalId: proposal.id, expectedDecisionToken: tokenQuery.data, decisionNotes: notes || null })
      toast.success('Preco proprio inativado.')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel inativar o preco.')
    }
  }

  return (
    <Drawer
      open={Boolean(proposal)}
      onOpenChange={(open) => { if (!open) onClose() }}
      title="Inativar preco proprio"
      description="Aposentadoria do preco vigente aprovado. O historico da proposta e preservado."
    >
      {proposal && (
        <div className="space-y-5">
          <Facts proposal={proposal} />
          <DecisionWarning tokenReady={tokenReady} onReload={() => void tokenQuery.refetch()} />
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="retire-notes">Observacao <span className="font-normal text-slate-500">(opcional)</span></label>
            <textarea id="retire-notes" className={textareaClassName} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Motivo da retirada para registro" />
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="button" variant="outline" className="border-red-200 text-red-800 hover:bg-red-50" onClick={() => void retire()} disabled={inactivateMutation.isPending || !tokenReady || !online}>
              {inactivateMutation.isPending ? 'Processando...' : (<><Trash2 className="size-4" /> Inativar preco</>)}
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  )
}