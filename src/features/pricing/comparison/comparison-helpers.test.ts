import { describe, expect, it } from 'vitest'

import {
  compareNumeric,
  formatComparisonCurrency,
  formatComparisonDate,
  formatRuleScope,
  formatRuleValue,
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
  best_cost: '18.50',
  best_supplier_id: 'sup-1',
  best_supplier_name: 'Lab Norte',
  best_valid_until: '2026-12-31',
  best_validity_not_informed: false,
  eligible_offer_count: 3,
  resolved_margin_rule_id: 'rule-1',
  resolved_rule_scope: 'global',
  resolved_adjustment_type: 'percentage',
  resolved_adjustment_value: '20.00',
  suggested_price: '22.20',
  effective_status: 'suggestion_available',
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
    expect(matchOfferFilter('validity_not_informed', { ...row, best_validity_not_informed: true, resolved_margin_rule_id: null })).toBe(true)
    expect(matchOfferFilter('with_rule', row)).toBe(true)
    expect(matchOfferFilter('without_rule', { ...row, resolved_margin_rule_id: null })).toBe(true)
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

  it('formata valor da regra de acordo com o tipo', () => {
    expect(formatRuleValue('percentage', '30')).toContain('30%')
    expect(formatRuleValue('fixed', '25')).toContain('25,00')
    expect(formatRuleValue(null, '10')).toBe('—')
  })

  it('formata origem da regra com nome do alvo', () => {
    expect(formatRuleScope('global')).toBe('Global')
    expect(formatRuleScope('category', { category_name: 'Exames' })).toBe('Categoria — Exames')
    expect(formatRuleScope('item', { item_name: 'Hemograma' })).toBe('Item — Hemograma')
    expect(formatRuleScope(null)).toBe('Sem regra')
  })
})
