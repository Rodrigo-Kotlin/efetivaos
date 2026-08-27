import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { IncomeStatementRow } from '@/types/database'

import DrePage from './dre-page'
import { useIncomeStatement, useCostCenters, useServiceLines } from '../queries/finance-queries'

vi.mock('../queries/finance-queries', () => ({
  useIncomeStatement: vi.fn(),
  useCostCenters: vi.fn(),
  useServiceLines: vi.fn(),
}))

const mockRows: IncomeStatementRow[] = [
  { row_code: 'RECEITA_BRUTA', label: 'Receita Bruta', row_type: 'SUBTOTAL', amount: '100000', sort_order: 10 },
  { row_code: 'DEDUCOES', label: '(-) Deduções da Receita', row_type: 'DETAIL', amount: '-15000', sort_order: 20 },
  { row_code: 'RECEITA_LIQUIDA', label: 'Receita Líquida', row_type: 'SUBTOTAL', amount: '85000', sort_order: 30 },
  { row_code: 'CUSTOS', label: '(-) Custos dos Serviços Prestados', row_type: 'DETAIL', amount: '-30000', sort_order: 40 },
  { row_code: 'LUCRO_BRUTO', label: 'Lucro Bruto / Margem de Contribuição', row_type: 'SUBTOTAL', amount: '55000', sort_order: 50 },
  { row_code: 'DESPESAS_OPERACIONAIS', label: '(-) Despesas Operacionais', row_type: 'DETAIL', amount: '-20000', sort_order: 60 },
  { row_code: 'EBITDA', label: 'EBITDA Gerencial', row_type: 'SUBTOTAL', amount: '35000', sort_order: 70 },
  { row_code: 'DEPRECIACAO', label: '(-) Depreciação e Amortização', row_type: 'DETAIL', amount: '-5000', sort_order: 80 },
  { row_code: 'EBIT', label: 'Resultado Operacional (EBIT)', row_type: 'SUBTOTAL', amount: '30000', sort_order: 90 },
  { row_code: 'RESULTADO_FINANCEIRO', label: 'Resultado Financeiro', row_type: 'DETAIL', amount: '-2000', sort_order: 100 },
  { row_code: 'OUTROS_RESULTADOS', label: 'Outros Resultados', row_type: 'DETAIL', amount: '1000', sort_order: 110 },
  { row_code: 'ANTES_IMPOSTOS', label: 'Resultado antes dos Tributos sobre Lucro', row_type: 'SUBTOTAL', amount: '29000', sort_order: 120 },
  { row_code: 'IMPOSTOS', label: '(-) Tributos sobre Resultado', row_type: 'DETAIL', amount: '-7250', sort_order: 130 },
  { row_code: 'RESULTADO_LIQUIDO', label: 'RESULTADO LÍQUIDO', row_type: 'TOTAL', amount: '21750', sort_order: 140 },
]

describe('DrePage', () => {
  beforeEach(() => {
    vi.mocked(useIncomeStatement).mockReturnValue({ data: mockRows, isLoading: false, isError: false } as unknown as ReturnType<typeof useIncomeStatement>)
    vi.mocked(useCostCenters).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useCostCenters>)
    vi.mocked(useServiceLines).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useServiceLines>)
  })

  it('renders DRE title and statement rows', () => {
    render(<DrePage />)
    expect(screen.getByText('DRE - Demonstracao do Resultado')).toBeInTheDocument()
    expect(screen.getByText('Receita Bruta')).toBeInTheDocument()
    expect(screen.getByText('RESULTADO LÍQUIDO')).toBeInTheDocument()
  })

  it('renders KPI cards with correct values', () => {
    render(<DrePage />)
    expect(screen.getByText('Receita Liquida')).toBeInTheDocument()
    expect(screen.getByText('EBITDA')).toBeInTheDocument()
    expect(screen.getByText('Resultado Liquido')).toBeInTheDocument()
    expect(screen.getByText('Margem EBITDA')).toBeInTheDocument()
    expect(screen.getByText('Margem Liquida')).toBeInTheDocument()
  })

  it('shows loading skeletons', () => {
    vi.mocked(useIncomeStatement).mockReturnValue({ data: undefined, isLoading: true, isError: false } as unknown as ReturnType<typeof useIncomeStatement>)
    render(<DrePage />)
    expect(screen.queryByText('Receita Bruta')).not.toBeInTheDocument()
  })

  it('shows empty state when no rows', () => {
    vi.mocked(useIncomeStatement).mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useIncomeStatement>)
    render(<DrePage />)
    expect(screen.getByText('Nenhum dado de DRE para o periodo selecionado.')).toBeInTheDocument()
  })

  it('renders all 14 DRE rows', () => {
    render(<DrePage />)
    for (const row of mockRows) {
      expect(screen.getByText(row.label)).toBeInTheDocument()
    }
  })

  it('clear filters button appears when filters are set', async () => {
    const user = userEvent.setup()
    const { container } = render(<DrePage />)
    expect(screen.queryByRole('button', { name: 'Limpar' })).not.toBeInTheDocument()

    const dateInput = container.querySelector('input[type="date"]')!
    await user.type(dateInput, '2026-01-01')
    expect(screen.getByRole('button', { name: 'Limpar' })).toBeInTheDocument()
  })

  it('negative amounts show red text', () => {
    render(<DrePage />)
    const dedRow = screen.getByText('(-) Deduções da Receita')
    expect(dedRow.closest('tr')).toHaveClass('text-slate-600')
  })

  it('RESULTADO_LIQUIDO row has total styling', () => {
    render(<DrePage />)
    const rlRow = screen.getByText('RESULTADO LÍQUIDO')
    expect(rlRow.closest('tr')).toHaveClass('font-bold')
  })
})
