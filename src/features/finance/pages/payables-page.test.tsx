import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

import type { FinancialPayableList, FinancialTransactionList } from '@/types/database'
import PayablesPage from './payables-page'
import {
  useCategories,
  useFinancialAccounts,
  useParties,
  usePayables,
  usePayablesTotal,
  usePaymentMethods,
  useReverseTransaction,
  useSettleTransaction,
  useTransactionDetail,
} from '../queries/finance-queries'

vi.mock('../queries/finance-queries', () => ({
  useCategories: vi.fn(),
  useFinancialAccounts: vi.fn(),
  useParties: vi.fn(),
  usePayables: vi.fn(),
  usePayablesTotal: vi.fn(),
  usePaymentMethods: vi.fn(),
  useReverseTransaction: vi.fn(),
  useSettleTransaction: vi.fn(),
  useTransactionDetail: vi.fn(),
}))

function lastTotalFilters(): Record<string, unknown> | undefined {
  return vi.mocked(usePayablesTotal).mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined
}

const payable: FinancialPayableList = {
  transaction_id: 'tx-1', description: 'Aluguel do escritorio', movement_type: 'DESPESA', status: 'pending',
  original_amount: '1200', settled_amount: '0', open_amount: '1200', transaction_date: '2026-10-01',
  competence_date: '2026-10-01', due_date: '2026-10-10', overdue: true, days_overdue: 1,
  party_name: 'Fornecedor A', category_name: 'Servicos', cost_center_id: null, cost_center_name: null,
  service_line_id: null, service_line_name: null, origin_account_id: 'account-1', payment_method_id: null,
  competency_entry_id: null, settlement_entry_id: null,
}

const payableDetail = { id: 'tx-1', description: payable.description, transaction_date: payable.transaction_date, competence_date: payable.competence_date!, movement_type: payable.movement_type, amount: payable.original_amount, status: payable.status, category_id: 'category-1', origin_account_id: payable.origin_account_id, destination_account_id: null, party_id: 'party-1', cost_center_id: null, service_line_id: null, payment_method_id: null, due_date: payable.due_date, payment_date: null, notes: 'Conta mensal', review_required: false, version: 1, idempotency_key: null, created_at: '', created_by: null, updated_at: '', updated_by: null, category_name: payable.category_name, origin_account_name: 'Cora', destination_account_name: null, party_name: payable.party_name, cost_center_name: null, service_line_name: null, payment_method_name: null, journal_entry_count: 0, total_debit: '0', total_credit: '0' } as unknown as FinancialTransactionList

