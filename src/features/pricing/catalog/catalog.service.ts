import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

import type { CatalogCategoryInput, CatalogCategoryRow, CatalogItemInput, CatalogItemRow } from './catalog.types'

type ServiceError = { code?: string; message?: string; details?: string; constraint?: string }

const itemSelect = 'id, code, name, category_id, unit, description, active, updated_at, category:catalog_categories!catalog_items_category_id_fkey(id, name, active)'
const categorySelect = 'id, name, active, updated_at'

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeCatalogItemInput(input: CatalogItemInput) {
  return {
    code: normalizeText(input.code).toUpperCase(),
    name: normalizeText(input.name),
    category_id: input.category_id,
    unit: normalizeText(input.unit).toLowerCase(),
    description: input.description ? normalizeText(input.description) : null,
  }
}

export function translateCatalogError(error: ServiceError): Error {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.constraint ?? ''}`.toLowerCase()

  if (error.code === '23505' && text.includes('catalog_items')) {
    return new Error('Ja existe um item com este codigo.')
  }
  if (error.code === '23505' && text.includes('catalog_categories')) {
    return new Error('Ja existe uma categoria com este nome.')
  }
  if (error.code === '23503') {
    return new Error('A categoria selecionada nao existe mais ou possui registros relacionados.')
  }
  if (error.code === '42501') {
    return new Error('Voce nao tem permissao para realizar esta operacao.')
  }
  if (text.includes('categoria e unidade nao podem mudar')) {
    return new Error('A categoria e a unidade nao podem ser alteradas porque o item ja participa do historico de cotacoes.')
  }
  if (text.includes('foreign key') || text.includes('violates foreign key')) {
    return new Error('Nao foi possivel concluir porque o registro possui historico relacionado.')
  }

  return new Error('Nao foi possivel concluir a operacao no catalogo. Tente novamente.')
}

function throwIfError(error: ServiceError | null) {
  if (error) throw translateCatalogError(error)
}

export async function listCatalogItems(): Promise<CatalogItemRow[]> {
  const { data, error } = await supabase.from('catalog_items').select(itemSelect).order('name')
  throwIfError(error)
  return (data ?? []) as CatalogItemRow[]
}

export async function listCatalogCategories(): Promise<CatalogCategoryRow[]> {
  const { data, error } = await supabase.from('catalog_categories').select(categorySelect).order('name')
  throwIfError(error)
  return (data ?? []) as CatalogCategoryRow[]
}

export async function createCatalogItem(input: CatalogItemInput): Promise<CatalogItemRow> {
  const payload: Database['public']['Tables']['catalog_items']['Insert'] = normalizeCatalogItemInput(input)
  const { data, error } = await supabase.from('catalog_items').insert(payload).select(itemSelect).single()
  throwIfError(error)
  return data as CatalogItemRow
}

export async function updateCatalogItem(id: string, input: CatalogItemInput): Promise<CatalogItemRow> {
  const payload: Database['public']['Tables']['catalog_items']['Update'] = normalizeCatalogItemInput(input)
  const { data, error } = await supabase.from('catalog_items').update(payload).eq('id', id).select(itemSelect).single()
  throwIfError(error)
  return data as CatalogItemRow
}

export async function setCatalogItemStatus(id: string, active: boolean): Promise<CatalogItemRow> {
  const { data, error } = await supabase.from('catalog_items').update({ active }).eq('id', id).select(itemSelect).single()
  throwIfError(error)
  return data as CatalogItemRow
}

export async function createCatalogCategory(input: CatalogCategoryInput): Promise<CatalogCategoryRow> {
  const payload = { name: normalizeText(input.name), active: input.active }
  const { data, error } = await supabase.from('catalog_categories').insert(payload).select(categorySelect).single()
  throwIfError(error)
  return data as CatalogCategoryRow
}

export async function updateCatalogCategory(id: string, input: CatalogCategoryInput): Promise<CatalogCategoryRow> {
  const payload = { name: normalizeText(input.name), active: input.active }
  const { data, error } = await supabase.from('catalog_categories').update(payload).eq('id', id).select(categorySelect).single()
  throwIfError(error)
  return data as CatalogCategoryRow
}

export async function setCatalogCategoryStatus(id: string, active: boolean): Promise<CatalogCategoryRow> {
  const { data, error } = await supabase.from('catalog_categories').update({ active }).eq('id', id).select(categorySelect).single()
  throwIfError(error)
  return data as CatalogCategoryRow
}
