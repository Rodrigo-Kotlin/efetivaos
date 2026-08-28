import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BalanceSheetPage from './balance-sheet-page'

vi.mock('../queries/finance-queries', () => ({
  useBalanceSheet: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}))

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <BalanceSheetPage />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('BalanceSheetPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page title', () => {
    renderPage()
    expect(screen.getByText(/Balan/)).toBeDefined()
  })

  it('shows date filter', () => {
    renderPage()
    expect(screen.getByText('Data de referencia')).toBeDefined()
  })

  it('shows empty state when no data', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Nenhum dado encontrado para a data selecionada.')).toBeDefined()
    })
  })

  it('does not show indicators when no data', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.queryByText('Capital Circulante Líquido')).toBeNull()
    })
  })
})

describe('BalanceSheetPage with data', () => {
  const mockRows = [
    { row_code: '1.1', label: 'Caixa', class: 'ATIVO', group_name: 'Circulante', amount: '5000', sort_order: 1, level: 2, row_type: 'DETAIL', presentation_sign: 1 },
    { row_code: '1.2', label: 'Imobilizado', class: 'ATIVO', group_name: 'Imobilizado', amount: '10000', sort_order: 2, level: 2, row_type: 'DETAIL', presentation_sign: 1 },
    { row_code: '1.3', label: 'Dep. Acumulada', class: 'ATIVO', group_name: 'Imobilizado', amount: '-2000', sort_order: 3, level: 2, row_type: 'DETAIL', presentation_sign: -1 },
    { row_code: 'T1', label: 'TOTAL ATIVO', class: 'ATIVO', group_name: '', amount: '13000', sort_order: 4, level: 0, row_type: 'TOTAL', presentation_sign: 1 },
    { row_code: '2.1', label: 'Fornecedores', class: 'PASSIVO', group_name: 'Circulante', amount: '3000', sort_order: 5, level: 2, row_type: 'DETAIL', presentation_sign: 1 },
    { row_code: 'T2', label: 'TOTAL PASSIVO', class: 'PASSIVO', group_name: '', amount: '3000', sort_order: 6, level: 0, row_type: 'TOTAL', presentation_sign: 1 },
    { row_code: '3.1', label: 'Capital Social', class: 'PL', group_name: 'Patrimônio Líquido', amount: '8000', sort_order: 7, level: 2, row_type: 'DETAIL', presentation_sign: 1 },
    { row_code: 'RE', label: 'Resultado do Exercicio', class: 'PL', group_name: 'Resultados Acumulados', amount: '2000', sort_order: 8, level: 2, row_type: 'DETAIL', presentation_sign: 1 },
    { row_code: 'T3', label: 'TOTAL PL', class: 'PL', group_name: '', amount: '10000', sort_order: 9, level: 0, row_type: 'TOTAL', presentation_sign: 1 },
  ]

  it('renders totals correctly', async () => {
    const { useBalanceSheet } = await import('../queries/finance-queries')
    vi.mocked(useBalanceSheet).mockReturnValue({ data: mockRows, isLoading: false } as ReturnType<typeof useBalanceSheet>)

    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Total Ativo')).toBeDefined()
      expect(screen.getByText('Total Passivo')).toBeDefined()
      expect(screen.getByText('Patrimônio Líquido')).toBeDefined()
    })
  })

  it('shows balanced badge when equation holds', async () => {
    const { useBalanceSheet } = await import('../queries/finance-queries')
    vi.mocked(useBalanceSheet).mockReturnValue({ data: mockRows, isLoading: false } as ReturnType<typeof useBalanceSheet>)

    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Balancado')).toBeDefined()
    })
  })

  it('shows ATIVO section', async () => {
    const { useBalanceSheet } = await import('../queries/finance-queries')
    vi.mocked(useBalanceSheet).mockReturnValue({ data: mockRows, isLoading: false } as ReturnType<typeof useBalanceSheet>)

    renderPage()
    await waitFor(() => {
      expect(screen.getByText('ATIVO')).toBeDefined()
    })
  })

  it('shows PASSIVO section', async () => {
    const { useBalanceSheet } = await import('../queries/finance-queries')
    vi.mocked(useBalanceSheet).mockReturnValue({ data: mockRows, isLoading: false } as ReturnType<typeof useBalanceSheet>)

    renderPage()
    await waitFor(() => {
      expect(screen.getByText('PASSIVO')).toBeDefined()
    })
  })

  it('shows equation formula', async () => {
    const { useBalanceSheet } = await import('../queries/finance-queries')
    vi.mocked(useBalanceSheet).mockReturnValue({ data: mockRows, isLoading: false } as ReturnType<typeof useBalanceSheet>)

    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Equacao patrimonial/)).toBeDefined()
    })
  })

  it('shows indicator labels', async () => {
    const { useBalanceSheet } = await import('../queries/finance-queries')
    vi.mocked(useBalanceSheet).mockReturnValue({ data: mockRows, isLoading: false } as ReturnType<typeof useBalanceSheet>)

    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Capital Circulante Líquido')).toBeDefined()
      expect(screen.getByText('Liquidez Corrente')).toBeDefined()
      expect(screen.getByText('Endividamento Geral')).toBeDefined()
      expect(screen.getByText('Capital de Terceiros')).toBeDefined()
    })
  })

  it('shows balanced equation', async () => {
    const { useBalanceSheet } = await import('../queries/finance-queries')
    vi.mocked(useBalanceSheet).mockReturnValue({ data: mockRows, isLoading: false } as ReturnType<typeof useBalanceSheet>)

    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Balancado')).toBeDefined()
    })
  })
})
