import {
  parseCollectionUrl,
  resetCollectionPage,
  serializeCollectionUrl,
  type CollectionUrlState,
} from './collection-url-state'

describe('collection URL state', () => {
  const options = {
    defaultSort: 'name',
    defaultDirection: 'asc' as const,
    sortKeys: ['name', 'created_at'],
    filterKeys: ['status', 'type'],
  }

  it('serializa somente valores não default e restaura filtros múltiplos', () => {
    const state: CollectionUrlState = {
      page: 3,
      pageSize: 50,
      search: '  clínica  ',
      sort: 'created_at',
      direction: 'desc',
      filters: { status: ['active', 'pending'], type: ['CLIENTE'] },
    }
    const params = serializeCollectionUrl(state, options)
    expect(params.toString()).toBe('page=3&pageSize=50&search=cl%C3%ADnica&sort=created_at&direction=desc&status=active&status=pending&type=CLIENTE')
    expect(parseCollectionUrl(params, options)).toEqual({ ...state, search: 'clínica' })
  })

  it('usa defaults seguros para parâmetros inválidos', () => {
    const state = parseCollectionUrl(new URLSearchParams('page=0&pageSize=10&sort=unknown&direction=sideways&status=active%2Cactive'), options)
    expect(state).toEqual({ page: 1, pageSize: 25, search: '', sort: 'name', direction: 'asc', filters: { status: ['active'] } })
  })

  it('reseta a página quando a busca ou filtros mudam', () => {
    const state: CollectionUrlState = { page: 4, pageSize: 25, search: 'a', sort: 'name', direction: 'asc', filters: {} }
    expect(resetCollectionPage(state)).toEqual({ ...state, page: 1 })
  })
})
