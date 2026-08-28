import * as Dialog from '@radix-ui/react-dialog'
import { Building2, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, ContactRound, House, LibraryBig, ListTree, LogOut, Menu, Scale, Search, Settings, Tag, UsersRound, X, ArrowLeftRight, TrendingUp, BarChart3, FileText, Warehouse, PieChart, type LucideIcon } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { Logo } from '@/components/shared/logo'
import { OfflineBanner } from '@/components/shared/offline-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { signOut } from '@/features/auth/auth.service'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  adminOnly?: boolean
}

type NavigationGroup = {
  id: string
  label: string
  items: NavItem[]
}

// ---------------------------------------------------------------------------
// Navigation data
// ---------------------------------------------------------------------------

const navigationGroups: NavigationGroup[] = [
  {
    id: 'principal',
    label: 'Principal',
    items: [
      { to: '/', label: 'Início', icon: House, end: true },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    items: [
      { to: '/pricing', label: 'Motor de Preços', icon: Tag, end: true },
      { to: '/pricing/comparison', label: 'Comparação', icon: CircleDollarSign },
      { to: '/pricing/prices', label: 'Tabela de Preços', icon: ListTree },
      { to: '/pricing/rules', label: 'Regras de Preço', icon: Scale, adminOnly: true },
      { to: '/pricing/quotations', label: 'Cotações', icon: ClipboardList },
      { to: '/crm', label: 'CRM', icon: ContactRound, end: true },
      { to: '/crm/clients', label: 'Clientes', icon: UsersRound },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    items: [
      { to: '/finance', label: 'Financeiro', icon: CircleDollarSign, end: true },
      { to: '/finance/transactions', label: 'Transações', icon: ArrowLeftRight },
      { to: '/finance/cashflow', label: 'Fluxo de Caixa', icon: TrendingUp },
    ],
  },
  {
    id: 'demonstracoes',
    label: 'Demonstrações',
    items: [
      { to: '/finance/cash-flow-statement', label: 'DFC', icon: BarChart3 },
      { to: '/finance/dre', label: 'DRE', icon: FileText },
      { to: '/finance/balance-sheet', label: 'Balanço Patrimonial', icon: PieChart },
      { to: '/finance/dmpl', label: 'DMPL', icon: FileText },
      { to: '/finance/dlpa', label: 'DLPA', icon: FileText },
      { to: '/finance/dva', label: 'DVA', icon: FileText },
    ],
  },
  {
    id: 'patrimonio',
    label: 'Patrimônio e Controle',
    items: [
      { to: '/finance/assets', label: 'Ativos e Bens', icon: Warehouse },
      { to: '/finance/adjustments', label: 'Ajustes', icon: Settings, adminOnly: true },
      { to: '/finance/notes', label: 'Notas', icon: FileText },
    ],
  },
  {
    id: 'cadastros',
    label: 'Cadastros',
    items: [
      { to: '/pricing/suppliers', label: 'Fornecedores', icon: Building2 },
      { to: '/pricing/catalog', label: 'Catálogo Efetiva', icon: LibraryBig },
      { to: '/finance/chart-accounts', label: 'Plano de Contas', icon: LibraryBig },
      { to: '/finance/cost-centers', label: 'Centros de Custo', icon: Building2 },
      { to: '/finance/accounts', label: 'Contas', icon: Settings },
      { to: '/finance/service-lines', label: 'Linhas de Serviço', icon: ListTree },
      { to: '/finance/categories', label: 'Categorias', icon: ClipboardList },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function itemMatchesPath(item: NavItem, pathname: string): boolean {
  if (item.end) return pathname === item.to
  if (item.to === '/') return pathname === '/'
  return pathname === item.to || pathname.startsWith(item.to + '/')
}

function findGroupForPath(pathname: string): string | null {
  for (const group of navigationGroups) {
    if (group.items.some((item) => itemMatchesPath(item, pathname))) {
      return group.id
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// SidebarContent
// ---------------------------------------------------------------------------

function SidebarContent({ onNavigate, forceExpanded = false }: { onNavigate?: () => void; forceExpanded?: boolean }) {
  const storedCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const collapsed = forceExpanded ? false : storedCollapsed
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const { profile } = useAuth()
  const location = useLocation()

  const activeGroupId = useMemo(() => findGroupForPath(location.pathname), [location.pathname])

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    if (activeGroupId) initial.add(activeGroupId)
    return initial
  })
  const prevPathnameRef = useRef(location.pathname)

  if (prevPathnameRef.current !== location.pathname) { // eslint-disable-line react-hooks/refs -- render-time pathname tracking
    prevPathnameRef.current = location.pathname // eslint-disable-line react-hooks/refs -- render-time pathname tracking
    if (activeGroupId) {
      setOpenGroups((prev) => {
        if (prev.has(activeGroupId)) return prev
        const next = new Set(prev)
        next.add(activeGroupId)
        return next
      })
    }
  }

  const isGroupExpanded = (groupId: string): boolean => {
    if (collapsed) return true
    return openGroups.has(groupId)
  }

  const toggleGroup = useCallback((groupId: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  const filteredGroups = useMemo(
    () => navigationGroups.map((g) => ({
      ...g,
      items: g.items.filter((item) => !item.adminOnly || profile?.role === 'admin'),
    })).filter((g) => g.items.length > 0),
    [profile?.role],
  )

  return (
    <>
      <div className="flex h-28 items-center border-b border-slate-200 px-4">
        <Logo compact={collapsed} />
      </div>
      <nav className="flex-1 overflow-y-auto p-3" aria-label="Navegação principal">
        {filteredGroups.map((group, groupIdx) => {
          const isExpanded = isGroupExpanded(group.id)
          const hasActiveItem = group.items.some((item) => itemMatchesPath(item, location.pathname))
          const marginTop = groupIdx > 0 ? 'mt-4' : ''

          return (
            <div key={group.id} className={marginTop}>
              {!collapsed && (
                <button
                  type="button"
                  className="flex w-full items-center gap-1 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`sidebar-panel-${group.id}`}
                >
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown className={cn('size-3 transition-transform', !isExpanded && '-rotate-90')} />
                </button>
              )}
              {isExpanded && (
                <div id={`sidebar-panel-${group.id}`} className="mt-1 space-y-0.5">
                  {group.items.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={onNavigate}
                      aria-label={collapsed ? label : undefined}
                      className={({ isActive }) => cn(
                        'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                        isActive ? 'bg-emerald-50 text-emerald-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                        collapsed && 'justify-center px-0',
                      )}
                      title={collapsed ? label : undefined}
                    >
                      <Icon className="size-5 shrink-0" />
                      {!collapsed && <span>{label}</span>}
                    </NavLink>
                  ))}
                </div>
              )}
              {!collapsed && !isExpanded && hasActiveItem && (
                <div className="mt-1 space-y-0.5">
                  {group.items.filter((item) => itemMatchesPath(item, location.pathname)).map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={onNavigate}
                      className={({ isActive }) => cn(
                        'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                        isActive ? 'bg-emerald-50 text-emerald-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                      )}
                    >
                      <Icon className="size-5 shrink-0" />
                      <span>{label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <div className={cn('flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-slate-500', collapsed && 'justify-center px-0')}>
          <Settings className="size-5 shrink-0" />
          {!collapsed && <span>Configurações</span>}
        </div>
        <button className="mt-2 hidden h-10 w-full items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:flex" type="button" onClick={toggleSidebar} aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}>
          {collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { profile, user, profileError, refreshProfile } = useAuth()
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const navigate = useNavigate()
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuário'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-[#f4f6f3] text-slate-950">
      <OfflineBanner />
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-white transition-[width] lg:flex lg:flex-col', collapsed ? 'w-[76px]' : 'w-64')}>
        <SidebarContent />
      </aside>

      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,86vw)] flex-col bg-white shadow-2xl outline-none lg:hidden" aria-describedby={undefined}>
            <Dialog.Title className="sr-only">Navegação principal</Dialog.Title>
            <Dialog.Close className="absolute right-3 top-5 z-10 grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700" aria-label="Fechar menu">
              <X className="size-5" />
            </Dialog.Close>
            <SidebarContent forceExpanded onNavigate={() => setMobileOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className={cn('transition-[padding] lg:pl-64', collapsed && 'lg:pl-[76px]')}>
        <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-slate-200/80 bg-[#f4f6f3]/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu className="size-5" />
          </Button>
          <Logo compact className="lg:hidden" />
          <div className="relative ml-auto hidden w-full max-w-md sm:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm outline-none focus:border-emerald-700" placeholder="Buscar no Efetiva OS..." aria-label="Buscar" disabled />
          </div>
          <div className="ml-auto flex items-center gap-3 sm:ml-0">
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold capitalize">{displayName}</p>
              <p className="text-xs text-slate-500">{profile?.role === 'admin' ? 'Administrador' : 'Equipe'}</p>
            </div>
            <div className="grid size-10 place-items-center rounded-full bg-[#0B6B3A] text-sm font-bold uppercase text-white">{displayName.charAt(0)}</div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair">
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        {profileError && (
          <div className="mx-4 mt-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:mx-6 lg:mx-8" role="alert">
            Não foi possível carregar o perfil deste usuário.
            <Button variant="outline" size="sm" onClick={() => void refreshProfile()}>Tentar novamente</Button>
          </div>
        )}

        <main className="px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
          <Outlet />
        </main>
        <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-5 text-xs text-slate-500 sm:px-6 lg:px-8">
          <span>Efetiva OS</span>
          <Badge variant="outline">Ambiente operacional</Badge>
        </footer>
      </div>
    </div>
  )
}
