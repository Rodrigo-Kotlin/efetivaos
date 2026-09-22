import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { OwnPriceProposal, OwnPriceProposalInsert, OwnPriceProposalItem, OwnPriceStatus } from '@/types/database'

import type { OwnCatalogItem } from './own-prices.types'

type ServiceError = { code?: string; message?: string; details?: string; constraint?: string }

export function translateOwnPriceError(error: ServiceError): Error {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.constraint ?? ''}`.toLowerCase()

  if (text.includes('desatualizada')) {
    return new Error('A proposta foi alterada desde que você abriu esta tela. Atualize os dados antes de continuar.')
  }
  if (error.code === '42501' && text.includes('apenas admin')) {
    return new Error('Apenas Admin pode aprovar ou inativar proposta de preco proprio.')
  }
  if (error.code === '42501' && text.includes('usuario autenticado')) {
    return new Error('Facça login para enviar propostas de preco proprio.')
  }
  if (error.code === '42501' && text.includes('somente muda pela rpc')) {
    return new Error('Apenas a RPC de aprovacao altera o estado de uma proposta.')
  }
  if (error.code === '23505' && text.includes('one_pending')) {
    return new Error('Ja existe uma proposta pendente para este item.')
  }
  if (error.code === '23503') {
    return new Error('O item selecionado nao existe mais.')
  }
  if (text.includes('somente propostas pendentes ou aprovadas podem ser inativadas')) {
    return new Error('Somente propostas pendentes ou aprovadas podem ser inativadas.')
  }
  if (text.includes('somente propostas pendentes podem ser aprovadas')) {
    return new Error('Somente propostas pendentes podem ser aprovadas.')
  }
  if (text.includes('nao pode ter preco proprio aprovado')) {
    return new Error('O item do catalogo nao existe ou esta inativo; nao e possivel aprovar este preco.')
  }
  if (text.includes('somente itens de servico proprio recebem proposta')) {
    return new Error('Apenas itens de servico proprio aceitam proposta de preco proprio.')
  }
  if (text.includes('nao pode receber proposta de preco proprio')) {
    return new Error('O item do catalogo nao existe ou esta inativo.')
  }
  if (text.includes('submetida pelo proprio usuario')) {
    return new Error('A proposta deve ser submetida pelo proprio usuario logado.')
  }
  if (text.includes('proposta de preco proprio inexistente')) {
    return new Error('A proposta de preco proprio nao existe mais.')
  }
  if (error.code === '42501' || text.includes('permission denied')) {
    return new Error('Voce nao tem permissao para realizar esta operacao.')
  }
  return new Error('Nao foi possivel concluir a operacao de preco proprio. Tente novamente.')
}

function normalizeMoney(value: string): string {
  return value.replace(',', '.').trim()
}

export function normalizeOwnPriceProposalInput(input: OwnPriceProposalInsert) {
  return {
    catalog_item_id: input.catalog_item_id,
    sale_price: normalizeMoney(input.sale_price),
    internal_cost: input.internal_cost ? normalizeMoney(input.internal_cost) : null,
    decision_notes: input.decision_notes ? input.decision_notes.trim() : null,
  }
}

export async function listOwnPriceProposals(params?: { catalogItemId?: string | null; status?: OwnPriceStatus | null }): Promise<OwnPriceProposalItem[]> {
  const { data, error } = await supabase.rpc('get_own_price_proposals', {
    p_catalog_item_id: params?.catalogItemId ?? null,
    p_status: params?.status ?? null,
  })
  if (error) throw translateOwnPriceError(error)
  return (data ?? []) as unknown as OwnPriceProposalItem[]
}

const ownCatalogItemSelect = 'id, code, name, unit, category_id, active, category:catalog_categories!catalog_items_category_id_fkey(name)'

export async function listOwnCatalogItems(): Promise<OwnCatalogItem[]> {
  const { data, error } = await supabase
    .from('catalog_items')
    .select(ownCatalogItemSelect)
    .eq('sourcing_type', 'own')
    .order('name')
  if (error) throw translateOwnPriceError(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    unit: row.unit,
    category_id: row.category_id,
    category_name: row.category?.name ?? null,
    active: row.active,
  }))
}

export async function createOwnPriceProposal(input: OwnPriceProposalInsert): Promise<OwnPriceProposal> {
  const payload: Database['public']['Tables']['own_price_proposals']['Insert'] = normalizeOwnPriceProposalInput(input)
  const { data, error } = await supabase.from('own_price_proposals').insert(payload).select('*').single()
  if (error) throw translateOwnPriceError(error)
  if (!data) throw new Error('O servidor nao retornou a proposta criada.')
  return data as OwnPriceProposal
}

export async function fetchOwnPriceDecisionToken(proposalId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('own_price_decision_token', { p_proposal_id: proposalId })
  if (error) throw translateOwnPriceError(error)
  return (data as string | null) ?? null
}

export async function approveOwnPriceProposal(input: { proposalId: string; expectedDecisionToken: string }): Promise<OwnPriceProposal> {
  const { data, error } = await supabase.rpc('approve_own_price_proposal', {
    p_proposal_id: input.proposalId,
    p_expected_decision_token: input.expectedDecisionToken,
  })
  if (error) throw translateOwnPriceError(error)
  if (!data) throw new Error('O servidor nao retornou a proposta aprovada.')
  return data as OwnPriceProposal
}

export async function inactivateOwnPriceProposal(input: { proposalId: string; expectedDecisionToken: string; decisionNotes?: string | null }): Promise<OwnPriceProposal> {
  const { data, error } = await supabase.rpc('inactivate_own_price_proposal', {
    p_proposal_id: input.proposalId,
    p_expected_decision_token: input.expectedDecisionToken,
    p_decision_notes: input.decisionNotes?.trim() ? input.decisionNotes.trim() : null,
  })
  if (error) throw translateOwnPriceError(error)
  if (!data) throw new Error('O servidor nao retornou a proposta inativada.')
  return data as OwnPriceProposal
}

export async function fetchProfileName(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('full_name').eq('id', userId).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw translateOwnPriceError(error)
  }
  return data?.full_name ?? null
}