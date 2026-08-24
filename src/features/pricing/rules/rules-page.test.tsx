import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import RulesPage from './rules-page'
import { useAuth } from '@/features/auth/auth-context'
import { useCatalogCategories } from '@/features/pricing/catalog/catalog.queries'
import { useCatalogItems } from '@/features/pricing/catalog/catalog.queries'
import { useCreateRule, useRules, useSetRuleActive, useUpdateRule } from './rules-queries'

vi.mock('./rules-queries', () => ({
  useRules: vi.fn(),
  useCreateRule: vi.fn(),
  useUpdateRule: vi.fn(),
  useSetRuleActive: vi.fn(),
}))

vi.mock('@/features/pricing/catalog/catalog.queries', () => ({
  useCatalogCategories: vi.fn(),
  useCatalogItems: vi.fn(),
}))

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}))

const baseRules = [
  {
    id: 'rule-global',
    scope_type: 'global' as const,
    category_id: null,
    catalog_item_id: null,
    calculation_type: 'percentage' as const,
    value: '20.0000',
    active: true,
    notes: 'Padrao geral',
    updated_at: '2026-08-23T00:00:00Z',
    category: null,
    catalog_item: null,
  },
  {
    id: 'rule-category',
    scope_type: 'category' as const,
    category_id: 'cat-laboratoriais',
    catalog_item_id: null,
    calculation_type: 'fixed' as const,
    value: '25.0000',
    active: true,
    notes: null,
    updated_at: '2026-08-22T00:00:00Z',
    category: { id: 'cat-laboratoriais', name: 'Laboratoriais', active: true },
    catalog_item: null,
  },
]

const baseCategories = [
  { id: 'cat-laboratoriais', name: 'Laboratoriais', active: true, updated_at: '2026-08-23' },
  { id: 'cat-bioquimica', name: 'Bioquimica', active: true, updated_at: '2026-08-23' },
]

const baseItems = [
  { id: 'item-1', code: 'EXA-001', name: 'Hemograma', unit: 'exame', description: null, active: true, updated_at: '2026-08-23', category: { id: 'cat-laboratoriais', name: 'Laboratoriais', active: true } },
]

function renderPage() {
  return render(<MemoryRouter><RulesPage /></MemoryRouter>)
}

function mockAdmin() {
  vi.mocked(useAuth).mockReturnValue({ profile: { id: 'admin', full_name: 'Admin', role: 'admin', active: true, created_at: '', created_by: null, updated_at: '', updated_by: null }, user: null, session: null, loading: false, profileError: null, refreshProfile: vi.fn() } as unknown as ReturnType<typeof useAuth>)
}

function mockEquipe() {
  vi.mocked(useAuth).mockReturnValue({ profile: { id: 'equipe', full_name: 'Equipe', role: 'equipe', active: true, created_at: '', created_by: null, updated_at: '', updated_by: null }, user: null, session: null, loading: false, profileError: null, refreshProfile: vi.fn() } as unknown as ReturnType<typeof useAuth>)
}

describe('RulesPage', () => {
  const refetch = vi.fn()
  const createMock = { mutateAsync: vi.fn(), isPending: false }
  const updateMock = { mutateAsync: vi.fn(), isPending: false }
  const setActiveMock = { mutateAsync: vi.fn(), isPending: false }

  beforeEach(() => {
    vi.mocked(useRules).mockReturnValue({ data: baseRules, isLoading: false, isError: false, refetch } as unknown as ReturnType<typeof useRules>)
    vi.mocked(useCatalogCategories).mockReturnValue({ data: baseCategories, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useCatalogCategories>)
    vi.mocked(useCatalogItems).mockReturnValue({ data: baseItems, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useCatalogItems>)
    vi.mocked(useCreateRule).mockReturnValue(createMock as unknown as ReturnType<typeof useCreateRule>)
    vi.mocked(useUpdateRule).mockReturnValue(updateMock as unknown as ReturnType<typeof useUpdateRule>)
    vi.mocked(useSetRuleActive).mockReturnValue(setActiveMock as unknown as ReturnType<typeof useSetRuleActive>)
    createMock.mutateAsync.mockReset().mockResolvedValue(baseRules[0])
    updateMock.mutateAsync.mockReset().mockResolvedValue(baseRules[0])
    setActiveMock.mutateAsync.mockReset().mockResolvedValue(baseRules[0])
  })

  afterEach(() => vi.restoreAllMocks())

  it('exibe loading enquanto as regras nao retornam', () => {
    mockAdmin()
    vi.mocked(useRules).mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch } as unknown as ReturnType<typeof useRules>)
    renderPage()
    expect(screen.getByRole('status', { name: 'Carregando registros' })).toBeInTheDocument()
  })

  it('mostra empty state com CTA para criar primeira regra', () => {
    mockAdmin()
    vi.mocked(useRules).mockReturnValue({ data: [], isLoading: false, isError: false, refetch } as unknown as ReturnType<typeof useRules>)
    renderPage()
    expect(screen.getByRole('heading', { name: 'Nenhuma regra de acrescimo configurada' })).toBeInTheDocument()
  })

  it('exibe restricao de acesso para Equipe sem botoes de edicao', () => {
    mockEquipe()
    renderPage()
    expect(screen.getByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nova regra/i })).not.toBeInTheDocument()
  })

  it('Admin ve tabela com escopo, tipo, valor e status', () => {
    mockAdmin()
    renderPage()
    const table = within(screen.getByRole('table', { name: 'Regras de acrescimo' }))
    expect(table.getAllByText('Global').length).toBeGreaterThan(0)
    expect(table.getAllByText('Categoria').length).toBeGreaterThan(0)
    expect(table.getByText('20%')).toBeInTheDocument()
    expect(table.getByText('R$ 25,00')).toBeInTheDocument()
    expect(table.getAllByText('Ativa').length).toBe(2)
  })

  it('filtra por escopo e status', async () => {
    mockAdmin()
    const user = userEvent.setup()
    renderPage()
    const table = within(screen.getByRole('table', { name: 'Regras de acrescimo' }))
    expect(table.getAllByText('20%').length).toBeGreaterThan(0)

    const scopeSelect = screen.getByLabelText('Filtrar por escopo')
    const statusSelect = screen.getByLabelText('Filtrar por status')

    await user.selectOptions(scopeSelect, 'global')
    expect(table.queryByText('R$ 25,00')).not.toBeInTheDocument()
    await user.selectOptions(scopeSelect, 'all')
    await user.selectOptions(statusSelect, 'active')
    expect(table.getAllByText('20%').length).toBeGreaterThan(0)
  })

  it('inativa regra ativa via botao de acao', async () => {
    mockAdmin()
    const user = userEvent.setup()
    renderPage()
    const deactivateButtons = screen.getAllByRole('button', { name: /Inativar regra/ })
    expect(deactivateButtons.length).toBeGreaterThan(0)
    await user.click(deactivateButtons[0])
    expect(setActiveMock.mutateAsync).toHaveBeenCalledWith({ id: 'rule-global', active: false })
  })
})
