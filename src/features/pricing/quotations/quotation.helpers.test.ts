import { formatCurrency, maskBrlInput } from './quotation.helpers'

describe('quotation currency helpers', () => {
  it.each([
    ['1', 'R$ 0,01'],
    ['1740', 'R$ 17,40'],
    ['10000', 'R$ 100,00'],
    ['R$ 17,40', 'R$ 17,40'],
    ['17.40', 'R$ 17,40'],
  ])('masks %s as %s', (input, expected) => {
    expect(maskBrlInput(input)).toBe(expected)
  })

  it.each([
    ['17.4', 'R$ 17,40'],
    ['53.8', 'R$ 53,80'],
    ['100', 'R$ 100,00'],
  ])('formats existing value %s as %s', (input, expected) => {
    expect(formatCurrency(input)).toBe(expected)
  })

  it('keeps the currency mask valid while deleting digits', () => {
    expect(maskBrlInput('R$ 17,4')).toBe('R$ 1,74')
    expect(maskBrlInput('R$ 1,7')).toBe('R$ 0,17')
    expect(maskBrlInput('R$ 0,1')).toBe('R$ 0,01')
    expect(maskBrlInput('')).toBe('R$ 0,00')
  })
})
