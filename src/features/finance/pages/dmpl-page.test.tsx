import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { DmplRow } from '@/types/database'

import DmplPage from './dmpl-page'
import { useDmpl } from '../queries/finance-queries'

vi.mock('../queries/finance-queries', () => ({
  useDmpl: vi.fn(),
}))

const mockRows: DmplRow[] = [
  { row_label: 'Saldo Inicial', capital_social: 50000, reservas: 10000, lucros_prejuizos_acumulados: 15000, resultado_exercicio: 0, outros_componentes: 0, total_pl: 75000, sort_order: 10 },
  { row_label: 'Aportes', capital_social: 10000, reservas: 0, lucros_prejuizos_acumulados: 0, resultado_exercicio: 0, outros_componentes: 0, total_pl: 10000, sort_order: 20 },
  { row_label: 'Resultado do Exercicio', capital_social: 0, reservas: 0, lucros_prejuizos_acumulados: 0, resultado_exercicio: 21750, outros_componentes: 0, total_pl: 21750, sort_order: 50 },
  { row_label: '= Saldo Final', capital_social: 60000, reservas: 10000, lucros_prejuizos_acumulados: 15000, resultado_exercicio: 21750, outros_componentes: 0, total_pl: 106750, sort_order: 70 },
]

describe('DmplPage', () => {
  beforeEach(() => {
    vi.mocked(useDmpl).mockReturnValue({ data: mockRows, isLoading: false, isError: false } as unknown as ReturnType<typeof useDmpl>)
  })

  it('renders DMPL title', () => {
    render(<DmplPage />)
    expect(screen.getByText('DMPL - Demonstração das Mutações do Patrimônio Líquido')).toBeInTheDocument()
  })

  it('renders table headers', () => {
    render(<DmplPage />)
    expect(screen.getByText('Movimento')).toBeInTheDocument()
    expect(screen.getByText('Capital Social')).toBeInTheDocument()
    expect(screen.getByText('Reservas')).toBeInTheDocument()
    expect(screen.getByText('Total PL')).toBeInTheDocument()
  })

  it('renders all DMPL rows', () => {
    render(<DmplPage />)
    for (const row of mockRows) {
      expect(screen.getByText(row.row_label)).toBeInTheDocument()
    }
  })

  it('shows loading state', () => {
    vi.mocked(useDmpl).mockReturnValue({ data: undefined, isLoading: true, isError: false } as unknown as ReturnType<typeof useDmpl>)
    render(<DmplPage />)
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
    expect(screen.queryByText('Saldo Inicial')).not.toBeInTheDocument()
  })

  it('shows empty state when no rows', () => {
    vi.mocked(useDmpl).mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useDmpl>)
    render(<DmplPage />)
    expect(screen.getByText('Nenhum dado encontrado para o periodo selecionado.')).toBeInTheDocument()
  })

  it('clear filters button resets date inputs', async () => {
    const user = userEvent.setup()
    const { container } = render(<DmplPage />)
    const dateFrom = container.querySelector('input[type="date"]')!
    await user.type(dateFrom, '2026-01-01')
    expect(screen.getByRole('button', { name: 'Limpar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(dateFrom).toHaveValue('')
  })

  it('Saldo Final row has bold styling', () => {
    render(<DmplPage />)
    const saldoFinal = screen.getByText('= Saldo Final')
    expect(saldoFinal.closest('tr')).toHaveClass('font-semibold')
  })
})
