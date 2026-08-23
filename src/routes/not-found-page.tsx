import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 p-6 text-center">
      <div><p className="text-sm font-bold text-emerald-800">404</p><h1 className="mt-3 font-serif text-4xl font-semibold">Pagina nao encontrada</h1><p className="mt-3 text-slate-600">O endereco informado nao existe no Efetiva OS.</p><Button asChild className="mt-6"><Link to="/">Voltar ao inicio</Link></Button></div>
    </main>
  )
}
