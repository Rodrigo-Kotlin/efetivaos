import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

import { LoadingScreen } from '@/components/shared/loading-screen'
import { ProtectedRoute } from '@/features/auth/protected-route'

const AppShell = lazy(() => import('@/app/app-shell'))
const LoginPage = lazy(() => import('@/features/auth/login-page'))
const HomePage = lazy(() => import('@/routes/home-page'))
const PricingPage = lazy(() => import('@/features/pricing/pricing-page'))
const SuppliersPage = lazy(() => import('@/features/pricing/suppliers/suppliers-page'))
const CatalogPage = lazy(() => import('@/features/pricing/catalog/catalog-page'))
const ComparisonPage = lazy(() => import('@/features/pricing/comparison/comparison-page'))
const PriceListPage = lazy(() => import('@/features/pricing/price-list/price-list-page'))
const RulesPage = lazy(() => import('@/features/pricing/rules/rules-page'))
const QuotationsPage = lazy(() => import('@/features/pricing/quotations/quotations-page'))
const QuotationEditorPage = lazy(() => import('@/features/pricing/quotations/quotation-editor-page'))
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
          { path: 'pricing/suppliers', element: pending(<SuppliersPage />) },
          { path: 'pricing/catalog', element: pending(<CatalogPage />) },
          { path: 'pricing/comparison', element: pending(<ComparisonPage />) },
          { path: 'pricing/prices', element: pending(<PriceListPage />) },
          { path: 'pricing/rules', element: pending(<RulesPage />) },
          { path: 'pricing/quotations', element: pending(<QuotationsPage />) },
          { path: 'pricing/quotations/new', element: pending(<QuotationEditorPage />) },
          { path: 'pricing/quotations/:quotationId', element: pending(<QuotationEditorPage />) },
        ],
      },
    ],
  },
  { path: '/404', element: pending(<NotFoundPage />) },
  { path: '*', element: <Navigate to="/404" replace /> },
])
