import { useMemo, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drawer } from '@/components/ui/drawer'
import { useServiceLines, useCreateServiceLine, useUpdateServiceLine } from '../queries/finance-queries'
import { serviceLineSchema, type ServiceLineFormValues } from '../schemas/finance-schemas'
import type { ServiceLine } from '../types/finance-types'

export default function ServiceLinesPage() {
  const { data: lines = [], isLoading } = useServiceLines()
  const createMutation = useCreateServiceLine()
  const updateMutation = useUpdateServiceLine()

  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceLine | null>(null)
  const [fv, setFv] = useState<Partial<ServiceLineFormValues>>({})
  const [fe, setFe] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    if (!search) return lines
    const q = search.toLowerCase()
    return lines.filter(l => l.name.toLowerCase().includes(q))
  }, [lines, search])

  const openCreate = () => { setEditing(null); setFv({ active: true }); setFe({}); setDrawerOpen(true) }
  const openEdit = (l: ServiceLine) => { setEditing(l); setFv({ name: l.name, active: l.active, description: l.description }); setFe({}); setDrawerOpen(true) }

  const handleSubmit = async () => {
    const r = serviceLineSchema.safeParse(fv)
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
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Linhas de Servico</h1>
          <p className="mt-1 text-sm text-slate-600">{lines.length} linhas</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 size-4" />Nova Linha</Button>
      </div>

      <div className="mb-6"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-10" placeholder="Buscar linha de servico..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>

      {isLoading ? <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
      : filtered.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><p className="text-sm text-slate-500">Nenhuma linha encontrada.</p></div>
      : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3">Nome</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>{filtered.map(l => (
              <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-5 py-3 font-medium">{l.name}</td>
                <td className="px-5 py-3">{l.active ? <Badge className="bg-emerald-100 text-emerald-800">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
                <td className="px-5 py-3"><Button variant="ghost" size="icon" onClick={() => openEdit(l)} aria-label={`Editar ${l.name}`}><Pencil className="size-4" /></Button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title={editing ? 'Editar Linha de Servico' : 'Nova Linha de Servico'}>
        <div className="space-y-4 px-1">
          {fe._form && <p className="text-sm text-red-600">{fe._form}</p>}
          <div><label className="mb-1 block text-sm font-medium">Nome *</label><Input value={fv.name || ''} onChange={e => setFv(p => ({ ...p, name: e.target.value }))} placeholder="Assessoria e Consultoria SST" />{fe.name && <p className="mt-1 text-xs text-red-600">{fe.name}</p>}</div>
          <div><label className="mb-1 block text-sm font-medium">Descricao</label><Input value={fv.description || ''} onChange={e => setFv(p => ({ ...p, description: e.target.value || null }))} placeholder="Descricao opcional" /></div>
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
