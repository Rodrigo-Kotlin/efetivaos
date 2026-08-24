import type { PriceEffectiveStatus, PriceReviewReason, PricingComparisonRow } from '@/types/database'

export type ComparisonRow = PricingComparisonRow

export type ComparisonOffer = {
  quotation_item_id: string
  quotation_id: string
  catalog_item_id: string | null
  unit_price: string
  supplier_description: string | null
  supplier_item_code: string | null
  supplier_id: string
  supplier_name: string
  reference_number: string | null
  received_at: string
  valid_until: string | null
  quotation_status: 'draft' | 'active' | 'cancelled'
  is_expired: boolean
  validity_not_informed: boolean
  is_eligible: boolean
}

export type ComparisonStatus = 'with_offer' | 'no_offer' | 'validity_not_informed' | 'no_rule' | 'suggestion_available'

export type OfferFilter = 'all' | 'with_offer' | 'no_offer' | 'validity_not_informed' | 'with_rule' | 'without_rule' | 'approved' | 'review_required' | 'inactive'

export type ComparisonSortKey = 'item' | 'best_cost' | 'category' | 'validity' | 'suggested_price'

export type OfferGroup = 'eligible' | 'historical'

export type CommercialStatusFilter = 'all' | PriceEffectiveStatus
export type CommercialSourceFilter = 'all' | 'automatic' | 'manual'

export type { PriceEffectiveStatus, PriceReviewReason }
