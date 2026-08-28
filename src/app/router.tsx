import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

import { LoadingScreen } from '@/components/shared/loading-screen'
import { AdminRoute, ProtectedRoute } from '@/features/auth/protected-route'

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
const CrmPage = lazy(() => import('@/features/crm/pages/crm-page'))
const ClientsPage = lazy(() => import('@/features/crm/pages/clients-page'))
const ClientFormPage = lazy(() => import('@/features/crm/pages/client-form-page'))
const ClientDetailPage = lazy(() => import('@/features/crm/pages/client-detail-page'))
const FinancePage = lazy(() => import('@/features/finance/pages/finance-page'))
const FinanceDashboardPage = lazy(() => import('@/features/finance/pages/finance-dashboard-page'))
const ChartAccountsPage = lazy(() => import('@/features/finance/pages/chart-accounts-page'))
const CostCentersPage = lazy(() => import('@/features/finance/pages/cost-centers-page'))
const ServiceLinesPage = lazy(() => import('@/features/finance/pages/service-lines-page'))
const CategoriesPage = lazy(() => import('@/features/finance/pages/categories-page'))
const AccountsPage = lazy(() => import('@/features/finance/pages/accounts-page'))
const TransactionsPage = lazy(() => import('@/features/finance/pages/transactions-page'))
const CashflowPage = lazy(() => import('@/features/finance/pages/cashflow-page'))
const DfcPage = lazy(() => import('@/features/finance/pages/dfc-page'))
const DrePage = lazy(() => import('@/features/finance/pages/dre-page'))
const AssetsPage = lazy(() => import('@/features/finance/pages/assets-page'))
const BalanceSheetPage = lazy(() => import('@/features/finance/pages/balance-sheet-page'))
const DmplPage = lazy(() => import('@/features/finance/pages/dmpl-page'))
const DlpaPage = lazy(() => import('@/features/finance/pages/dlpa-page'))
const DvaPage = lazy(() => import('@/features/finance/pages/dva-page'))
const AdjustmentsPage = lazy(() => import('@/features/finance/pages/adjustments-page'))
const NotesPage = lazy(() => import('@/features/finance/pages/notes-page'))
const ReceivablesPage = lazy(() => import('@/features/finance/pages/receivables-page'))
const PayablesPage = lazy(() => import('@/features/finance/pages/payables-page'))
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
          {
            element: <AdminRoute />,
            children: [{ path: 'pricing/rules', element: pending(<RulesPage />) }],
          },
          { path: 'pricing/quotations', element: pending(<QuotationsPage />) },
          { path: 'pricing/quotations/new', element: pending(<QuotationEditorPage />) },
          { path: 'pricing/quotations/:quotationId', element: pending(<QuotationEditorPage />) },
          { path: 'crm', element: pending(<CrmPage />) },
          { path: 'crm/clients', element: pending(<ClientsPage />) },
          { path: 'crm/clients/new', element: pending(<ClientFormPage />) },
          { path: 'crm/clients/:clientId', element: pending(<ClientDetailPage />) },
          { path: 'crm/clients/:clientId/edit', element: pending(<ClientFormPage />) },
          { path: 'finance', element: pending(<FinanceDashboardPage />) },
          { path: 'finance/launch', element: pending(<FinancePage />) },
          { path: 'finance/chart-accounts', element: pending(<ChartAccountsPage />) },
          { path: 'finance/cost-centers', element: pending(<CostCentersPage />) },
          { path: 'finance/service-lines', element: pending(<ServiceLinesPage />) },
          { path: 'finance/categories', element: pending(<CategoriesPage />) },
          { path: 'finance/accounts', element: pending(<AccountsPage />) },
          { path: 'finance/transactions', element: pending(<TransactionsPage />) },
          { path: 'finance/receivables', element: pending(<ReceivablesPage />) },
          { path: 'finance/payables', element: pending(<PayablesPage />) },
          { path: 'finance/cashflow', element: pending(<CashflowPage />) },
          { path: 'finance/cash-flow-statement', element: pending(<DfcPage />) },
          { path: 'finance/dre', element: pending(<DrePage />) },
          { path: 'finance/assets', element: pending(<AssetsPage />) },
          { path: 'finance/balance-sheet', element: pending(<BalanceSheetPage />) },
          { path: 'finance/dmpl', element: pending(<DmplPage />) },
          { path: 'finance/dlpa', element: pending(<DlpaPage />) },
          { path: 'finance/dva', element: pending(<DvaPage />) },
          {
            element: <AdminRoute />,
            children: [{ path: 'finance/adjustments', element: pending(<AdjustmentsPage />) }],
          },
          { path: 'finance/notes', element: pending(<NotesPage />) },
        ],
      },
    ],
  },
  { path: '/404', element: pending(<NotFoundPage />) },
  { path: '*', element: <Navigate to="/404" replace /> },
])
