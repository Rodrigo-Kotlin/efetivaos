import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import type { FinancialReceivableList } from '@/types/database'
import ReceivablesPage from './receivables-page'
import { useCategories, useFinancialAccounts, useParties, usePaymentMethods, useReceivables, useReverseTransaction, useSettleTransaction } from '../queries/finance-queries'

vi.mock('../queries/finance-queries', () => ({
  useCategories: vi.fn(), useFinancialAccounts: vi.fn(), useParties: vi.fn(), usePaymentMethods: vi.fn(), useReceivables: vi.fn(), useReverseTransaction: vi.fn(), useSettleTransaction: vi.fn(),
}))

const receivable: FinancialReceivableList = {
  transaction_id: 'tx-1', description: 'Contrato de consultoria', movement_type: 'RECEITA', status: 'pending', original_amount: '1800', settled_amount: '0', open_amount: '1800', transaction_date: '2026-10-01', competence_date: '2026-10-01', due_date: '2026-10-10', overdue: true, days_overdue: 1, party_name: 'Cliente A', category_name: 'Servicos', cost_center_id: null, cost_center_name: null, service_line_id: null, service_line_name: null, origin_account_id: 'account-1', payment_method_id: null, competency_entry_id: null, settlement_entry_id: null,
}

function mockResources() {
  vi.mocked(useCategories).mockReturnValue({ data: [{ id: 'category-1', name: 'Servicos' }] } as unknown as ReturnType<typeof useCategories>)
  vi.mocked(useFinancialAccounts).mockReturnValue({ data: [{ id: 'account-1', name: 'Cora', active: true }] } as unknown as ReturnType<typeof useFinancialAccounts>)
  vi.mocked(useParties).mockReturnValue({ data: [{ id: 'party-1', name: 'Cliente A' }] } as unknown as ReturnType<typeof useParties>)
  vi.mocked(usePaymentMethods).mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePaymentMethods>)
  vi.mocked(useSettleTransaction).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSettleTransaction>)
  vi.mocked(useReverseTransaction).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReverseTransaction>)
}

describe('ReceivablesPage', () => {
  beforeEach(() => {
    mockResources()
    vi.mocked(useReceivables).mockReturnValue({ data: { rows: [receivable], count: 1, page: 1, pageSize: 25, pageCount: 1 }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useReceivables>)
  })

  it('renderiza toolbar, contador, lista responsiva e acao de recebimento', () => {
    render(<MemoryRouter><ReceivablesPage /></MemoryRouter>)
    expect(screen.getByText('Contas a Receber')).toBeInTheDocument()
    expect(screen.getByText('1–1 de 1 contas a receber')).toBeInTheDocument()
    expect(screen.getAllByText('Contrato de consultoria')).toHaveLength(2)
    expect(screen.getAllByText('Receber').length).toBeGreaterThan(0)
    expect(screen.getByText('Mais filtros')).toBeInTheDocument()
  })

  it('distingue filtered empty e oferece limpar filtros', () => {
    vi.mocked(useReceivables).mockReturnValue({ data: { rows: [], count: 0, page: 1, pageSize: 25, pageCount: 1 }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useReceivables>)
    render(<MemoryRouter initialEntries={['/finance/receivables?status=pending']}><ReceivablesPage /></MemoryRouter>)
    expect(screen.getByText('Nenhuma conta a receber atende aos filtros')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[1])
    expect(screen.queryByText('Nenhuma conta a receber atende aos filtros')).not.toBeInTheDocument()
  })

  it('renderiza erro com retry', () => {
    const refetch = vi.fn()
    vi.mocked(useReceivables).mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } as unknown as ReturnType<typeof useReceivables>)
    render(<MemoryRouter><ReceivablesPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})
