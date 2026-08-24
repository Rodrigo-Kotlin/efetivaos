import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-context'
import { useComparison } from '@/features/pricing/comparison/comparison-queries'
import PricingPage from '@/features/pricing/pricing-page'
import { useQuotations } from '@/features/pricing/quotations/quotation.queries'

vi.mock('@/features/auth/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('@/features/pricing/comparison/comparison-queries', () => ({ useComparison: vi.fn() }))
vi.mock('@/features/pricing/quotations/quotation.queries', () => ({ useQuotations: vi.fn() }))

const comparison = [
  {
    catalog_item_id: 'item-approved', catalog_item_active: true, code: 'EXA-001', item_name: 'Hemograma', category_name: 'Laboratorial',
    best_cost: '10.00', best_supplier_name: 'Lab Norte', eligible_offer_count: 2, resolved_margin_rule_id: 'rule-1', effective_status: 'approved',
  },
  {
    catalog_item_id: 'item-review', catalog_item_active: true, code: 'EXA-002', item_name: 'Glicemia', category_name: 'Laboratorial',
    best_cost: '12.00', best_supplier_name: 'Lab Sul', eligible_offer_count: 1, resolved_margin_rule_id: 'rule-1', effective_status: 'review_required',
  },
  {
    catalog_item_id: 'item-empty', catalog_item_active: true, code: 'EXA-003', item_name: 'Audiometria', category_name: 'Ocupacional',
    best_cost: null, best_supplier_name: null, eligible_offer_count: 0, resolved_margin_rule_id: null, effective_status: 'no_cost',
  },
]

function queryResult(data: unknown, overrides = {}) {
  return { data, isLoading: false, isError: false, refetch: vi.fn(), ...overrides }
}

describe('PricingPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'))
    vi.mocked(useAuth).mockReturnValue({
      profile: { id: 'user-1', full_name: 'Usuario Teste', role: 'equipe', active: true, created_at: '', created_by: null, updated_at: '', updated_by: null },
      user: { email: 'equipe@example.com' },
    } as ReturnType<typeof useAuth>)
    vi.mocked(useComparison).mockReturnValue(queryResult(comparison) as unknown as ReturnType<typeof useComparison>)
    vi.mocked(useQuotations).mockReturnValue(queryResult([
      { id: 'quotation-1', status: 'active', valid_until: '2026-08-30' },
      { id: 'quotation-2', status: 'active', valid_until: '2026-09-10' },
      { id: 'quotation-3', status: 'cancelled', valid_until: '2026-08-29' },
    ]) as unknown as ReturnType<typeof useQuotations>)
  })

  afterEach(() => vi.useRealTimers())

  it('exibe indicadores autoritativos e oculta o atalho de regras da Equipe', () => {
    render(<MemoryRouter><PricingPage /></MemoryRouter>)

    expect(screen.getByText('Preços aprovados').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Em revisão').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Itens sem regra').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Itens sem oferta vigente').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Cotações vencendo em 7 dias').nextElementSibling).toHaveTextContent('1')
    expect(screen.queryByRole('heading', { name: 'Regras de preço' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fornecedores' })).toBeInTheDocument()
  })

  it('mostra skeletons sem renderizar zeros durante o carregamento', () => {
    vi.mocked(useComparison).mockReturnValue(queryResult(undefined, { isLoading: true }) as unknown as ReturnType<typeof useComparison>)
    render(<MemoryRouter><PricingPage /></MemoryRouter>)

    expect(screen.getAllByLabelText('Carregando indicador')).toHaveLength(5)
    expect(screen.queryByText('Preços aprovados')).not.toBeInTheDocument()
  })

  it('repete as duas consultas quando o dashboard falha', () => {
    const comparisonRefetch = vi.fn()
    const quotationsRefetch = vi.fn()
    vi.mocked(useComparison).mockReturnValue(queryResult(undefined, { isError: true, refetch: comparisonRefetch }) as unknown as ReturnType<typeof useComparison>)
    vi.mocked(useQuotations).mockReturnValue(queryResult(undefined, { isError: true, refetch: quotationsRefetch }) as unknown as ReturnType<typeof useQuotations>)
    render(<MemoryRouter><PricingPage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(comparisonRefetch).toHaveBeenCalledOnce()
    expect(quotationsRefetch).toHaveBeenCalledOnce()
  })
})
