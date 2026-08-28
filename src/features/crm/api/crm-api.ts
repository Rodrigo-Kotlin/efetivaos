import { supabase } from '@/lib/supabase'
import type {
  CrmPipeline,
  CrmStage,
  CrmOpportunityBoardRow,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function crmError(error: { code?: string; message: string }, operation: string): string {
  if (error.code === '23503') return 'Registro referenciado não encontrado.'
  if (error.code === '23505') return 'Registro duplicado.'
  if (error.code === '42501') return 'Sem permissão para esta operação.'
  if (error.code === 'PGRST116') return 'Registro não encontrado.'
  return `Erro ao ${operation}: ${error.message}`
}

// ---------------------------------------------------------------------------
// Pipelines
// ---------------------------------------------------------------------------

export async function fetchCrmPipelines(): Promise<CrmPipeline[]> {
  const { data, error } = await (supabase
    .from('crm_pipelines' as any)
    .select('*') as any)
    .eq('active', true)
    .order('name')
  if (error) throw new Error(crmError(error, 'carregar pipelines'))
  return data as CrmPipeline[]
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export async function fetchCrmStages(pipelineId: string): Promise<CrmStage[]> {
  const { data, error } = await (supabase
    .from('crm_stages' as any)
    .select('*') as any)
    .eq('pipeline_id', pipelineId)
    .eq('active', true)
    .order('position')
  if (error) throw new Error(crmError(error, 'carregar etapas'))
  return data as CrmStage[]
}

// ---------------------------------------------------------------------------
// Opportunities Board
// ---------------------------------------------------------------------------

export async function fetchCrmOpportunities(
  pipelineId: string,
): Promise<CrmOpportunityBoardRow[]> {
  const { data, error } = await (supabase
    .from('crm_opportunities_board_v' as any)
    .select('*') as any)
    .eq('pipeline_id', pipelineId)
    .eq('status', 'open')
    .order('sort_order')
  if (error) throw new Error(crmError(error, 'carregar oportunidades'))
  return data as CrmOpportunityBoardRow[]
}

// ---------------------------------------------------------------------------
// Single Opportunity
// ---------------------------------------------------------------------------

export async function fetchCrmOpportunity(id: string): Promise<CrmOpportunityBoardRow> {
  const { data, error } = await (supabase
    .from('crm_opportunities_board_v' as any)
    .select('*') as any)
    .eq('opportunity_id', id)
    .single()
  if (error) throw new Error(crmError(error, 'carregar oportunidade'))
  return data as CrmOpportunityBoardRow
}

// ---------------------------------------------------------------------------
// Create Opportunity
// ---------------------------------------------------------------------------

export async function createCrmOpportunity(input: {
  client_id: string
  title: string
  pipeline_id?: string
  stage_id?: string
  value?: number
  expected_close_date?: string | null
  responsible_user_id?: string | null
  description?: string | null
}): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('create_crm_opportunity', {
    p_client_id: input.client_id,
    p_title: input.title,
    p_pipeline_id: input.pipeline_id ?? null,
    p_stage_id: input.stage_id ?? null,
    p_value: input.value ?? 0,
    p_expected_close_date: input.expected_close_date ?? null,
    p_responsible_user_id: input.responsible_user_id ?? null,
    p_description: input.description ?? null,
  })
  if (error) throw new Error(crmError(error, 'criar oportunidade'))
  return data as string
}

// ---------------------------------------------------------------------------
// Update Opportunity
// ---------------------------------------------------------------------------

export async function updateCrmOpportunity(
  id: string,
  input: {
    title?: string
    client_id?: string
    value?: number
    expected_close_date?: string | null
    responsible_user_id?: string | null
    description?: string | null
  },
): Promise<void> {
  const { error } = await (supabase.rpc as any)('update_crm_opportunity', {
    p_opportunity_id: id,
    p_title: input.title ?? null,
    p_client_id: input.client_id ?? null,
    p_value: input.value ?? null,
    p_expected_close_date: input.expected_close_date ?? null,
    p_responsible_user_id: input.responsible_user_id ?? null,
    p_description: input.description ?? null,
  })
  if (error) throw new Error(crmError(error, 'atualizar oportunidade'))
}

// ---------------------------------------------------------------------------
// Move Opportunity
// ---------------------------------------------------------------------------

export async function moveCrmOpportunity(
  opportunityId: string,
  targetStageId: string,
  targetPosition?: number,
): Promise<void> {
  const { error } = await (supabase.rpc as any)('move_crm_opportunity', {
    p_opportunity_id: opportunityId,
    p_target_stage_id: targetStageId,
    p_target_position: targetPosition ?? null,
  })
  if (error) throw new Error(crmError(error, 'mover oportunidade'))
}

// ---------------------------------------------------------------------------
// Mark Won / Lost
// ---------------------------------------------------------------------------

export async function markOpportunityWon(id: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('mark_opportunity_won', {
    p_opportunity_id: id,
  })
  if (error) throw new Error(crmError(error, 'marcar como ganha'))
}

export async function markOpportunityLost(id: string, reason: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('mark_opportunity_lost', {
    p_opportunity_id: id,
    p_lost_reason: reason,
  })
  if (error) throw new Error(crmError(error, 'marcar como perdida'))
}
