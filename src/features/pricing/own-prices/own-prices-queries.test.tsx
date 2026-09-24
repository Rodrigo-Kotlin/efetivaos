import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { comparisonKeys } from '@/features/pricing/comparison/comparison-queries'

const apiMocks = vi.hoisted(() => ({
  approveOwnPriceProposal: vi.fn(),
  createOwnPriceProposal: vi.fn(),
}))

vi.mock('./own-prices-api', () => ({
  ...vi.importActual('./own-prices-api'),
  approveOwnPriceProposal: apiMocks.approveOwnPriceProposal,
  createOwnPriceProposal: apiMocks.createOwnPriceProposal,
}))

import { useApproveOwnPriceProposal, useCreateOwnPriceProposal, ownPriceKeys } from './own-prices-queries'

type ApproveMutation = ReturnType<typeof useApproveOwnPriceProposal>
type CreateMutation = ReturnType<typeof useCreateOwnPriceProposal>

describe('invalidacao de cache das mutacoes de preco proprio', () => {
  let client: QueryClient
  let calls: { own: number; comparison: number }
  let approve: ApproveMutation
  let create: CreateMutation

  function wrapper() {
    return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

  beforeEach(() => {
    calls = { own: 0, comparison: 0 }
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    apiMocks.approveOwnPriceProposal.mockReset()
    apiMocks.createOwnPriceProposal.mockReset()
  })

  function Capture() {
    approve = useApproveOwnPriceProposal()
    create = useCreateOwnPriceProposal()
    return null
  }

  function Probe() {
    useQuery({ queryKey: ownPriceKeys.proposals(), queryFn: async () => { calls.own += 1; return [] as unknown[] } })
    useQuery({ queryKey: comparisonKeys.list(), queryFn: async () => { calls.comparison += 1; return [] as unknown[] } })
    return null
  }

  it('lice as propostas e a comparacao quando a aprovacao tem sucesso', async () => {
    apiMocks.approveOwnPriceProposal.mockResolvedValue({ id: 'p1' })
    render(<><Capture /><Probe /></>, { wrapper: wrapper() })

    await waitFor(() => expect(calls.own).toBe(1))
    expect(calls.comparison).toBe(1)

    await act(async () => {
      await approve.mutateAsync({ proposalId: 'p1', expectedDecisionToken: 't1' })
    })

    await waitFor(() => expect(calls.own).toBe(2))
    expect(calls.comparison).toBe(2)
  })

  it('lice as propostas e a comparacao mesmo quando a aprovacao falha (token desatualizado)', async () => {
    apiMocks.approveOwnPriceProposal.mockRejectedValue(new Error('Decisao desatualizada'))
    render(<><Capture /><Probe /></>, { wrapper: wrapper() })

    await waitFor(() => expect(calls.own).toBe(1))

    await act(async () => {
      await approve.mutateAsync({ proposalId: 'p1', expectedDecisionToken: 't1' }).catch(() => undefined)
    })

    await waitFor(() => expect(calls.own).toBe(2))
    expect(calls.comparison).toBe(2)
  })

  it('atualiza propostas e comparacao depois de criar uma proposta', async () => {
    apiMocks.createOwnPriceProposal.mockResolvedValue(undefined)
    render(<><Capture /><Probe /></>, { wrapper: wrapper() })

    await waitFor(() => expect(calls.own).toBe(1))
    await act(async () => {
      await create.mutateAsync({ catalog_item_id: 'item-1', sale_price: '120,00', internal_cost: null, decision_notes: null })
    })

    expect(apiMocks.createOwnPriceProposal).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(calls.own).toBe(2))
    expect(calls.comparison).toBe(2)
  })
})
