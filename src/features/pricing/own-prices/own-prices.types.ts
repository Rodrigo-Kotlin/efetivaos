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

export type OwnPriceViewRow = {
  item: OwnCatalogItem
  state: OwnPriceRowState
  currentApproved: OwnPriceProposalItem | null
  pending: OwnPriceProposalItem | null
  proposals: OwnPriceProposalItem[]
}

export type OwnPriceStatusFilter = 'all' | OwnPriceRowState