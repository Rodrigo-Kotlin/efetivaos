import { ownPriceCreationSchema, ownPriceReajusteSchema } from './own-prices.schemas'

describe('ownPriceCreationSchema', () => {
  it('aceita proposta valida com custo e observacoes', () => {
    const result = ownPriceCreationSchema.safeParse({ catalog_item_id: 'item-1', sale_price: '18,90', internal_cost: '10,25', notes: 'Servico planejado' })
    expect(result.success).toBe(true)
  })

  it('aceita proposta sem custo interno e sem observacoes', () => {
    const result = ownPriceCreationSchema.safeParse({ catalog_item_id: 'item-1', sale_price: '18.90', internal_cost: '', notes: '' })
    expect(result.success).toBe(true)
  })

  it.each([
    [{ sale_price: '' }, 'Informe o preco de venda'],
    [{ sale_price: '0' }, 'maior que zero'],
    [{ sale_price: '-5' }, 'maior que zero'],
    [{ sale_price: 'abc' }, 'maior que zero'],
    [{ internal_cost: '-1' }, 'maior que zero'],
    [{ catalog_item_id: '' }, 'Selecione um servico proprio'],
  ])('rejeita valores invalidos: %#', (partial, expectedMessage) => {
    const result = ownPriceCreationSchema.safeParse({ catalog_item_id: 'item-1', sale_price: '10', internal_cost: '', notes: '', ...partial })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(JSON.stringify(result.error.issues.map((issue) => issue.message))).toContain(expectedMessage)
    }
  })

  it('rejeita observacoes acima de 1000 caracteres', () => {
    const result = ownPriceCreationSchema.safeParse({ catalog_item_id: 'item-1', sale_price: '10', internal_cost: '', notes: 'x'.repeat(1001) })
    expect(result.success).toBe(false)
  })
})

describe('ownPriceReajusteSchema', () => {
  it('exige justificativa no reajuste', () => {
    const result = ownPriceReajusteSchema.safeParse({ catalog_item_id: 'item-1', sale_price: '22', internal_cost: '', notes: '  ' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some((issue) => issue.message.includes('justificativa'))).toBe(true)
  })

  it('aceita reajuste justificado', () => {
    const result = ownPriceReajusteSchema.safeParse({ catalog_item_id: 'item-1', sale_price: '22,00', internal_cost: '12', notes: 'Reformulacao do escopo do servico' })
    expect(result.success).toBe(true)
  })
})