import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-context'
import { useQuotations } from '@/features/pricing/quotations/quotation.queries'
import { useClientLists } from '@/features/crm/queries/client-queries'

import HomePage, { getGreetingByHour } from './home-page'

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/features/pricing/quotations/quotation.queries', () => ({
  useQuotations: vi.fn(),
}))

vi.mock('@/features/crm/queries/client-queries', () => ({
  useClientLists: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuth)
const mockUseQuotations = vi.mocked(useQuotations)
const mockUseClientLists = vi.mocked(useClientLists)

function setupHome() {
  mockUseAuth.mockReturnValue({
    session: { user: { id: 'u1' } } as never,
    user: { id: 'u1', email: 'test@test.com' } as never,
    profile: { id: 'u1', role: 'admin', full_name: 'Joao Silva' } as never,
    loading: false,
    profileError: null,
    refreshProfile: vi.fn(),
  })
  mockUseQuotations.mockReturnValue({ data: [], isLoading: false, isError: false } as never)
  mockUseClientLists.mockReturnValue({ data: [], isLoading: false, isError: false } as never)
}

describe('getGreetingByHour', () => {
  it('returns Bom dia for morning hours', () => {
    expect(getGreetingByHour(0)).toBe('Bom dia')
    expect(getGreetingByHour(8)).toBe('Bom dia')
    expect(getGreetingByHour(11)).toBe('Bom dia')
  })

  it('returns Boa tarde for afternoon hours', () => {
    expect(getGreetingByHour(12)).toBe('Boa tarde')
    expect(getGreetingByHour(14)).toBe('Boa tarde')
    expect(getGreetingByHour(17)).toBe('Boa tarde')
  })

  it('returns Boa noite for evening hours', () => {
    expect(getGreetingByHour(18)).toBe('Boa noite')
    expect(getGreetingByHour(20)).toBe('Boa noite')
    expect(getGreetingByHour(23)).toBe('Boa noite')
  })
})

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders greeting with first name', () => {
    setupHome()
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    expect(screen.getByText(/Joao/)).toBeInTheDocument()
  })

  it('renders metrics without fake numbers', () => {
    setupHome()
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    expect(screen.getByText('Cotações abertas')).toBeInTheDocument()
    expect(screen.getByText('Clientes ativos')).toBeInTheDocument()
    const modulosLabels = screen.getAllByText('Módulos')
    expect(modulosLabels.length).toBeGreaterThanOrEqual(1)
  })

  it('renders modules grid', () => {
    setupHome()
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    const motor = screen.getAllByText('Motor de Preços')
    expect(motor.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('CRM leve')).toBeInTheDocument()
    expect(screen.getByText('Financeiro')).toBeInTheDocument()
    expect(screen.getByText('Transações')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('shows module status badges with accents', () => {
    setupHome()
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    const availableBadges = screen.getAllByText('Disponível')
    expect(availableBadges.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Planejado')).toBeInTheDocument()
  })

  it('shows loading skeletons for metrics', () => {
    setupHome()
    mockUseQuotations.mockReturnValue({ data: undefined, isLoading: true, isError: false } as never)
    mockUseClientLists.mockReturnValue({ data: undefined, isLoading: true, isError: false } as never)
    const { container } = render(<MemoryRouter><HomePage /></MemoryRouter>)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  it('shows error state when quotation query fails', () => {
    setupHome()
    mockUseQuotations.mockReturnValue({ data: undefined, isLoading: false, isError: true } as never)
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    expect(screen.getByText('Não foi possível carregar')).toBeInTheDocument()
  })

  it('shows error state when client query fails', () => {
    setupHome()
    mockUseClientLists.mockReturnValue({ data: undefined, isLoading: false, isError: true } as never)
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    expect(screen.getByText('Não foi possível carregar')).toBeInTheDocument()
  })
})
