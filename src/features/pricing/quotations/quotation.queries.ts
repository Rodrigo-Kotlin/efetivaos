import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { activateQuotation, cancelQuotation, discardPendingQuotationAttachment, getQuotation, listQuotations, saveQuotationDraft } from './quotation.service'

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
  return (id?: string) => Promise.all([
    client.invalidateQueries({ queryKey: quotationKeys.lists() }),
    ...(id ? [client.invalidateQueries({ queryKey: quotationKeys.detail(id) })] : []),
  ])
}

export function useSaveQuotationDraft() {
  const invalidate = useInvalidateQuotations()
  return useMutation({ mutationFn: saveQuotationDraft, onSuccess: (result) => invalidate(result.quotation.id) })
}

export function useActivateQuotation() {
  const invalidate = useInvalidateQuotations()
  return useMutation({ mutationFn: activateQuotation, onSuccess: (quotation) => invalidate(quotation.id) })
}

export function useCancelQuotation() {
  const invalidate = useInvalidateQuotations()
  return useMutation({ mutationFn: cancelQuotation, onSuccess: (quotation) => { void invalidate(quotation.id) } })
}

export function useDiscardPendingQuotationAttachment() {
  const invalidate = useInvalidateQuotations()
  return useMutation({ mutationFn: discardPendingQuotationAttachment, onSuccess: (quotation) => invalidate(quotation.id) })
}
