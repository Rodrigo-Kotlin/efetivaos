import { useMemo, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drawer } from '@/components/ui/drawer'
import { useFinancialAccounts, useCreateFinancialAccount, useUpdateFinancialAccount, useChartAccounts } from '../queries/finance-queries'
import { financialAccountSchema, type FinancialAccountFormValues } from '../schemas/finance-schemas'
import type { FinancialAccountList } from '../types/finance-types'

const TYPE_LABELS: Record<string, string> = {
  CAIXA: 'Caixa', CONTA_CORRENTE: 'Conta Corrente', POUPANCA: 'Poupanca',
  CARTAO: 'Cartao', INVESTIMENTO: 'Investimento', OUTRO: 'Outro',
}

export default function AccountsPage() {
  const { data: accounts = [], isLoading } = useFinancialAccounts()
  const { data: chartAccounts = [] } = useChartAccounts()
  const createMutation = useCreateFinancialAccount()
  const updateMutation = useUpdateFinancialAccount()

  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<FinancialAccountList | null>(null)
  const [fv, setFv] = useState<Partial<FinancialAccountFormValues>>({})
  const [fe, setFe] = useState<Record<string, string>>({})

  const cashAccounts = useMemo(() => chartAccounts.filter(a => a.is_cash && a.active), [chartAccounts])

  const filtered = useMemo(() => {
    if (!search) return accounts
    const q = search.toLowerCase()
    return accounts.filter(a => a.name.toLowerCase().includes(q) || (a.institution || '').toLowerCase().includes(q))
  }, [accounts, search])

  const openCreate = () => { setEditing(null); setFv({ active: true, account_type: 'CONTA_CORRENTE' }); setFe({}); setDrawerOpen(true) }
  const openEdit = (a: FinancialAccountList) => {
    setEditing(a)
    setFv({ name: a.name, chart_account_id: a.chart_account_id, institution: a.institution, account_type: a.account_type, active: a.active, opening_date: a.opening_date, notes: a.notes })
    setFe({}); setDrawerOpen(true)
  }

  const handleSubmit = async () => {
    const r = financialAccountSchema.safeParse(fv)
    if (!r.success) { const e: Record<string, string> = {}; for (const i of r.error.issues) e[i.path[0] as string] = i.message; setFe(e); return }
    setFe({})
    try {
      if (editing) await updateMutation.mutateAsync({ id: editing.id, values: r.data })
      else await createMutation.mutateAsync(r.data)
      setDrawerOpen(false)
    } catch { setFe({ _form: 'Erro ao salvar.' }) }
  }

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Contas Financeiras</h1>
          <p className="mt-1 text-sm text-slate-600">{accounts.length} contas</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 size-4" />Nova Conta</Button>
      </div>

      <div className="mb-6"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-10" placeholder="Buscar conta financeira..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>

      {isLoading ? <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
      : filtered.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><p className="text-sm text-slate-500">Nenhuma conta encontrada.</p></div>
      : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3">Nome</th><th className="px-5 py-3">Conta Contabil</th><th className="px-5 py-3">Instituicao</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>{filtered.map(a => (
              <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-5 py-3 font-medium">{a.name}</td>
                <td className="px-5 py-3 text-xs text-slate-600">{a.chart_account_code ? `${a.chart_account_code} - ${a.chart_account_name}` : '-'}</td>
                <td className="px-5 py-3 text-slate-600">{a.institution || '-'}</td>
                <td className="px-5 py-3"><Badge variant="outline">{TYPE_LABELS[a.account_type] || a.account_type}</Badge></td>
                <td className="px-5 py-3">{a.active ? <Badge className="bg-emerald-100 text-emerald-800">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
                <td className="px-5 py-3"><Button variant="ghost" size="icon" onClick={() => openEdit(a)} aria-label={`Editar ${a.name}`}><Pencil className="size-4" /></Button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title={editing ? 'Editar Conta Financeira' : 'Nova Conta Financeira'}>
        <div className="space-y-4 px-1">
          {fe._form && <p className="text-sm text-red-600">{fe._form}</p>}
          <div><label className="mb-1 block text-sm font-medium">Nome *</label><Input value={fv.name || ''} onChange={e => setFv(p => ({ ...p, name: e.target.value }))} placeholder="Banco Cora" />{fe.name && <p className="mt-1 text-xs text-red-600">{fe.name}</p>}</div>
          <div><label className="mb-1 block text-sm font-medium">Conta Contabil (Caixa/Banco) *</label>
            <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.chart_account_id || ''} onChange={e => setFv(p => ({ ...p, chart_account_id: e.target.value }))}>
              <option value="">Selecione</option>
              {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
            {fe.chart_account_id && <p className="mt-1 text-xs text-red-600">{fe.chart_account_id}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-sm font-medium">Instituicao</label><Input value={fv.institution || ''} onChange={e => setFv(p => ({ ...p, institution: e.target.value || null }))} placeholder="Cora, Nubank..." /></div>
            <div><label className="mb-1 block text-sm font-medium">Tipo</label>
              <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.account_type || 'CONTA_CORRENTE'} onChange={e => setFv(p => ({ ...p, account_type: e.target.value as FinancialAccountFormValues['account_type'] }))}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div><label className="mb-1 block text-sm font-medium">Data de Abertura</label><Input type="date" value={fv.opening_date || ''} onChange={e => setFv(p => ({ ...p, opening_date: e.target.value || null }))} /></div>
          <div><label className="mb-1 block text-sm font-medium">Observacoes</label><Input value={fv.notes || ''} onChange={e => setFv(p => ({ ...p, notes: e.target.value || null }))} placeholder="Notas opcionais" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 rounded border-slate-300" checked={fv.active !== false} onChange={e => setFv(p => ({ ...p, active: e.target.checked }))} /> Ativo</label>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
