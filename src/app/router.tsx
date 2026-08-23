import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

import { LoadingScreen } from '@/components/shared/loading-screen'
import { ProtectedRoute } from '@/features/auth/protected-route'

const AppShell = lazy(() => import('@/app/app-shell'))
const LoginPage = lazy(() => import('@/features/auth/login-page'))
const HomePage = lazy(() => import('@/routes/home-page'))
const PricingPage = lazy(() => import('@/features/pricing/pricing-page'))
const NotFoundPage = lazy(() => import('@/routes/not-found-page'))

const pending = (node: React.ReactNode) => <Suspense fallback={<LoadingScreen />}>{node}</Suspense>

export const router = createBrowserRouter([
  { path: '/login', element: pending(<LoginPage />) },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: pending(<AppShell />),
        children: [
          { index: true, element: pending(<HomePage />) },
          { path: 'pricing', element: pending(<PricingPage />) },
        ],
      },
    ],
  },
  { path: '/404', element: pending(<NotFoundPage />) },
  { path: '*', element: <Navigate to="/404" replace /> },
])
