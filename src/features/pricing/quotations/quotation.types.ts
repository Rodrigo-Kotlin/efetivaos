import type { CatalogItem, Quotation, QuotationItem, Supplier } from '@/types/database'

export type QuotationListRow = Pick<Quotation, 'id' | 'reference_number' | 'received_at' | 'valid_until' | 'status' | 'updated_at' | 'archived_at'> & {
  supplier: Pick<Supplier, 'id' | 'name'>
  quotation_items: Array<Pick<QuotationItem, 'id'>>
}

export type QuotationItemRow = QuotationItem & {
  catalog_item: (Pick<CatalogItem, 'id' | 'code' | 'name' | 'unit' | 'category_id' | 'active'> & {
    category: { id: string; name: string }
  }) | null
}

export type QuotationDetail = Quotation & {
  supplier: Pick<Supplier, 'id' | 'name' | 'active'>
  quotation_items: QuotationItemRow[]
}

export type QuotationDraftItem = {
  id?: string
  catalog_item_id: string | null
  supplier_description: string | null
  supplier_item_code: string | null
  unit_price: string
  notes: string | null
}

export type QuotationDraftInput = {
  id?: string
  expectedUpdatedAt: string | null
  expectedRevision: number | null
  supplier_id: string
  reference_number: string | null
  received_at: string
  valid_until: string | null
  notes: string | null
  items: QuotationDraftItem[]
  file?: File | null
}

export type QuotationDraftSaveResult = {
  quotation: Quotation
  attachmentWarning?: string
}

export type QuotationLifecycleInput = Pick<Quotation, 'id'> & {
  expectedRevision: number
}

export type QuotationAttachmentRecoveryInput = Pick<Quotation, 'id'> & {
  expectedRevision: number
}
