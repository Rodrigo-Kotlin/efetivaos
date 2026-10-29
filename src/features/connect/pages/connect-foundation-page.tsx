import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, LockKeyhole, MessageSquare, ShieldCheck, UsersRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorState, EmptyState, TableSkeleton } from '@/components/shared/operational-ui'
import { useAuth } from '@/features/auth/auth-context'
import { useConnectFoundation, useConnectOrganizations, useUpsertConnectProfileSector } from '../hooks/use-connect-foundation'
import { CONNECT_CLASSIFICATION_LABELS } from '../types/connect-types'

const EMPTY_SECTORS: never[] = []
const EMPTY_PROFILES: never[] = []

export default function ConnectFoundationPage() {
  const { profile } = useAuth()
  const organizationsQuery = useConnectOrganizations()
  const organization = organizationsQuery.data?.[0] ?? null
  const foundationQuery = useConnectFoundation(organization?.id ?? null)
  const assignmentMutation = useUpsertConnectProfileSector()
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [selectedSectorId, setSelectedSectorId] = useState('')
  const [permissions, setPermissions] = useState({ can_view: true, can_assign: false, can_transfer: false, can_manage: false })

  const sectors = foundationQuery.data?.sectors ?? EMPTY_SECTORS
  const operators = foundationQuery.data?.operators ?? []
  const profiles = foundationQuery.data?.profiles ?? EMPTY_PROFILES
  const activeSectors = useMemo(() => sectors.filter(sector => sector.active), [sectors])
  const effectiveProfileId = selectedProfileId || profiles[0]?.id || ''
  const effectiveSectorId = selectedSectorId || activeSectors[0]?.id || ''

  if (organizationsQuery.isLoading || (organization && foundationQuery.isLoading)) {
    return <TableSkeleton columns={3} />
  }

  if (organizationsQuery.isError || foundationQuery.isError) {
    return <ErrorState onRetry={() => { void organizationsQuery.refetch(); void foundationQuery.refetch() }} />
  }

  if (!organization) {
    return <EmptyState title="Nenhuma organização Connect disponível" description="O acesso a uma organização Connect precisa ser configurado por um administrador." action={<Link to="/">Voltar ao início</Link>} />
  }

  const handleAssignment = async () => {
    if (!effectiveProfileId || !effectiveSectorId) return
    await assignmentMutation.mutateAsync({
      organization_id: organization.id,
      profile_id: effectiveProfileId,
      sector_id: effectiveSectorId,
      ...permissions,
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-800">Atendimento multissetorial</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">EfetivaConnect</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Fundação do domínio de atendimento da Efetiva, preparada para canais digitais sem dados fictícios de WhatsApp.</p>
        </div>
        <Badge className="w-fit bg-teal-50 text-teal-800"><CheckCircle2 className="size-3.5" /> Foundation ativa</Badge>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo da fundação Connect">
        <FoundationCard icon={<ShieldCheck />} label="Organização" value={organization.name} detail={organization.slug} />
        <FoundationCard icon={<UsersRound />} label="Setores" value={String(sectors.length)} detail="Setores configurados" />
        <FoundationCard icon={<UsersRound />} label="Operadores" value={String(operators.length)} detail="Membros ativos" />
        <FoundationCard icon={<MessageSquare />} label="Integrações" value="Não configuradas" detail="WhatsApp será tratado em gate posterior" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="connect-sectors-title">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
          <div>
            <h2 id="connect-sectors-title" className="font-serif text-xl font-semibold text-slate-950">Setores</h2>
            <p className="mt-1 text-sm text-slate-600">Cada setor possui classificação de dados e será usado para autorização contextual.</p>
          </div>
          <Badge variant="outline">{organization.name}</Badge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map(sector => (
            <div key={sector.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{sector.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{sector.slug}</p>
                </div>
                <Badge variant="outline" className={sector.data_classification === 'SENSITIVE' ? 'border-amber-300 text-amber-800' : 'text-slate-600'}>
                  {CONNECT_CLASSIFICATION_LABELS[sector.data_classification]}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-slate-500">{sector.active ? 'Ativo' : 'Inativo'} · ordem {sector.sort_order}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="connect-operators-title">
        <div>
          <h2 id="connect-operators-title" className="font-serif text-xl font-semibold text-slate-950">Operadores por setor</h2>
          <p className="mt-1 text-sm text-slate-600">Perfis existentes no EfetivaOS são reutilizados; o Connect apenas registra seus vínculos e permissões.</p>
        </div>

        {operators.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">Nenhum operador ativo encontrado.</p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Operador</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">Setores</th><th className="px-4 py-3">Permissões</th></tr></thead>
              <tbody>{operators.map(operator => <tr key={operator.profile_id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium text-slate-900">{operator.profile.full_name || 'Usuário sem nome'}</td><td className="px-4 py-3 text-slate-600">{operator.profile.role}</td><td className="px-4 py-3 text-slate-600">{operator.sector_permissions.length || (operator.profile.role === 'admin' ? 'Todos (admin)' : 'Nenhum')}</td><td className="px-4 py-3 text-slate-600">{operator.profile.role === 'admin' ? 'Administração da organização' : operator.sector_permissions.filter(permission => permission.can_view).map(permission => sectors.find(sector => sector.id === permission.sector_id)?.name).filter(Boolean).join(', ') || 'Sem acesso setorial'}</td></tr>)}</tbody>
            </table>
          </div>
        )}

        {profile?.role === 'admin' && (
          <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
            <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 size-5 shrink-0 text-teal-800" /><div><h3 className="font-semibold text-slate-950">Vincular operador a setor</h3><p className="mt-1 text-sm text-slate-600">A operação é protegida por RLS e gera evento de auditoria.</p></div></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Operador<select className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" value={effectiveProfileId} onChange={event => setSelectedProfileId(event.target.value)}><option value="">Selecione</option>{profiles.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.full_name || candidate.id} ({candidate.role})</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">Setor<select className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" value={effectiveSectorId} onChange={event => setSelectedSectorId(event.target.value)}><option value="">Selecione</option>{activeSectors.map(sector => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></label>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-700">{([['can_view', 'Visualizar'], ['can_assign', 'Atribuir'], ['can_transfer', 'Transferir'], ['can_manage', 'Gerenciar']] as const).map(([key, label]) => <label key={key} className="inline-flex items-center gap-2"><input type="checkbox" checked={permissions[key]} onChange={event => setPermissions(current => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}</div>
            <Button className="mt-4" onClick={() => void handleAssignment()} disabled={!effectiveProfileId || !effectiveSectorId || assignmentMutation.isPending}>{assignmentMutation.isPending ? 'Salvando...' : 'Salvar vínculo'}</Button>
            {assignmentMutation.isError && <p className="mt-2 text-sm text-red-700" role="alert">Não foi possível salvar o vínculo. Verifique as permissões.</p>}
          </div>
        )}
      </section>
    </div>
  )
}

function FoundationCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-800">{icon}</span><p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 break-words font-serif text-xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>
}
