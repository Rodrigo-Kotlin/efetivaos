export const COLLECTION_PAGE_SIZES = [25, 50, 100] as const
export type CollectionPageSize = typeof COLLECTION_PAGE_SIZES[number]
export type CollectionSortDirection = 'asc' | 'desc'

export type CollectionUrlState = {
  page: number
  pageSize: CollectionPageSize
  search: string
  sort: string
  direction: CollectionSortDirection
  filters: Record<string, string[]>
}

export type CollectionUrlOptions = {
  defaultPage?: number
  defaultPageSize?: CollectionPageSize
  defaultSort?: string
  defaultDirection?: CollectionSortDirection
  sortKeys?: readonly string[]
  filterKeys?: readonly string[]
}

function validPageSize(value: number, fallback: CollectionPageSize): CollectionPageSize {
  return COLLECTION_PAGE_SIZES.includes(value as CollectionPageSize) ? value as CollectionPageSize : fallback
}

function validDirection(value: string | null, fallback: CollectionSortDirection): CollectionSortDirection {
  return value === 'asc' || value === 'desc' ? value : fallback
}

function validSort(value: string | null, options: CollectionUrlOptions): string {
  if (!value || !options.sortKeys || options.sortKeys.includes(value)) return value ?? options.defaultSort ?? ''
  return options.defaultSort ?? ''
}

export function parseCollectionUrl(params: URLSearchParams, options: CollectionUrlOptions = {}): CollectionUrlState {
  const defaultPage = Math.max(1, options.defaultPage ?? 1)
  const defaultPageSize = options.defaultPageSize ?? 25
  const pageValue = Number(params.get('page'))
  const page = Number.isInteger(pageValue) && pageValue >= 1 ? pageValue : defaultPage
  const filters: Record<string, string[]> = {}

  for (const key of options.filterKeys ?? []) {
    const values = params.getAll(key).flatMap(value => value.split(',')).map(value => value.trim()).filter(Boolean)
    if (values.length > 0) filters[key] = [...new Set(values)]
  }

  return {
    page,
    pageSize: validPageSize(Number(params.get('pageSize')), defaultPageSize),
    search: params.get('search')?.trim() ?? '',
    sort: validSort(params.get('sort'), options),
    direction: validDirection(params.get('direction'), options.defaultDirection ?? 'asc'),
    filters,
  }
}

export function serializeCollectionUrl(state: CollectionUrlState, options: CollectionUrlOptions = {}): URLSearchParams {
  const params = new URLSearchParams()
  const defaultPage = Math.max(1, options.defaultPage ?? 1)
  const defaultPageSize = options.defaultPageSize ?? 25
  const defaultSort = options.defaultSort ?? ''
  const defaultDirection = options.defaultDirection ?? 'asc'

  if (state.page !== defaultPage) params.set('page', String(Math.max(1, state.page)))
  if (state.pageSize !== defaultPageSize) params.set('pageSize', String(state.pageSize))
  if (state.search.trim()) params.set('search', state.search.trim())
  if (state.sort && state.sort !== defaultSort) params.set('sort', state.sort)
  if (state.direction !== defaultDirection) params.set('direction', state.direction)
  for (const [key, values] of Object.entries(state.filters)) {
    for (const value of values.filter(Boolean)) params.append(key, value)
  }

  return params
}

export function resetCollectionPage(state: CollectionUrlState): CollectionUrlState {
  return { ...state, page: 1 }
}
