import { fireEvent, render, screen } from '@testing-library/react'
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
    vi.mocked(useFinancialDashboard).mockClear()
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
    expect(screen.getByText(/Visão consolidada/)).toBeInTheDocument()
  })

  it('renders preset buttons', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Este mês')).toBeInTheDocument()
    expect(screen.getByText('Mês anterior')).toBeInTheDocument()
    expect(screen.getByText('Este trimestre')).toBeInTheDocument()
    expect(screen.getByText('Este ano')).toBeInTheDocument()
  })

  it('keeps advanced date filters collapsed behind the mobile-friendly control', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)

    const toggle = screen.getByRole('button', { name: 'Filtros avançados' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Data inicial')).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Data inicial')).toBeInTheDocument()
    expect(screen.getByLabelText('Data final')).toBeInTheDocument()
    expect(screen.getByLabelText('Data de posição')).toBeInTheDocument()
  })

  it('uses the month and year context to query a monthly period', () => {
    render(<MemoryRouter initialEntries={['/finance?year=2026&month=8']}><FinanceDashboardPage /></MemoryRouter>)

    expect(screen.getByText('Agosto 2026')).toBeInTheDocument()
    expect(vi.mocked(useFinancialDashboard).mock.calls[0]?.[0]).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
      asOfDate: '2026-08-31',
    })

    fireEvent.change(screen.getByLabelText('Mês de referência'), { target: { value: '9' } })
    expect(vi.mocked(useFinancialDashboard).mock.calls.find(call => call[0]?.from === '2026-09-01')?.[0]).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      asOfDate: '2026-09-30',
    })
  })

  it('renders KPI cards with correct values', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Saldo de Caixa')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 52.000,00').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Resultado Líquido').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('R$ 21.500,00').length).toBeGreaterThanOrEqual(1)
  })

  it('exposes KPI descriptions through a focusable accessible tooltip', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)

    const trigger = screen.getByRole('button', { name: 'Informação sobre Saldo de Caixa' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Saldo das contas financeiras na data de referência selecionada.')).not.toBeInTheDocument()

    fireEvent.focus(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute('aria-describedby')
    expect(screen.getByRole('tooltip')).toHaveTextContent('Saldo das contas financeiras na data de referência selecionada.')

    fireEvent.blur(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('renders only formally supported indicator cards', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)

    expect(screen.getByText('Saldo de Caixa')).toBeInTheDocument()
    expect(screen.getAllByText('Receita Bruta').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Receita Líquida').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Custos')).toBeInTheDocument()
    expect(screen.getByText('Despesas')).toBeInTheDocument()
    expect(screen.getAllByText('Liquidez Corrente').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Endividamento')).not.toBeInTheDocument()
    expect(screen.queryByText('Gastos Operacionais')).not.toBeInTheDocument()
  })

  it('renders the accepted March values without mixing BP YTD result', () => {
    vi.mocked(useFinancialDashboard).mockReturnValue({
      data: {
        ...mockDashboard,
        period: { from: '2026-03-01', to: '2026-03-31', as_of_date: '2026-03-31' },
        cashflow: { ...mockDashboard.cashflow, closing_balance: 18187.58 },
        income_statement: {
          ...mockDashboard.income_statement,
          revenue: 75591.68, net_revenue: 75591.68, cogs: 24213.78,
          opex: 29253.29, net_result: 22124.61,
        },
      }, isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useFinancialDashboard>)

    render(<MemoryRouter initialEntries={['/finance?year=2026&month=3']}><FinanceDashboardPage /></MemoryRouter>)

    expect(screen.getAllByText('R$ 18.187,58').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('R$ 75.591,68').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('R$ 24.213,78').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('R$ 29.253,29').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('R$ 22.124,61').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('R$ 20.039,82')).not.toBeInTheDocument()
  })

  it('uses an em dash for zero or sign-inverting previous comparisons', () => {
    vi.mocked(useFinancialDashboard).mockImplementation((filters) => ({
      data: filters?.from === '2026-07-01'
        ? { ...mockDashboard, income_statement: { ...mockDashboard.income_statement, net_result: 0 } }
        : { ...mockDashboard, income_statement: { ...mockDashboard.income_statement, net_result: -100 } },
      isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useFinancialDashboard>))

    render(<MemoryRouter initialEntries={['/finance?year=2026&month=8']}><FinanceDashboardPage /></MemoryRouter>)

    expect(screen.getAllByText('— vs mês anterior').length).toBeGreaterThanOrEqual(1)
  })

  it('renders EBITDA and margins', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getAllByText('EBITDA').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Margem EBITDA')).toBeInTheDocument()
    expect(screen.getByText('Margem Líquida')).toBeInTheDocument()
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
    expect(screen.getByText('Resultado do Período')).toBeInTheDocument()
    expect(screen.getAllByText('Receita Bruta').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('(-) Deduções')).toBeInTheDocument()
  })

  it('renders balance sheet section', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Posição Patrimonial')).toBeInTheDocument()
    expect(screen.getByText('Ativo Total')).toBeInTheDocument()
    expect(screen.getByText('Patrimônio Líquido')).toBeInTheDocument()
  })

  it('renders statement links', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Demonstrações Financeiras')).toBeInTheDocument()
    expect(screen.getByText('DRE')).toBeInTheDocument()
    expect(screen.getByText('DFC')).toBeInTheDocument()
    expect(screen.getByText('Balanço Patrimonial')).toBeInTheDocument()
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
    expect(screen.getByText(/Recebíveis vencidos/)).toBeInTheDocument()
  })

  it('shows warning for overdue payables', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText(/Pagáveis vencidos/)).toBeInTheDocument()
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
    expect(screen.queryByText(/Recebíveis vencidos/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Pagáveis vencidos/)).not.toBeInTheDocument()
  })

  it('renders quick action buttons', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('+ Receita')).toBeInTheDocument()
    expect(screen.getByText('+ Despesa')).toBeInTheDocument()
    expect(screen.getByText('Transferir')).toBeInTheDocument()
    expect(screen.getByText('Ver lançamentos')).toBeInTheDocument()
  })

  it('quick actions navigate to transactions', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    const receitaBtn = screen.getByText('+ Receita')
    expect(receitaBtn).toBeDefined()
    const despBtn = screen.getByText('+ Despesa')
    expect(despBtn).toBeDefined()
    const transfBtn = screen.getByText('Transferir')
    expect(transfBtn).toBeDefined()
    const verBtn = screen.getByText('Ver lançamentos')
    expect(verBtn).toBeDefined()
  })

  it('renders Saídas realizadas and Saídas previstas', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Saídas realizadas')).toBeInTheDocument()
    expect(screen.getByText('Saídas previstas')).toBeInTheDocument()
  })

  it('renders Resultado do Período section', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Resultado do Período')).toBeInTheDocument()
    expect(screen.getByText('(-) Deduções')).toBeInTheDocument()
    expect(screen.getByText('(-) Custos dos Serviços')).toBeInTheDocument()
  })

  it('renders Passivo Não Circulante', () => {
    render(<MemoryRouter><FinanceDashboardPage /></MemoryRouter>)
    expect(screen.getByText('Passivo Não Circulante')).toBeInTheDocument()
  })
})
