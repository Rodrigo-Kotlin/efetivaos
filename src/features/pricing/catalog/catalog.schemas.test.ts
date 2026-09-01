import { catalogCategorySchema, catalogItemSchema } from './catalog.schemas'

describe('catalog schemas', () => {
  it('nao exige codigo e exige categoria e unidade do item', () => {
    const result = catalogItemSchema.safeParse({ name: 'Item', category_id: '', unit: ' ', description: '' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect('code' in result.error.flatten().fieldErrors).toBe(false)
      expect(result.error.flatten().fieldErrors.category_id).toContain('Selecione uma categoria.')
      expect(result.error.flatten().fieldErrors.unit).toContain('Informe a unidade do item.')
    }
  })

  it('exige e remove espacos do nome da categoria', () => {
    expect(catalogCategorySchema.safeParse({ name: '   ', active: true }).success).toBe(false)
    expect(catalogCategorySchema.parse({ name: '  Exames Laboratoriais  ', active: true })).toEqual({ name: 'Exames Laboratoriais', active: true })
  })
})
