import { supabase } from '@/lib/supabase'
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

export async function markOpportunityLost(
  id: string,
  reason?: string,
  reasonId?: string,
  reasonDetail?: string,
): Promise<void> {
  const { error } = await (supabase.rpc as any)('mark_opportunity_lost', {
    p_opportunity_id: id,
    p_lost_reason: reason ?? null,
    p_lost_reason_id: reasonId ?? null,
    p_lost_reason_detail: reasonDetail ?? null,
  })
  if (error) throw new Error(crmError(error, 'marcar como perdida'))
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export async function createCrmActivity(input: {
  opportunity_id: string
  type: string
  title: string
  due_at: string
  client_id?: string
  description?: string
  responsible_user_id?: string
}): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('create_crm_activity', {
    p_opportunity_id: input.opportunity_id,
    p_type: input.type,
    p_title: input.title,
    p_due_at: input.due_at,
    p_client_id: input.client_id ?? null,
    p_description: input.description ?? null,
    p_responsible_user_id: input.responsible_user_id ?? null,
  })
  if (error) throw new Error(crmError(error, 'criar atividade'))
  return data as string
}

export async function updateCrmActivity(
  activityId: string,
  input: {
    type?: string
    title?: string
    description?: string
    due_at?: string
    responsible_user_id?: string
  },
): Promise<void> {
  const { error } = await (supabase.rpc as any)('update_crm_activity', {
    p_activity_id: activityId,
    p_type: input.type ?? null,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_due_at: input.due_at ?? null,
    p_responsible_user_id: input.responsible_user_id ?? null,
  })
  if (error) throw new Error(crmError(error, 'atualizar atividade'))
}

export async function completeCrmActivity(activityId: string, outcome?: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('complete_crm_activity', {
    p_activity_id: activityId,
    p_outcome: outcome ?? null,
  })
  if (error) throw new Error(crmError(error, 'concluir atividade'))
}

export async function cancelCrmActivity(activityId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('cancel_crm_activity', {
    p_activity_id: activityId,
  })
  if (error) throw new Error(crmError(error, 'cancelar atividade'))
}

export async function fetchCrmActivities(opportunityId: string): Promise<CrmActivity[]> {
  const { data, error } = await (supabase
    .from('crm_activities' as any)
    .select('*') as any)
    .eq('opportunity_id', opportunityId)
    .order('due_at', { ascending: true })
  if (error) throw new Error(crmError(error, 'carregar atividades'))
  return data as CrmActivity[]
}

export async function fetchCrmEvents(opportunityId: string): Promise<CrmOpportunityEvent[]> {
  const { data, error } = await (supabase
    .from('crm_opportunity_events' as any)
    .select('*') as any)
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(crmError(error, 'carregar eventos'))
  return data as CrmOpportunityEvent[]
}

export async function fetchCrmLossReasons(): Promise<CrmLossReason[]> {
  const { data, error } = await (supabase
    .from('crm_loss_reasons' as any)
    .select('*') as any)
    .eq('active', true)
    .order('position')
  if (error) throw new Error(crmError(error, 'carregar motivos de perda'))
  return data as CrmLossReason[]
}

export async function fetchCrmOpportunityExtended(id: string): Promise<CrmOpportunityBoardRowExtended> {
  const { data, error } = await (supabase
    .from('crm_opportunities_board_v' as any)
    .select('*') as any)
    .eq('opportunity_id', id)
    .single()
  if (error) throw new Error(crmError(error, 'carregar oportunidade'))
  return data as CrmOpportunityBoardRowExtended
}
