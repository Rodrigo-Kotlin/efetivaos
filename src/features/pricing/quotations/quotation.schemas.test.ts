import { normalizeQuotationValues, parseBrlDecimal, quotationSchema, validateActivation } from './quotation.schemas'

describe('quotation validation', () => {
  it('normaliza valores BRL sem usar ponto flutuante no payload', () => {
    expect(parseBrlDecimal('R$ 1.234,56')).toBe('1234.56')
    expect(parseBrlDecimal('12,5')).toBe('12.50')
    expect(parseBrlDecimal('0012.50')).toBe('12.50')
    expect(parseBrlDecimal('999999999999,99')).toBe('999999999999.99')
    expect(parseBrlDecimal('0')).toBeNull()
    expect(parseBrlDecimal('1,234')).toBeNull()
    expect(parseBrlDecimal('1000000000000,00')).toBeNull()
    expect(parseBrlDecimal('12.3456')).toBeNull()
  })

  it('exige fornecedor, recebimento, preco positivo e validade coerente', () => {
    const result = quotationSchema.safeParse({ supplier_id: '', reference_number: '', received_at: '', valid_until: '2026-01-01', notes: '', items: [{ catalog_item_id: '', supplier_description: '', supplier_item_code: '', unit_price: '0', notes: '' }] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining(['Selecione o fornecedor.', 'Informe a data de recebimento.', 'Informe um valor maior que zero.']))
  })

  it('permite item sem mapeamento no rascunho e bloqueia ativacao por linha', () => {
    const values = { supplier_id: 'supplier-1', reference_number: '', received_at: '2026-08-23', valid_until: '', notes: '', items: [{ catalog_item_id: '', supplier_description: 'Exame', supplier_item_code: '', unit_price: '25,90', notes: '' }] }
    expect(quotationSchema.safeParse(values).success).toBe(true)
    expect(validateActivation(values)).toEqual({ 'items.0.catalog_item_id': 'Linha 1: vincule um item do Catalogo Efetiva.' })
    expect(normalizeQuotationValues(values).items[0].unit_price).toBe('25.90')
  })

  it('rejeita item canonico duplicado', () => {
    const item = { catalog_item_id: 'item-1', supplier_description: '', supplier_item_code: '', unit_price: '10', notes: '' }
    const result = quotationSchema.safeParse({ supplier_id: 'supplier-1', reference_number: '', received_at: '2026-08-23', valid_until: '', notes: '', items: [item, item] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toContain('nao pode aparecer duas vezes')
  })
})
