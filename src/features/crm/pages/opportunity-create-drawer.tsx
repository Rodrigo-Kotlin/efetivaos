import { useState } from 'react'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCreateCrmOpportunity } from '../queries/pipeline-queries'
import type { CrmStage, ClientListRow } from '@/types/database'

type Props = {
  open: boolean
  onClose: () => void
  defaultPipelineId?: string
  stages: CrmStage[]
}

export function OpportunityCreateDrawer({ open, onClose, defaultPipelineId, stages }: Props) {
  const createMutation = useCreateCrmOpportunity()

  // Form state
  const [clientId, setClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [title, setTitle] = useState('')
  const [stageId, setStageId] = useState('')
  const [value, setValue] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [description, setDescription] = useState('')

  // Client search
  const { data: clients } = useQuery({
    queryKey: ['crm', 'clients', 'search', clientSearch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_list_v')
        .select('id, legal_name, trade_name, tax_id')
        .or(`legal_name.ilike.%${clientSearch}%,trade_name.ilike.%${clientSearch}%`)
        .limit(20)
      if (error) throw error
      return data as Pick<ClientListRow, 'id' | 'legal_name' | 'trade_name' | 'tax_id'>[]
    },
    enabled: clientSearch.length >= 2,
    staleTime: 10_000,
  })

  const selectedClient = clients?.find(c => c.id === clientId)

  function reset() {
    setClientId('')
    setClientSearch('')
    setTitle('')
    setStageId('')
    setValue('')
    setExpectedDate('')
    setDescription('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !title.trim()) return

    await createMutation.mutateAsync({
      client_id: clientId,
      title: title.trim(),
      pipeline_id: defaultPipelineId,
      stage_id: stageId || undefined,
      value: value ? Number(value) : 0,
      expected_close_date: expectedDate || null,
      description: description.trim() || null,
    })
    reset()
    onClose()
  }

  return (
    <Drawer open={open} onOpenChange={o => { if (!o) { reset(); onClose() } }} title="Nova Oportunidade">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Client */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Cliente *</label>
          {selectedClient ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="flex-1 text-sm">{selectedClient.trade_name || selectedClient.legal_name}</span>
              <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => { setClientId(''); setClientSearch('') }}>
                Trocar
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <Input
                placeholder="Buscar cliente..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
              />
              {clients && clients.length > 0 && (
                <div className="max-h-[150px] overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  {clients.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => { setClientId(c.id); setClientSearch('') }}
                    >
                      <span className="font-medium">{c.trade_name || c.legal_name}</span>
                      {c.tax_id && <span className="text-xs text-slate-400">{c.tax_id}</span>}
                    </button>
                  ))}
                </div>
              )}
              {clientSearch.length >= 2 && clients && clients.length === 0 && (
                <p className="text-xs text-slate-400">Nenhum cliente encontrado</p>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Título *</label>
          <Input
            placeholder="Ex: Gestão Mensal SST"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Stage */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Etapa</label>
          <select
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
            value={stageId || stages[0]?.id || ''}
            onChange={e => setStageId(e.target.value)}
          >
            {stages.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.probability}%)</option>
            ))}
          </select>
        </div>

        {/* Value */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Valor (R$)</label>
          <Input
            type="number"
            placeholder="0,00"
            value={value}
            onChange={e => setValue(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>

        {/* Expected close date */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Previsão de fechamento</label>
          <Input
            type="date"
            value={expectedDate}
            onChange={e => setExpectedDate(e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Descrição</label>
          <textarea
            className="min-h-[80px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            placeholder="Detalhes opcionais..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full"
          disabled={!clientId || !title.trim() || createMutation.isPending}
        >
          {createMutation.isPending ? 'Criando...' : 'Criar oportunidade'}
        </Button>
      </form>
    </Drawer>
  )
}
