import { supabase } from '@/lib/supabase'

import type { PriceList } from '@/types/database'

import type { ComparisonOffer, ComparisonRow } from './comparison-types'

type ServiceError = { code?: string; message?: string; details?: string; constraint?: string }

const comparisonSelect = 'catalog_item_id, catalog_item_active, code, item_name, unit, category_id, category_name, best_quotation_item_id, best_cost, best_supplier_id, best_supplier_name, best_valid_until, best_validity_not_informed, eligible_offer_count, resolved_margin_rule_id, resolved_rule_scope, resolved_adjustment_type, resolved_adjustment_value, suggested_price, price_list_id, approved_cost_price, approved_final_price, approved_adjustment_type, approved_adjustment_value, manual_source, approved_at, approved_by, approved_source_quotation_item_id, approved_quotation_id, approved_quotation_reference, approved_supplier_id, approved_supplier_name, approved_source_valid_until, effective_status, review_reason, persisted_status, approved_margin_rule_id, best_quotation_item_id_at_approval, best_cost_at_approval, decision_token'

const offersSelect = 'quotation_item_id, quotation_id, catalog_item_id, unit_price, supplier_description, supplier_item_code, supplier_id, supplier_name, reference_number, received_at, valid_until, quotation_status, is_expired, validity_not_informed, is_eligible'

export function translateError(error: ServiceError): Error {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.constraint ?? ''}`.toLowerCase()
  if (error.code === '42501') return new Error('Voce nao tem permissao para ler a comparacao.')
  if (error.code === 'PGRST116') return new Error('Comparacao indisponivel no momento.')
  if (text.includes('permission denied')) return new Error('Voce nao tem permissao para ler a comparacao.')
  return new Error('Nao foi possivel carregar a comparacao de custos. Tente novamente.')
}

export function translatePriceDecisionError(error: ServiceError): Error {
  const text = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
  if (text.includes('desatualizada')) return new Error('Esta decisao ficou desatualizada. Os dados foram recarregados; revise antes de tentar novamente.')
  if (error.code === '42501' || text.includes('apenas admin') || text.includes('permission denied')) return new Error('Apenas Admin pode alterar o preco comercial.')
  if (text.includes('nao e elegivel')) return new Error('A fonte selecionada nao esta mais elegivel. Recarregue as ofertas.')
  if (text.includes('regra de acrescimo')) return new Error('Defina uma regra de acrescimo antes de aprovar este preco.')
  if (text.includes('nao existe cotacao elegivel')) return new Error('Nao existe cotacao elegivel para este item.')
  if (text.includes('preco ativo nao encontrado')) return new Error('Nao ha preco comercial ativo para inativar.')
  return new Error('Nao foi possivel concluir a decisao comercial. Tente novamente.')
}

function assertNoError(error: ServiceError | null) {
  if (error) throw translateError(error)
}

export async function listComparison(): Promise<ComparisonRow[]> {
  const { data, error } = await supabase
    .from('pricing_comparison_v')
    .select(comparisonSelect)
    .order('code', { ascending: true })
  assertNoError(error)
  return (data ?? []) as unknown as ComparisonRow[]
}

export async function listOffersForItem(catalogItemId: string): Promise<ComparisonOffer[]> {
  const { data, error } = await supabase
    .from('quotation_item_candidates_v')
    .select(offersSelect)
    .eq('catalog_item_id', catalogItemId)
    .order('is_eligible', { ascending: false })
    .order('unit_price', { ascending: true })
    .order('valid_until', { ascending: false, nullsFirst: false })
    .order('received_at', { ascending: false })
  assertNoError(error)
  return (data ?? []) as unknown as ComparisonOffer[]
}

export async function approvePrice(input: { catalogItemId: string; decisionToken: string; sourceQuotationItemId?: string | null }): Promise<PriceList> {
  const { data, error } = await supabase.rpc('approve_price', {
    p_catalog_item_id: input.catalogItemId,
    p_expected_decision_token: input.decisionToken,
    p_source_quotation_item_id: input.sourceQuotationItemId ?? null,
  })
  if (error) throw translatePriceDecisionError(error)
  if (!data) throw new Error('O servidor nao retornou o preco aprovado.')
  return data as PriceList
}

export async function inactivatePrice(input: { catalogItemId: string; decisionToken: string }): Promise<PriceList> {
  const { data, error } = await supabase.rpc('inactivate_price', {
    p_catalog_item_id: input.catalogItemId,
    p_expected_decision_token: input.decisionToken,
  })
  if (error) throw translatePriceDecisionError(error)
  if (!data) throw new Error('O servidor nao retornou o preco inativado.')
  return data as PriceList
}
