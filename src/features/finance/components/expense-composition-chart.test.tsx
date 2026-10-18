import { render, screen } from '@testing-library/react'

import type { ExpenseCompositionRow } from '../api/finance-api'
import { sortExpenseComposition } from './expense-composition-chart-helpers'
import { ExpenseCompositionChart } from './expense-composition-chart'

const marchRows: ExpenseCompositionRow[] = [
  { account_code: '5.1.01.001', account_name: 'Salários Administrativos', amount: 8000, percentage: 27.35 },
  { account_code: '5.2.01.001', account_name: 'Aluguéis e Condomínio', amount: 2750, percentage: 9.4 },
  { account_code: '5.3.01.001', account_name: 'Sistemas e Assinaturas', amount: 18503.29, percentage: 63.25 },
]

describe('ExpenseCompositionChart', () => {
  it('orders accounts by amount and preserves the official returned percentages', () => {
    const sorted = sortExpenseComposition(marchRows)
    expect(sorted.map(row => row.account_code)).toEqual(['5.3.01.001', '5.1.01.001', '5.2.01.001'])

    render(<ExpenseCompositionChart rows={marchRows} isLoading={false} isError={false} />)

    expect(screen.getByRole('img', { name: /composição das despesas operacionais/ })).toBeInTheDocument()
    expect(screen.getByText('Aluguéis e Condomínio')).toBeInTheDocument()
    expect(screen.getByText('5.2.01.001')).toBeInTheDocument()
    expect(screen.getByText('R$ 2.750,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 29.253,29')).toBeInTheDocument()
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
  })

  it.each([
    ['Janeiro', 34779.18],
    ['Fevereiro', 18180.93],
    ['Março', 29253.29],
  ])('reconciles the %s total from the RPC rows', (_month, total) => {
    const rows = [{ ...marchRows[0], amount: total, percentage: 100 }]
    render(<ExpenseCompositionChart rows={rows} isLoading={false} isError={false} />)
    expect(screen.getAllByText(new RegExp(`${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)).length).toBeGreaterThanOrEqual(2)
  })

  it('renders loading, error and empty states explicitly', () => {
    const { rerender } = render(<ExpenseCompositionChart rows={undefined} isLoading isError={false} />)
    expect(screen.getByLabelText('Carregando composição das despesas')).toBeInTheDocument()

    rerender(<ExpenseCompositionChart rows={undefined} isLoading={false} isError />)
    expect(screen.getByText('Erro ao carregar a composição das despesas.')).toBeInTheDocument()

    rerender(<ExpenseCompositionChart rows={[]} isLoading={false} isError={false} />)
    expect(screen.getByText('Nenhuma despesa operacional encontrada para este período.')).toBeInTheDocument()
  })
})
