import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../api/finance-api'
import type { ChartAccountFormValues, CostCenterFormValues, ServiceLineFormValues, CategoryFormValues, FinancialAccountFormValues, TransactionBaseFormValues } from '../schemas/finance-schemas'

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
// Parties (Pessoas)
// ---------------------------------------------------------------------------

export function useParties() {
  return useQuery({
    queryKey: ['finance', 'parties'],
    queryFn: api.fetchParties,
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

// ---------------------------------------------------------------------------
// Transactions (Motor de Lançamentos 08B)
// ---------------------------------------------------------------------------

const TX_KEYS = {
  all: ['finance', 'transactions'] as const,
  list: () => [...TX_KEYS.all, 'list'] as const,
  detail: (id: string) => [...TX_KEYS.all, 'detail', id] as const,
  journal: (txId: string) => [...TX_KEYS.all, 'journal', txId] as const,
}

export function useTransactions() {
  return useQuery({
    queryKey: TX_KEYS.list(),
    queryFn: api.fetchTransactions,
  })
}

export function useTransactionDetail(id: string | null) {
  return useQuery({
    queryKey: TX_KEYS.detail(id ?? ''),
    queryFn: () => api.fetchTransactionById(id!),
    enabled: !!id,
  })
}

export function useJournalEntries(transactionId: string | null) {
  return useQuery({
    queryKey: TX_KEYS.journal(transactionId ?? ''),
    queryFn: () => api.fetchJournalEntriesByTransaction(transactionId!),
    enabled: !!transactionId,
  })
}

export function useJournalLines(entryId: string | null) {
  return useQuery({
    queryKey: [...TX_KEYS.all, 'lines', entryId ?? ''],
    queryFn: () => api.fetchJournalLinesByEntry(entryId!),
    enabled: !!entryId,
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: TransactionBaseFormValues) => api.createTransaction({
      description: values.description,
      transactionDate: values.transaction_date,
      competenceDate: values.competence_date,
      movementType: values.movement_type,
      amount: values.amount,
      categoryId: values.category_id,
      originAccountId: values.origin_account_id,
      destinationAccountId: values.destination_account_id,
      partyId: values.party_id,
      costCenterId: values.cost_center_id,
      serviceLineId: values.service_line_id,
      paymentMethodId: values.payment_method_id,
      dueDate: values.due_date,
      paymentDate: values.payment_date,
      notes: values.notes,
      principalAmount: values.principal_amount,
      interestAmount: values.interest_amount,
      idempotencyKey: values.idempotency_key,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TX_KEYS.all })
      void qc.invalidateQueries({ queryKey: CF_KEYS.all })
    },
  })
}

export function useSettleTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, paymentDate, paymentMethodId }: { id: string; paymentDate: string; paymentMethodId?: string | null }) =>
      api.settleTransaction(id, paymentDate, paymentMethodId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TX_KEYS.all })
      void qc.invalidateQueries({ queryKey: CF_KEYS.all })
    },
  })
}

export function useCancelTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string | null }) =>
      api.cancelTransaction(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TX_KEYS.all })
      void qc.invalidateQueries({ queryKey: CF_KEYS.all })
    },
  })
}

// ---------------------------------------------------------------------------
// Cash Flow / DFC (ETAPA 08D)
// ---------------------------------------------------------------------------

const CF_KEYS = {
  all: ['finance', 'cashflow'] as const,
  realized: (filters: api.CashflowFilters) => [...CF_KEYS.all, 'realized', filters] as const,
  forecast: (filters: api.CashflowFilters) => [...CF_KEYS.all, 'forecast', filters] as const,
  statement: (filters: api.CashflowFilters) => [...CF_KEYS.all, 'statement', filters] as const,
  summary: (filters: api.CashflowFilters) => [...CF_KEYS.all, 'summary', filters] as const,
  weeks13: (from?: string | null) => [...CF_KEYS.all, 'weeks13', from ?? ''] as const,
}

export function useCashflowSummary(filters: api.CashflowFilters = {}) {
  return useQuery({
    queryKey: CF_KEYS.summary(filters),
    queryFn: () => api.fetchCashflowSummary(filters),
  })
}

export function useCashflowRealized(filters: api.CashflowFilters = {}) {
  return useQuery({
    queryKey: CF_KEYS.realized(filters),
    queryFn: () => api.fetchCashflowRealized(filters),
  })
}

export function useCashflowForecast(filters: api.CashflowFilters = {}) {
  return useQuery({
    queryKey: CF_KEYS.forecast(filters),
    queryFn: () => api.fetchCashflowForecast(filters),
  })
}

export function useCashflowStatement(filters: api.CashflowFilters = {}) {
  return useQuery({
    queryKey: CF_KEYS.statement(filters),
    queryFn: () => api.fetchCashflowStatement(filters),
  })
}

export function useCashflow13Weeks(from?: string | null) {
  return useQuery({
    queryKey: CF_KEYS.weeks13(from),
    queryFn: () => api.fetchCashflow13Weeks(from),
  })
}
