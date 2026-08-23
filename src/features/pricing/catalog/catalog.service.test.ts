import { normalizeCatalogItemInput, translateCatalogError } from './catalog.service'

describe('translateCatalogError', () => {
  it('traduz codigo duplicado para uma mensagem compreensivel', () => {
    const error = translateCatalogError({ code: '23505', message: 'duplicate key', details: 'uq_catalog_items_code_ci' })
    expect(error.message).toBe('Ja existe um item com este codigo.')
  })

  it('traduz nome de categoria duplicado', () => {
    const error = translateCatalogError({ code: '23505', message: 'duplicate key', details: 'uq_catalog_categories_name_ci' })
    expect(error.message).toBe('Ja existe uma categoria com este nome.')
  })

  it('traduz bloqueio de categoria e unidade pelo historico', () => {
    const error = translateCatalogError({ message: 'Categoria e unidade nao podem mudar depois que o item participa de uma cotacao.' })
    expect(error.message).toContain('historico de cotacoes')
  })
})

describe('normalizeCatalogItemInput', () => {
  it('normaliza textos e converte o codigo para maiusculas', () => {
    expect(normalizeCatalogItemInput({
      code: ' exa-001 ',
      name: ' Hemograma   completo ',
      category_id: 'category-1',
      unit: ' Exame ',
      description: '  Coleta   simples ',
    })).toEqual({
      code: 'EXA-001',
      name: 'Hemograma completo',
      category_id: 'category-1',
      unit: 'exame',
      description: 'Coleta simples',
    })
  })
})
