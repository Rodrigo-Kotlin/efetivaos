import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-context'
import { useUiStore } from '@/stores/ui-store'

import AppShell from './app-shell'

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/features/auth/auth.service', () => ({
  signOut: vi.fn(),
}))

vi.mock('@/stores/ui-store', () => ({
  useUiStore: vi.fn(),
}))

vi.mock('@/components/shared/logo', () => ({
  Logo: ({ compact }: { compact?: boolean }) => <div data-testid="logo" data-compact={compact} />,
}))

vi.mock('@/components/shared/offline-banner', () => ({
  OfflineBanner: () => <div data-testid="offline-banner" />,
}))

const mockUseAuth = vi.mocked(useAuth)
const mockUseUiStore = vi.mocked(useUiStore)

function setupAuth(role: 'admin' | 'equipe' = 'admin') {
  mockUseAuth.mockReturnValue({
    session: { user: { id: 'u1' } } as never,
    user: { id: 'u1', email: 'test@test.com' } as never,
    profile: { id: 'u1', role, full_name: 'Test User' } as never,
    loading: false,
    profileError: null,
    refreshProfile: vi.fn(),
  })
  mockUseUiStore.mockImplementation((selector: (state: { sidebarCollapsed: boolean; toggleSidebar: () => void }) => unknown) => {
    return selector({ sidebarCollapsed: false, toggleSidebar: vi.fn() }) as never
  })
}

function renderShell(pathname = '/') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppShell />
    </MemoryRouter>,
  )
}

describe('AppShell sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders navigation groups', () => {
    setupAuth()
    renderShell()
    expect(screen.getByText('Principal')).toBeInTheDocument()
    expect(screen.getByText('Comercial')).toBeInTheDocument()
    expect(screen.getByText('Financeiro')).toBeInTheDocument()
    expect(screen.getByText('Demonstrações')).toBeInTheDocument()
    expect(screen.getByText('Patrimônio e Controle')).toBeInTheDocument()
    expect(screen.getByText('Cadastros')).toBeInTheDocument()
  })

  it('auto-expands group containing active route', () => {
    setupAuth()
    renderShell('/finance/dre')
    expect(screen.getByText('Demonstrações')).toBeInTheDocument()
    expect(screen.getByText('DRE')).toBeVisible()
  })

  it('shows adminOnly items for admin', async () => {
    setupAuth('admin')
    renderShell('/pricing/rules')
    const user = userEvent.setup()
    await user.click(screen.getByText('Comercial'))
    await user.click(screen.getByText('Patrimônio e Controle'))
    expect(screen.getByText('Regras de Preço')).toBeInTheDocument()
    expect(screen.getByText('Ajustes')).toBeInTheDocument()
  })

  it('hides adminOnly items for equipe', () => {
    setupAuth('equipe')
    renderShell()
    expect(screen.queryByText('Regras de Preço')).not.toBeInTheDocument()
    expect(screen.queryByText('Ajustes')).not.toBeInTheDocument()
  })

  it('collapses group on header click', async () => {
    setupAuth()
    renderShell('/')
    const user = userEvent.setup()
    const financeiroButton = screen.getByRole('button', { name: /Financeiro/i })
    await user.click(financeiroButton)
    expect(screen.getByText('Lançamentos')).toBeVisible()
    await user.click(financeiroButton)
    expect(screen.queryByText('Lançamentos')).not.toBeInTheDocument()
  })

  it('sidebar collapsed hides group labels', () => {
    setupAuth()
    mockUseUiStore.mockImplementation((selector: (state: { sidebarCollapsed: boolean; toggleSidebar: () => void }) => unknown) => {
      return selector({ sidebarCollapsed: true, toggleSidebar: vi.fn() }) as never
    })
    renderShell()
    expect(screen.queryByText('Principal')).not.toBeInTheDocument()
    expect(screen.queryByText('Comercial')).not.toBeInTheDocument()
  })

  it('sidebar collapsed hides item text', () => {
    setupAuth()
    mockUseUiStore.mockImplementation((selector: (state: { sidebarCollapsed: boolean; toggleSidebar: () => void }) => unknown) => {
      return selector({ sidebarCollapsed: true, toggleSidebar: vi.fn() }) as never
    })
    renderShell()
    expect(screen.queryByText('Início')).not.toBeInTheDocument()
    expect(screen.queryByText('Motor de Preços')).not.toBeInTheDocument()
  })

  it('active group opens automatically on route change', () => {
    setupAuth()
    renderShell('/finance/dre')
    expect(screen.getByText('Demonstrações')).toBeInTheDocument()
    expect(screen.getByText('DRE')).toBeVisible()
  })

  it('manual close of active group removes other items but keeps active item', async () => {
    setupAuth()
    renderShell('/finance/dre')
    const user = userEvent.setup()
    const demosButton = screen.getByRole('button', { name: /Demonstrações/i })
    expect(screen.getByText('DRE')).toBeInTheDocument()
    await user.click(demosButton)
    expect(screen.queryByText('DFC')).not.toBeInTheDocument()
    expect(screen.getByText('DRE')).toBeInTheDocument()
  })
})
