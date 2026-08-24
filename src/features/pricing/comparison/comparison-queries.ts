import { useQuery } from '@tanstack/react-query'

import { listComparison, listOffersForItem } from './comparison-api'

export const comparisonKeys = {
  all: ['comparison'] as const,
  list: () => [...comparisonKeys.all, 'list'] as const,
  offers: (catalogItemId: string) => [...comparisonKeys.all, 'offers', catalogItemId] as const,
}

export function useComparison() {
  return useQuery({ queryKey: comparisonKeys.list(), queryFn: listComparison })
}

export function useComparisonOffers(catalogItemId: string | null) {
  return useQuery({
    queryKey: comparisonKeys.offers(catalogItemId ?? ''),
    queryFn: () => listOffersForItem(catalogItemId!),
    enabled: Boolean(catalogItemId),
  })
}
