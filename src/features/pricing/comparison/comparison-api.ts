import { supabase } from '@/lib/supabase'

import type { ComparisonOffer, ComparisonRow } from './comparison-types'

type ServiceError = { code?: string; message?: string; details?: string; constraint?: string }

const comparisonSelect = 'catalog_item_id, code, item_name, unit, category_id, category_name, best_quotation_item_id, best_cost, best_supplier_id, best_supplier_name, best_valid_until, best_validity_not_informed, eligible_offer_count, resolved_margin_rule_id, resolved_rule_scope, resolved_adjustment_type, resolved_adjustment_value, suggested_price, effective_status'

const offersSelect = 'quotation_item_id, quotation_id, catalog_item_id, unit_price, supplier_description, supplier_item_code, supplier_id, supplier_name, reference_number, received_at, valid_until, quotation_status, is_expired, validity_not_informed, is_eligible'

export function translateError(error: ServiceError): Error {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.constraint ?? ''}`.toLowerCase()
  if (error.code === '42501') return new Error('Voce nao tem permissao para ler a comparacao.')
  if (error.code === 'PGRST116') return new Error('Comparacao indisponivel no momento.')
  if (text.includes('permission denied')) return new Error('Voce nao tem permissao para ler a comparacao.')
  return new Error('Nao foi possivel carregar a comparacao de custos. Tente novamente.')
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
