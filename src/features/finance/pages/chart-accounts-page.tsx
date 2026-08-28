import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Plus, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drawer } from '@/components/ui/drawer'
import { useChartAccounts, useCreateChartAccount, useUpdateChartAccount } from '../queries/finance-queries'
import { chartAccountSchema, type ChartAccountFormValues } from '../schemas/finance-schemas'
import type { ChartAccount, FinancialAccountClass } from '../types/finance-types'

const CLASS_LABELS: Record<FinancialAccountClass, string> = {
  ATIVO: 'Ativo', PASSIVO: 'Passivo', PL: 'Patrimônio Líquido',
  RECEITA: 'Receita', CUSTO: 'Custo', DESPESA: 'Despesa',
}

const CLASS_COLORS: Record<FinancialAccountClass, string> = {
  ATIVO: 'bg-blue-100 text-blue-800', PASSIVO: 'bg-rose-100 text-rose-800',
  PL: 'bg-purple-100 text-purple-800', RECEITA: 'bg-emerald-100 text-emerald-800',
  CUSTO: 'bg-orange-100 text-orange-800', DESPESA: 'bg-amber-100 text-amber-800',
}

const CLASS_ORDER: FinancialAccountClass[] = ['ATIVO', 'PASSIVO', 'PL', 'RECEITA', 'CUSTO', 'DESPESA']

