import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { transferableAbortController } from 'node:util'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom'

import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { useUiStore } from '@/stores/ui-store'
import type { ClientListRow, Profile } from '@/types/database'

import { router as applicationRouter } from './router'

const mocks = vi.hoisted(() => ({
  from: vi.fn(() => { throw new Error('Unexpected Supabase table access in offline navigation test') }),
  rpc: vi.fn(() => { throw new Error('Unexpected Supabase RPC in offline navigation test') }),
  getClient: vi.fn(),
  listContracts: vi.fn(),
  createContract: vi.fn(),
  updateContract: vi.fn(),
  discardDocument: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('@/lib/env', () => ({ isSupabaseConfigured: true }))
vi.mock('@/features/auth/auth.service', () => ({ signInWithPassword: vi.fn(), signOut: vi.fn() }))

// Keep the production route tree, shell, Auth guards, login, home, pricing,
// client detail and contracts UI. Only data sources and these unrelated page
// bodies are doubles; their own unit suites exercise their module behavior.
vi.mock('@/features/crm/pages/crm-page', () => ({ default: () => <h1>CRM — rota preservada</h1> }))
vi.mock('@/features/crm/pages/clients-page', () => ({
  default: () => <><h1>Clientes — rota preservada</h1><Link to="/crm/clients/client-1">Abrir cliente de regressão</Link></>,
}))
vi.mock('@/features/finance/pages/finance-dashboard-page', () => ({ default: () => <h1>Financeiro — rota preservada</h1> }))
vi.mock('@/features/finance/queries/finance-queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/finance/queries/finance-queries')>()
  return {
    ...actual,
    useCashflowStatement: () => ({ data: [], isLoading: false, isError: false }),
    useCostCenters: () => ({ data: [] }),
    useServiceLines: () => ({ data: [] }),
  }
})
vi.mock('@/features/pricing/quotations/quotation.queries', () => ({
  useQuotations: () => ({ data: [], isLoading: false, isError: false }),
}))
vi.mock('@/features/pricing/comparison/comparison-queries', () => ({
  useComparison: () => ({ data: [], isLoading: false, isError: false }),
}))
vi.mock('@/features/crm/api/clients-api', () => ({
  getClient: mocks.getClient,
  listClients: vi.fn().mockResolvedValue({ data: [], error: null }),
  createClient: vi.fn(), updateClient: vi.fn(), setClientStatus: vi.fn(),
}))
vi.mock('@/features/crm/api/contracts-api', () => ({
  listClientContracts: mocks.listContracts,
  createClientContract: mocks.createContract,
  updateClientContract: mocks.updateContract,
  discardContractDocument: mocks.discardDocument,
  archiveClientContract: vi.fn(), listContractDocuments: vi.fn(),
  listContractEvents: vi.fn(), recordContractEvent: vi.fn(),
  uploadContractDocument: vi.fn(), getContractDocumentUrl: vi.fn(),
}))

const profile: Profile = {
  id: 'user-1', full_name: 'Regressão Cleanup', role: 'admin', active: true,
  created_at: '2026-11-13T00:00:00Z', updated_at: '2026-11-13T00:00:00Z',
  created_by: null, updated_by: null,
}
const anonymous: AuthContextValue = {
  session: null, user: null, profile: null, loading: false,
  profileError: null, refreshProfile: async () => undefined,
}
const authenticated = (role: Profile['role'] = 'admin'): AuthContextValue => ({
  ...anonymous,
  session: { user: { id: profile.id } } as AuthContextValue['session'],
  user: { id: profile.id } as AuthContextValue['user'],
  profile: { ...profile, role },
})
const client = {
  id: 'client-1', legal_name: 'Cliente de regressão', client_type: 'company',
  status: 'active', country: 'Brasil',
} as unknown as ClientListRow

const sessions: Array<{ router: ReturnType<typeof createMemoryRouter>; queryClient: QueryClient }> = []
const noFetch = vi.fn(() => { throw new Error('Network is forbidden in offline navigation tests') })

function renderApplication(path: string, auth = authenticated(), previousPath?: string) {
  const router = createMemoryRouter(applicationRouter.routes, {
    initialEntries: previousPath ? [previousPath, path] : [path],
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  sessions.push({ router, queryClient })
  const tree = (value: AuthContextValue) => (
    <AuthContext.Provider value={value}>
      <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
    </AuthContext.Provider>
  )
  const view = render(tree(auth))
  return { router, authenticate: (role: Profile['role'] = 'admin') => view.rerender(tree(authenticated(role))) }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Node's Request requires a native AbortSignal, whereas jsdom replaces the
  // global AbortController. Keep their brands coherent without mocking routes
  // or allowing any fetch; this changes only the test environment.
  vi.stubGlobal('AbortController', transferableAbortController().constructor)
  vi.stubGlobal('fetch', noFetch)
  useUiStore.setState({ sidebarCollapsed: false })
  mocks.getClient.mockResolvedValue({ data: client, error: null })
  mocks.listContracts.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  for (const { router, queryClient } of sessions.splice(0)) {
    expect(queryClient.getQueryCache().getAll().filter(query => query.queryKey.includes('connect'))).toEqual([])
    router.dispose()
    queryClient.clear()
  }
  expect(mocks.from).not.toHaveBeenCalled()
  expect(mocks.rpc).not.toHaveBeenCalled()
  expect(noFetch).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})

afterAll(() => applicationRouter.dispose())

describe('legacy Connect URLs through the production route tree', () => {
  for (const role of ['admin', 'equipe'] as const) {
    it.each(['/connect', '/connect/organization-1', '/connect/organization-1?tab=legacy#messages'])(`redirects %s to authenticated home for ${role}, with no Connect query`, async (path) => {
      const { router } = renderApplication(path, authenticated(role))
      await screen.findByRole('heading', { name: /Regressão/ })
      expect(router.state.location.pathname).toBe('/')
      expect(router.state.location.search).toBe('')
      expect(router.state.location.hash).toBe('')
      expect(router.state.historyAction).toBe('REPLACE')
      expect(document.querySelector('a[href^="/connect"]')).toBeNull()
    })
  }

  it.each(['/connect', '/connect/organization-1'])('preserves login and returns %s to home after authentication', async (path) => {
    const { router, authenticate } = renderApplication(path, anonymous)
    await screen.findByRole('heading', { name: 'Acesse o Efetiva OS' })
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.state.from.pathname).toBe(path)

    authenticate('equipe')
    await screen.findByRole('heading', { name: /Regressão/ })
    expect(router.state.location.pathname).toBe('/')
  })

  it('replaces the retired URL in history instead of trapping back navigation', async () => {
    const { router } = renderApplication('/connect/organization-1', authenticated(), '/pricing')
    await screen.findByRole('heading', { name: /Regressão/ })
    await act(() => router.navigate(-1))
    await waitFor(() => expect(router.state.location.pathname).toBe('/pricing'))
    expect(await screen.findByRole('heading', { name: 'Visão operacional' })).toBeInTheDocument()
  })

  it('still blocks an inactive authenticated profile before redirecting', async () => {
    const { router } = renderApplication('/connect', { ...authenticated(), profile: { ...profile, active: false } })
    expect(await screen.findByRole('heading', { name: 'Acesso inativo' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/connect')
  })

  it('keeps Auth loading before resolving a retired URL', () => {
    const { router } = renderApplication('/connect', { ...anonymous, loading: true })
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    expect(router.state.location.pathname).toBe('/connect')
  })

  it.each(['/unknown', '/connect/organization-1/not-a-legacy-route'])('preserves 404 behavior for %s', async (path) => {
    const { router } = renderApplication(path)
    expect(await screen.findByRole('heading', { name: 'Pagina nao encontrada' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/404')
  })
})

describe('preserved application navigation', () => {
  it.each([
    ['/crm', 'CRM — rota preservada'],
    ['/crm/clients', 'Clientes — rota preservada'],
    ['/finance', 'Financeiro — rota preservada'],
    ['/pricing', 'Visão operacional'],
  ])('keeps the registered route %s reachable from the shell', async (path, title) => {
    const { router } = renderApplication(path)
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
  })

  it.each(['admin', 'equipe'] as const)('keeps real client detail and the Contracts form accessible for %s', async (role) => {
    const { router } = renderApplication('/crm/clients', authenticated(role))
    const user = userEvent.setup()
    await user.click(await screen.findByRole('link', { name: 'Abrir cliente de regressão' }))
    expect(await screen.findByRole('heading', { name: 'Contratos' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/crm/clients/client-1')
    expect(screen.getByRole('link', { name: 'Ir para Contratos' })).toHaveAttribute('href', '#contratos')
    expect(mocks.getClient).toHaveBeenCalledWith('client-1')
    await waitFor(() => expect(mocks.listContracts).toHaveBeenCalledWith('client-1'))

    await user.click(screen.getByRole('button', { name: 'Novo contrato' }))
    expect(screen.getByRole('heading', { name: 'Cadastrar contrato' })).toBeInTheDocument()
    expect(screen.getByLabelText('Cliente vinculado')).toHaveValue('Cliente de regressão')
    expect(mocks.createContract).not.toHaveBeenCalled()
    expect(mocks.updateContract).not.toHaveBeenCalled()
    expect(mocks.discardDocument).not.toHaveBeenCalled()
  })
})