function mockResources() {
  vi.mocked(useCategories).mockReturnValue({ data: [{ id: 'category-1', name: 'Servicos' }] } as unknown as ReturnType<typeof useCategories>)
  vi.mocked(useFinancialAccounts).mockReturnValue({ data: [{ id: 'account-1', name: 'Cora', active: true }] } as unknown as ReturnType<typeof useFinancialAccounts>)
  vi.mocked(useParties).mockReturnValue({ data: [{ id: 'party-1', name: 'Fornecedor A' }] } as unknown as ReturnType<typeof useParties>)
  vi.mocked(usePaymentMethods).mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePaymentMethods>)
  vi.mocked(useSettleTransaction).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSettleTransaction>)
  vi.mocked(useReverseTransaction).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReverseTransaction>)
  vi.mocked(usePayablesTotal).mockReturnValue({ data: 1200, isLoading: false, isError: false } as unknown as ReturnType<typeof usePayablesTotal>)
  vi.mocked(useTransactionDetail).mockReturnValue({ data: payableDetail, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTransactionDetail>)
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

  it('abre e fecha o detalhe pelo identificador da transacao', () => {
    render(<MemoryRouter><PayablesPage /></MemoryRouter>)

    fireEvent.click(screen.getAllByRole('button', { name: /Ver detalhes/ })[0])
    expect(screen.getByText('Detalhes da conta a pagar')).toBeInTheDocument()
    expect(screen.getByText('Conta mensal')).toBeInTheDocument()
    expect(screen.getAllByText('Cora').some(element => element.tagName === 'DD')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    expect(screen.queryByText('Detalhes da conta a pagar')).not.toBeInTheDocument()
  })

  it('exibe o card Total a pagar com o total global filtrado, nao apenas a pagina atual', () => {
    vi.mocked(usePayables).mockReturnValue({ data: { rows: [payable], count: 1, page: 1, pageSize: 25, pageCount: 1 }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof usePayables>)
    vi.mocked(usePayablesTotal).mockReturnValue({ data: 98765.4, isLoading: false, isError: false } as unknown as ReturnType<typeof usePayablesTotal>)
    render(<MemoryRouter><PayablesPage /></MemoryRouter>)
    expect(screen.getByText('Total a pagar')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*98\.765,40/)).toBeInTheDocument()
  })

  it('recalcula o total ao alterar o periodo', async () => {
    render(<MemoryRouter><PayablesPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-02-10' } })
    await waitFor(() => expect(lastTotalFilters()).toMatchObject({ dueDateFrom: '2026-02-10' }))
  })

  it('recalcula o total com a busca ativa', async () => {
    render(<MemoryRouter initialEntries={['/finance/payables?search=aluguel']}><PayablesPage /></MemoryRouter>)
    await waitFor(() => expect(lastTotalFilters()).toMatchObject({ search: 'aluguel' }))
  })

  it('recalcula o total ao alterar o status', async () => {
    render(<MemoryRouter><PayablesPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'settled' } })
    await waitFor(() => expect(lastTotalFilters()).toMatchObject({ status: 'settled' }))
  })

  it('nao inclui paginacao nas chaves do total ao mudar de pagina', async () => {
    vi.mocked(usePayables).mockReturnValue({ data: { rows: [payable], count: 50, page: 1, pageSize: 25, pageCount: 2 }, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof usePayables>)
    render(<MemoryRouter><PayablesPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await waitFor(() => expect(vi.mocked(usePayables)).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
    const calls = vi.mocked(usePayablesTotal).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every(([filters]) => !('page' in (filters as object)) && !('pageSize' in (filters as object)))).toBe(true)
  })

  it('recalcula o total ao limpar os filtros', async () => {
    render(<MemoryRouter initialEntries={['/finance/payables?status=pending&dueDateFrom=2026-01-01']}><PayablesPage /></MemoryRouter>)
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0])
    await waitFor(() => expect(lastTotalFilters()).toMatchObject({ status: undefined, dueDateFrom: undefined, search: '' }))
  })

  it('mostra R$ 0,00 quando nao ha resultados', () => {
    vi.mocked(usePayables).mockReturnValue({ data: { rows: [], count: 0, page: 1, pageSize: 25, pageCount: 1 }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof usePayables>)
    vi.mocked(usePayablesTotal).mockReturnValue({ data: 0, isLoading: false, isError: false } as unknown as ReturnType<typeof usePayablesTotal>)
    render(<MemoryRouter><PayablesPage /></MemoryRouter>)
    expect(screen.getByText(/R\$\s*0,00/)).toBeInTheDocument()
  })

  it('mostra skeleton no card de total durante o carregamento', () => {
    vi.mocked(usePayablesTotal).mockReturnValue({ data: undefined, isLoading: true, isError: false } as unknown as ReturnType<typeof usePayablesTotal>)
    render(<MemoryRouter><PayablesPage /></MemoryRouter>)
    const card = screen.getByText('Total a pagar').closest('div.rounded-xl')
    expect(card?.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('mostra estado de erro discreto quando o total falha', () => {
    vi.mocked(usePayablesTotal).mockReturnValue({ data: undefined, isLoading: false, isError: true } as unknown as ReturnType<typeof usePayablesTotal>)
    render(<MemoryRouter><PayablesPage /></MemoryRouter>)
    expect(screen.getByText('Não foi possível calcular')).toBeInTheDocument()
  })
})
