import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { AdminRoute, ProtectedRoute } from '@/features/auth/protected-route'
import type { Profile } from '@/types/database'

const activeProfile: Profile = {
  id: 'user-1', full_name: 'Usuario Teste', role: 'equipe', active: true,
  created_at: '2026-08-23T10:00:00Z', created_by: null,
  updated_at: '2026-08-23T10:00:00Z', updated_by: null,
}

const baseAuth: AuthContextValue = {
  session: null,
  user: null,
  profile: null,
  loading: false,
  profileError: null,
  refreshProfile: async () => undefined,
}

function renderRoute(auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/pricing']}>
        <Routes>
          <Route path="/login" element={<p>Tela de login</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/pricing" element={<p>Conteudo protegido</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ProtectedRoute', () => {
  it('redireciona visitante sem sessao', () => {
    renderRoute(baseAuth)
    expect(screen.getByText('Tela de login')).toBeInTheDocument()
  })

  it('libera usuario autenticado', () => {
    renderRoute({
      ...baseAuth,
      session: { user: { id: 'user-1' } } as AuthContextValue['session'],
      user: { id: 'user-1' } as AuthContextValue['user'],
      profile: activeProfile,
    })
    expect(screen.getByText('Conteudo protegido')).toBeInTheDocument()
  })

  it('mantem o carregamento enquanto o perfil e consultado', () => {
    renderRoute({
      ...baseAuth,
      session: { user: { id: 'user-1' } } as AuthContextValue['session'],
      user: { id: 'user-1' } as AuthContextValue['user'],
      loading: true,
    })
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Conteudo protegido')).not.toBeInTheDocument()
  })

  it('bloqueia perfil ausente depois do carregamento', () => {
    renderRoute({
      ...baseAuth,
      session: { user: { id: 'user-1' } } as AuthContextValue['session'],
      user: { id: 'user-1' } as AuthContextValue['user'],
    })
    expect(screen.getByRole('heading', { name: 'Perfil indisponivel' })).toBeInTheDocument()
    expect(screen.queryByText('Conteudo protegido')).not.toBeInTheDocument()
  })

  it('bloqueia e permite recuperar quando a consulta do perfil falha', async () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderRoute({
      ...baseAuth,
      session: { user: { id: 'user-1' } } as AuthContextValue['session'],
      user: { id: 'user-1' } as AuthContextValue['user'],
      profileError: new Error('profile unavailable'),
      refreshProfile,
    })

    expect(screen.getByText('Verifique sua conexao e tente novamente.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(refreshProfile).toHaveBeenCalledOnce()
    expect(screen.queryByText('Conteudo protegido')).not.toBeInTheDocument()
  })

  it('bloqueia perfil autenticado inativo', () => {
    renderRoute({
      ...baseAuth,
      session: { user: { id: 'user-1' } } as AuthContextValue['session'],
      user: { id: 'user-1' } as AuthContextValue['user'],
      profile: { ...activeProfile, active: false },
    })
    expect(screen.getByRole('heading', { name: 'Acesso inativo' })).toBeInTheDocument()
    expect(screen.queryByText('Conteudo protegido')).not.toBeInTheDocument()
  })
})

describe('AdminRoute', () => {
  function renderAdminRoute(profile: Profile) {
    return render(
      <AuthContext.Provider value={{ ...baseAuth, profile }}>
        <MemoryRouter initialEntries={['/pricing/rules']}>
          <Routes>
            <Route path="/pricing" element={<p>Dashboard de precos</p>} />
            <Route element={<AdminRoute />}>
              <Route path="/pricing/rules" element={<p>Regras comerciais</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  }

  it('libera a rota de regras para Admin', () => {
    renderAdminRoute({ ...activeProfile, role: 'admin' })
    expect(screen.getByText('Regras comerciais')).toBeInTheDocument()
  })

  it('redireciona Equipe para o dashboard de precos', () => {
    renderAdminRoute(activeProfile)
    expect(screen.getByText('Dashboard de precos')).toBeInTheDocument()
    expect(screen.queryByText('Regras comerciais')).not.toBeInTheDocument()
  })
})
