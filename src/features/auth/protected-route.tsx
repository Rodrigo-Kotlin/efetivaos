import { LockKeyhole } from 'lucide-react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { LoadingScreen } from '@/components/shared/loading-screen'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { signOut } from '@/features/auth/auth.service'

export function ProtectedRoute() {
  const { session, profile, loading } = useAuth()
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
  return <Outlet />
}
