import type { OfferFilter } from './comparison-types'
import { isExpired } from '@/features/pricing/quotations/quotation.helpers'

export function formatComparisonCurrency(value: string | null) {
  if (value === null) return 'Sem oferta vigente'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

export function formatRuleValue(calculationType: 'percentage' | 'fixed' | null, value: string | null): string {
  if (calculationType === null || value === null) return '—'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  if (calculationType === 'percentage') {
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(numeric)}%`
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric)
}

export function formatRuleScope(scope: 'global' | 'category' | 'item' | null, target?: { category_name?: string; item_name?: string } | null): string {
  if (scope === null) return 'Sem regra'
  if (scope === 'global') return 'Global'
  if (scope === 'category') return `Categoria${target?.category_name ? ` — ${target.category_name}` : ''}`
  return `Item${target?.item_name ? ` — ${target.item_name}` : ''}`
}

export function formatComparisonDate(value: string | null) {
  if (!value) return 'Não informada'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

export function matchComparisonSearch(term: string, row: { code: string; item_name: string; category_name: string; best_supplier_name: string | null }): boolean {
  const normalized = term.toLocaleLowerCase('pt-BR').trim()
  if (!normalized) return true
  const haystacks = [row.code, row.item_name, row.category_name, row.best_supplier_name ?? '']
  return haystacks.some((field) => field.toLocaleLowerCase('pt-BR').includes(normalized))
}

export function matchOfferFilter(
  filter: OfferFilter,
  row: { best_cost: string | null; best_validity_not_informed: boolean | null; best_valid_until: string | null; resolved_margin_rule_id: string | null },
): boolean {
  if (filter === 'all') return true
  if (filter === 'with_offer') return row.best_cost !== null
  if (filter === 'no_offer') return row.best_cost === null
  if (filter === 'with_rule') return row.best_cost !== null && row.resolved_margin_rule_id !== null
  if (filter === 'without_rule') return row.best_cost !== null && row.resolved_margin_rule_id === null
  return Boolean(row.best_validity_not_informed) || row.best_valid_until === null
}

export function isOfferStillValid(validUntil: string | null, today = new Date()): boolean {
  if (!validUntil) return true
  return !isExpired(validUntil, today)
}

export function compareNumeric(a: string | null, b: string | null) {
  const an = a === null ? Number.POSITIVE_INFINITY : Number(a)
  const bn = b === null ? Number.POSITIVE_INFINITY : Number(b)
  if (an < bn) return -1
  if (an > bn) return 1
  return 0
}
