import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CrmStage } from '@/types/database'

export type CrmFilters = {
  search: string
  stage_id: string
  responsible: string
  status: string
  activity: string
  value_min: string
  value_max: string
  date_from: string
  date_to: string
}

export const DEFAULT_FILTERS: CrmFilters = {
  search: '', stage_id: '', responsible: '', status: '', activity: '',
  value_min: '', value_max: '', date_from: '', date_to: '',
}

type Props = {
  filters: CrmFilters
  onChange: (f: CrmFilters) => void
  stages: CrmStage[]
}

export function FilterPopover({ filters, onChange, stages }: Props) {
  const [open, setOpen] = useState(false)
  const activeCount = Object.values(filters).filter(v => v !== '').length

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)} className="relative">
        <Filter className="mr-1 size-3.5" />
        Filtros
        {activeCount > 0 && (
          <span className="ml-1 flex size-4 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white">
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-[320px] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-700">Filtros avançados</p>
              {activeCount > 0 && (
                <button className="text-xs text-slate-500 hover:text-slate-700" onClick={() => onChange(DEFAULT_FILTERS)}>
                  Limpar tudo
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Busca</label>
                <Input placeholder="Título ou cliente..." value={filters.search} onChange={e => onChange({ ...filters, search: e.target.value })} />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500">Etapa</label>
                <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={filters.stage_id} onChange={e => onChange({ ...filters, stage_id: e.target.value })}>
                  <option value="">Todas</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500">Status</label>
                <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={filters.status} onChange={e => onChange({ ...filters, status: e.target.value })}>
                  <option value="">Todas</option>
                  <option value="open">Abertas</option>
                  <option value="won">Ganhas</option>
                  <option value="lost">Perdidas</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500">Atividade</label>
                <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={filters.activity} onChange={e => onChange({ ...filters, activity: e.target.value })}>
                  <option value="">Todas</option>
                  <option value="overdue">Atrasada</option>
                  <option value="today">Hoje</option>
                  <option value="upcoming">Próximos 7 dias</option>
                  <option value="none">Sem atividade</option>
                </select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-500">Valor mín.</label>
                  <Input type="number" placeholder="0" value={filters.value_min} onChange={e => onChange({ ...filters, value_min: e.target.value })} />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-500">Valor máx.</label>
                  <Input type="number" placeholder="∞" value={filters.value_max} onChange={e => onChange({ ...filters, value_max: e.target.value })} />
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-500">Previsão de</label>
                  <Input type="date" value={filters.date_from} onChange={e => onChange({ ...filters, date_from: e.target.value })} />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-500">Previsão até</label>
                  <Input type="date" value={filters.date_to} onChange={e => onChange({ ...filters, date_to: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={() => setOpen(false)}>Aplicar</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
