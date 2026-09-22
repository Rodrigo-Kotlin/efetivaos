import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { comparisonKeys } from '@/features/pricing/comparison/comparison-queries'

import {
  approveOwnPriceProposal,
  createOwnPriceProposal,
  fetchOwnPriceDecisionToken,
  fetchProfileName,
  inactivateOwnPriceProposal,
  listOwnCatalogItems,
  listOwnPriceProposals,
} from './own-prices-api'

export const ownPriceKeys = {
  all: ['own-prices'] as const,
  proposals: () => [...ownPriceKeys.all, 'proposals'] as const,
  catalog: () => [...ownPriceKeys.all, 'catalog'] as const,
  token: (proposalId: string) => [...ownPriceKeys.all, 'token', proposalId] as const,
  profile: (userId: string) => [...ownPriceKeys.all, 'profile', userId] as const,
}

export function useOwnPriceProposals() {
  return useQuery({ queryKey: ownPriceKeys.proposals(), queryFn: () => listOwnPriceProposals() })
}

export function useOwnPriceCatalogItems() {
  return useQuery({ queryKey: ownPriceKeys.catalog(), queryFn: listOwnCatalogItems })
}

export function useOwnPriceDecisionToken(proposalId: string | null) {
  return useQuery({
    queryKey: ownPriceKeys.token(proposalId ?? ''),
    queryFn: () => fetchOwnPriceDecisionToken(proposalId!),
    enabled: Boolean(proposalId),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useUserDisplayName(userId: string | null) {
  return useQuery({
    queryKey: ownPriceKeys.profile(userId ?? ''),
    queryFn: () => fetchProfileName(userId!),
    enabled: Boolean(userId),
  })
}

function useInvalidateOwnPricing() {
  const client = useQueryClient()
  return () => Promise.all([
    client.invalidateQueries({ queryKey: ownPriceKeys.all }),
    client.invalidateQueries({ queryKey: comparisonKeys.all }),
  ])
}

export function useCreateOwnPriceProposal() {
  const invalidate = useInvalidateOwnPricing()
  return useMutation({
    mutationFn: createOwnPriceProposal,
    onSuccess: invalidate,
    onError: invalidate,
  })
}

export function useApproveOwnPriceProposal() {
  const invalidate = useInvalidateOwnPricing()
  return useMutation({
    mutationFn: approveOwnPriceProposal,
    onSuccess: invalidate,
    onError: invalidate,
  })
}

export function useInactivateOwnPriceProposal() {
  const invalidate = useInvalidateOwnPricing()
  return useMutation({
    mutationFn: inactivateOwnPriceProposal,
    onSuccess: invalidate,
    onError: invalidate,
  })
}