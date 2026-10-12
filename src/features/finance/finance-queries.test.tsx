import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from './api/finance-api'
import { useCreateCategory, useUpdateCategory } from './queries/finance-queries'

vi.mock('./api/finance-api', () => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
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
