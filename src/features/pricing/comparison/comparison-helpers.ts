import type { OfferFilter } from './comparison-types'
import { isExpired } from '@/features/pricing/quotations/quotation.helpers'

export function formatComparisonCurrency(value: string | null) {
  if (value === null) return 'Sem oferta vigente'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
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
  row: { best_unit_price: string | null; best_validity_not_informed: boolean | null; best_valid_until: string | null },
): boolean {
  if (filter === 'all') return true
  if (filter === 'with_offer') return row.best_unit_price !== null
  if (filter === 'no_offer') return row.best_unit_price === null
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
