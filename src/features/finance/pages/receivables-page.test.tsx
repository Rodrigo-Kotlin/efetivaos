import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import type { FinancialReceivableList, FinancialTransactionList } from '@/types/database'
import ReceivablesPage from './receivables-page'
import { useCategories, useFinancialAccounts, useParties, usePaymentMethods, useReceivables, useReceivablesTotal, useReverseTransaction, useSettleTransaction, useTransactionDetail } from '../queries/finance-queries'

vi.mock('../queries/finance-queries', () => ({
  useCategories: vi.fn(), useFinancialAccounts: vi.fn(), useParties: vi.fn(), usePaymentMethods: vi.fn(), useReceivables: vi.fn(), useReceivablesTotal: vi.fn(), useReverseTransaction: vi.fn(), useSettleTransaction: vi.fn(), useTransactionDetail: vi.fn(),
}))

function lastTotalFilters(): Record<string, unknown> | undefined {
  return vi.mocked(useReceivablesTotal).mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined
}

const receivable: FinancialReceivableList = {
  transaction_id: 'tx-1', description: 'Contrato de consultoria', movement_type: 'RECEITA', status: 'pending', original_amount: '1800', settled_amount: '0', open_amount: '1800', transaction_date: '2026-10-01', competence_date: '2026-10-01', due_date: '2026-10-10', overdue: true, days_overdue: 1, party_name: 'Cliente A', category_name: 'Servicos', cost_center_id: null, cost_center_name: null, service_line_id: null, service_line_name: null, origin_account_id: 'account-1', payment_method_id: null, competency_entry_id: null, settlement_entry_id: null,
}

const receivableDetail = { id: 'tx-1', description: receivable.description, transaction_date: receivable.transaction_date, competence_date: receivable.competence_date!, movement_type: receivable.movement_type, amount: receivable.original_amount, status: receivable.status, category_id: 'category-1', origin_account_id: receivable.origin_account_id, destination_account_id: null, party_id: 'party-1', cost_center_id: null, service_line_id: null, payment_method_id: null, due_date: receivable.due_date, payment_date: null, notes: 'Receita recorrente', review_required: false, version: 1, idempotency_key: null, created_at: '', created_by: null, updated_at: '', updated_by: null, category_name: receivable.category_name, origin_account_name: 'Cora', destination_account_name: null, party_name: receivable.party_name, cost_center_name: null, service_line_name: null, payment_method_name: null, journal_entry_count: 0, total_debit: '0', total_credit: '0' } as unknown as FinancialTransactionList

