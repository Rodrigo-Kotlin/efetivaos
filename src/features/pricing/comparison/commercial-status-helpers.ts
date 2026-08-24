import type { PriceEffectiveStatus, PriceReviewReason } from './comparison-types'

const reasonLabels: Record<PriceReviewReason, string> = {
  manual_review_required: 'Revisao manual solicitada',
  approved_source_ineligible: 'Fonte aprovada nao esta mais elegivel',
  best_cost_reference_changed: 'Referencia de menor custo mudou',
  no_active_rule: 'Regra de acrescimo nao esta mais ativa',
  pricing_rule_changed: 'Regra de acrescimo mudou',
}

export function commercialStatusLabel(status: PriceEffectiveStatus): string {
  if (status === 'approved') return 'Aprovado'
  if (status === 'review_required') return 'Revisao necessaria'
  if (status === 'inactive') return 'Inativo'
  if (status === 'no_cost') return 'Sem custo vigente'
  if (status === 'no_rule') return 'Sem regra'
  return 'Sugestao disponivel'
}

export function reviewReasonLabel(reason: PriceReviewReason | null): string | null {
  return reason ? reasonLabels[reason] : null
}
