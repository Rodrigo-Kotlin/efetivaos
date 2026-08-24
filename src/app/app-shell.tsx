import * as Dialog from '@radix-ui/react-dialog'
import { Building2, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, House, LibraryBig, LogOut, Menu, Scale, Search, Settings, Tag, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { Logo } from '@/components/shared/logo'
import { OfflineBanner } from '@/components/shared/offline-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { signOut } from '@/features/auth/auth.service'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'

const navigation = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/pricing', label: 'Motor de Precos', icon: Tag, end: true },
  { to: '/pricing/comparison', label: 'Comparacao', icon: CircleDollarSign },
  { to: '/pricing/rules', label: 'Regras de preco', icon: Scale },
  { to: '/pricing/suppliers', label: 'Fornecedores', icon: Building2 },
  { to: '/pricing/catalog', label: 'Catalogo Efetiva', icon: LibraryBig },
  { to: '/pricing/quotations', label: 'Cotacoes', icon: ClipboardList },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)

  return (
    <>
      <div className="flex h-28 items-center border-b border-slate-200 px-4">
        <Logo compact={collapsed} />
      </div>
      <nav className="flex-1 space-y-2 p-3" aria-label="Navegacao principal">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate} className={({ isActive }) => cn('flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors', isActive ? 'bg-emerald-50 text-emerald-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950', collapsed && 'justify-center px-0')} title={collapsed ? label : undefined}>
            <Icon className="size-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <div className={cn('flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-slate-500', collapsed && 'justify-center px-0')}>
          <Settings className="size-5 shrink-0" />
          {!collapsed && <span>Configuracoes</span>}
        </div>
        <button className="mt-2 hidden h-10 w-full items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:flex" type="button" onClick={toggleSidebar} aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}>
          {collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
        </button>
      </div>
    </>
  )
}

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { profile, user, profileError, refreshProfile } = useAuth()
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const navigate = useNavigate()
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuario'

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
            <Dialog.Title className="sr-only">Navegacao principal</Dialog.Title>
            <Dialog.Close className="absolute right-3 top-5 z-10 grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700" aria-label="Fechar menu">
              <X className="size-5" />
            </Dialog.Close>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
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
            Nao foi possivel carregar o perfil deste usuario.
            <Button variant="outline" size="sm" onClick={() => void refreshProfile()}>Tentar novamente</Button>
          </div>
        )}

        <main className="px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
          <Outlet />
        </main>
        <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-5 text-xs text-slate-500 sm:px-6 lg:px-8">
          <span>Efetiva OS</span>
          <Badge variant="outline"><CircleDollarSign className="size-3" /> Sprint 4</Badge>
        </footer>
      </div>
    </div>
  )
}
