import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchCrmPipelines,
  fetchCrmStages,
  fetchCrmOpportunities,
  fetchCrmOpportunity,
  createCrmOpportunity,
  updateCrmOpportunity,
  moveCrmOpportunity,
  markOpportunityWon,
  markOpportunityLost,
} from '../api/crm-api'
import type {
  CrmPipeline,
  CrmStage,
  CrmOpportunityBoardRow,
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
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      markOpportunityLost(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmPipelineKeys.all })
    },
  })
}
