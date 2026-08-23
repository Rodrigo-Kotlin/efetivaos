import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createSupplier, listSuppliers, setSupplierStatus, updateSupplier } from './suppliers-api'

export const supplierKeys = {
  all: ['suppliers'] as const,
  lists: () => [...supplierKeys.all, 'list'] as const,
}

export function useSuppliers() {
  return useQuery({ queryKey: supplierKeys.lists(), queryFn: listSuppliers })
}

function useInvalidateSupplierLists() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: supplierKeys.lists() })
}

export function useCreateSupplier() {
  const invalidate = useInvalidateSupplierLists()
  return useMutation({ mutationFn: createSupplier, onSuccess: invalidate })
}

export function useUpdateSupplier() {
  const invalidate = useInvalidateSupplierLists()
  return useMutation({ mutationFn: updateSupplier, onSuccess: invalidate })
}

export function useSetSupplierStatus() {
  const invalidate = useInvalidateSupplierLists()
  return useMutation({ mutationFn: setSupplierStatus, onSuccess: invalidate })
}
