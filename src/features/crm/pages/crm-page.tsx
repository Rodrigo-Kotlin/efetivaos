import { useState, useMemo, useCallback } from 'react'
import { Plus, LayoutGrid, List, BarChart3 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'

import { Button } from '@/components/ui/button'
import { useCrmPipelines, useCrmStages, useCrmOpportunities } from '../queries/pipeline-queries'
import { OpportunityCard } from './opportunity-card'
import { OpportunityList } from './opportunity-list'
import { OpportunityCreateDrawer } from './opportunity-create-drawer'
import { OpportunityDetailDrawer } from './opportunity-detail-drawer'
import { WonLostDialogs } from './won-lost-dialogs'
import { CrmKpiBar } from './crm-kpi-bar'
import { FilterPopover, DEFAULT_FILTERS, type CrmFilters } from './filter-popover'
import { IndicatorsDrawer } from './indicators-drawer'
import type { CrmOpportunityBoardRowExtended, CrmBoardColumn, CrmStage } from '@/types/database'

type ViewMode = 'pipeline' | 'list'
type SortKey = 'title' | 'client_name' | 'stage_name' | 'value' | 'probability' | 'next_activity' | 'expected_close_date' | 'stage_age_days' | 'updated_at'

const quickFilters = [
  { key: 'all', label: 'Todas' },
  { key: 'overdue', label: 'Atrasadas' },
  { key: 'today', label: 'Hoje' },
  { key: 'none', label: 'Sem atividade' },
] as const

type QuickFilter = typeof quickFilters[number]['key']

function KanbanColumn({
  stage,
  opportunities,
  onCardClick,
}: {
  stage: CrmStage
  opportunities: CrmOpportunityBoardRowExtended[]
  onCardClick: (opp: CrmOpportunityBoardRowExtended) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const totalValue = opportunities.reduce((s, o) => s + o.value, 0)

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[300px] min-w-[300px] flex-col rounded-xl border bg-slate-50/80 transition-colors ${
        isOver ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-700">{stage.name}</p>
          <p className="text-xs text-slate-500">
            {opportunities.length} · {fmt(totalValue)}
          </p>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        <SortableContext
          items={opportunities.map(o => o.opportunity_id)}
          strategy={verticalListSortingStrategy}
        >
          {opportunities.map(opp => (
            <OpportunityCard key={opp.opportunity_id} opportunity={opp} onClick={() => onCardClick(opp)} />
          ))}
        </SortableContext>
        {opportunities.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-400">Nenhuma oportunidade</p>
        )}
      </div>
    </div>
  )
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const STORAGE_KEY_VIEW = 'crm-view-mode'
const STORAGE_KEY_SORT = 'crm-list-sort'

export default function CrmPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(STORAGE_KEY_VIEW) as ViewMode) || 'pipeline'
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [wonLost, setWonLost] = useState<{ id: string; action: 'won' | 'lost' } | null>(null)
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [filters, setFilters] = useState<CrmFilters>(DEFAULT_FILTERS)
  const [sortKey, setSortKey] = useState<SortKey>(
    () => (localStorage.getItem(STORAGE_KEY_SORT) as SortKey) || 'updated_at'
  )
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [indicatorsOpen, setIndicatorsOpen] = useState(false)

  const { data: pipelines, isLoading: lPipelines } = useCrmPipelines()
  const defaultPipeline = pipelines?.find(p => p.is_default) ?? pipelines?.[0]
  const { data: stages, isLoading: lStages } = useCrmStages(defaultPipeline?.id)
  const { data: opportunities, isLoading: lOpps } = useCrmOpportunities(defaultPipeline?.id)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, CrmOpportunityBoardRowExtended[]>>({})

  const isLoading = lPipelines || lStages || lOpps
  const extOpps = (opportunities ?? []) as CrmOpportunityBoardRowExtended []

  // Apply filters
  const filteredOpps = useMemo(() => {
    return extOpps.filter(o => {
      // Quick filters
      if (quickFilter === 'overdue' && o.next_activity_status_semantic !== 'overdue') return false
      if (quickFilter === 'today' && o.next_activity_status_semantic !== 'today') return false
      if (quickFilter === 'none' && o.next_activity_status_semantic !== 'none') return false

      // Advanced filters
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!o.title.toLowerCase().includes(q) && !o.client_name.toLowerCase().includes(q)) return false
      }
      if (filters.stage_id && o.stage_id !== filters.stage_id) return false
      if (filters.status && o.status !== filters.status) return false
      if (filters.activity && o.next_activity_status_semantic !== filters.activity) return false
      if (filters.value_min && o.value < Number(filters.value_min)) return false
      if (filters.value_max && o.value > Number(filters.value_max)) return false
      if (filters.date_from && o.expected_close_date && o.expected_close_date < filters.date_from) return false
      if (filters.date_to && o.expected_close_date && o.expected_close_date > filters.date_to) return false

      return true
    })
  }, [extOpps, quickFilter, filters])

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    localStorage.setItem(STORAGE_KEY_SORT, key)
  }, [sortKey])

  const switchView = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem(STORAGE_KEY_VIEW, mode)
  }, [])

  // Kanban columns
  const columns: CrmBoardColumn[] = (stages ?? []).map(s => {
    const opps = filteredOpps.filter(o => o.stage_id === s.id)
    return {
      stage_id: s.id, stage_name: s.name, stage_position: s.position,
      stage_probability: s.probability, opportunities: opps,
      total_value: opps.reduce((sum, o) => sum + o.value, 0), count: opps.length,
    }
  })

  const sortableItems: Record<string, string[]> = {}
  for (const col of columns) {
    sortableItems[col.stage_id] = col.opportunities.map(o => o.opportunity_id)
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const activeOpp = activeId ? extOpps.find(o => o.opportunity_id === activeId) : null

  function handleDragStart(event: DragStartEvent) { setActiveId(String(event.active.id)) }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    let activeStageId: string | null = null
    for (const [stageId, oppIds] of Object.entries(sortableItems)) {
      if (oppIds.includes(activeId)) { activeStageId = stageId; break }
    }
    if (!activeStageId) return
    let overStageId: string | null = null
    if (sortableItems[overId]) { overStageId = overId }
    else {
      for (const [stageId, oppIds] of Object.entries(sortableItems)) {
        if (oppIds.includes(overId)) { overStageId = stageId; break }
      }
    }
    if (!overStageId || activeStageId === overStageId) return
    setItems(prev => {
      const newItems = { ...prev }
      for (const col of columns) {
        if (!newItems[col.stage_id]) { newItems[col.stage_id] = col.opportunities }
      }
      const source = [...(newItems[activeStageId!] ?? [])]
      const dest = [...(newItems[overStageId!] ?? [])]
      const activeIdx = source.findIndex(o => o.opportunity_id === activeId)
      if (activeIdx === -1) return prev
      const [moved] = source.splice(activeIdx, 1)
      moved.stage_id = overStageId!
      dest.push(moved)
      newItems[activeStageId!] = source
      newItems[overStageId!] = dest
      return newItems
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    let activeStageId: string | null = null
    for (const [stageId, oppIds] of Object.entries(sortableItems)) {
      if (oppIds.includes(activeId)) { activeStageId = stageId; break }
    }
    if (!activeStageId) return
    if (!sortableItems[overId]) {
      let overStageId: string | null = null
      for (const [stageId, oppIds] of Object.entries(sortableItems)) {
        if (oppIds.includes(overId)) { overStageId = stageId; break }
      }
      if (overStageId && activeStageId === overStageId) {
        const currentItems = items[activeStageId] ?? sortableItems[activeStageId]?.map(id =>
          extOpps.find(o => o.opportunity_id === id)!
        ) ?? []
        const oldIdx = currentItems.findIndex(o => o.opportunity_id === activeId)
        const newIdx = currentItems.findIndex(o => o.opportunity_id === overId)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          setItems(prev => ({ ...prev, [activeStageId!]: arrayMove(currentItems, oldIdx, newIdx) }))
        }
      }
    }
  }

  const displayColumns = columns.map(col => {
    const override = items[col.stage_id]
    if (override) return { ...col, opportunities: override, count: override.length, total_value: override.reduce((s, o) => s + o.value, 0) }
    return col
  })

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">CRM Comercial</h1>
          <p className="mt-1 text-sm text-slate-500">
            {viewMode === 'pipeline' ? 'Arraste oportunidades entre etapas.' : 'Visualize e gerencie seu pipeline.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 bg-white">
            <button
              onClick={() => switchView('pipeline')}
              className={`flex items-center gap-1 rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'pipeline' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <LayoutGrid className="size-3.5" />Pipeline
            </button>
            <button
              onClick={() => switchView('list')}
              className={`flex items-center gap-1 rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'list' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <List className="size-3.5" />Lista
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={() => setIndicatorsOpen(true)}>
            <BarChart3 className="mr-1 size-3.5" />Indicadores
          </Button>

          <FilterPopover filters={filters} onChange={setFilters} stages={stages ?? []} />

          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />Oportunidade
          </Button>
        </div>
      </div>

      <CrmKpiBar opportunities={extOpps} />

      {/* Quick filters */}
      <div className="flex items-center gap-2 px-6 pb-3">
        {quickFilters.map(f => (
          <button
            key={f.key}
            onClick={() => setQuickFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              quickFilter === f.key
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto px-6 pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[400px] w-[300px] shrink-0 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : viewMode === 'pipeline' ? (
        // Pipeline / Kanban
        columns.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-slate-500">Nenhum pipeline configurado.</p>
          </div>
        ) : extOpps.length === 0 && !createOpen ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">Nenhuma oportunidade aberta</p>
              <p className="mt-1 text-xs text-slate-500">Crie a primeira oportunidade para iniciar seu pipeline.</p>
              <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1 size-3.5" />Criar oportunidade
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto px-6 pb-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
              <div className="flex gap-4">
                {displayColumns.map(col => {
                  const stage = stages?.find(s => s.id === col.stage_id)
                  if (!stage) return null
                  return <KanbanColumn key={col.stage_id} stage={stage} opportunities={col.opportunities} onCardClick={opp => setDetailId(opp.opportunity_id)} />
                })}
              </div>
              <DragOverlay>
                {activeOpp ? <div className="rotate-2 opacity-80"><OpportunityCard opportunity={activeOpp} onClick={() => {}} isDragOverlay /></div> : null}
              </DragOverlay>
            </DndContext>
          </div>
        )
      ) : (
        // List view
        <OpportunityList
          opportunities={filteredOpps}
          onRowClick={opp => setDetailId(opp.opportunity_id)}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
      )}

      <OpportunityCreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} defaultPipelineId={defaultPipeline?.id} stages={stages ?? []} />
      <OpportunityDetailDrawer opportunityId={detailId} onClose={() => setDetailId(null)} onWon={id => setWonLost({ id, action: 'won' })} onLost={id => setWonLost({ id, action: 'lost' })} stages={stages ?? []} />
      <WonLostDialogs wonLost={wonLost} onClose={() => setWonLost(null)} />
      <IndicatorsDrawer open={indicatorsOpen} onClose={() => setIndicatorsOpen(false)} pipelineId={defaultPipeline?.id} />
    </div>
  )
}
