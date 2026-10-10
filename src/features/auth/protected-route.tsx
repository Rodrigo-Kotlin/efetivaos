import { LockKeyhole } from 'lucide-react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { LoadingScreen } from '@/components/shared/loading-screen'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { signOut } from '@/features/auth/auth.service'

export function ProtectedRoute() {
  const { session, profile, loading, profileError, refreshProfile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  if (profile && !profile.active) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f4f6f3] px-5">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-900"><LockKeyhole className="size-6" /></span>
          <h1 className="mt-5 font-serif text-3xl font-semibold">Acesso inativo</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Seu perfil esta inativo. Procure um administrador para recuperar o acesso.</p>
          <Button className="mt-6" variant="outline" onClick={() => void signOut().then(() => navigate('/login', { replace: true }))}>Sair</Button>
        </section>
      </main>
    )
  }
  if (session && !profile) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f4f6f3] px-5">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-900"><LockKeyhole className="size-6" /></span>
          <h1 className="mt-5 font-serif text-3xl font-semibold">Perfil indisponivel</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Nao foi possivel validar seu perfil. Tente novamente ou saia da conta.</p>
          {profileError ? <p className="mt-2 text-xs text-slate-500">Verifique sua conexao e tente novamente.</p> : null}
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => void refreshProfile()}>Tentar novamente</Button>
            <Button onClick={() => void signOut().then(() => navigate('/login', { replace: true }))}>Sair</Button>
          </div>
        </section>
      </main>
    )
  }
  return <Outlet />
}

export function AdminRoute() {
  const { profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (profile?.role !== 'admin') return <Navigate to="/pricing" replace />
  return <Outlet />
}
