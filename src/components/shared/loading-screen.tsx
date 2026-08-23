import { Logo } from '@/components/shared/logo'

export function LoadingScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50" aria-busy="true">
      <div className="flex flex-col items-center gap-5">
        <Logo />
        <span className="size-6 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
        <span className="sr-only">Carregando aplicacao</span>
      </div>
    </main>
  )
}
