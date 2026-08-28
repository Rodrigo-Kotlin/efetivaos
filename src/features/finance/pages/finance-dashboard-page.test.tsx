import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import type { FinancialDashboardData } from '../api/finance-api'

import FinanceDashboardPage from './finance-dashboard-page'
import { useFinancialDashboard } from '../queries/finance-queries'

vi.mock('../queries/finance-queries', () => ({
  useFinancialDashboard: vi.fn(),
}))

const mockDashboard: FinancialDashboardData = {
  period: { from: '2026-08-01', to: '2026-08-31', as_of_date: '2026-08-31' },
  cashflow: {
    opening_balance: 50000, closing_balance: 52000,
    realized_inflows: 30000, realized_outflows: 28000,
    projected_inflows: 10000, projected_outflows: 12000, projected_balance: 50000,
  },
  receivables: { open: 15000, overdue: 3000, due_in_7_days: 5000, due_in_30_days: 12000 },
  payables: { open: 8000, overdue: 1500, due_in_7_days: 2000, due_in_30_days: 6000 },
  income_statement: {
    revenue: 100000, revenue_deductions: 15000, net_revenue: 85000,
    cogs: 30000, gross_profit: 55000, opex: 20000, depreciation: 5000,
    ebitda: 30000, financial_result: -2000, other_income: 1000,
    other_expense: 500, tax: 7000, net_result: 21500,
    margin_ebitda: 35.29, margin_net: 25.29,
  },
  balance_sheet: {
    total_assets: 200000, current_assets: 80000,
    current_liabilities: 40000, non_current_liabilities: 30000,
    total_liabilities: 70000, equity: 130000,
    working_capital: 40000, current_ratio: 2.0, leverage: 0.54,
  },
}

describe('FinanceDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(useFinancialDashboard).mockReturnValue({
      data: mockDashboard, isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useFinancialDashboard>)
  })

  it('renders dashboard title', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Financeiro 360')).toBeInTheDocument()
  })

  it('renders period subtitle', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText(/Visao consolidada/)).toBeInTheDocument()
  })

  it('renders preset buttons', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Este mes')).toBeInTheDocument()
    expect(screen.getByText('Mes anterior')).toBeInTheDocument()
    expect(screen.getByText('Este trimestre')).toBeInTheDocument()
    expect(screen.getByText('Este ano')).toBeInTheDocument()
  })

  it('renders KPI cards with correct values', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Caixa Atual')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 52.000,00').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Resultado Liquido').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('R$ 21.500,00').length).toBeGreaterThanOrEqual(1)
  })

  it('renders EBITDA and margins', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getAllByText('EBITDA').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Margem EBITDA')).toBeInTheDocument()
    expect(screen.getByText('Margem Liquida')).toBeInTheDocument()
  })

  it('renders cashflow section', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Fluxo de Caixa')).toBeInTheDocument()
    expect(screen.getByText('Saldo inicial')).toBeInTheDocument()
    expect(screen.getByText('Entradas realizadas')).toBeInTheDocument()
  })

  it('renders receivables section', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Contas a Receber')).toBeInTheDocument()
    expect(screen.getAllByText('Em aberto').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Vencidos').length).toBeGreaterThanOrEqual(1)
  })

  it('renders payables section', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Contas a Pagar')).toBeInTheDocument()
  })

  it('renders income statement section', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Resultado do Periodo')).toBeInTheDocument()
    expect(screen.getByText('Receita Bruta')).toBeInTheDocument()
    expect(screen.getByText('(-) Deducoes')).toBeInTheDocument()
  })

  it('renders balance sheet section', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Posicao Patrimonial')).toBeInTheDocument()
    expect(screen.getByText('Ativo Total')).toBeInTheDocument()
    expect(screen.getByText('Patrimonio Liquido')).toBeInTheDocument()
  })

  it('renders statement links', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Demonstracoes Financeiras')).toBeInTheDocument()
    expect(screen.getByText('DRE')).toBeInTheDocument()
    expect(screen.getByText('DFC')).toBeInTheDocument()
    expect(screen.getByText('Balanco Patrimonial')).toBeInTheDocument()
  })

  it('shows loading skeleton', () => {
    vi.mocked(useFinancialDashboard).mockReturnValue({
      data: undefined, isLoading: true, isError: false,
    } as unknown as ReturnType<typeof useFinancialDashboard>)
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.queryByText('Financeiro 360')).not.toBeInTheDocument()
  })

  it('shows error state', () => {
    vi.mocked(useFinancialDashboard).mockReturnValue({
      data: undefined, isLoading: false, isError: true,
    } as unknown as ReturnType<typeof useFinancialDashboard>)
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText(/Nao foi possivel carregar/)).toBeInTheDocument()
  })

  it('shows warning for overdue receivables', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText(/Recebiveis vencidos/)).toBeInTheDocument()
  })

  it('shows warning for overdue payables', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText(/Pagaveis vencidos/)).toBeInTheDocument()
  })

  it('does not show alerts when values are zero', () => {
    vi.mocked(useFinancialDashboard).mockReturnValue({
      data: {
        ...mockDashboard,
        receivables: { open: 0, overdue: 0, due_in_7_days: 0, due_in_30_days: 0 },
        payables: { open: 0, overdue: 0, due_in_7_days: 0, due_in_30_days: 0 },
      }, isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useFinancialDashboard>)
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.queryByText(/Recebiveis vencidos/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Pagaveis vencidos/)).not.toBeInTheDocument()
  })
})
