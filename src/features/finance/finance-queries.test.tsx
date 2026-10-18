import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from './api/finance-api'
import { useCreateCategory, useExpenseComposition, useUpdateCategory, useUpdateTransaction } from './queries/finance-queries'

vi.mock('./api/finance-api', () => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  updateTransaction: vi.fn(),
  fetchExpenseComposition: vi.fn(),
}))

const categoryValues = {
  name: 'Nova categoria',
  movement_type: 'DESPESA' as const,
  counter_account_id: null,
  cost_center_id: null,
  service_line_id: null,
  cash_flow_class: 'OPERACIONAL' as const,
  active: true,
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('finance category mutations', () => {
  afterEach(() => vi.clearAllMocks())

  it('waits for category cache invalidation after creating a category', async () => {
    vi.mocked(api.createCategory).mockResolvedValue({} as never)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const { result } = renderHook(() => useCreateCategory(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await result.current.mutateAsync(categoryValues)
    })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['finance', 'categories'] })
  })

  it('waits for category cache invalidation after updating a category', async () => {
    vi.mocked(api.updateCategory).mockResolvedValue({} as never)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const { result } = renderHook(() => useUpdateCategory(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await result.current.mutateAsync({ id: 'category-1', values: categoryValues })
    })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['finance', 'categories'] })
  })
})

describe('financial transaction mutations', () => {
  afterEach(() => vi.clearAllMocks())

  it('invalidates transaction, ledger and report queries after editing', async () => {
    vi.mocked(api.updateTransaction).mockResolvedValue()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const { result } = renderHook(() => useUpdateTransaction(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await result.current.mutateAsync({ transactionId: 'tx-1', expectedVersion: 1, amount: 8500 })
    })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['finance', 'transactions'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['finance', 'receivables'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['finance', 'payables'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['finance', 'cashflow'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['finance', 'income-statement'] })
  })
})

describe('expense composition query', () => {
  afterEach(() => vi.clearAllMocks())

  it('passes the official RPC filters and includes them in the query key', async () => {
    vi.mocked(api.fetchExpenseComposition).mockResolvedValue([
      { account_code: '5.2.01.001', account_name: 'Aluguéis e Condomínio', amount: 2750, percentage: 9.4 },
    ])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useExpenseComposition({ from: '2026-03-01', to: '2026-03-31' }), { wrapper: createWrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(api.fetchExpenseComposition).toHaveBeenCalledWith({
      from: '2026-03-01', to: '2026-03-31', costCenterId: null, serviceLineId: null,
    })
    expect(queryClient.getQueryCache().find({ queryKey: ['finance', 'expense-composition', '2026-03-01', '2026-03-31', null, null] })).toBeDefined()
  })

  it('exposes RPC errors without converting them into empty data', async () => {
    vi.mocked(api.fetchExpenseComposition).mockRejectedValue(new Error('Access denied'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useExpenseComposition(), { wrapper: createWrapper(queryClient) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})
