import type { OwnPriceProposalItem } from '@/types/database'

export type OwnPriceRowState = 'no_price' | 'pending' | 'approved' | 'inactive'

export type OwnCatalogItem = {
  id: string
  code: string
  name: string
  unit: string
  category_id: string
  category_name: string | null
  active: boolean
}

export type OwnPriceCommercialStatus = {
  catalog_item_id: string
  price_list_id: string | null
  status: 'approved' | 'inactive' | null
  own_price_proposal_id: string | null
  final_price: string | null
  approved_at: string | null
}

export type OwnPriceViewRow = {
  item: OwnCatalogItem
  state: OwnPriceRowState
  currentApproved: OwnPriceProposalItem | null
  pending: OwnPriceProposalItem | null
  proposals: OwnPriceProposalItem[]
  commercialStatus: OwnPriceCommercialStatus | null
}

export type OwnPriceStatusFilter = 'all' | OwnPriceRowState