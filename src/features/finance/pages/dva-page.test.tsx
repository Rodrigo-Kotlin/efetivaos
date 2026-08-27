import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { DvaRow } from '@/types/database'

import DvaPage from './dva-page'
import { useDva } from '../queries/finance-queries'

vi.mock('../queries/finance-queries', () => ({
  useDva: vi.fn(),
}))

const mockRows: DvaRow[] = [
  { row_label: 'Receita Operacional Bruta', amount: 100000, sort_order: 10 },
  { row_label: '(-) Deducoes da Receita', amount: -15000, sort_order: 20 },
  { row_label: '= Receita Operacional Liquida', amount: 85000, sort_order: 30 },
  { row_label: '(-) Insumos de Terceiros', amount: -30000, sort_order: 40 },
  { row_label: '= Valor Bruto Adicionado', amount: 55000, sort_order: 50 },
  { row_label: '(-) Retencoes e Tributos', amount: -7250, sort_order: 60 },
  { row_label: '= Valor Adicionado Liquido', amount: 47750, sort_order: 70 },
  { row_label: 'Distribuicao - Pessoal', amount: -20000, sort_order: 80 },
  { row_label: 'Distribuicao - Gobierno', amount: -7250, sort_order: 81 },
  { row_label: 'Distribuicao - Capital de Terceiros', amount: -2000, sort_order: 82 },
  { row_label: 'Distribuicao - Capital Proprio', amount: 18500, sort_order: 83 },
  { row_label: '= Total Distribuido', amount: 47750, sort_order: 90 },
]

describe('DvaPage', () => {
  beforeEach(() => {
    vi.mocked(useDva).mockReturnValue({ data: mockRows, isLoading: false, isError: false } as unknown as ReturnType<typeof useDva>)
  })

  it('renders DVA title', () => {
    render(<DvaPage />)
    expect(screen.getByText('DVA - Demonstracao do Valor Adicionado')).toBeInTheDocument()
  })

  it('renders all DVA rows', () => {
    render(<DvaPage />)
    for (const row of mockRows) {
      expect(screen.getByText(row.row_label)).toBeInTheDocument()
    }
  })

  it('shows loading state', () => {
    vi.mocked(useDva).mockReturnValue({ data: undefined, isLoading: true, isError: false } as unknown as ReturnType<typeof useDva>)
    render(<DvaPage />)
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('shows empty state when no rows', () => {
    vi.mocked(useDva).mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useDva>)
    render(<DvaPage />)
    expect(screen.getByText('Nenhum dado encontrado para o periodo selecionado.')).toBeInTheDocument()
  })

  it('subtotal rows have bold styling', () => {
    render(<DvaPage />)
    const subtotal = screen.getByText('= Valor Bruto Adicionado')
    expect(subtotal.closest('div')).toHaveClass('font-semibold')
  })

  it('distribuicao rows have indentation', () => {
    render(<DvaPage />)
    const dist = screen.getByText('Distribuicao - Pessoal')
    expect(dist.closest('div')).toHaveClass('pl-6')
  })

  it('clear filters button works', async () => {
    const user = userEvent.setup()
    const { container } = render(<DvaPage />)
    const dateInput = container.querySelector('input[type="date"]')!
    await user.type(dateInput, '2026-06-01')
    await user.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(dateInput).toHaveValue('')
  })
})
