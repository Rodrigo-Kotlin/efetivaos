import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import type { FinancialTransactionList } from '../types/finance-types'
import { FinancialMovementsList } from './financial-movements-list'

const baseMovement: FinancialTransactionList = {
  id: 'movement-1', description: 'Transferência entre contas', transaction_date: '2026-03-20', competence_date: '2026-03-20',
  movement_type: 'TRANSFERENCIA', amount: '500', status: 'settled', category_id: null, category_name: null,
  origin_account_id: 'origin', origin_account_name: 'Conta A', destination_account_id: 'destination', destination_account_name: 'Conta B',
  party_id: null, party_name: null, cost_center_id: null, cost_center_name: null, service_line_id: null, service_line_name: null,
  payment_method_id: null, payment_method_name: null, due_date: null, payment_date: '2026-03-20', notes: null,
  review_required: false, version: 1, idempotency_key: null, created_at: '2026-03-20T10:00:00Z', created_by: null, updated_at: '2026-03-20T10:00:00Z',
  updated_by: null, journal_entry_count: 1, total_debit: '500', total_credit: '500',
}

describe('FinancialMovementsList', () => {
  it('preserves transfer type and cancelled status without relabeling them as income or expense', () => {
    const cancelled = { ...baseMovement, id: 'movement-2', description: 'Principal de empréstimo', movement_type: 'EMPRESTIMO_PAGO' as const, status: 'cancelled' as const }

    render(<MemoryRouter><FinancialMovementsList rows={[baseMovement, cancelled]} isLoading={false} isError={false} viewHref="/finance/transactions" /></MemoryRouter>)

    expect(screen.getAllByText('Transferência')).toHaveLength(2)
    expect(screen.getAllByText('Concluída')).toHaveLength(2)
    expect(screen.getAllByText('Empréstimo Pago')).toHaveLength(2)
    expect(screen.getAllByText('Cancelado')).toHaveLength(2)
    expect(screen.queryByText('Receita')).not.toBeInTheDocument()
    expect(screen.queryByText('Despesa')).not.toBeInTheDocument()
  })
})
