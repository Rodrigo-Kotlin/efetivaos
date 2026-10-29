import { Navigate, Outlet } from 'react-router-dom'

import { LoadingScreen } from '@/components/shared/loading-screen'
import { useAuth } from '@/features/auth/auth-context'
import { useConnectAccess } from './hooks/use-connect-foundation'

export function ConnectRoute() {
  const { profile, loading } = useAuth()
  const accessQuery = useConnectAccess()

  if (loading || accessQuery.isPending) return <LoadingScreen />
  if (!profile?.active || accessQuery.isError || !accessQuery.data?.canAccess) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
