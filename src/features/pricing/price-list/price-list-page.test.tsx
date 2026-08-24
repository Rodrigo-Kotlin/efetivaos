import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-context'
import { useCatalogCategories } from '@/features/pricing/catalog/catalog.queries'
import { useComparison } from '@/features/pricing/comparison/comparison-queries'

import PriceListPage from './price-list-page'

vi.mock('@/features/auth/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('@/features/pricing/catalog/catalog.queries', () => ({ useCatalogCategories: vi.fn() }))
vi.mock('@/features/pricing/comparison/comparison-queries', () => ({
  useComparison: vi.fn(),
  useComparisonOffers: vi.fn(() => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() })),
  useApprovePrice: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useInactivatePrice: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

const approvedRow = {
  catalog_item_id: 'item-1', catalog_item_active: true, code: 'EXA-001', item_name: 'Hemograma', unit: 'exame', category_id: 'cat-1', category_name: 'Laboratoriais',
  best_quotation_item_id: 'qi-1', best_cost: '15.50', best_supplier_id: 'sup-1', best_supplier_name: 'Lab Norte', best_valid_until: '2026-12-31', best_validity_not_informed: false, eligible_offer_count: 1,
  resolved_margin_rule_id: 'rule-1', resolved_rule_scope: 'global', resolved_adjustment_type: 'percentage', resolved_adjustment_value: '20.00', suggested_price: '18.60',
  price_list_id: 'price-1', approved_cost_price: '15.50', approved_final_price: '18.60', approved_adjustment_type: 'percentage', approved_adjustment_value: '20.00', manual_source: false,
  approved_at: '2026-08-24T12:00:00Z', approved_by: 'admin-1', approved_source_quotation_item_id: 'qi-1', approved_quotation_id: 'quotation-1', approved_quotation_reference: 'COT-001', approved_supplier_id: 'sup-1', approved_supplier_name: 'Lab Norte', approved_source_valid_until: '2026-12-31',
  effective_status: 'approved', review_reason: null, persisted_status: 'approved', approved_margin_rule_id: 'rule-1', best_quotation_item_id_at_approval: 'qi-1', best_cost_at_approval: '15.50', decision_token: 'token-1',
}

const inactiveRow = {
  ...approvedRow,
  catalog_item_id: 'item-2', catalog_item_active: false, code: 'EXA-002', item_name: 'Glicemia',
  price_list_id: 'price-2', approved_final_price: '8.50', approved_at: '2026-08-20T12:00:00Z',
  approved_supplier_id: 'sup-2', approved_supplier_name: 'BioLab', approved_source_valid_until: null,
  manual_source: true, effective_status: 'review_required', review_reason: 'approved_source_ineligible',
}

describe('PriceListPage', () => {
  beforeEach(() => {
    vi.mocked(useComparison).mockReturnValue({ data: [approvedRow], isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useComparison>)
    vi.mocked(useCatalogCategories).mockReturnValue({ data: [{ id: 'cat-1', name: 'Laboratoriais' }], isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useCatalogCategories>)
    vi.mocked(useAuth).mockReturnValue({ profile: { role: 'equipe' } } as unknown as ReturnType<typeof useAuth>)
  })

  it('exibe somente o valor comercial aprovado com fonte e status', () => {
    render(<MemoryRouter><PriceListPage /></MemoryRouter>)
    const table = within(screen.getByRole('table', { name: 'Tabela de Precos' }))
    expect(table.getByText(/18,60/)).toBeInTheDocument()
    expect(table.getByText('Automatica')).toBeInTheDocument()
    expect(table.getByText('Aprovado')).toBeInTheDocument()
  })

  it('filtra por fonte sem confundir sugestoes com precos comerciais', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><PriceListPage /></MemoryRouter>)
    await user.selectOptions(screen.getByLabelText('Filtrar tabela por fonte'), 'manual')
    expect(screen.getByRole('heading', { name: 'Nenhum preco encontrado' })).toBeInTheDocument()
  })

  it('preserva preco aprovado de item inativo e identifica catalogo e validade da fonte', () => {
    vi.mocked(useComparison).mockReturnValue({ data: [approvedRow, inactiveRow], isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useComparison>)
    render(<MemoryRouter><PriceListPage /></MemoryRouter>)
    const table = within(screen.getByRole('table', { name: 'Tabela de Precos' }))
    expect(table.getByText('Glicemia')).toBeInTheDocument()
    expect(table.getByText('Catalogo inativo')).toBeInTheDocument()
    expect(table.getByText('Validade nao informada')).toBeInTheDocument()
    expect(table.getByText('Fonte vigente')).toBeInTheDocument()
  })

  it('filtra pelo fornecedor aprovado', async () => {
    vi.mocked(useComparison).mockReturnValue({ data: [approvedRow, inactiveRow], isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useComparison>)
    render(<MemoryRouter><PriceListPage /></MemoryRouter>)
    await userEvent.selectOptions(screen.getByLabelText('Filtrar tabela por fornecedor'), 'sup-2')
    const table = within(screen.getByRole('table', { name: 'Tabela de Precos' }))
    expect(table.getByText('Glicemia')).toBeInTheDocument()
    expect(table.queryByText('Hemograma')).not.toBeInTheDocument()
  })

  it('ordena por preco final e alterna a direcao', async () => {
    vi.mocked(useComparison).mockReturnValue({ data: [approvedRow, inactiveRow], isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useComparison>)
    render(<MemoryRouter><PriceListPage /></MemoryRouter>)
    await userEvent.selectOptions(screen.getByLabelText('Ordenar tabela de precos por'), 'final_price')
    let rows = within(screen.getByRole('table', { name: 'Tabela de Precos' })).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Glicemia')
    await userEvent.click(screen.getByRole('button', { name: 'Ordem crescente' }))
    rows = within(screen.getByRole('table', { name: 'Tabela de Precos' })).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Hemograma')
  })
})
