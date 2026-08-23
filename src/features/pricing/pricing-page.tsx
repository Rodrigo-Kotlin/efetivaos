import { CheckCircle2, Database, LockKeyhole, Route, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/features/auth/auth-context'

const checks = [
  { label: 'Aplicacao carregada', detail: 'React, Vite e rota lazy', icon: CheckCircle2 },
  { label: 'Rota protegida', detail: 'Sessao obrigatoria', icon: LockKeyhole },
  { label: 'Supabase conectado', detail: 'Auth e consulta de perfil', icon: Database },
  { label: 'Navegacao ativa', detail: 'App Shell responsivo', icon: Route },
]

export default function PricingPage() {
  const { profile, user } = useAuth()

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge>Motor de Precos</Badge>
            <Badge variant="outline">Baseline Sprint 0</Badge>
          </div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Fundacao operacional</h1>
          <p className="mt-3 max-w-2xl text-slate-600">Esta pagina comprova a infraestrutura do modulo. Cadastros, comparacao e regras comerciais entram somente nos proximos gates.</p>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Status da fundacao">
        {checks.map(({ label, detail, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Icon className="size-5" /></span>
              <div><h2 className="text-sm font-bold">{label}</h2><p className="mt-0.5 text-xs text-slate-500">{detail}</p></div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-7 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Proximo fluxo funcional</p>
          <h2 className="mt-3 font-serif text-2xl font-semibold">Fornecedor ate tabela comercial</h2>
          <div className="mt-7 flex flex-wrap gap-2 text-sm">
            {['Fornecedor', 'Cotacao', 'Itens', 'Comparacao', 'Acrescimo', 'Revisao', 'Aprovacao', 'Tabela comercial'].map((step, index) => (
              <span key={step} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2"><strong className="text-emerald-800">{String(index + 1).padStart(2, '0')}</strong>{step}</span>
            ))}
          </div>
          <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Nenhum CRUD foi habilitado nesta etapa. A interface sera expandida apenas apos o gate da fundacao.
          </div>
        </article>

        <aside className="rounded-2xl bg-emerald-950 p-6 text-white shadow-sm sm:p-8">
          <div className="flex items-center justify-between"><UserRound className="size-6 text-lime-300" /><Badge className="bg-white/10 text-white">{profile?.role === 'admin' ? 'Admin' : 'Equipe'}</Badge></div>
          <h2 className="mt-8 font-serif text-2xl font-semibold">Perfil reconhecido</h2>
          <dl className="mt-6 space-y-4 text-sm">
            <div><dt className="text-emerald-100/60">Nome</dt><dd className="mt-1 font-semibold">{profile?.full_name || 'Nao informado'}</dd></div>
            <div><dt className="text-emerald-100/60">E-mail</dt><dd className="mt-1 break-all font-semibold">{user?.email}</dd></div>
            <div><dt className="text-emerald-100/60">Role autorizada pelo banco</dt><dd className="mt-1 font-semibold capitalize">{profile?.role}</dd></div>
          </dl>
        </aside>
      </section>
    </div>
  )
}
