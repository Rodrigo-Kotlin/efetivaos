import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../api/finance-api'
import type { ChartAccountFormValues, CostCenterFormValues, ServiceLineFormValues, CategoryFormValues, FinancialAccountFormValues } from '../schemas/finance-schemas'

// ---------------------------------------------------------------------------
// Chart Accounts
// ---------------------------------------------------------------------------

export function useChartAccounts() {
  return useQuery({
    queryKey: ['finance', 'chart-accounts'],
    queryFn: api.fetchChartAccounts,
  })
}

export function useCreateChartAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: ChartAccountFormValues) => api.createChartAccount(values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['finance', 'chart-accounts'] }),
  })
}

export function useUpdateChartAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ChartAccountFormValues }) =>
      api.updateChartAccount(id, values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['finance', 'chart-accounts'] }),
  })
}

// ---------------------------------------------------------------------------
// Cost Centers
// ---------------------------------------------------------------------------

export function useCostCenters() {
  return useQuery({
    queryKey: ['finance', 'cost-centers'],
    queryFn: api.fetchCostCenters,
  })
}

export function useCreateCostCenter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: CostCenterFormValues) => api.createCostCenter(values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['finance', 'cost-centers'] }),
  })
}

export function useUpdateCostCenter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: CostCenterFormValues }) =>
      api.updateCostCenter(id, values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['finance', 'cost-centers'] }),
  })
}

// ---------------------------------------------------------------------------
// Service Lines
// ---------------------------------------------------------------------------

export function useServiceLines() {
  return useQuery({
    queryKey: ['finance', 'service-lines'],
    queryFn: api.fetchServiceLines,
  })
}

export function useCreateServiceLine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: ServiceLineFormValues) => api.createServiceLine(values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['finance', 'service-lines'] }),
  })
}

export function useUpdateServiceLine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ServiceLineFormValues }) =>
      api.updateServiceLine(id, values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['finance', 'service-lines'] }),
  })
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function useCategories() {
  return useQuery({
    queryKey: ['finance', 'categories'],
    queryFn: api.fetchCategories,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: CategoryFormValues) => api.createCategory(values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['finance', 'categories'] }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: CategoryFormValues }) =>
      api.updateCategory(id, values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['finance', 'categories'] }),
  })
}

// ---------------------------------------------------------------------------
// Financial Accounts
// ---------------------------------------------------------------------------

export function useFinancialAccounts() {
  return useQuery({
    queryKey: ['finance', 'accounts'],
    queryFn: api.fetchFinancialAccounts,
  })
}

export function useCreateFinancialAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: FinancialAccountFormValues) => api.createFinancialAccount(values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['finance', 'accounts'] }),
  })
}

export function useUpdateFinancialAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: FinancialAccountFormValues }) =>
      api.updateFinancialAccount(id, values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['finance', 'accounts'] }),
  })
}

// ---------------------------------------------------------------------------
// Payment Methods
// ---------------------------------------------------------------------------

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['finance', 'payment-methods'],
    queryFn: api.fetchPaymentMethods,
  })
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: { name: string; active: boolean }) => api.createPaymentMethod(values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['finance', 'payment-methods'] }),
  })
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: { name: string; active: boolean } }) =>
      api.updatePaymentMethod(id, values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['finance', 'payment-methods'] }),
  })
}
