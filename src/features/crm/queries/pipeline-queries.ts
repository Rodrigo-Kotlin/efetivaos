import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchCrmPipelines,
  fetchCrmStages,
  fetchCrmOpportunities,
  fetchCrmOpportunity,
  fetchCrmOpportunityExtended,
  fetchCrmPipelineAnalytics,
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
  CrmPipelineAnalytics,
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
  analytics: (params?: Record<string, string | undefined>) => [...crmPipelineKeys.all, 'analytics', params] as const,
}

// ---------------------------------------------------------------------------
// Targeted invalidation helpers
// ---------------------------------------------------------------------------

function invalidateOpportunities(qc: ReturnType<typeof useQueryClient>, pipelineId?: string) {
  if (pipelineId) {
    qc.invalidateQueries({ queryKey: crmPipelineKeys.opportunities(pipelineId) })
  } else {
    qc.invalidateQueries({ queryKey: crmPipelineKeys.all, predicate: (q) =>
      q.queryKey.includes('opportunities')
    })
  }
}

function invalidateOpportunity(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: crmPipelineKeys.opportunity(id) })
}

function invalidateActivities(qc: ReturnType<typeof useQueryClient>, opportunityId: string) {
  qc.invalidateQueries({ queryKey: crmPipelineKeys.activities(opportunityId) })
  qc.invalidateQueries({ queryKey: crmPipelineKeys.events(opportunityId) })
}

function invalidateAnalytics(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: crmPipelineKeys.all, predicate: (q) =>
    q.queryKey.includes('analytics')
  })
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
  return useQuery<CrmOpportunityBoardRowExtended[]>({
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

export function useCrmPipelineAnalytics(params?: {
  pipeline_id?: string
  from_date?: string
  to_date?: string
  responsible_user_id?: string
}) {
  return useQuery<CrmPipelineAnalytics>({
    queryKey: crmPipelineKeys.analytics(params as Record<string, string | undefined>),
    queryFn: () => fetchCrmPipelineAnalytics(params),
    staleTime: 60_000,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateCrmOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCrmOpportunity,
    onSuccess: (_data, variables) => {
      invalidateOpportunities(qc, variables.pipeline_id as string | undefined)
      invalidateAnalytics(qc)
    },
  })
}

export function useUpdateCrmOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof updateCrmOpportunity>[1]) =>
      updateCrmOpportunity(id, input),
    onSuccess: (_data, variables) => {
      invalidateOpportunity(qc, variables.id)
      invalidateOpportunities(qc)
      invalidateAnalytics(qc)
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
    onSuccess: (_data, variables) => {
      invalidateOpportunity(qc, variables.opportunityId)
      invalidateOpportunities(qc)
      invalidateAnalytics(qc)
    },
  })
}

export function useMarkOpportunityWon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markOpportunityWon,
    onSuccess: (_data, id) => {
      invalidateOpportunity(qc, id)
      invalidateOpportunities(qc)
      invalidateAnalytics(qc)
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
    onSuccess: (_data, variables) => {
      invalidateOpportunity(qc, variables.id)
      invalidateOpportunities(qc)
      invalidateAnalytics(qc)
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
    onSuccess: (_data, variables) => {
      invalidateActivities(qc, variables.opportunity_id)
      invalidateOpportunity(qc, variables.opportunity_id)
      invalidateOpportunities(qc)
    },
  })
}

export function useUpdateCrmActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ activityId, ...input }: { activityId: string } & Parameters<typeof updateCrmActivity>[1]) =>
      updateCrmActivity(activityId, input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: crmPipelineKeys.all, predicate: (q) =>
        q.queryKey.includes('activities') || q.queryKey.includes('opportunities')
      })
    },
  })
}

export function useCompleteCrmActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ activityId, outcome }: { activityId: string; outcome?: string }) =>
      completeCrmActivity(activityId, outcome),
    onSuccess: (_data, variables) => {
      invalidateActivities(qc, variables.activityId)
      invalidateOpportunities(qc)
      invalidateAnalytics(qc)
    },
  })
}

export function useCancelCrmActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cancelCrmActivity,
    onSuccess: (_data, activityId) => {
      invalidateActivities(qc, activityId)
      invalidateOpportunities(qc)
    },
  })
}
