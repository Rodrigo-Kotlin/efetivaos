import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { lookupCompanyByCnpj, isValidCnpj, normalizeCnpj } from './brasil-api'
import type { CompanyLookupResult, CompanyLookupError } from './types'

export const companyLookupKeys = {
  all: ['company-lookup'] as const,
  byCnpj: (cnpj: string) => [...companyLookupKeys.all, normalizeCnpj(cnpj)] as const,
}

type UseCompanyLookupResult = {
  data: CompanyLookupResult | null
  error: CompanyLookupError | null
  status: 'idle' | 'loading' | 'success' | 'error'
  isFetching: boolean
  refetch: () => void
}

export function useCompanyLookup(cnpj: string): UseCompanyLookupResult {
  const normalized = normalizeCnpj(cnpj)
  const enabled = isValidCnpj(normalized)

  const query = useQuery({
    queryKey: companyLookupKeys.byCnpj(normalized),
    queryFn: async () => {
      const result = await lookupCompanyByCnpj(normalized)
      return result
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
    gcTime: 30 * 60 * 1000,
  })

  const status = useMemo(() => {
    if (!enabled) return 'idle' as const
    if (query.isFetching) return 'loading' as const
    if (query.data?.data) return 'success' as const
    if (query.data?.error) return 'error' as const
    return 'idle' as const
  }, [enabled, query.isFetching, query.data])

  return {
    data: query.data?.data ?? null,
    error: query.data?.error ?? null,
    status,
    isFetching: query.isFetching,
    refetch: () => { void query.refetch() },
  }
}
