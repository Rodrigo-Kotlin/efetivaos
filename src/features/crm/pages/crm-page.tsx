import { useState } from 'react'
import { Plus, GripVertical } from 'lucide-react'
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
import type { CrmOpportunityBoardRow, CrmBoardColumn, CrmStage } from '@/types/database'

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

// ---------------------------------------------------------------------------
// KanbanColumn (droppable)
// ---------------------------------------------------------------------------

function KanbanColumn({
  stage,
  opportunities,
  onCardClick,
}: {
  stage: CrmStage
  opportunities: CrmOpportunityBoardRow[]
  onCardClick: (opp: CrmOpportunityBoardRow) => void
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
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-700">{stage.name}</p>
          <p className="text-xs text-slate-500">
            {opportunities.length} · {fmt(totalValue)}
          </p>
        </div>
      </div>

      {/* Cards */}
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

// ---------------------------------------------------------------------------
// Main CRM Page
// ---------------------------------------------------------------------------

export default function CrmPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [wonLost, setWonLost] = useState<{ id: string; action: 'won' | 'lost' } | null>(null)

  // Data
  const { data: pipelines, isLoading: lPipelines } = useCrmPipelines()
  const defaultPipeline = pipelines?.find(p => p.is_default) ?? pipelines?.[0]
  const { data: stages, isLoading: lStages } = useCrmStages(defaultPipeline?.id)
  const { data: opportunities, isLoading: lOpps } = useCrmOpportunities(defaultPipeline?.id)

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, CrmOpportunityBoardRow[]>>({})

  const isLoading = lPipelines || lStages || lOpps

  // Build columns from stages + opportunities
  const columns: CrmBoardColumn[] = (stages ?? []).map(s => {
    const opps = (opportunities ?? []).filter(o => o.stage_id === s.id)
    return {
      stage_id: s.id,
      stage_name: s.name,
      stage_position: s.position,
      stage_probability: s.probability,
      opportunities: opps,
      total_value: opps.reduce((sum, o) => sum + o.value, 0),
      count: opps.length,
    }
  })

  // Build sortable items map
  const sortableItems: Record<string, string[]> = {}
  for (const col of columns) {
    sortableItems[col.stage_id] = col.opportunities.map(o => o.opportunity_id)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const activeOpp = activeId
    ? (opportunities ?? []).find(o => o.opportunity_id === activeId)
    : null

  // DnD handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Find which stage contains the active item
    let activeStageId: string | null = null
    for (const [stageId, oppIds] of Object.entries(sortableItems)) {
      if (oppIds.includes(activeId)) {
        activeStageId = stageId
        break
      }
    }
    if (!activeStageId) return

    // Check if over is a stage id or a card id
    let overStageId: string | null = null
    if (sortableItems[overId]) {
      // Over is a stage
      overStageId = overId
    } else {
      // Over is a card - find its stage
      for (const [stageId, oppIds] of Object.entries(sortableItems)) {
        if (oppIds.includes(overId)) {
          overStageId = stageId
          break
        }
      }
    }

    if (!overStageId || activeStageId === overStageId) return

    // Move item between stages
    setItems(prev => {
      const newItems = { ...prev }
      // Initialize from original columns if not in state yet
      for (const col of columns) {
        if (!newItems[col.stage_id]) {
          newItems[col.stage_id] = col.opportunities
        }
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

    // Find active stage
    let activeStageId: string | null = null
    for (const [stageId, oppIds] of Object.entries(sortableItems)) {
      if (oppIds.includes(activeId)) {
        activeStageId = stageId
        break
      }
    }
    if (!activeStageId) return

    // Reorder within same stage
    if (!sortableItems[overId]) {
      let overStageId: string | null = null
      for (const [stageId, oppIds] of Object.entries(sortableItems)) {
        if (oppIds.includes(overId)) {
          overStageId = stageId
          break
        }
      }
      if (overStageId && activeStageId === overStageId) {
        const currentItems = items[activeStageId] ?? sortableItems[activeStageId]?.map(id =>
          (opportunities ?? []).find(o => o.opportunity_id === id)!
        ) ?? []
        const oldIdx = currentItems.findIndex(o => o.opportunity_id === activeId)
        const newIdx = currentItems.findIndex(o => o.opportunity_id === overId)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(currentItems, oldIdx, newIdx)
          setItems(prev => ({ ...prev, [activeStageId!]: reordered }))
        }
      }
    }

    // If moved to a different stage, the handleDragOver already handled it
    // Persist via moveCrmOpportunity will be handled by parent
  }

  // Get the items to display (state override or original columns)
  const displayColumns: CrmBoardColumn[] = columns.map(col => {
    const override = items[col.stage_id]
    if (override) {
      return {
        ...col,
        opportunities: override,
        count: override.length,
        total_value: override.reduce((s, o) => s + o.value, 0),
      }
    }
    return col
  })

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
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

      {/* KPIs */}
      <CrmKpiBar opportunities={opportunities ?? []} />

      {/* Kanban */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto px-6 pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[400px] w-[300px] shrink-0 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : columns.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-slate-500">Nenhum pipeline configurado.</p>
          </div>
        </div>
      ) : (opportunities ?? []).length === 0 && !createOpen ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">Nenhuma oportunidade aberta</p>
            <p className="mt-1 text-xs text-slate-500">
              Crie a primeira oportunidade para iniciar seu pipeline comercial.
            </p>
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
                    opportunities={col.opportunities}
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

      {/* Drawers / Dialogs */}
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
      <WonLostDialogs
        wonLost={wonLost}
        onClose={() => setWonLost(null)}
      />
    </div>
  )
}
