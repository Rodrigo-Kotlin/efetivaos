import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { ProtectedRoute } from '@/features/auth/protected-route'

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
    })
    expect(screen.getByText('Conteudo protegido')).toBeInTheDocument()
  })
})
