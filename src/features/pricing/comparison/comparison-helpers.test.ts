import { describe, expect, it } from 'vitest'

import {
  compareNumeric,
  formatComparisonCurrency,
  formatComparisonDate,
  isOfferStillValid,
  matchComparisonSearch,
  matchOfferFilter,
} from './comparison-helpers'
import type { ComparisonRow } from './comparison-types'

const row: ComparisonRow = {
  catalog_item_id: 'item-1',
  code: 'EXA-001',
  item_name: 'Hemograma completo',
  unit: 'exame',
  category_id: 'cat-1',
  category_name: 'Laboratoriais',
  best_quotation_item_id: 'qi-1',
  best_supplier_id: 'sup-1',
  best_supplier_name: 'Lab Norte',
  best_unit_price: '18.50',
  best_valid_until: '2026-12-31',
  best_received_at: '2026-08-20',
  best_validity_not_informed: false,
  eligible_offer_count: 3,
}

describe('comparison-helpers', () => {
  it('formata moeda em pt-BR', () => {
    expect(formatComparisonCurrency('1234.5')).toContain('1.234,50')
  })

  it('devolve placeholder sem oferta vigente', () => {
    expect(formatComparisonCurrency(null)).toBe('Sem oferta vigente')
  })

  it('formata data no fuso UTC para evitar offset', () => {
    expect(formatComparisonDate('2026-08-24')).toBe('24/08/2026')
  })

  it('busca ignora caixa e acentos', () => {
    expect(matchComparisonSearch('hemograma', row)).toBe(true)
    expect(matchComparisonSearch('lab', row)).toBe(true)
    expect(matchComparisonSearch('inexistente', row)).toBe(false)
    expect(matchComparisonSearch('', row)).toBe(true)
  })

  it('filtro por situacao reconhece cada estado', () => {
    expect(matchOfferFilter('all', row)).toBe(true)
    expect(matchOfferFilter('with_offer', row)).toBe(true)
    expect(matchOfferFilter('no_offer', row)).toBe(false)
    expect(matchOfferFilter('validity_not_informed', { ...row, best_validity_not_informed: true })).toBe(true)
  })

  it('considera oferta sem validade como elegivel', () => {
    expect(isOfferStillValid(null)).toBe(true)
    expect(isOfferStillValid('2020-01-01')).toBe(false)
    expect(isOfferStillValid('2099-01-01')).toBe(true)
  })

  it('ordena numericamente tratando null como infinito', () => {
    expect(compareNumeric('1.00', '2.00')).toBeLessThan(0)
    expect(compareNumeric('2.00', '1.00')).toBeGreaterThan(0)
    expect(compareNumeric(null, '1.00')).toBeGreaterThan(0)
    expect(compareNumeric('1.00', null)).toBeLessThan(0)
  })
})
