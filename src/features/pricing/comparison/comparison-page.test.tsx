import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import ComparisonPage from './comparison-page'
import { useCatalogCategories } from '@/features/pricing/catalog/catalog.queries'
import { useQuotations } from '@/features/pricing/quotations/quotation.queries'
import { useAuth } from '@/features/auth/auth-context'
import { useComparison } from './comparison-queries'

vi.mock('./comparison-queries', () => ({
  useComparison: vi.fn(),
  useComparisonOffers: vi.fn(() => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() })),
}))

vi.mock('@/features/pricing/catalog/catalog.queries', () => ({
  useCatalogCategories: vi.fn(),
}))

vi.mock('@/features/pricing/quotations/quotation.queries', () => ({
  useQuotations: vi.fn(),
}))

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}))

const baseComparison = [
  {
    catalog_item_id: 'item-1',
    code: 'EXA-001',
    item_name: 'Hemograma',
    unit: 'exame',
    category_id: 'cat-laboratoriais',
    category_name: 'Laboratoriais',
    best_quotation_item_id: 'qi-1',
    best_cost: '15.50',
    best_supplier_id: 'sup-norte',
    best_supplier_name: 'Lab Norte',
    best_valid_until: '2026-12-31',
    best_validity_not_informed: false,
    eligible_offer_count: 3,
    resolved_margin_rule_id: 'rule-1',
    resolved_rule_scope: 'global' as const,
    resolved_adjustment_type: 'percentage' as const,
    resolved_adjustment_value: '20.00',
    suggested_price: '18.60',
    effective_status: 'suggestion_available',
  },
  {
    catalog_item_id: 'item-2',
    code: 'EXA-002',
    item_name: 'Glicemia',
    unit: 'exame',
    category_id: 'cat-laboratoriais',
    category_name: 'Laboratoriais',
    best_quotation_item_id: null,
    best_cost: null,
    best_supplier_id: null,
    best_supplier_name: null,
    best_valid_until: null,
    best_validity_not_informed: null,
    eligible_offer_count: 0,
    resolved_margin_rule_id: null,
    resolved_rule_scope: null,
    resolved_adjustment_type: null,
    resolved_adjustment_value: null,
    suggested_price: null,
    effective_status: 'no_cost',
  },
  {
    catalog_item_id: 'item-3',
    code: 'EXA-003',
    item_name: 'Colesterol sem validade',
    unit: 'exame',
    category_id: 'cat-bioquimica',
    category_name: 'Bioquimica',
    best_quotation_item_id: 'qi-3',
    best_cost: '20.00',
    best_supplier_id: 'sup-sul',
    best_supplier_name: 'Clinica Sul',
    best_valid_until: null,
    best_validity_not_informed: true,
    eligible_offer_count: 1,
    resolved_margin_rule_id: 'rule-1',
    resolved_rule_scope: 'global' as const,
    resolved_adjustment_type: 'percentage' as const,
    resolved_adjustment_value: '20.00',
    suggested_price: '24.00',
    effective_status: 'suggestion_available',
  },
]

const baseCategories = [
  { id: 'cat-laboratoriais', name: 'Laboratoriais', active: true, updated_at: '2026-08-23' },
  { id: 'cat-bioquimica', name: 'Bioquimica', active: true, updated_at: '2026-08-23' },
]

const baseQuotations = [
  { id: 'q1', reference_number: 'REF-1', received_at: '2026-08-20', valid_until: '2026-09-01', status: 'active', updated_at: '2026-08-23T00:00:00Z', supplier: { id: 'sup-norte', name: 'Lab Norte' }, quotation_items: [{ id: 'qi-1' }] },
]

function renderPage() {
  return render(<MemoryRouter><ComparisonPage /></MemoryRouter>)
}

