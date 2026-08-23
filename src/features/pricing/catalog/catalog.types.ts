import type { CatalogCategory, CatalogItem } from '@/types/database'

export type CatalogItemRow = Pick<
  CatalogItem,
  'id' | 'code' | 'name' | 'category_id' | 'unit' | 'description' | 'active' | 'updated_at'
> & {
  category: Pick<CatalogCategory, 'id' | 'name' | 'active'>
}

export type CatalogCategoryRow = Pick<CatalogCategory, 'id' | 'name' | 'active' | 'updated_at'>

export type CatalogItemInput = Pick<CatalogItem, 'code' | 'name' | 'category_id' | 'unit'> & {
  description?: string
}

export type CatalogCategoryInput = Pick<CatalogCategory, 'name' | 'active'>