export default function ChartAccountsPage() {
  const { data: accounts = [], isLoading } = useChartAccounts()
  const createMutation = useCreateChartAccount()
  const updateMutation = useUpdateChartAccount()

  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(CLASS_ORDER))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<ChartAccount | null>(null)
  const [fv, setFv] = useState<Partial<ChartAccountFormValues>>({})
  const [fe, setFe] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    if (!search) return accounts
    const q = search.toLowerCase()
    return accounts.filter(a => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.bp_group.toLowerCase().includes(q))
  }, [accounts, search])

  const grouped = useMemo(() => {
    const m = new Map<string, ChartAccount[]>()
    for (const a of filtered) { const arr = m.get(a.class) || []; arr.push(a); m.set(a.class, arr) }
    return m
  }, [filtered])

  const openCreate = () => {
    setEditing(null)
    setFv({ class: 'DESPESA', nature: 'DEBITO', posting: true, active: true, is_cash: false, presentation_sign: 1, dfc_default: 'OPERACIONAL', current_class: 'CIRCULANTE', bp_group: '', dre_class: '', dva_class: '' })
    setFe({}); setDrawerOpen(true)
  }

  const openEdit = (a: ChartAccount) => {
    setEditing(a)
    setFv({ code: a.code, name: a.name, class: a.class, nature: a.nature, posting: a.posting, active: a.active, current_class: a.current_class, bp_group: a.bp_group, dre_class: a.dre_class, dfc_default: a.dfc_default, dva_class: a.dva_class, is_cash: a.is_cash, presentation_sign: (a.presentation_sign as 1 | -1) })
    setFe({}); setDrawerOpen(true)
  }

  const handleSubmit = async () => {
    const r = chartAccountSchema.safeParse(fv)
    if (!r.success) { const e: Record<string, string> = {}; for (const i of r.error.issues) e[i.path[0] as string] = i.message; setFe(e); return }
    setFe({})
    try {
      if (editing) await updateMutation.mutateAsync({ id: editing.id, values: r.data })
      else await createMutation.mutateAsync(r.data)
      setDrawerOpen(false)
    } catch { setFe({ _form: 'Erro ao salvar.' }) }
  }

  const upd = (f: string, v: unknown) => setFv(p => ({ ...p, [f]: v }))

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Plano de Contas</h1>
          <p className="mt-1 text-sm text-slate-600">{accounts.length} contas</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 size-4" />Nova Conta</Button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-10" placeholder="Buscar por codigo, nome, grupo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><p className="text-sm text-slate-500">Nenhuma conta encontrada.</p></div>
      ) : (
        <div className="space-y-2">
          {CLASS_ORDER.map(cls => {
            const items = grouped.get(cls) || []
            if (!items.length) return null
            const isOpen = expanded.has(cls)
            return (
              <div key={cls} className="rounded-xl border border-slate-200 bg-white">
                <button type="button" onClick={() => setExpanded(p => { const n = new Set(p); if (isOpen) n.delete(cls); else n.add(cls); return n })} className="flex w-full items-center gap-3 px-5 py-3 text-left">
                  {isOpen ? <ChevronDown className="size-4 text-slate-400" /> : <ChevronRight className="size-4 text-slate-400" />}
                  <Badge className={CLASS_COLORS[cls]}>{CLASS_LABELS[cls]}</Badge>
                  <span className="text-sm text-slate-500">{items.length} contas</span>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          <th className="px-5 py-2">Codigo</th>
                          <th className="px-5 py-2">Nome</th>
                          <th className="px-5 py-2">Nat.</th>
                          <th className="px-5 py-2">Grupo BP</th>
                          <th className="px-5 py-2">DRE</th>
                          <th className="px-5 py-2">Caixa</th>
                          <th className="px-5 py-2">Ativo</th>
                          <th className="px-5 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(a => (
                          <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="px-5 py-2 font-mono text-xs">{a.code}</td>
                            <td className="px-5 py-2 font-medium">{a.name}</td>
                            <td className="px-5 py-2"><Badge variant="outline">{a.nature === 'DEBITO' ? 'D' : 'C'}</Badge></td>
                            <td className="px-5 py-2 text-slate-600">{a.bp_group || '-'}</td>
                            <td className="px-5 py-2 text-xs text-slate-500">{a.dre_class || '-'}</td>
                            <td className="px-5 py-2">{a.is_cash ? <Badge className="bg-emerald-100 text-emerald-800">Sim</Badge> : '-'}</td>
                            <td className="px-5 py-2">{a.active ? <Badge className="bg-emerald-100 text-emerald-800">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
                            <td className="px-5 py-2"><Button variant="ghost" size="icon" onClick={() => openEdit(a)} aria-label={`Editar ${a.name}`}><Pencil className="size-4" /></Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title={editing ? 'Editar Conta Contabil' : 'Nova Conta Contabil'}>
        <div className="space-y-4 px-1">
          {fe._form && <p className="text-sm text-red-600">{fe._form}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium">Codigo *</label>
            <Input value={fv.code || ''} onChange={e => upd('code', e.target.value)} placeholder="1.1.01.001" />
            {fe.code && <p className="mt-1 text-xs text-red-600">{fe.code}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nome *</label>
            <Input value={fv.name || ''} onChange={e => upd('name', e.target.value)} placeholder="Caixa Geral" />
            {fe.name && <p className="mt-1 text-xs text-red-600">{fe.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Classe *</label>
              <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.class || 'DESPESA'} onChange={e => upd('class', e.target.value)}>
                {Object.entries(CLASS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Natureza *</label>
              <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.nature || 'DEBITO'} onChange={e => upd('nature', e.target.value)}>
                <option value="DEBITO">Debito</option>
                <option value="CREDITO">Credito</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Circulante</label>
              <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.current_class || ''} onChange={e => upd('current_class', e.target.value || null)}>
                <option value="">N/A</option>
                <option value="CIRCULANTE">Circulante</option>
                <option value="NAO_CIRCULANTE">Não Circulante</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">DFC Padrao</label>
              <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.dfc_default || 'OPERACIONAL'} onChange={e => upd('dfc_default', e.target.value)}>
                <option value="OPERACIONAL">Operacional</option>
                <option value="INVESTIMENTO">Investimento</option>
                <option value="FINANCIAMENTO">Financiamento</option>
                <option value="NAO_CAIXA">Nao Caixa</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grupo BP</label>
            <Input value={fv.bp_group || ''} onChange={e => upd('bp_group', e.target.value)} placeholder="Disponibilidades" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Classe DRE</label>
              <Input value={fv.dre_class || ''} onChange={e => upd('dre_class', e.target.value)} placeholder="DESPESA_OPERACIONAL" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Classe DVA</label>
              <Input value={fv.dva_class || ''} onChange={e => upd('dva_class', e.target.value)} placeholder="PESSOAL" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 rounded border-slate-300" checked={fv.is_cash || false} onChange={e => upd('is_cash', e.target.checked)} /> Caixa/banco</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 rounded border-slate-300" checked={fv.posting !== false} onChange={e => upd('posting', e.target.checked)} /> Lancavel</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 rounded border-slate-300" checked={fv.active !== false} onChange={e => upd('active', e.target.checked)} /> Ativo</label>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
