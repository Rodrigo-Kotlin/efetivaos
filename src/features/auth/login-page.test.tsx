import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import LoginPage from '@/features/auth/login-page'

const auth: AuthContextValue = {
  session: null,
  user: null,
  profile: null,
  loading: false,
  profileError: null,
  refreshProfile: async () => undefined,
}

describe('LoginPage', () => {
  it('exibe o formulario quando a conexao esta configurada', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter><LoginPage /></MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )

    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeEnabled()
  })
})