function mockResources() {
  vi.mocked(useCategories).mockReturnValue({ data: [{ id: 'category-1', name: 'Servicos' }] } as unknown as ReturnType<typeof useCategories>)
  vi.mocked(useFinancialAccounts).mockReturnValue({ data: [{ id: 'account-1', name: 'Cora', active: true }] } as unknown as ReturnType<typeof useFinancialAccounts>)
  vi.mocked(useParties).mockReturnValue({ data: [{ id: 'party-1', name: 'Cliente A' }] } as unknown as ReturnType<typeof useParties>)
  vi.mocked(usePaymentMethods).mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePaymentMethods>)
  vi.mocked(useSettleTransaction).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSettleTransaction>)
  vi.mocked(useReverseTransaction).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReverseTransaction>)
  vi.mocked(useReceivablesTotal).mockReturnValue({ data: 1800, isLoading: false, isError: false } as unknown as ReturnType<typeof useReceivablesTotal>)
  vi.mocked(useTransactionDetail).mockReturnValue({ data: receivableDetail, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTransactionDetail>)
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

  it('abre e fecha o detalhe pelo identificador da transacao', () => {
    render(<MemoryRouter><ReceivablesPage /></MemoryRouter>)

    fireEvent.click(screen.getAllByRole('button', { name: /Ver detalhes/ })[0])
    expect(screen.getByText('Detalhes da conta a receber')).toBeInTheDocument()
    expect(screen.getByText('Receita recorrente')).toBeInTheDocument()
    expect(screen.getAllByText('Cora').some(element => element.tagName === 'DD')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    expect(screen.queryByText('Detalhes da conta a receber')).not.toBeInTheDocument()
  })

  it('exibe o card Total a receber com o total global filtrado, nao apenas a pagina atual', () => {
    vi.mocked(useReceivables).mockReturnValue({ data: { rows: [receivable], count: 1, page: 1, pageSize: 25, pageCount: 1 }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useReceivables>)
    vi.mocked(useReceivablesTotal).mockReturnValue({ data: 125430.2, isLoading: false, isError: false } as unknown as ReturnType<typeof useReceivablesTotal>)
    render(<MemoryRouter><ReceivablesPage /></MemoryRouter>)
    expect(screen.getByText('Total a receber')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*125\.430,20/)).toBeInTheDocument()
  })

  it('recalcula o total ao alterar o periodo', async () => {
    render(<MemoryRouter><ReceivablesPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-01-15' } })
    await waitFor(() => expect(lastTotalFilters()).toMatchObject({ dueDateFrom: '2026-01-15' }))
  })

  it('recalcula o total com a busca ativa', async () => {
    render(<MemoryRouter initialEntries={['/finance/receivables?search=consulta']}><ReceivablesPage /></MemoryRouter>)
    await waitFor(() => expect(lastTotalFilters()).toMatchObject({ search: 'consulta' }))
  })

  it('recalcula o total ao alterar o status', async () => {
    render(<MemoryRouter><ReceivablesPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'settled' } })
    await waitFor(() => expect(lastTotalFilters()).toMatchObject({ status: 'settled' }))
  })

  it('nao inclui paginacao nas chaves do total ao mudar de pagina', async () => {
    vi.mocked(useReceivables).mockReturnValue({ data: { rows: [receivable], count: 50, page: 1, pageSize: 25, pageCount: 2 }, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useReceivables>)
    render(<MemoryRouter><ReceivablesPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await waitFor(() => expect(vi.mocked(useReceivables)).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
    const calls = vi.mocked(useReceivablesTotal).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every(([filters]) => !('page' in (filters as object)) && !('pageSize' in (filters as object)))).toBe(true)
  })

  it('recalcula o total ao limpar os filtros', async () => {
    render(<MemoryRouter initialEntries={['/finance/receivables?status=pending&dueDateFrom=2026-01-01']}><ReceivablesPage /></MemoryRouter>)
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0])
    await waitFor(() => expect(lastTotalFilters()).toMatchObject({ status: undefined, dueDateFrom: undefined, search: '' }))
  })

  it('mostra R$ 0,00 quando nao ha resultados', () => {
    vi.mocked(useReceivables).mockReturnValue({ data: { rows: [], count: 0, page: 1, pageSize: 25, pageCount: 1 }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useReceivables>)
    vi.mocked(useReceivablesTotal).mockReturnValue({ data: 0, isLoading: false, isError: false } as unknown as ReturnType<typeof useReceivablesTotal>)
    render(<MemoryRouter><ReceivablesPage /></MemoryRouter>)
    expect(screen.getByText(/R\$\s*0,00/)).toBeInTheDocument()
  })

  it('mostra skeleton no card de total durante o carregamento', () => {
    vi.mocked(useReceivablesTotal).mockReturnValue({ data: undefined, isLoading: true, isError: false } as unknown as ReturnType<typeof useReceivablesTotal>)
    render(<MemoryRouter><ReceivablesPage /></MemoryRouter>)
    const card = screen.getByText('Total a receber').closest('div.rounded-xl')
    expect(card?.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('mostra estado de erro discreto quando o total falha', () => {
    vi.mocked(useReceivablesTotal).mockReturnValue({ data: undefined, isLoading: false, isError: true } as unknown as ReturnType<typeof useReceivablesTotal>)
    render(<MemoryRouter><ReceivablesPage /></MemoryRouter>)
    expect(screen.getByText('Não foi possível calcular')).toBeInTheDocument()
  })
})