describe('ComparisonPage', () => {
  const refetch = vi.fn()
  const refetchQuotations = vi.fn()
  const refetchCategories = vi.fn()

  beforeEach(() => {
    vi.mocked(useComparison).mockReturnValue({ data: baseComparison, isLoading: false, isError: false, refetch } as unknown as ReturnType<typeof useComparison>)
    vi.mocked(useCatalogCategories).mockReturnValue({ data: baseCategories, isLoading: false, isError: false, refetch: refetchCategories } as unknown as ReturnType<typeof useCatalogCategories>)
    vi.mocked(useQuotations).mockReturnValue({ data: baseQuotations, isLoading: false, isError: false, refetch: refetchQuotations } as unknown as ReturnType<typeof useQuotations>)
    vi.mocked(useAuth).mockReturnValue({ profile: { id: 'admin', full_name: 'Admin', role: 'admin', active: true, created_at: '', created_by: null, updated_at: '', updated_by: null }, user: null, session: null, loading: false, profileError: null, refreshProfile: vi.fn() } as unknown as ReturnType<typeof useAuth>)
  })

  afterEach(() => vi.restoreAllMocks())

  it('exibe loading enquanto a consulta inicial nao retorna', () => {
    vi.mocked(useComparison).mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch } as unknown as ReturnType<typeof useComparison>)
    renderPage()
    expect(screen.getByRole('status', { name: 'Carregando registros' })).toBeInTheDocument()
  })

  it('exibe erro com retry quando a view falha', async () => {
    const user = userEvent.setup()
    vi.mocked(useComparison).mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } as unknown as ReturnType<typeof useComparison>)
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(refetch).toHaveBeenCalled()
    expect(refetchCategories).toHaveBeenCalled()
  })

  it('mostra empty state com CTA para o catalogo quando nao ha itens', () => {
    vi.mocked(useComparison).mockReturnValue({ data: [], isLoading: false, isError: false, refetch } as unknown as ReturnType<typeof useComparison>)
    renderPage()
    expect(screen.getByRole('heading', { name: 'Ainda não há itens no Catálogo Efetiva' })).toBeInTheDocument()
  })

  it('renderiza o menor custo com destaque, sem oferta, e alerta de validade', () => {
    renderPage()
    const table = within(screen.getByRole('table', { name: 'Comparacao de precos' }))
    expect(table.getAllByText('Sugestao disponivel').length).toBeGreaterThan(0)
    expect(table.getAllByText('Sem oferta vigente').length).toBeGreaterThan(0)
    expect(table.getAllByText('Validade nao informada').length).toBeGreaterThan(0)
  })

  it('abre o drawer de ofertas ao clicar em "3 ofertas"', async () => {
    const user = userEvent.setup()
    renderPage()
    const trigger = screen.getByRole('button', { name: /Ver 3 ofertas de Hemograma/i })
    await user.click(trigger)
    expect(await screen.findByRole('dialog', { name: /Hemograma/i })).toBeInTheDocument()
  })

  it('filtra por categoria, fornecedor, situacao e busca textual', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.selectOptions(screen.getByLabelText('Filtrar por categoria'), 'cat-bioquimica')
    const table = within(screen.getByRole('table', { name: 'Comparacao de precos' }))
    expect(table.queryByText('Hemograma')).not.toBeInTheDocument()
    expect(table.getByText('Colesterol sem validade')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filtrar por categoria'), 'all')
    await user.selectOptions(screen.getByLabelText('Filtrar por fornecedor'), 'sup-sul')
    expect(table.queryByText('Hemograma')).not.toBeInTheDocument()
    expect(table.getByText('Colesterol sem validade')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filtrar por fornecedor'), 'all')
    await user.selectOptions(screen.getByLabelText('Filtrar por situação da oferta'), 'no_offer')
    expect(table.queryByText('Hemograma')).not.toBeInTheDocument()
    expect(table.getByText('Glicemia')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filtrar por situação da oferta'), 'all')
    await user.type(screen.getByPlaceholderText('Buscar item, código ou fornecedor...'), 'hemograma')
    expect(table.queryByText('Glicemia')).not.toBeInTheDocument()
    expect(table.getByText('Hemograma')).toBeInTheDocument()
  })

  it('exibe empty state filtrado com botao de limpar', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText('Buscar item, código ou fornecedor...'), 'inexistente')
    expect(screen.getByRole('heading', { name: 'Nenhum item encontrado' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByPlaceholderText('Buscar item, código ou fornecedor...')).toHaveValue('')
  })
})
