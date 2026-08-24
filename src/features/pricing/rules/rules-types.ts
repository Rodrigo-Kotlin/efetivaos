import type { AdjustmentType, MarginRule, MarginScope } from '@/types/database'

export type { AdjustmentType, MarginRule, MarginScope }

export type RuleRow = MarginRule & {
  category?: { id: string; name: string; active: boolean } | null
  catalog_item?: { id: string; code: string; name: string; active: boolean } | null
}

export type RuleInput = {
  scope_type: MarginScope
  category_id: string | null
  catalog_item_id: string | null
  calculation_type: AdjustmentType
  value: string
  active: boolean
  notes: string | null
}

export type RuleFilter = 'all' | 'global' | 'category' | 'item'
export type StatusFilter = 'all' | 'active' | 'inactive'

export const ruleScopeLabels: Record<MarginScope, string> = {
  global: 'Global',
  category: 'Categoria',
  item: 'Item',
}

export const ruleCalculationLabels: Record<AdjustmentType, string> = {
  percentage: 'Percentual sobre custo',
  fixed: 'Valor fixo',
}

export function parseRuleValue(raw: string): number {
  if (!raw) return Number.NaN
  const normalized = raw.replace(/\s+/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return parsed
}

export function formatRuleValue(calculationType: AdjustmentType | null, value: string | number | null): string {
  if (calculationType === null || value === null) return '—'
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return '—'
  if (calculationType === 'percentage') {
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(num)}%`
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}
