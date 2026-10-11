import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

import type { FinancialPayableList } from '@/types/database'
import PayablesPage from './payables-page'
import {
  useCategories,
  useFinancialAccounts,
  useParties,
  usePayables,
  usePaymentMethods,
  useReverseTransaction,
  useSettleTransaction,
} from '../queries/finance-queries'

vi.mock('../queries/finance-queries', () => ({
  useCategories: vi.fn(),
  useFinancialAccounts: vi.fn(),
  useParties: vi.fn(),
  usePayables: vi.fn(),
  usePaymentMethods: vi.fn(),
  useReverseTransaction: vi.fn(),
  useSettleTransaction: vi.fn(),
}))

const payable: FinancialPayableList = {
  transaction_id: 'tx-1', description: 'Aluguel do escritorio', movement_type: 'DESPESA', status: 'pending',
  original_amount: '1200', settled_amount: '0', open_amount: '1200', transaction_date: '2026-10-01',
  competence_date: '2026-10-01', due_date: '2026-10-10', overdue: true, days_overdue: 1,
  party_name: 'Fornecedor A', category_name: 'Servicos', cost_center_id: null, cost_center_name: null,
  service_line_id: null, service_line_name: null, origin_account_id: 'account-1', payment_method_id: null,
  competency_entry_id: null, settlement_entry_id: null,
}

function mockResources() {
  vi.mocked(useCategories).mockReturnValue({ data: [{ id: 'category-1', name: 'Servicos' }] } as unknown as ReturnType<typeof useCategories>)
  vi.mocked(useFinancialAccounts).mockReturnValue({ data: [{ id: 'account-1', name: 'Cora', active: true }] } as unknown as ReturnType<typeof useFinancialAccounts>)
  vi.mocked(useParties).mockReturnValue({ data: [{ id: 'party-1', name: 'Fornecedor A' }] } as unknown as ReturnType<typeof useParties>)
  vi.mocked(usePaymentMethods).mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePaymentMethods>)
  vi.mocked(useSettleTransaction).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSettleTransaction>)
  vi.mocked(useReverseTransaction).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReverseTransaction>)
}

function LocationProbe() {
  return <output data-testid="location-search">{useLocation().search}</output>
}

describe('PayablesPage', () => {
  beforeEach(() => {
    mockResources()
    vi.mocked(usePayables).mockReturnValue({ data: { rows: [payable], count: 1, page: 1, pageSize: 25, pageCount: 1 }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof usePayables>)
  })

  it('renderiza toolbar, contador, tabela responsiva e acao de pagamento', () => {
    render(<MemoryRouter><PayablesPage /></MemoryRouter>)
    expect(screen.getByText('Contas a Pagar')).toBeInTheDocument()
    expect(screen.getByText('1–1 de 1 contas a pagar')).toBeInTheDocument()
    expect(screen.getAllByText('Aluguel do escritorio')).toHaveLength(2)
    expect(screen.getAllByText('Pagar').length).toBeGreaterThan(0)
    expect(screen.getByText('Mais filtros')).toBeInTheDocument()
  })

  it('distingue filtered empty e oferece limpar filtros', () => {
    vi.mocked(usePayables).mockReturnValue({ data: { rows: [], count: 0, page: 1, pageSize: 25, pageCount: 1 }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof usePayables>)
    render(<MemoryRouter initialEntries={['/finance/payables?status=pending']}><PayablesPage /></MemoryRouter>)
    expect(screen.getByText('Nenhuma conta a pagar atende aos filtros')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[1])
    expect(screen.queryByText('Nenhuma conta a pagar atende aos filtros')).not.toBeInTheDocument()
  })

  it('renderiza erro com retry', () => {
    const refetch = vi.fn()
    vi.mocked(usePayables).mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } as unknown as ReturnType<typeof usePayables>)
    render(<MemoryRouter><PayablesPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('normaliza uma página inválida na URL usando o pageCount retornado', async () => {
    vi.mocked(usePayables).mockReturnValue({ data: { rows: [], count: 30, page: 5, pageSize: 25, pageCount: 2 }, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof usePayables>)

    render(<MemoryRouter initialEntries={['/finance/payables?page=5']}><PayablesPage /><LocationProbe /></MemoryRouter>)

    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?page=2'))
  })

})
