import { useMemo, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drawer } from '@/components/ui/drawer'
import { useCategories, useCreateCategory, useUpdateCategory, useChartAccounts, useCostCenters, useServiceLines } from '../queries/finance-queries'
import { categorySchema, type CategoryFormValues } from '../schemas/finance-schemas'
import type { FinancialCategoryList } from '../types/finance-types'

const MOVEMENT_LABELS: Record<string, string> = {
  RECEITA: 'Receita', DESPESA: 'Despesa', TRANSFERENCIA: 'Transferencia',
  EMPRESTIMO_RECEBIDO: 'Emprestimo Recebido', EMPRESTIMO_PAGO: 'Emprestimo Pago',
  APORTE: 'Aporte', RETIRADA: 'Retirada', IMOBILIZADO: 'Imobilizado',
  SALDO_INICIAL: 'Saldo Inicial', AJUSTE: 'Ajuste',
}

const DFC_LABELS: Record<string, string> = {
  OPERACIONAL: 'Operacional', INVESTIMENTO: 'Investimento',
  FINANCIAMENTO: 'Financiamento', NAO_CAIXA: 'N/Caixa', TRANSFERENCIA: 'Transferencia',
}

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories()
  const { data: chartAccounts = [] } = useChartAccounts()
  const { data: costCenters = [] } = useCostCenters()
  const { data: serviceLines = [] } = useServiceLines()
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()

  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<FinancialCategoryList | null>(null)
  const [fv, setFv] = useState<Partial<CategoryFormValues>>({})
  const [fe, setFe] = useState<Record<string, string>>({})

  const postingAccounts = useMemo(() => chartAccounts.filter(a => a.posting && a.active), [chartAccounts])

  const filtered = useMemo(() => {
    if (!search) return categories
    const q = search.toLowerCase()
    return categories.filter(c => c.name.toLowerCase().includes(q) || c.movement_type.toLowerCase().includes(q))
  }, [categories, search])

  const openCreate = () => { setEditing(null); setFv({ movement_type: 'DESPESA', cash_flow_class: 'OPERACIONAL', active: true }); setFe({}); setDrawerOpen(true) }
  const openEdit = (c: FinancialCategoryList) => {
    setEditing(c)
    setFv({ name: c.name, movement_type: c.movement_type, counter_account_id: c.counter_account_id, cost_center_id: c.cost_center_id, service_line_id: c.service_line_id, cash_flow_class: c.cash_flow_class, active: c.active })
    setFe({}); setDrawerOpen(true)
  }

  const handleSubmit = async () => {
    const r = categorySchema.safeParse(fv)
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
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Categorias Financeiras</h1>
          <p className="mt-1 text-sm text-slate-600">{categories.length} categorias</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 size-4" />Nova Categoria</Button>
      </div>

      <div className="mb-6"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-10" placeholder="Buscar categoria..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>

      {isLoading ? <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
      : filtered.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><p className="text-sm text-slate-500">Nenhuma categoria encontrada.</p></div>
      : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3">Nome</th><th className="px-5 py-3">Movimento</th><th className="px-5 py-3">Conta Contrap.</th><th className="px-5 py-3">Centro Custo</th><th className="px-5 py-3">Linha Servico</th><th className="px-5 py-3">DFC</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>{filtered.map(c => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-5 py-3 font-medium">{c.name}</td>
                <td className="px-5 py-3"><Badge variant="outline">{MOVEMENT_LABELS[c.movement_type] || c.movement_type}</Badge></td>
                <td className="px-5 py-3 text-xs text-slate-600">{c.counter_account_name || '-'}</td>
                <td className="px-5 py-3 text-xs text-slate-600">{c.cost_center_name || '-'}</td>
                <td className="px-5 py-3 text-xs text-slate-600">{c.service_line_name || '-'}</td>
                <td className="px-5 py-3 text-xs">{DFC_LABELS[c.cash_flow_class] || c.cash_flow_class}</td>
                <td className="px-5 py-3">{c.active ? <Badge className="bg-emerald-100 text-emerald-800">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
                <td className="px-5 py-3"><Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label={`Editar ${c.name}`}><Pencil className="size-4" /></Button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title={editing ? 'Editar Categoria' : 'Nova Categoria'}>
        <div className="space-y-4 px-1">
          {fe._form && <p className="text-sm text-red-600">{fe._form}</p>}
          <div><label className="mb-1 block text-sm font-medium">Nome *</label><Input value={fv.name || ''} onChange={e => setFv(p => ({ ...p, name: e.target.value }))} placeholder="Receita - Assessoria SST" />{fe.name && <p className="mt-1 text-xs text-red-600">{fe.name}</p>}</div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-sm font-medium">Tipo Movimento *</label>
              <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.movement_type || 'DESPESA'} onChange={e => setFv(p => ({ ...p, movement_type: e.target.value as CategoryFormValues['movement_type'] }))}>
                {Object.entries(MOVEMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="mb-1 block text-sm font-medium">DFC</label>
              <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.cash_flow_class || 'OPERACIONAL'} onChange={e => setFv(p => ({ ...p, cash_flow_class: e.target.value as CategoryFormValues['cash_flow_class'] }))}>
                {Object.entries(DFC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div><label className="mb-1 block text-sm font-medium">Conta Contrapartida</label>
            <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.counter_account_id || ''} onChange={e => setFv(p => ({ ...p, counter_account_id: e.target.value || null }))}>
              <option value="">Nenhuma</option>
              {postingAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-sm font-medium">Centro de Custo</label>
              <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.cost_center_id || ''} onChange={e => setFv(p => ({ ...p, cost_center_id: e.target.value || null }))}>
                <option value="">Nenhum</option>
                {costCenters.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="mb-1 block text-sm font-medium">Linha de Servico</label>
              <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.service_line_id || ''} onChange={e => setFv(p => ({ ...p, service_line_id: e.target.value || null }))}>
                <option value="">Nenhuma</option>
                {serviceLines.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
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
