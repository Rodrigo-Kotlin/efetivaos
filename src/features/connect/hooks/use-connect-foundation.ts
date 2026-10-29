import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/auth-context'
import {
  getConnectAccess,
  listConnectFoundation,
  listConnectOrganizations,
  upsertConnectProfileSector,
} from '../api/connect-api'

export const connectQueryKeys = {
  organizations: ['connect', 'organizations'] as const,
  foundation: (organizationId: string) => ['connect', 'foundation', organizationId] as const,
  access: (profileId: string) => ['connect', 'access', profileId] as const,
}

export function useConnectOrganizations() {
  return useQuery({ queryKey: connectQueryKeys.organizations, queryFn: listConnectOrganizations })
}

export function useConnectFoundation(organizationId: string | null) {
  return useQuery({
    queryKey: organizationId ? connectQueryKeys.foundation(organizationId) : ['connect', 'foundation', 'none'],
    queryFn: () => listConnectFoundation(organizationId!),
    enabled: Boolean(organizationId),
  })
}

export function useConnectAccess() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: profile ? connectQueryKeys.access(profile.id) : ['connect', 'access', 'none'],
    queryFn: () => getConnectAccess(profile!.id, profile!.role),
    enabled: Boolean(profile?.id && profile.active),
  })
}

export function useUpsertConnectProfileSector() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: upsertConnectProfileSector,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: connectQueryKeys.foundation(variables.organization_id) })
    },
  })
}
