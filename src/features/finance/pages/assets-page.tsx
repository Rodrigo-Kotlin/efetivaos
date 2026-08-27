import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAssets, useCreateAsset, useUpdateAsset, useDisposeAsset, usePostDepreciation } from '../queries/finance-queries'
import { useChartAccounts, useCostCenters, useServiceLines } from '../queries/finance-queries'
import type { FinancialAssetList } from '@/types/database'

const fmt = (v: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  FULLY_DEPRECIATED: 'Totalmente depreciado',
  DISPOSED: 'Baixado',
  INACTIVE: 'Inativo',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'warning' | 'outline'> = {
  ACTIVE: 'default',
  FULLY_DEPRECIATED: 'secondary',
  DISPOSED: 'warning',
  INACTIVE: 'outline',
}

export default function AssetsPage() {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<FinancialAssetList | null>(null)
  const [fe, setFe] = useState<Record<string, string>>({})

  // Form state
  const [fv, setFv] = useState({
    asset_code: '', name: '', description: '', category: '',
    acquisition_date: new Date().toISOString().slice(0, 10),
    acquisition_value: '', residual_value: '0', useful_life_months: '60',
    location: '', responsible: '', serial_number: '', patrimony_number: '',
    notes: '', asset_chart_account_id: '', accumulated_depreciation_account_id: '',
    depreciation_expense_account_id: '', cost_center_id: '', service_line_id: '',
  })

  const { data: assets, isLoading } = useAssets()
  const { data: chartAccounts } = useChartAccounts()
  const { data: costCenters } = useCostCenters()
  const { data: serviceLines } = useServiceLines()
  const createMutation = useCreateAsset()
  const updateMutation = useUpdateAsset()
  const disposeMutation = useDisposeAsset()
  const postDepMutation = usePostDepreciation()

  const assetAccounts = useMemo(() =>
    (chartAccounts ?? []).filter(a => a.class === 'ATIVO' && a.current_class === 'NAO_CIRCULANTE' && a.posting),
    [chartAccounts])

  const depAccounts = useMemo(() =>
    (chartAccounts ?? []).filter(a => a.class === 'ATIVO' && a.bp_group === 'Imobilizado' && a.nature === 'CREDITO' && a.posting),
    [chartAccounts])

  const expAccounts = useMemo(() =>
    (chartAccounts ?? []).filter(a => a.class === 'DESPESA' && a.dre_class === 'DEPRECIACAO_AMORTIZACAO' && a.posting),
    [chartAccounts])

  const filtered = useMemo(() => {
    if (!assets) return []
    return assets.filter(a => {
      const matchSearch = !search ||
        a.asset_code.toLowerCase().includes(search.toLowerCase()) ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.category ?? '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === 'all' || a.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [assets, search, filterStatus])

  const summary = useMemo(() => {
    if (!filtered.length) return { count: 0, totalValue: 0, totalAccDep: 0, totalBookValue: 0 }
    return {
      count: filtered.length,
      totalValue: filtered.reduce((s, a) => s + Number(a.acquisition_value), 0),
      totalAccDep: filtered.reduce((s, a) => s + Number(a.accumulated_depreciation), 0),
      totalBookValue: filtered.reduce((s, a) => s + Number(a.book_value_estimated), 0),
    }
  }, [filtered])

  const openCreate = () => {
    setEditing(null)
    setFv({
      asset_code: '', name: '', description: '', category: '',
      acquisition_date: new Date().toISOString().slice(0, 10),
      acquisition_value: '', residual_value: '0', useful_life_months: '60',
      location: '', responsible: '', serial_number: '', patrimony_number: '',
      notes: '', asset_chart_account_id: '', accumulated_depreciation_account_id: '',
      depreciation_expense_account_id: '', cost_center_id: '', service_line_id: '',
    })
    setFe({}); setDrawerOpen(true)
  }

  const openEdit = (a: FinancialAssetList) => {
    setEditing(a)
    setFv({
      asset_code: a.asset_code, name: a.name, description: a.description ?? '',
      category: a.category ?? '', acquisition_date: a.acquisition_date,
      acquisition_value: String(a.acquisition_value), residual_value: String(a.residual_value),
      useful_life_months: String(a.useful_life_months),
      location: a.location ?? '', responsible: a.responsible ?? '',
      serial_number: a.serial_number ?? '', patrimony_number: a.patrimony_number ?? '',
      notes: a.notes ?? '',
      asset_chart_account_id: a.asset_chart_account_id ?? '',
      accumulated_depreciation_account_id: a.accumulated_depreciation_account_id ?? '',
      depreciation_expense_account_id: a.depreciation_expense_account_id ?? '',
      cost_center_id: a.cost_center_id ?? '', service_line_id: a.service_line_id ?? '',
    })
    setFe({}); setDrawerOpen(true)
  }

  const handleSubmit = async () => {
    const e: Record<string, string> = {}
    if (!fv.asset_code.trim()) e.asset_code = 'Obrigatorio'
    if (!fv.name.trim()) e.name = 'Obrigatorio'
    if (!fv.acquisition_date) e.acquisition_date = 'Obrigatorio'
    if (!fv.acquisition_value || Number(fv.acquisition_value) <= 0) e.acquisition_value = 'Valor deve ser > 0'
    if (Object.keys(e).length) { setFe(e); return }

    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          payload: {
            name: fv.name, description: fv.description || null, category: fv.category || null,
            location: fv.location || null, responsible: fv.responsible || null,
            serial_number: fv.serial_number || null, patrimony_number: fv.patrimony_number || null,
            notes: fv.notes || null,
            asset_chart_account_id: fv.asset_chart_account_id || null,
            accumulated_depreciation_account_id: fv.accumulated_depreciation_account_id || null,
            depreciation_expense_account_id: fv.depreciation_expense_account_id || null,
            cost_center_id: fv.cost_center_id || null, service_line_id: fv.service_line_id || null,
          },
        })
      } else {
        await createMutation.mutateAsync({
          asset_code: fv.asset_code, name: fv.name,
          description: fv.description || null, category: fv.category || null,
          acquisition_date: fv.acquisition_date,
          acquisition_value: Number(fv.acquisition_value),
          residual_value: Number(fv.residual_value || 0),
          useful_life_months: Number(fv.useful_life_months || 60),
          location: fv.location || null, responsible: fv.responsible || null,
          serial_number: fv.serial_number || null, patrimony_number: fv.patrimony_number || null,
          notes: fv.notes || null,
          asset_chart_account_id: fv.asset_chart_account_id || null,
          accumulated_depreciation_account_id: fv.accumulated_depreciation_account_id || null,
          depreciation_expense_account_id: fv.depreciation_expense_account_id || null,
          cost_center_id: fv.cost_center_id || null, service_line_id: fv.service_line_id || null,
        })
      }
      setDrawerOpen(false)
    } catch (err) {
      setFe({ submit: err instanceof Error ? err.message : 'Erro ao salvar' })
    }
  }

  const handleDispose = async (a: FinancialAssetList) => {
    if (!confirm(`Dar baixa no ativo ${a.asset_code} - ${a.name}?`)) return
    try { await disposeMutation.mutateAsync({ id: a.id }) }
    catch { /* error toast */ }
  }

  const handlePostDep = async (a: FinancialAssetList) => {
    const period = prompt('Periodo de competencia (YYYY-MM):', new Date().toISOString().slice(0, 7))
    if (!period) return
    try {
      await postDepMutation.mutateAsync({ assetId: a.id, competencePeriod: `${period}-01` })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao contabilizar')
    }
  }

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <Badge className="mb-4">Financeiro</Badge>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Ativos e Bens</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600">
            Registro patrimonial, vida util e depreciacao gerencial.
          </p>
        </div>
        <Button onClick={openCreate}>+ Novo bem</Button>
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total de bens</p>
          <p className="mt-2 font-serif text-2xl font-semibold">{summary.count}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Custo historico</p>
          <p className="mt-2 font-serif text-2xl font-semibold">{fmt(summary.totalValue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Dep. acumulada</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-red-600">{fmt(summary.totalAccDep)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Valor liquido</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-emerald-700">{fmt(summary.totalBookValue)}</p>
        </div>
      </section>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input placeholder="Buscar por codigo, nome ou categoria..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
          <option value="all">Todos os status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="FULLY_DEPRECIATED">Totalmente depreciado</option>
          <option value="DISPOSED">Baixado</option>
          <option value="INACTIVE">Inativo</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Codigo</th>
              <th className="px-4 py-3">Bem</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3 text-right">Aquisicao</th>
              <th className="px-4 py-3 text-right">Custo</th>
              <th className="px-4 py-3 text-right">Dep. Acum.</th>
              <th className="px-4 py-3 text-right">Valor Liq.</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Carregando...</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Nenhum ativo encontrado</td></tr>}
            {filtered.map(a => (
              <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{a.asset_code}</td>
                <td className="px-4 py-3 font-medium">{a.name}</td>
                <td className="px-4 py-3 text-slate-600">{a.category ?? '-'}</td>
                <td className="px-4 py-3 text-right text-slate-600">{new Date(a.acquisition_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-right font-medium">{fmt(a.acquisition_value)}</td>
                <td className="px-4 py-3 text-right text-red-600">{fmt(a.accumulated_depreciation)}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">{fmt(a.book_value_estimated)}</td>
                <td className="px-4 py-3"><Badge variant={STATUS_VARIANTS[a.status] ?? 'secondary'}>{STATUS_LABELS[a.status] ?? a.status}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>Editar</Button>
                    {a.status === 'ACTIVE' && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => handlePostDep(a)}>Depreciar</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDispose(a)}>Baixar</Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Disposed assets warning */}
      {filtered.some(a => a.status === 'DISPOSED') && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            <strong>Baixa operacional:</strong> Ativos com status &quot;Baixado&quot; foram desativados operacionalmente.
            Eventual baixa contabiliza deve ser lancada separadamente via transacao financeira.
          </p>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative ml-auto h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold">{editing ? 'Editar ativo' : 'Novo ativo / bem'}</h2>
              <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>X</Button>
            </div>

            {fe.submit && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{fe.submit}</div>}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Codigo do bem *</label>
                <Input value={fv.asset_code} onChange={e => setFv(f => ({ ...f, asset_code: e.target.value }))} disabled={!!editing} placeholder="Ex: AT-001" />
                {fe.asset_code && <p className="mt-1 text-xs text-red-600">{fe.asset_code}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Nome / Descricao *</label>
                <Input value={fv.name} onChange={e => setFv(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Notebook Dell" />
                {fe.name && <p className="mt-1 text-xs text-red-600">{fe.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Categoria</label>
                  <Input value={fv.category} onChange={e => setFv(f => ({ ...f, category: e.target.value }))} placeholder="Ex: Equipamento" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Data de aquisicao *</label>
                  <Input type="date" value={fv.acquisition_date} onChange={e => setFv(f => ({ ...f, acquisition_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Valor aquisicao (R$) *</label>
                  <Input type="number" step="0.01" value={fv.acquisition_value} onChange={e => setFv(f => ({ ...f, acquisition_value: e.target.value }))} />
                  {fe.acquisition_value && <p className="mt-1 text-xs text-red-600">{fe.acquisition_value}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Valor residual (R$)</label>
                  <Input type="number" step="0.01" value={fv.residual_value} onChange={e => setFv(f => ({ ...f, residual_value: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Vida util (meses)</label>
                  <Input type="number" value={fv.useful_life_months} onChange={e => setFv(f => ({ ...f, useful_life_months: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Localizacao</label>
                  <Input value={fv.location} onChange={e => setFv(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Responsavel</label>
                  <Input value={fv.responsible} onChange={e => setFv(f => ({ ...f, responsible: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Numero de serie</label>
                  <Input value={fv.serial_number} onChange={e => setFv(f => ({ ...f, serial_number: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Plaqueta</label>
                  <Input value={fv.patrimony_number} onChange={e => setFv(f => ({ ...f, patrimony_number: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Conta do imobilizado</label>
                <select value={fv.asset_chart_account_id} onChange={e => setFv(f => ({ ...f, asset_chart_account_id: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm">
                  <option value="">Nenhuma</option>
                  {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Conta Dep. Acumulada</label>
                  <select value={fv.accumulated_depreciation_account_id} onChange={e => setFv(f => ({ ...f, accumulated_depreciation_account_id: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm">
                    <option value="">Nenhuma</option>
                    {depAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Conta Desp. Depreciacao</label>
                  <select value={fv.depreciation_expense_account_id} onChange={e => setFv(f => ({ ...f, depreciation_expense_account_id: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm">
                    <option value="">Nenhuma</option>
                    {expAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Centro de custo</label>
                  <select value={fv.cost_center_id} onChange={e => setFv(f => ({ ...f, cost_center_id: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm">
                    <option value="">Nenhum</option>
                    {(costCenters ?? []).filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Linha de servico</label>
                  <select value={fv.service_line_id} onChange={e => setFv(f => ({ ...f, service_line_id: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm">
                    <option value="">Nenhuma</option>
                    {(serviceLines ?? []).filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Observacoes</label>
                <textarea value={fv.notes} onChange={e => setFv(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
