import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FinancialTransactionList } from '@/types/database'
import TransactionsPage from './transactions-page'
import {
  useCancelTransaction,
  useCategories,
  useCreateTransaction,
  useCostCenters,
  useFinancialAccounts,
  useJournalEntries,
  useJournalLines,
  useParties,
  usePaymentMethods,
  useReverseTransaction,
  useServiceLines,
  useSettleTransaction,
  useTransactionDetail,
  useTransactions,
  useUpdateTransaction,
} from '../queries/finance-queries'

vi.mock('../queries/finance-queries', () => ({
  useCancelTransaction: vi.fn(), useCategories: vi.fn(), useCreateTransaction: vi.fn(), useCostCenters: vi.fn(), useFinancialAccounts: vi.fn(),
  useJournalEntries: vi.fn(), useJournalLines: vi.fn(), useParties: vi.fn(), usePaymentMethods: vi.fn(), useReverseTransaction: vi.fn(),
  useServiceLines: vi.fn(), useSettleTransaction: vi.fn(), useTransactionDetail: vi.fn(), useTransactions: vi.fn(), useUpdateTransaction: vi.fn(),
}))

const transfer: FinancialTransactionList = {
  id: 'tx-cora', description: 'Retirada do caixa Cora', transaction_date: '2026-10-01', competence_date: '2026-10-01', movement_type: 'TRANSFERENCIA', amount: '10000', status: 'pending',
  category_id: null, origin_account_id: 'account-cora', destination_account_id: null, party_id: null, cost_center_id: null, service_line_id: null, payment_method_id: null, due_date: null, payment_date: null, notes: null, review_required: false, version: 1, idempotency_key: null,
  created_at: '', created_by: null, updated_at: '', updated_by: null, category_name: null, origin_account_name: 'Cora', destination_account_name: null, party_name: null, cost_center_name: null, service_line_name: null, payment_method_name: null, journal_entry_count: 1, total_debit: '10000', total_credit: '10000',
}

const loanCategory = { id: 'category-loan', name: 'Amortizacao de emprestimo', movement_type: 'EMPRESTIMO_PAGO', active: true }

function mockResources() {
  vi.mocked(useCategories).mockReturnValue({ data: [loanCategory] } as unknown as ReturnType<typeof useCategories>)
  vi.mocked(useFinancialAccounts).mockReturnValue({ data: [{ id: 'account-cora', name: 'Cora', active: true }] } as unknown as ReturnType<typeof useFinancialAccounts>)
  vi.mocked(useParties).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useParties>)
  vi.mocked(useCostCenters).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useCostCenters>)
  vi.mocked(useServiceLines).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useServiceLines>)
  vi.mocked(usePaymentMethods).mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePaymentMethods>)
  vi.mocked(useJournalEntries).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useJournalEntries>)
  vi.mocked(useJournalLines).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useJournalLines>)
  vi.mocked(useCreateTransaction).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCreateTransaction>)
  vi.mocked(useSettleTransaction).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSettleTransaction>)
  vi.mocked(useCancelTransaction).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCancelTransaction>)
  vi.mocked(useReverseTransaction).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useReverseTransaction>)
  vi.mocked(useUpdateTransaction).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as unknown as ReturnType<typeof useUpdateTransaction>)
  vi.mocked(useTransactionDetail).mockReturnValue({ data: transfer } as unknown as ReturnType<typeof useTransactionDetail>)
  vi.mocked(useTransactions).mockReturnValue({ data: { rows: [transfer], count: 1, page: 1, pageSize: 25, pageCount: 1 }, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTransactions>)
}

function openDetails() {
  fireEvent.click(screen.getByText('Retirada do caixa Cora'))
  expect(screen.getByText('Detalhes do Lancamento')).toBeInTheDocument()
}

function openEdit() {
  openDetails()
  fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
  expect(screen.getByText('Editar Lancamento')).toBeInTheDocument()
}

describe('TransactionsPage pending edit and action eligibility', () => {
  beforeEach(() => {
    mockResources()
  })

  it('case Cora: permite editar valor de pending e oculta Receber/Pagar para transferencia', () => {
    render(<MemoryRouter><TransactionsPage /></MemoryRouter>)
    openEdit()
    expect(screen.getByRole('spinbutton')).toHaveValue(10000)
    expect(screen.queryByRole('button', { name: /Receber|Pagar/ })).not.toBeInTheDocument()
  })

  it('bloqueia valor invalido e envia o novo valor ao salvar', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useUpdateTransaction).mockReturnValue({ mutateAsync, isPending: false } as unknown as ReturnType<typeof useUpdateTransaction>)
    render(<MemoryRouter><TransactionsPage /></MemoryRouter>)
    openEdit()
    const amount = screen.getByRole('spinbutton')
    fireEvent.change(amount, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alteracoes' }))
    expect(screen.getByText('Valor deve ser maior que zero')).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()

    fireEvent.change(amount, { target: { value: '8500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alteracoes' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ amount: 8500, movementType: 'TRANSFERENCIA' }))
  })

  it('permite classificar a transferencia como amortizacao de emprestimo sem juros', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useUpdateTransaction).mockReturnValue({ mutateAsync, isPending: false } as unknown as ReturnType<typeof useUpdateTransaction>)
    render(<MemoryRouter><TransactionsPage /></MemoryRouter>)
    openEdit()
    const movementSelect = screen.getAllByRole('combobox').find(element => (element as HTMLSelectElement).value === 'TRANSFERENCIA')
    expect(movementSelect).toBeTruthy()
    fireEvent.change(movementSelect!, { target: { value: 'EMPRESTIMO_PAGO' } })
    expect(screen.getByText('Principal (R$) *')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alteracoes' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ movementType: 'EMPRESTIMO_PAGO', amount: 10000, principalAmount: 10000, interestAmount: 0, originAccountId: null, destinationAccountId: 'account-cora' }))
  })

  it('mantem Receber/Pagar visivel somente para titulo AR/AP pending', () => {
    const receivable = { ...transfer, movement_type: 'RECEITA' as const }
    vi.mocked(useTransactions).mockReturnValue({ data: { rows: [receivable], count: 1, page: 1, pageSize: 25, pageCount: 1 }, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTransactions>)
    vi.mocked(useTransactionDetail).mockReturnValue({ data: receivable } as unknown as ReturnType<typeof useTransactionDetail>)
    render(<MemoryRouter><TransactionsPage /></MemoryRouter>)
    openDetails()
    expect(screen.getByRole('button', { name: 'Receber' })).toBeInTheDocument()
  })

  it('nao mostra Receber/Pagar para amortizacao e nao oferece edicao destrutiva de liquidado', () => {
    const loan = { ...transfer, movement_type: 'EMPRESTIMO_PAGO' as const }
    vi.mocked(useTransactions).mockReturnValue({ data: { rows: [loan], count: 1, page: 1, pageSize: 25, pageCount: 1 }, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useTransactions>)
    vi.mocked(useTransactionDetail).mockReturnValue({ data: loan } as unknown as ReturnType<typeof useTransactionDetail>)
    render(<MemoryRouter><TransactionsPage /></MemoryRouter>)
    openDetails()
    expect(screen.queryByRole('button', { name: /Receber|Pagar/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()

    vi.mocked(useTransactionDetail).mockReturnValue({ data: { ...loan, status: 'settled' } } as unknown as ReturnType<typeof useTransactionDetail>)
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    fireEvent.click(screen.getByText('Retirada do caixa Cora'))
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Estornar' })).toBeInTheDocument()
  })
})
