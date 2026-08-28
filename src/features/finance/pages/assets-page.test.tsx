import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AssetsPage from './assets-page'

// Mock the API modules
vi.mock('../api/finance-api', () => ({
  fetchAssets: vi.fn().mockResolvedValue([]),
  fetchAsset: vi.fn().mockResolvedValue(null),
  createAsset: vi.fn().mockResolvedValue('new-id'),
  updateAsset: vi.fn().mockResolvedValue(undefined),
  disposeAsset: vi.fn().mockResolvedValue(undefined),
  postAssetDepreciation: vi.fn().mockResolvedValue('post-id'),
  fetchChartAccounts: vi.fn().mockResolvedValue([]),
  fetchCostCenters: vi.fn().mockResolvedValue([]),
  fetchServiceLines: vi.fn().mockResolvedValue([]),
}))

vi.mock('../queries/finance-queries', () => ({
  useAssets: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useAssetDetail: vi.fn().mockReturnValue({ data: null }),
  useCreateAsset: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateAsset: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }),
  useDisposeAsset: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
  usePostDepreciation: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
  useChartAccounts: vi.fn().mockReturnValue({ data: [] }),
  useCostCenters: vi.fn().mockReturnValue({ data: [] }),
  useServiceLines: vi.fn().mockReturnValue({ data: [] }),
}))

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AssetsPage />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('AssetsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page title', () => {
    renderPage()
    expect(screen.getByText('Ativos e Bens')).toBeDefined()
  })

  it('shows the create button', () => {
    renderPage()
    expect(screen.getByText('+ Novo bem')).toBeDefined()
  })

  it('shows empty state when no assets', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Nenhum ativo encontrado')).toBeDefined()
    })
  })

  it('shows summary cards', () => {
    renderPage()
    expect(screen.getByText('Total de bens')).toBeDefined()
    expect(screen.getByText('Custo historico')).toBeDefined()
    expect(screen.getByText('Dep. acumulada')).toBeDefined()
    expect(screen.getByText('Valor líquido')).toBeDefined()
  })

  it('has search input', () => {
    renderPage()
    expect(screen.getByPlaceholderText('Buscar por codigo, nome ou categoria...')).toBeDefined()
  })

  it('has status filter', () => {
    renderPage()
    expect(screen.getByDisplayValue('Todos os status')).toBeDefined()
  })

  it('has table headers', () => {
    renderPage()
    expect(screen.getByText('Codigo')).toBeDefined()
    expect(screen.getByText('Bem')).toBeDefined()
    expect(screen.getByText('Status')).toBeDefined()
    expect(screen.getByText('Acoes')).toBeDefined()
  })
})
