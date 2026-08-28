import { useState, useEffect } from 'react'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Pencil, Check, X, Trash2 } from 'lucide-react'
import { useCrmOpportunity, useUpdateCrmOpportunity, useMoveCrmOpportunity } from '../queries/pipeline-queries'
import type { CrmStage } from '@/types/database'

type Props = {
  opportunityId: string | null
  onClose: () => void
  onWon: (id: string) => void
  onLost: (id: string) => void
  stages: CrmStage[]
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtDate = (d: string | null) => {
  if (!d) return '-'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

const fmtDateTime = (d: string | null) => {
  if (!d) return '-'
  return new Date(d).toLocaleString('pt-BR')
}

export function OpportunityDetailDrawer({ opportunityId, onClose, onWon, onLost, stages }: Props) {
  const { data: opp, isLoading } = useCrmOpportunity(opportunityId ?? undefined)
  const updateMutation = useUpdateCrmOpportunity()
  const moveMutation = useMoveCrmOpportunity()

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editValue, setEditValue] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editStageId, setEditStageId] = useState('')

  useEffect(() => {
    if (opp) {
      setEditTitle(opp.title)
      setEditValue(String(opp.value))
      setEditDate(opp.expected_close_date ?? '')
      setEditDesc(opp.description ?? '')
      setEditStageId(opp.stage_id)
    }
  }, [opp])

  async function handleSave() {
    if (!opp) return

    // If stage changed, move first
    if (editStageId !== opp.stage_id) {
      await moveMutation.mutateAsync({
        opportunityId: opp.opportunity_id,
        targetStageId: editStageId,
      })
    }

    await updateMutation.mutateAsync({
      id: opp.opportunity_id,
      title: editTitle,
      value: editValue ? Number(editValue) : 0,
      expected_close_date: editDate || null,
      description: editDesc || null,
    })

    setEditing(false)
  }

  if (!opportunityId) return null

  const stage = stages.find(s => s.id === (editing ? editStageId : opp?.stage_id))

  return (
    <Drawer open={!!opportunityId} onOpenChange={o => { if (!o) { setEditing(false); onClose() } }} title="Oportunidade">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />)}
        </div>
      ) : !opp ? (
        <p className="text-sm text-slate-500">Oportunidade não encontrada.</p>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-slate-500">{opp.client_name}</p>
              {editing ? (
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="mt-1 font-serif text-lg" />
              ) : (
                <h2 className="font-serif text-lg font-semibold">{opp.title}</h2>
              )}
              <Badge className="mt-1 bg-emerald-100 text-emerald-800">{stage?.name ?? '-'}</Badge>
            </div>
            <div className="flex gap-1">
              {!editing && (
                <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Editar">
                  <Pencil className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            {/* Value */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Valor</span>
              {editing ? (
                <Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className="w-[140px] text-right" min="0" step="0.01" />
              ) : (
                <span className="font-semibold text-slate-800">{fmt(opp.value)}</span>
              )}
            </div>

            {/* Probability */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Probabilidade</span>
              <span className="text-sm text-slate-700">{editing ? (stages.find(s => s.id === editStageId)?.probability ?? opp.probability) : opp.probability}%</span>
            </div>

            {/* Stage */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Etapa</span>
              {editing ? (
                <select
                  className="h-8 rounded border border-slate-200 px-2 text-sm"
                  value={editStageId}
                  onChange={e => setEditStageId(e.target.value)}
                >
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.probability}%)</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-slate-700">{stage?.name ?? '-'}</span>
              )}
            </div>

            {/* Expected close */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Previsão de fechamento</span>
              {editing ? (
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-[160px]" />
              ) : (
                <span className="text-sm text-slate-700">{fmtDate(opp.expected_close_date)}</span>
              )}
            </div>

            {/* Responsible */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Responsável</span>
              <span className="text-sm text-slate-700">{opp.responsible_name ?? '-'}</span>
            </div>

            {/* Description */}
            <div>
              <span className="text-xs text-slate-500">Descrição</span>
              {editing ? (
                <textarea
                  className="mt-1 min-h-[60px] w-full rounded border border-slate-200 px-2 py-1 text-sm"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                />
              ) : (
                <p className="mt-1 text-sm text-slate-700">{opp.description || '-'}</p>
              )}
            </div>
          </div>

          {/* Client data */}
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-2 text-xs font-medium text-slate-500">Dados do cliente</p>
            <div className="space-y-1 text-sm">
              <p><span className="text-slate-500">Razão social:</span> {opp.client_legal_name}</p>
              {opp.client_tax_id && <p><span className="text-slate-500">CPF/CNPJ:</span> {opp.client_tax_id}</p>}
            </div>
          </div>

          {/* History */}
          <div className="rounded-lg border border-slate-200 p-4 text-xs text-slate-500">
            <p>Criada em: {fmtDateTime(opp.created_at)}</p>
            <p>Atualizada em: {fmtDateTime(opp.updated_at)}</p>
            {opp.status === 'won' && <p className="text-emerald-600">Ganha em: {fmtDateTime(opp.won_at)}</p>}
            {opp.status === 'lost' && (
              <>
                <p className="text-red-600">Perdida em: {fmtDateTime(opp.lost_at)}</p>
                <p>Motivo: {opp.lost_reason}</p>
              </>
            )}
          </div>

          {/* Actions */}
          {editing ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={updateMutation.isPending || moveMutation.isPending}>
                <Check className="mr-1 size-3.5" />Salvar
              </Button>
            </div>
          ) : opp.status === 'open' ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-emerald-700 hover:bg-emerald-50" onClick={() => onWon(opp.opportunity_id)}>
                <Check className="mr-1 size-3.5" />Ganha
              </Button>
              <Button variant="outline" className="flex-1 text-red-600 hover:bg-red-50" onClick={() => onLost(opp.opportunity_id)}>
                <X className="mr-1 size-3.5" />Perdida
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Drawer>
  )
}
