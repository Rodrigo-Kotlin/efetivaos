import { supabase } from '@/lib/supabase'
import type { Database, MarginRule } from '@/types/database'

import { parseRuleValue } from './rules-types'
import type { RuleInput, RuleRow } from './rules-types'

type ServiceError = { code?: string; message?: string; details?: string; constraint?: string }

const listSelect = 'id, scope_type, category_id, catalog_item_id, calculation_type, value, active, notes, updated_at, category:catalog_categories!margin_rules_category_id_fkey(id, name, active), catalog_item:catalog_items!margin_rules_catalog_item_id_fkey(id, code, name, active)'

type RawRow = MarginRule & {
  category: { id: string; name: string; active: boolean } | null
  catalog_item: { id: string; code: string; name: string; active: boolean } | null
}

function translateError(error: ServiceError): Error {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.constraint ?? ''}`.toLowerCase()
  if (error.code === '42501') return new Error('Voce nao tem permissao para gerenciar regras de acrescimo.')
  if (error.code === 'PGRST116') return new Error('Regra nao encontrada.')
  if (text.includes('permission denied')) return new Error('Voce nao tem permissao para gerenciar regras de acrescimo.')
  if (text.includes('unique') || text.includes('duplicate') || text.includes('conflict')) {
    return new Error('Ja existe uma regra ativa para este escopo.')
  }
  if (text.includes('check') && text.includes('value')) return new Error('Valor da regra invalido.')
  if (text.includes('check') && text.includes('scope')) return new Error('Combinacao de escopo e alvo invalida.')
  return new Error('Nao foi possivel concluir a operacao com a regra. Tente novamente.')
}

function assertNoError(error: ServiceError | null) {
  if (error) throw translateError(error)
}

function normalizeValue(input: RuleInput): string {
  return parseRuleValue(input.value).toFixed(4)
}

export async function listRules(): Promise<RuleRow[]> {
  const { data, error } = await supabase
    .from('margin_rules')
    .select(listSelect)
    .order('scope_type', { ascending: true })
    .order('updated_at', { ascending: false })
  assertNoError(error)
  return (data ?? []) as unknown as RawRow[] as RuleRow[]
}

export async function createRule(input: RuleInput): Promise<RuleRow> {
  const payload: Database['public']['Tables']['margin_rules']['Insert'] = {
    scope_type: input.scope_type,
    category_id: input.scope_type === 'category' ? input.category_id : null,
    catalog_item_id: input.scope_type === 'item' ? input.catalog_item_id : null,
    calculation_type: input.calculation_type,
    value: normalizeValue(input),
    active: input.active,
    notes: input.notes?.trim() || null,
  }
  const { data, error } = await supabase.from('margin_rules').insert(payload).select(listSelect).single()
  assertNoError(error)
  if (!data) throw new Error('Nao foi possivel criar a regra.')
  return data as unknown as RuleRow
}

export async function updateRule(id: string, input: RuleInput): Promise<RuleRow> {
  const payload: Database['public']['Tables']['margin_rules']['Update'] = {
    scope_type: input.scope_type,
    category_id: input.scope_type === 'category' ? input.category_id : null,
    catalog_item_id: input.scope_type === 'item' ? input.catalog_item_id : null,
    calculation_type: input.calculation_type,
    value: normalizeValue(input),
    active: input.active,
    notes: input.notes?.trim() || null,
  }
  const { data, error } = await supabase.from('margin_rules').update(payload).eq('id', id).select(listSelect).single()
  assertNoError(error)
  if (!data) throw new Error('Nao foi possivel atualizar a regra.')
  return data as unknown as RuleRow
}

export async function setRuleActive(id: string, active: boolean): Promise<RuleRow> {
  const { data, error } = await supabase
    .from('margin_rules')
    .update({ active })
    .eq('id', id)
    .select(listSelect)
    .single()
  assertNoError(error)
  if (!data) throw new Error('Nao foi possivel alterar o status da regra.')
  return data as unknown as RuleRow
}
