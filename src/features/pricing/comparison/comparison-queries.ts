import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { approvePrice, inactivatePrice, listComparison, listOffersForItem } from './comparison-api'

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

function useInvalidatePricingDecision() {
  const client = useQueryClient()
  return (catalogItemId: string) => Promise.all([
    client.invalidateQueries({ queryKey: comparisonKeys.list() }),
    client.invalidateQueries({ queryKey: comparisonKeys.offers(catalogItemId) }),
  ])
}

export function useApprovePrice() {
  const invalidate = useInvalidatePricingDecision()
  return useMutation({
    mutationFn: approvePrice,
    onSettled: (_data, _error, input) => invalidate(input.catalogItemId),
  })
}

export function useInactivatePrice() {
  const invalidate = useInvalidatePricingDecision()
  return useMutation({
    mutationFn: inactivatePrice,
    onSettled: (_data, _error, input) => invalidate(input.catalogItemId),
  })
}
