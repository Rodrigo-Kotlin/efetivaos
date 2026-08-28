import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMarkOpportunityWon, useMarkOpportunityLost, useCrmLossReasons } from '../queries/pipeline-queries'

type Props = {
  wonLost: { id: string; action: 'won' | 'lost' } | null
  onClose: () => void
}

export function WonLostDialogs({ wonLost, onClose }: Props) {
  const wonMutation = useMarkOpportunityWon()
  const lostMutation = useMarkOpportunityLost()
  const { data: reasons = [] } = useCrmLossReasons()

  const [lostReasonId, setLostReasonId] = useState('')
  const [otherDetail, setOtherDetail] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setLostReasonId('')
    setOtherDetail('')
    setError(null)
    onClose()
  }

  async function handleWon() {
    if (!wonLost || wonLost.action !== 'won') return
    setError(null)
    try {
      await wonMutation.mutateAsync(wonLost.id)
      handleClose()
    } catch {
      setError('Erro ao marcar como ganha. Tente novamente.')
    }
  }

  async function handleLost() {
    if (!wonLost || wonLost.action !== 'lost') return
    const selectedReason = reasons.find(r => r.id === lostReasonId)
    if (!selectedReason) return
    setError(null)
    try {
      await lostMutation.mutateAsync({
        id: wonLost.id,
        reasonId: lostReasonId,
        reason: selectedReason.name,
        reasonDetail: selectedReason.name === 'Outro' ? otherDetail : undefined,
      })
      handleClose()
    } catch {
      setError('Erro ao marcar como perdida. Tente novamente.')
    }
  }

  if (!wonLost) return null

  if (wonLost.action === 'won') {
    return (
      <Dialog open onOpenChange={o => { if (!o) handleClose() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como ganha</DialogTitle>
            <DialogDescription>
              Confirmar que esta oportunidade foi fechada com sucesso?
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleWon} disabled={wonMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {wonMutation.isPending ? 'Confirmando...' : 'Confirmar ganho'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como perdida</DialogTitle>
          <DialogDescription>
            Selecione o motivo da perda.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-3">
          {reasons.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum motivo configurado. Contate o administrador.</p>
          ) : (
            <div className="space-y-1">
              {reasons.map(reason => (
                <label
                  key={reason.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    lostReasonId === reason.id
                      ? 'border-red-300 bg-red-50 text-red-800'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="loss-reason"
                    value={reason.id}
                    checked={lostReasonId === reason.id}
                    onChange={() => setLostReasonId(reason.id)}
                    className="accent-red-600"
                  />
                  {reason.name}
                </label>
              ))}
            </div>
          )}
          {reasons.find(r => r.id === lostReasonId)?.name === 'Outro' && (
            <textarea
              className="min-h-[60px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Descreva o motivo..."
              value={otherDetail}
              onChange={e => setOtherDetail(e.target.value)}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={handleLost}
            disabled={!lostReasonId || lostMutation.isPending ||
              (reasons.find(r => r.id === lostReasonId)?.name === 'Outro' && !otherDetail.trim())}
          >
            {lostMutation.isPending ? 'Confirmando...' : 'Confirmar perda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
