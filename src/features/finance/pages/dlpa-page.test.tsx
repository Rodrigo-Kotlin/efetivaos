import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { DlpaRow } from '@/types/database'

import DlpaPage from './dlpa-page'
import { useDlpa } from '../queries/finance-queries'

vi.mock('../queries/finance-queries', () => ({
  useDlpa: vi.fn(),
}))

const mockRows: DlpaRow[] = [
  { row_label: 'Saldo Inicial LP', amount: 15000, sort_order: 10 },
  { row_label: '(+) Ajustes Exercicios Anteriores', amount: 0, sort_order: 20 },
  { row_label: '(+) Resultado Liquido do Exercicio', amount: 21750, sort_order: 30 },
  { row_label: '(-) Dividendos / Lucros Distribuidos', amount: -5000, sort_order: 40 },
  { row_label: '(+) Ajustes do Periodo', amount: 0, sort_order: 50 },
  { row_label: '= Saldo Final LP', amount: 31750, sort_order: 60 },
]

describe('DlpaPage', () => {
  beforeEach(() => {
    vi.mocked(useDlpa).mockReturnValue({ data: mockRows, isLoading: false, isError: false } as unknown as ReturnType<typeof useDlpa>)
  })

  it('renders DLPA title', () => {
    render(<DlpaPage />)
    expect(screen.getByText('DLPA - Demonstracao de Lucros ou Prejuizos Acumulados')).toBeInTheDocument()
  })

  it('renders all DLPA rows', () => {
    render(<DlpaPage />)
    for (const row of mockRows) {
      expect(screen.getByText(row.row_label)).toBeInTheDocument()
    }
  })

  it('shows loading state', () => {
    vi.mocked(useDlpa).mockReturnValue({ data: undefined, isLoading: true, isError: false } as unknown as ReturnType<typeof useDlpa>)
    render(<DlpaPage />)
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('shows empty state when no rows', () => {
    vi.mocked(useDlpa).mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useDlpa>)
    render(<DlpaPage />)
    expect(screen.getByText('Nenhum dado encontrado para o periodo selecionado.')).toBeInTheDocument()
  })

  it('Saldo rows have bold styling', () => {
    render(<DlpaPage />)
    const saldoInicial = screen.getByText('Saldo Inicial LP')
    expect(saldoInicial.closest('div')).toHaveClass('font-semibold')
    const saldoFinal = screen.getByText('= Saldo Final LP')
    expect(saldoFinal.closest('div')).toHaveClass('font-semibold')
  })

  it('Resultado row has highlight styling', () => {
    render(<DlpaPage />)
    const resultado = screen.getByText('(+) Resultado Liquido do Exercicio')
    expect(resultado.closest('div')).toHaveClass('bg-blue-50')
  })

  it('clear filters button works', async () => {
    const user = userEvent.setup()
    const { container } = render(<DlpaPage />)
    const dateInput = container.querySelector('input[type="date"]')!
    await user.type(dateInput, '2026-01-01')
    await user.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(dateInput).toHaveValue('')
  })
})
