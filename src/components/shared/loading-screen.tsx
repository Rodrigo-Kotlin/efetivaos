import symbolLogo from '../../../assets/logo/symbol/logo-symbol-transparent.png'

export function LoadingScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-white" aria-busy="true">
      <div className="flex flex-col items-center gap-5">
        <img src={symbolLogo} alt="Efetiva" className="size-20 object-contain" />
        <span className="size-6 animate-spin rounded-full border-2 border-[#0B6B3A] border-t-transparent" />
        <span className="sr-only">Carregando aplicacao</span>
      </div>
    </main>
  )
}
