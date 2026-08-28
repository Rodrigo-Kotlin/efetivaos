import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import AdjustmentsPage from './adjustments-page'
import { useChartAccounts, useCreateAdjustment } from '../queries/finance-queries'

vi.mock('../queries/finance-queries', () => ({
  useChartAccounts: vi.fn(),
  useCreateAdjustment: vi.fn(),
}))

describe('AdjustmentsPage', () => {
  beforeEach(() => {
    vi.mocked(useChartAccounts).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useChartAccounts>)
    vi.mocked(useCreateAdjustment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateAdjustment>)
  })

  it('renders adjustments title', () => {
    render(<AdjustmentsPage />)
    expect(screen.getByText('Ajustes Contabeis')).toBeInTheDocument()
  })

  it('shows info text when form is hidden', () => {
    render(<AdjustmentsPage />)
    expect(screen.getByText('Os lancamentos de ajuste criados aparecerao automaticamente em:')).toBeInTheDocument()
    expect(screen.getByText('Balanco Patrimonial (BP)')).toBeInTheDocument()
    expect(screen.getByText('Demonstração do Resultado (DRE)')).toBeInTheDocument()
  })

  it('shows form when Novo Ajuste button clicked', async () => {
    const user = userEvent.setup()
    render(<AdjustmentsPage />)
    await user.click(screen.getByText('Novo Ajuste'))
    expect(screen.getByText('Data do Lancamento *')).toBeInTheDocument()
    expect(screen.getByText('Competencia *')).toBeInTheDocument()
    expect(screen.getByText('Historico *')).toBeInTheDocument()
  })

  it('hides info when form is shown', async () => {
    const user = userEvent.setup()
    render(<AdjustmentsPage />)
    await user.click(screen.getByText('Novo Ajuste'))
    expect(screen.queryByText('Os lancamentos de ajuste criados aparecerao automaticamente em:')).not.toBeInTheDocument()
  })

  it('shows balanced indicator', async () => {
    const user = userEvent.setup()
    render(<AdjustmentsPage />)
    await user.click(screen.getByText('Novo Ajuste'))
    expect(screen.getByText('Balanceado')).toBeInTheDocument()
  })

  it('can cancel form', async () => {
    const user = userEvent.setup()
    render(<AdjustmentsPage />)
    await user.click(screen.getByText('Novo Ajuste'))
    expect(screen.getByText('Data do Lancamento *')).toBeInTheDocument()
    const cancelButtons = screen.getAllByText('Cancelar')
    await user.click(cancelButtons[0])
    expect(screen.queryByText('Data do Lancamento *')).not.toBeInTheDocument()
  })

  it('save button is disabled initially', async () => {
    const user = userEvent.setup()
    render(<AdjustmentsPage />)
    await user.click(screen.getByText('Novo Ajuste'))
    const saveBtn = screen.getByText('Salvar Ajuste')
    expect(saveBtn).toBeDisabled()
  })
})
