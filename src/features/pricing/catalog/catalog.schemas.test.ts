import { catalogCategorySchema, catalogItemSchema } from './catalog.schemas'

describe('catalog schemas', () => {
  it('exige codigo, categoria e unidade do item', () => {
    const result = catalogItemSchema.safeParse({ code: '  ', name: 'Item', category_id: '', unit: ' ', description: '' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.code).toContain('Informe o codigo do item.')
      expect(result.error.flatten().fieldErrors.category_id).toContain('Selecione uma categoria.')
      expect(result.error.flatten().fieldErrors.unit).toContain('Informe a unidade do item.')
    }
  })

  it('exige e remove espacos do nome da categoria', () => {
    expect(catalogCategorySchema.safeParse({ name: '   ', active: true }).success).toBe(false)
    expect(catalogCategorySchema.parse({ name: '  Laboratoriais  ', active: true })).toEqual({ name: 'Laboratoriais', active: true })
  })
})
