import { supabase } from '@/lib/supabase'
import type {
  CrmPipeline,
  CrmStage,
  CrmOpportunityBoardRow,
  CrmOpportunityBoardRowExtended,
  CrmActivity,
  CrmOpportunityEvent,
  CrmLossReason,
  ActivityNextStatus,
  OpportunityStatus,
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
  filters: CrmOpportunityFilters = {},
): Promise<CrmOpportunityBoardRowExtended[]> {
  let query = (supabase
    .from('crm_opportunities_board_v' as any)
    .select('opportunity_id, client_id, client_name, client_legal_name, client_tax_id, title, description, pipeline_id, pipeline_name, stage_id, stage_name, stage_position, stage_probability, value, probability, expected_close_date, responsible_user_id, responsible_name, status, sort_order, won_at, lost_at, lost_reason, lost_reason_id, lost_reason_detail, loss_reason_name, created_at, updated_at, created_by, stage_entered_at, stage_age_days, next_activity_id, next_activity_type, next_activity_title, next_activity_due_at, next_activity_responsible_user_id, next_activity_status_semantic') as any)
    .eq('pipeline_id', pipelineId)
    .eq('status', filters.status ?? 'open')
    .order('sort_order')
  if (filters.search?.trim()) {
    const search = escapePostgrestSearch(filters.search.trim())
    query = query.or(`title.ilike.%${search}%,client_name.ilike.%${search}%`)
  }
  if (filters.stage_id) query = query.eq('stage_id', filters.stage_id)
  if (filters.activity) query = query.eq('next_activity_status_semantic', filters.activity)
  if (filters.value_min !== undefined) query = query.gte('value', filters.value_min)
  if (filters.value_max !== undefined) query = query.lte('value', filters.value_max)
  if (filters.date_from) query = query.gte('expected_close_date', filters.date_from)
  if (filters.date_to) query = query.lte('expected_close_date', filters.date_to)

  const { data, error } = await query
  if (error) throw new Error(crmError(error, 'carregar oportunidades'))
  return data as CrmOpportunityBoardRowExtended[]
}

export type CrmOpportunityFilters = {
  search?: string
  stage_id?: string
  status?: OpportunityStatus
  activity?: ActivityNextStatus
  value_min?: number
  value_max?: number
  date_from?: string
  date_to?: string
}

function escapePostgrestSearch(value: string): string {
  return value.replace(/[\\(),]/g, char => `\\${char}`)
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

export async function fetchCrmPipelineAnalytics(params?: {
  pipeline_id?: string
  from_date?: string
  to_date?: string
  responsible_user_id?: string
}): Promise<import('@/types/database').CrmPipelineAnalytics> {
  const { data, error } = await (supabase.rpc as any)('get_crm_pipeline_analytics', {
    p_pipeline_id: params?.pipeline_id ?? null,
    p_from_date: params?.from_date ?? null,
    p_to_date: params?.to_date ?? null,
    p_responsible_user_id: params?.responsible_user_id ?? null,
  })
  if (error) throw new Error(crmError(error, 'carregar analytics'))
  return data as import('@/types/database').CrmPipelineAnalytics
}
