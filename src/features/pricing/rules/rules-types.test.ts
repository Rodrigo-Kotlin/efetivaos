import { describe, expect, it } from 'vitest'

import {
  formatRuleValue,
  parseRuleValue,
  ruleCalculationLabels,
  ruleScopeLabels,
} from './rules-types'
import { validateRuleValue } from './rules-schema'

describe('rules-types', () => {
  it('parseRuleValue aceita virgula e ponto como separador', () => {
    expect(parseRuleValue('30')).toBe(30)
    expect(parseRuleValue('30,5')).toBe(30.5)
    expect(parseRuleValue('30.5')).toBe(30.5)
    expect(parseRuleValue(' 25,00 ')).toBe(25)
    expect(parseRuleValue('abc')).toBeNaN()
  })

  it('formatRuleValue usa percentual ou BRL', () => {
    expect(formatRuleValue('percentage', '30')).toContain('30%')
    expect(formatRuleValue('fixed', '25.5')).toContain('25,50')
    expect(formatRuleValue(null, '10')).toBe('—')
  })

  it('exibe labels canonicos em pt-BR', () => {
    expect(ruleScopeLabels.global).toBe('Global')
    expect(ruleCalculationLabels.percentage).toBe('Percentual sobre custo')
    expect(ruleCalculationLabels.fixed).toBe('Valor fixo')
  })
})

describe('validateRuleValue', () => {
  it('rejeita vazio', () => {
    expect(validateRuleValue('percentage', '')).toMatch(/percentual/i)
    expect(validateRuleValue('fixed', '   ')).toMatch(/valor/i)
  })

  it('rejeita negativos', () => {
    expect(validateRuleValue('percentage', '-5')).toMatch(/negativo/i)
    expect(validateRuleValue('fixed', '-10,00')).toMatch(/negativo/i)
  })

  it('aceita 0% e R$ 0,00 como validos', () => {
    expect(validateRuleValue('percentage', '0')).toBeNull()
    expect(validateRuleValue('fixed', '0,00')).toBeNull()
  })

  it('rejeita percentual acima de 1000%', () => {
    expect(validateRuleValue('percentage', '1500')).toMatch(/limite/i)
  })
})
