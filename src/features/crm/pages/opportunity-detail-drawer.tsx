import { useState, useEffect } from 'react'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Pencil, Check, X, Plus, Clock, AlertTriangle, Circle } from 'lucide-react'
import {
  useCrmOpportunityExtended,
  useUpdateCrmOpportunity,
  useMoveCrmOpportunity,
  useCrmActivities,
  useCrmEvents,
  useCreateCrmActivity,
  useCompleteCrmActivity,
  useCancelCrmActivity,
} from '../queries/pipeline-queries'
import type { CrmStage } from '@/types/database'

type Props = {
  opportunityId: string | null
  onClose: () => void
  onWon: (id: string) => void
  onLost: (id: string) => void
  stages: CrmStage[]
}

const ACTIVITY_TYPES = [
  'Ligação', 'WhatsApp', 'E-mail', 'Reunião', 'Visita',
  'Follow-up', 'Preparar proposta', 'Enviar proposta', 'Solicitar documentos', 'Outro',
]

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtDate = (d: string | null) => {
  if (!d) return '-'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

const fmtDateTime = (d: string | null) => {
  if (!d) return '-'
  const date = new Date(d)
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

const EVENT_LABELS: Record<string, string> = {
  opportunity_created: 'Oportunidade criada',
  opportunity_updated: 'Atualizada',
  stage_changed: 'Etapa alterada',
  activity_created: 'Atividade criada',
  activity_completed: 'Atividade concluída',
  activity_cancelled: 'Atividade cancelada',
  activity_rescheduled: 'Atividade reagendada',
  marked_won: 'Marcada como ganha',
  marked_lost: 'Marcada como perdida',
  loss_reason_changed: 'Motivo de perda alterado',
}

function toLocalDatetimeString(dateStr: string, timeStr: string): string {
  const dt = new Date(`${dateStr}T${timeStr || '09:00'}:00`)
  return dt.toISOString()
}

export function OpportunityDetailDrawer({ opportunityId, onClose, onWon, onLost, stages }: Props) {
  const { data: opp, isLoading } = useCrmOpportunityExtended(opportunityId ?? undefined)
  const updateMutation = useUpdateCrmOpportunity()
  const moveMutation = useMoveCrmOpportunity()

  const { data: activities = [] } = useCrmActivities(opportunityId ?? undefined)
  const { data: events = [] } = useCrmEvents(opportunityId ?? undefined)
  const createActivity = useCreateCrmActivity()
  const completeActivity = useCompleteCrmActivity()
  const cancelActivity = useCancelCrmActivity()

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editValue, setEditValue] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editStageId, setEditStageId] = useState('')

  const [showActivityForm, setShowActivityForm] = useState(false)
  const [actType, setActType] = useState('Ligação')
  const [actTitle, setActTitle] = useState('')
  const [actDate, setActDate] = useState('')
  const [actTime, setActTime] = useState('')
  const [actDesc, setActDesc] = useState('')
  const [completeOutcome, setCompleteOutcome] = useState('')
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    setError(null)
    try {
      if (editStageId !== opp.stage_id) {
        await moveMutation.mutateAsync({ opportunityId: opp.opportunity_id, targetStageId: editStageId })
      }
      await updateMutation.mutateAsync({
        id: opp.opportunity_id,
        title: editTitle,
        value: editValue ? Number(editValue) : 0,
        expected_close_date: editDate || null,
        description: editDesc || null,
      })
      setEditing(false)
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    }
  }

  async function handleCreateActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!opp || !actTitle.trim() || !actDate) return
    setError(null)
    try {
      const dueAt = toLocalDatetimeString(actDate, actTime)
      await createActivity.mutateAsync({
        opportunity_id: opp.opportunity_id,
        type: actType,
        title: actTitle.trim(),
        due_at: dueAt,
        description: actDesc.trim() || undefined,
      })
      setActTitle('')
      setActDate('')
      setActTime('')
      setActDesc('')
      setShowActivityForm(false)
    } catch {
      setError('Erro ao criar atividade. Tente novamente.')
    }
  }

  async function handleComplete(activityId: string) {
    setError(null)
    try {
      await completeActivity.mutateAsync({ activityId, outcome: completeOutcome || undefined })
      setCompletingId(null)
      setCompleteOutcome('')
    } catch {
      setError('Erro ao concluir atividade.')
    }
  }

  if (!opportunityId) return null

  const stage = stages.find(s => s.id === (editing ? editStageId : opp?.stage_id))
  const semantic = opp?.next_activity_status_semantic
  const isClosed = opp?.status === 'won' || opp?.status === 'lost'

  return (
    <Drawer open={!!opportunityId} onOpenChange={o => { if (!o) { setEditing(false); setShowActivityForm(false); setError(null); onClose() } }} title="Oportunidade">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />)}
        </div>
      ) : !opp ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">Oportunidade não encontrada.</p>
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 truncate">{opp.client_name}</p>
              {editing ? (
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="mt-1 font-serif text-lg" />
              ) : (
                <h2 className="font-serif text-lg font-semibold">{opp.title}</h2>
              )}
              <Badge className="mt-1 bg-emerald-100 text-emerald-800">{stage?.name ?? '-'}</Badge>
            </div>
            <div className="flex gap-1">
              {!editing && opp.status === 'open' && (
                <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Editar">
                  <Pencil className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Next Activity */}
          {!isClosed && (
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500">Próxima atividade</p>
                <Button variant="ghost" size="sm" onClick={() => setShowActivityForm(true)}>
                  <Plus className="mr-1 size-3" />Nova
                </Button>
              </div>
              {semantic === 'none' ? (
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Circle className="size-3" />
                  <span>Sem próxima atividade</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {activities.filter(a => a.status === 'pending').slice(0, 1).map(a => (
                    <div key={a.id} className="flex items-start justify-between">
                      <div className="flex items-start gap-2 min-w-0">
                        {semantic === 'overdue' ? (
                          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                        ) : semantic === 'today' ? (
                          <Clock className="mt-0.5 size-4 shrink-0 text-amber-500" />
                        ) : (
                          <Clock className="mt-0.5 size-4 shrink-0 text-slate-400" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{a.title}</p>
                          <p className="text-xs text-slate-500">{a.type} · {fmtDateTime(a.due_at)}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => setCompletingId(a.id)}>
                          <Check className="size-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => cancelActivity.mutateAsync(a.id)}>
                          <X className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Details */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Valor</span>
              {editing ? (
                <Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className="w-[140px] text-right" min="0" step="0.01" />
              ) : (
                <span className="font-semibold text-slate-800">{fmt(opp.value)}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Probabilidade</span>
              <span className="text-sm text-slate-700">{editing ? (stages.find(s => s.id === editStageId)?.probability ?? opp.probability) : opp.probability}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Etapa</span>
              {editing ? (
                <select className="h-8 rounded border border-slate-200 px-2 text-sm" value={editStageId} onChange={e => setEditStageId(e.target.value)}>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name} ({s.probability}%)</option>)}
                </select>
              ) : (
                <span className="text-sm text-slate-700">{stage?.name ?? '-'}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Previsão de fechamento</span>
              {editing ? (
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-[160px]" />
              ) : (
                <span className="text-sm text-slate-700">{fmtDate(opp.expected_close_date)}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Responsável</span>
              <span className="text-sm text-slate-700">{opp.responsible_name ?? '-'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500">Descrição</span>
              {editing ? (
                <textarea className="mt-1 min-h-[60px] w-full rounded border border-slate-200 px-2 py-1 text-sm" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
              ) : (
                <p className="mt-1 text-sm text-slate-700">{opp.description || '-'}</p>
              )}
            </div>
          </div>

          {/* Client */}
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-2 text-xs font-medium text-slate-500">Dados do cliente</p>
            <div className="space-y-1 text-sm">
              <p><span className="text-slate-500">Razão social:</span> {opp.client_legal_name}</p>
              {opp.client_tax_id && <p><span className="text-slate-500">CPF/CNPJ:</span> {opp.client_tax_id}</p>}
            </div>
          </div>

          {/* Status */}
          <div className="rounded-lg border border-slate-200 p-4 text-xs text-slate-500">
            <p>Criada em: {fmtDateTime(opp.created_at)}</p>
            <p>Atualizada em: {fmtDateTime(opp.updated_at)}</p>
            {opp.status === 'won' && <p className="text-emerald-600">Ganha em: {fmtDateTime(opp.won_at)}</p>}
            {opp.status === 'lost' && (
              <>
                <p className="text-red-600">Perdida em: {fmtDateTime(opp.lost_at)}</p>
                <p>Motivo: {opp.loss_reason_name ?? opp.lost_reason}</p>
                {opp.lost_reason_detail && <p>Detalhe: {opp.lost_reason_detail}</p>}
              </>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-3 text-xs font-medium text-slate-500">Histórico</p>
            {events.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum registro ainda.</p>
            ) : (
              <div className="space-y-3 relative before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-slate-200">
                {events.map(evt => (
                  <div key={evt.id} className="flex gap-3 relative">
                    <div className="relative z-10 mt-1 flex size-[15px] shrink-0 items-center justify-center rounded-full bg-white border border-slate-300">
                      <div className="size-[7px] rounded-full bg-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{EVENT_LABELS[evt.event_type] ?? evt.event_type}</p>
                      <p className="text-[11px] text-slate-400">{fmtDateTime(evt.created_at)}</p>
                      {evt.event_type === 'activity_completed' && evt.event_data && typeof evt.event_data === 'object' && 'outcome' in evt.event_data && (
                        <p className="text-xs text-slate-500 mt-0.5">{String((evt.event_data as Record<string, unknown>).outcome)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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

          {/* Create Activity Dialog */}
          <Dialog open={showActivityForm} onOpenChange={setShowActivityForm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova atividade</DialogTitle>
                <DialogDescription>Agende a próxima ação para esta oportunidade.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateActivity} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Tipo *</label>
                  <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={actType} onChange={e => setActType(e.target.value)}>
                    {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Título *</label>
                  <Input placeholder="Ex: Follow-up proposta" value={actTitle} onChange={e => setActTitle(e.target.value)} required />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Data *</label>
                    <Input type="date" value={actDate} onChange={e => setActDate(e.target.value)} required />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Hora</label>
                    <Input type="time" value={actTime} onChange={e => setActTime(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Descrição</label>
                  <textarea className="min-h-[60px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={actDesc} onChange={e => setActDesc(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowActivityForm(false)}>Cancelar</Button>
                  <Button type="submit" disabled={!actTitle.trim() || !actDate || createActivity.isPending}>
                    {createActivity.isPending ? 'Criando...' : 'Criar atividade'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Complete Activity Dialog */}
          <Dialog open={completingId !== null} onOpenChange={open => { if (!open) { setCompletingId(null); setCompleteOutcome('') } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Concluir atividade</DialogTitle>
                <DialogDescription>Registro opcional do resultado.</DialogDescription>
              </DialogHeader>
              <textarea className="min-h-[60px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Resultado ou observação (opcional)" value={completeOutcome} onChange={e => setCompleteOutcome(e.target.value)} />
              <DialogFooter>
                <Button variant="outline" onClick={() => { setCompletingId(null); setCompleteOutcome('') }}>Cancelar</Button>
                <Button onClick={() => completingId && handleComplete(completingId)} disabled={completeActivity.isPending}>
                  {completeActivity.isPending ? 'Concluindo...' : 'Concluir'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </Drawer>
  )
}
