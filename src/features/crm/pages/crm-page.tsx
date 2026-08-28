import { useState } from 'react'
import { Plus, Filter } from 'lucide-react'
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
import { OpportunityCreateDrawer } from './opportunity-create-drawer'
import { OpportunityDetailDrawer } from './opportunity-detail-drawer'
import { WonLostDialogs } from './won-lost-dialogs'
import { CrmKpiBar } from './crm-kpi-bar'
import type { CrmOpportunityBoardRowExtended, CrmBoardColumn, CrmStage } from '@/types/database'

type FilterType = 'all' | 'overdue' | 'today' | 'none'

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
            <OpportunityCard
              key={opp.opportunity_id}
              opportunity={opp}
              onClick={() => onCardClick(opp)}
            />
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

export default function CrmPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [wonLost, setWonLost] = useState<{ id: string; action: 'won' | 'lost' } | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')

  const { data: pipelines, isLoading: lPipelines } = useCrmPipelines()
  const defaultPipeline = pipelines?.find(p => p.is_default) ?? pipelines?.[0]
  const { data: stages, isLoading: lStages } = useCrmStages(defaultPipeline?.id)
  const { data: opportunities, isLoading: lOpps } = useCrmOpportunities(defaultPipeline?.id)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, CrmOpportunityBoardRowExtended[]>>({})

  const isLoading = lPipelines || lStages || lOpps

  const extOpps = (opportunities ?? []) as CrmOpportunityBoardRowExtended[]

  const filteredOpps = extOpps.filter(o => {
    if (filter === 'all') return true
    if (filter === 'overdue') return o.next_activity_status_semantic === 'overdue'
    if (filter === 'today') return o.next_activity_status_semantic === 'today'
    if (filter === 'none') return o.next_activity_status_semantic === 'none'
    return true
  })

  const columns: CrmBoardColumn[] = (stages ?? []).map(s => {
    const opps = filteredOpps.filter(o => o.stage_id === s.id)
    return {
      stage_id: s.id,
      stage_name: s.name,
      stage_position: s.position,
      stage_probability: s.probability,
      opportunities: opps as CrmOpportunityBoardRowExtended[],
      total_value: opps.reduce((sum, o) => sum + o.value, 0),
      count: opps.length,
    }
  })

  const sortableItems: Record<string, string[]> = {}
  for (const col of columns) {
    sortableItems[col.stage_id] = col.opportunities.map(o => o.opportunity_id)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const activeOpp = activeId
    ? extOpps.find(o => o.opportunity_id === activeId)
    : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

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
        if (!newItems[col.stage_id]) { newItems[col.stage_id] = col.opportunities as CrmOpportunityBoardRowExtended[] }
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
          const reordered = arrayMove(currentItems, oldIdx, newIdx)
          setItems(prev => ({ ...prev, [activeStageId!]: reordered }))
        }
      }
    }
  }

  const displayColumns: CrmBoardColumn[] = columns.map(col => {
    const override = items[col.stage_id]
    if (override) {
      return { ...col, opportunities: override, count: override.length, total_value: override.reduce((s, o) => s + o.value, 0) }
    }
    return col
  })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">CRM Comercial</h1>
          <p className="mt-1 text-sm text-slate-500">
            Acompanhe oportunidades e avance cada negociação até o fechamento.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />Oportunidade
        </Button>
      </div>

      <CrmKpiBar opportunities={extOpps} />

      {/* Filters */}
      <div className="flex items-center gap-2 px-6 pb-3">
        <Filter className="size-3.5 text-slate-400" />
        {(['all', 'overdue', 'today', 'none'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'overdue' ? 'Atrasadas' : f === 'today' ? 'Hoje' : 'Sem atividade'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto px-6 pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[400px] w-[300px] shrink-0 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : columns.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-500">Nenhum pipeline configurado.</p>
        </div>
      ) : extOpps.length === 0 && !createOpen ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">Nenhuma oportunidade aberta</p>
            <p className="mt-1 text-xs text-slate-500">Crie a primeira oportunidade para iniciar seu pipeline comercial.</p>
            <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 size-3.5" />Criar oportunidade
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto px-6 pb-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4">
              {displayColumns.map(col => {
                const stage = stages?.find(s => s.id === col.stage_id)
                if (!stage) return null
                return (
                  <KanbanColumn
                    key={col.stage_id}
                    stage={stage}
                    opportunities={col.opportunities as CrmOpportunityBoardRowExtended[]}
                    onCardClick={opp => setDetailId(opp.opportunity_id)}
                  />
                )
              })}
            </div>
            <DragOverlay>
              {activeOpp ? (
                <div className="rotate-2 opacity-80">
                  <OpportunityCard opportunity={activeOpp} onClick={() => {}} isDragOverlay />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      <OpportunityCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultPipelineId={defaultPipeline?.id}
        stages={stages ?? []}
      />
      <OpportunityDetailDrawer
        opportunityId={detailId}
        onClose={() => setDetailId(null)}
        onWon={id => setWonLost({ id, action: 'won' })}
        onLost={id => setWonLost({ id, action: 'lost' })}
        stages={stages ?? []}
      />
      <WonLostDialogs wonLost={wonLost} onClose={() => setWonLost(null)} />
    </div>
  )
}
