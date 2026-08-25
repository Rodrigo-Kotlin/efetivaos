import { ArrowRight, Plus, Inbox, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ErrorState, PageHeader } from '@/components/shared/operational-ui'
import { Button } from '@/components/ui/button'
import { useClientLists } from '../queries/client-queries'
import type { Client } from '@/types/database'

export default function CrmPage() {
  const [, setDrawer] = useState<{ mode: 'create' | 'edit' | 'detail'; client?: Client } | null>(null)
  const clientsQuery = useClientLists()
  const clients = clientsQuery.data ?? []
  const [thirtyDaysAgoMs] = useState(() => Date.now() - 30 * 24 * 60 * 60 * 1000)
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="CRM Light"
        title="Relacionamento com clientes"
        description="Centralize cadastros de clientes e seus contatos, sem perder o historico de registros inativos."
        actions={<><Button asChild variant="outline"><Link to="/crm/clients"><UsersRound className="size-4" /> Clientes</Link></Button><Button asChild><Link to="/crm/clients/new"><Plus className="size-4" /> Novo cliente</Link></Button></>} />
      {clientsQuery.isError ? (
        <ErrorState title="Nao foi possivel carregar o CRM" message="Verifique sua conexao e tente novamente." onRetry={() => void clientsQuery.refetch()} />
      ) : clientsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores do CRM">
          {Array.from({ length: 4 }, (_, index) => (
            <article key={index} className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Carregando indicador" role="status">
              <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
              <div className="mt-3 h-9 w-12 animate-pulse rounded bg-slate-100" />
            </article>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-emerald-500 text-4xl mb-4"><Inbox className="size-6" aria-hidden="true" /></p>
          <h2 className="font-serif text-2xl font-semibold">Nenhum cliente cadastrado</h2>
          <p className="text-slate-600">Cadastre o primeiro cliente para iniciar a base comercial do Efetiva OS.</p>
           <Button onClick={() => setDrawer({ mode: 'create' })} className="mt-4"><Plus className="size-4" /> Cadastrar cliente</Button>
        </div>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores do CRM">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Clientes ativos</p>
            <p className="mt-2 font-serif text-3xl font-semibold">{clients.filter((c) => c.status === 'active').length}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Clientes inativos</p>
            <p className="mt-2 font-serif text-3xl font-semibold">{clients.filter((c) => c.status === 'inactive').length}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sem contato principal</p>
            <p className="mt-2 font-serif text-3xl font-semibold">{clients.filter((c) => c.primary_contact_id === null).length}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Atualizados em 30 dias</p>
            <p className="mt-2 font-serif text-3xl font-semibold">{clients.filter((c) => new Date(c.updated_at).getTime() >= thirtyDaysAgoMs).length}</p>
          </article>
        </section>
      )}
      <section className="mt-6 rounded-2xl bg-emerald-950 p-7 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-300">Base de relacionamento</p>
        <h2 className="mt-3 font-serif text-2xl font-semibold">Clientes e contatos em um unico lugar</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100/80">Consulte dados institucionais, enderecos e pessoas de contato com status e contato principal controlados.</p>
        <Button asChild className="mt-6 bg-white text-emerald-950 hover:bg-emerald-50"><Link to="/crm/clients">Abrir clientes <ArrowRight className="size-4" /></Link></Button>
      </section>
    </div>
  )
}