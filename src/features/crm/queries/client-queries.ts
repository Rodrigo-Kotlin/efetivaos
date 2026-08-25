import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { listClients, getClient, createClient, updateClient, setClientStatus } from '@/features/crm/api/clients-api'

export const clientKeys = {
  all: ['crm', 'clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (filters?: { search?: string; type?: 'company' | 'individual'; status?: 'active' | 'inactive' }) =>
    [...clientKeys.all, 'list', filters] as const,
  detail: (id: string) => [...clientKeys.all, 'detail', id] as const,
}

export function useClientLists(filters?: {
  search?: string
  type?: 'company' | 'individual'
  status?: 'active' | 'inactive'
}) {
  return useQuery({
    queryKey: clientKeys.list(filters),
    queryFn: () => listClients(filters).then((r) => r.data),
    staleTime: 60_000,
    enabled: Boolean(filters !== undefined),
  })
}

export function useClientDetail(id: string | undefined) {
  return useQuery({
    queryKey: clientKeys.detail(id ?? ''),
    queryFn: () => getClient(id!).then((r) => r.data),
    staleTime: 60_000,
    enabled: Boolean(id),
  })
}

export function useCreateClientMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof createClient>[0]) => createClient(input).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
    },
  })
}

export function useSetClientStatusMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      setClientStatus({ id, status }).then((r) => r.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: clientKeys.all })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
    },
  })
}

export function useUpdateClientMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateClient>[0]['input'] }) =>
      updateClient({ id, input }).then((r) => r.data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: clientKeys.all })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
    },
  })
}