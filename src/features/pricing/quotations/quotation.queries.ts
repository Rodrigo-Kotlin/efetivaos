import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { comparisonKeys } from '@/features/pricing/comparison/comparison-queries'

import { activateQuotation, archiveQuotation, cancelQuotation, discardPendingQuotationAttachment, getQuotation, listQuotations, saveQuotationDraft, unarchiveQuotation } from './quotation.service'

export const quotationKeys = {
  all: ['quotations'] as const,
  lists: () => [...quotationKeys.all, 'list'] as const,
  detail: (id: string) => [...quotationKeys.all, 'detail', id] as const,
}

export function useQuotations() {
  return useQuery({ queryKey: quotationKeys.lists(), queryFn: listQuotations })
}

export function useQuotation(id?: string) {
  return useQuery({ queryKey: quotationKeys.detail(id ?? ''), queryFn: () => getQuotation(id!), enabled: Boolean(id) })
}

function useInvalidateQuotations() {
  const client = useQueryClient()
  return (id?: string, affectsComparison = false) => Promise.all([
    client.invalidateQueries({ queryKey: quotationKeys.lists() }),
    ...(id ? [client.invalidateQueries({ queryKey: quotationKeys.detail(id) })] : []),
    ...(affectsComparison ? [client.invalidateQueries({ queryKey: comparisonKeys.all })] : []),
  ])
}

export function useSaveQuotationDraft() {
  const invalidate = useInvalidateQuotations()
  return useMutation({ mutationFn: saveQuotationDraft, onSuccess: (result) => invalidate(result.quotation.id) })
}

export function useActivateQuotation() {
  const invalidate = useInvalidateQuotations()
  return useMutation({ mutationFn: activateQuotation, onSuccess: (quotation) => invalidate(quotation.id, true) })
}

export function useCancelQuotation() {
  const invalidate = useInvalidateQuotations()
  return useMutation({ mutationFn: cancelQuotation, onSuccess: (quotation) => invalidate(quotation.id, true) })
}

export function useDiscardPendingQuotationAttachment() {
  const invalidate = useInvalidateQuotations()
  return useMutation({ mutationFn: discardPendingQuotationAttachment, onSuccess: (quotation) => invalidate(quotation.id) })
}

export function useArchiveQuotation() {
  const invalidate = useInvalidateQuotations()
  return useMutation({ mutationFn: archiveQuotation, onSuccess: (quotation) => invalidate(quotation.id, true) })
}

export function useUnarchiveQuotation() {
  const invalidate = useInvalidateQuotations()
  return useMutation({ mutationFn: unarchiveQuotation, onSuccess: (quotation) => invalidate(quotation.id, true) })
}
