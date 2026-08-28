import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMarkOpportunityWon, useMarkOpportunityLost } from '../queries/pipeline-queries'

type Props = {
  wonLost: { id: string; action: 'won' | 'lost' } | null
  onClose: () => void
}

const LOSS_REASONS = [
  'Preço',
  'Concorrente',
  'Sem orçamento',
  'Sem retorno',
  'Prazo',
  'Escopo incompatível',
  'Cliente desistiu',
  'Outro',
]

export function WonLostDialogs({ wonLost, onClose }: Props) {
  const wonMutation = useMarkOpportunityWon()
  const lostMutation = useMarkOpportunityLost()

  const [lostReason, setLostReason] = useState('')
  const [otherReason, setOtherReason] = useState('')

  function handleClose() {
    setLostReason('')
    setOtherReason('')
    onClose()
  }

  async function handleWon() {
    if (!wonLost || wonLost.action !== 'won') return
    await wonMutation.mutateAsync(wonLost.id)
    handleClose()
  }

  async function handleLost() {
    if (!wonLost || wonLost.action !== 'lost') return
    const reason = lostReason === 'Outro' ? otherReason : lostReason
    if (!reason.trim()) return
    await lostMutation.mutateAsync({ id: wonLost.id, reason: reason.trim() })
    handleClose()
  }

  if (!wonLost) return null

  // Won dialog
  if (wonLost.action === 'won') {
    return (
      <Dialog open onOpenChange={o => { if (!o) handleClose() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como ganha</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Confirmar que esta oportunidade foi fechada com sucesso?
          </p>
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

  // Lost dialog
  return (
    <Dialog open onOpenChange={o => { if (!o) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como perdida</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Selecione o motivo da perda:</p>
          <div className="space-y-1">
            {LOSS_REASONS.map(reason => (
              <label key={reason} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="loss-reason"
                  value={reason}
                  checked={lostReason === reason}
                  onChange={e => setLostReason(e.target.value)}
                  className="accent-red-600"
                />
                {reason}
              </label>
            ))}
          </div>
          {lostReason === 'Outro' && (
            <textarea
              className="min-h-[60px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Descreva o motivo..."
              value={otherReason}
              onChange={e => setOtherReason(e.target.value)}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={handleLost}
            disabled={!lostReason || lostMutation.isPending || (lostReason === 'Outro' && !otherReason.trim())}
          >
            {lostMutation.isPending ? 'Confirmando...' : 'Confirmar perda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
