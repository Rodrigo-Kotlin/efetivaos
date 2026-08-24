import type { QuotationStatus } from '@/types/database'

export type ValidityFilter = 'all' | 'valid' | 'expired' | 'no-validity'

export const quotationStatusLabels: Record<QuotationStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  cancelled: 'Cancelada',
}

export function isExpired(validUntil: string | null, today = new Date()): boolean {
  if (!validUntil) return false
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return validUntil < localToday
}

export function matchesValidity(validUntil: string | null, filter: ValidityFilter, today = new Date()) {
  if (filter === 'all') return true
  if (filter === 'no-validity') return validUntil === null
  return validUntil !== null && (filter === 'expired' ? isExpired(validUntil, today) : !isExpired(validUntil, today))
}

export function formatDate(value: string | null) {
  if (!value) return 'Não informada'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function formatCurrency(value: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}
