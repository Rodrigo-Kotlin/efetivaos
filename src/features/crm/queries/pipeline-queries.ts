import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchCrmPipelines,
  fetchCrmStages,
  fetchCrmOpportunities,
  fetchCrmOpportunity,
  fetchCrmOpportunityExtended,
  createCrmOpportunity,
  updateCrmOpportunity,
  moveCrmOpportunity,
  markOpportunityWon,
  markOpportunityLost,
  fetchCrmActivities,
  fetchCrmEvents,
  fetchCrmLossReasons,
  createCrmActivity,
  updateCrmActivity,
  completeCrmActivity,
  cancelCrmActivity,
} from '../api/crm-api'
import type {
  CrmPipeline,
  CrmStage,
  CrmOpportunityBoardRow,
  CrmOpportunityBoardRowExtended,
  CrmActivity,
  CrmOpportunityEvent,
  CrmLossReason,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const crmPipelineKeys = {
  all: ['crm', 'pipeline'] as const,
  pipelines: () => [...crmPipelineKeys.all, 'pipelines'] as const,
  stages: (pipelineId: string) => [...crmPipelineKeys.all, 'stages', pipelineId] as const,
  opportunities: (pipelineId: string) => [...crmPipelineKeys.all, 'opportunities', pipelineId] as const,
  opportunity: (id: string) => [...crmPipelineKeys.all, 'opportunity', id] as const,
  activities: (opportunityId: string) => [...crmPipelineKeys.all, 'activities', opportunityId] as const,
  events: (opportunityId: string) => [...crmPipelineKeys.all, 'events', opportunityId] as const,
  lossReasons: () => [...crmPipelineKeys.all, 'lossReasons'] as const,
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCrmPipelines() {
  return useQuery<CrmPipeline[]>({
    queryKey: crmPipelineKeys.pipelines(),
    queryFn: fetchCrmPipelines,
    staleTime: 120_000,
  })
}

export function useCrmStages(pipelineId: string | undefined) {
  return useQuery<CrmStage[]>({
    queryKey: crmPipelineKeys.stages(pipelineId ?? ''),
    queryFn: () => fetchCrmStages(pipelineId!),
    enabled: !!pipelineId,
    staleTime: 120_000,
  })
}

export function useCrmOpportunities(pipelineId: string | undefined) {
  return useQuery<CrmOpportunityBoardRow[]>({
    queryKey: crmPipelineKeys.opportunities(pipelineId ?? ''),
    queryFn: () => fetchCrmOpportunities(pipelineId!),
    enabled: !!pipelineId,
    staleTime: 30_000,
  })
}

export function useCrmOpportunity(id: string | undefined) {
  return useQuery<CrmOpportunityBoardRow>({
    queryKey: crmPipelineKeys.opportunity(id ?? ''),
    queryFn: () => fetchCrmOpportunity(id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useCrmOpportunityExtended(id: string | undefined) {
  return useQuery<CrmOpportunityBoardRowExtended>({
    queryKey: crmPipelineKeys.opportunity(id ?? ''),
    queryFn: () => fetchCrmOpportunityExtended(id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useCrmActivities(opportunityId: string | undefined) {
  return useQuery<CrmActivity[]>({
    queryKey: crmPipelineKeys.activities(opportunityId ?? ''),
    queryFn: () => fetchCrmActivities(opportunityId!),
    enabled: !!opportunityId,
    staleTime: 15_000,
  })
}

export function useCrmEvents(opportunityId: string | undefined) {
  return useQuery<CrmOpportunityEvent[]>({
    queryKey: crmPipelineKeys.events(opportunityId ?? ''),
    queryFn: () => fetchCrmEvents(opportunityId!),
    enabled: !!opportunityId,
    staleTime: 15_000,
  })
}

export function useCrmLossReasons() {
  return useQuery<CrmLossReason[]>({
    queryKey: crmPipelineKeys.lossReasons(),
    queryFn: fetchCrmLossReasons,
    staleTime: 300_000,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateCrmOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCrmOpportunity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmPipelineKeys.all })
    },
  })
}

export function useUpdateCrmOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof updateCrmOpportunity>[1]) =>
      updateCrmOpportunity(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmPipelineKeys.all })
    },
  })
}

export function useMoveCrmOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      opportunityId,
      targetStageId,
      targetPosition,
    }: {
      opportunityId: string
      targetStageId: string
      targetPosition?: number
    }) => moveCrmOpportunity(opportunityId, targetStageId, targetPosition),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmPipelineKeys.all })
    },
  })
}

export function useMarkOpportunityWon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markOpportunityWon,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmPipelineKeys.all })
    },
  })
}

export function useMarkOpportunityLost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, reasonId, reasonDetail }: {
      id: string
      reason?: string
      reasonId?: string
      reasonDetail?: string
    }) => markOpportunityLost(id, reason, reasonId, reasonDetail),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmPipelineKeys.all })
    },
  })
}

// ---------------------------------------------------------------------------
// Activity Mutations
// ---------------------------------------------------------------------------

export function useCreateCrmActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCrmActivity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmPipelineKeys.all })
    },
  })
}

export function useUpdateCrmActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ activityId, ...input }: { activityId: string } & Parameters<typeof updateCrmActivity>[1]) =>
      updateCrmActivity(activityId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmPipelineKeys.all })
    },
  })
}

export function useCompleteCrmActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ activityId, outcome }: { activityId: string; outcome?: string }) =>
      completeCrmActivity(activityId, outcome),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmPipelineKeys.all })
    },
  })
}

export function useCancelCrmActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cancelCrmActivity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmPipelineKeys.all })
    },
  })
}
