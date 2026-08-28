import { useMemo, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, Plus, Search, XCircle, CheckCircle, Clock, ArrowUpRight, ArrowDownRight, Upload, Download } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drawer } from '@/components/ui/drawer'
import { ImportWizard } from './import-wizard'
import { exportData, TRANSACTION_COLUMNS } from '../lib/export-utils'
import {
  useTransactions,
  useTransactionDetail,
  useJournalEntries,
  useJournalLines,
  useCreateTransaction,
  useSettleTransaction,
  useCancelTransaction,
  useCategories,
  useFinancialAccounts,
  useParties,
  useCostCenters,
  useServiceLines,
  usePaymentMethods,
} from '../queries/finance-queries'
import { transactionBaseSchema, type TransactionBaseFormValues, MOVEMENT_TYPE_LABELS, MOVEMENT_TYPE_GROUPS, getStatusLabel } from '../schemas/finance-schemas'
import type { FinancialTransactionList, FinancialJournalEntryList, FinancialJournalLineList } from '../types/finance-types'

const STATUS_ICONS: Record<string, typeof Clock> = { pending: Clock, settled: CheckCircle, cancelled: XCircle }
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  settled: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-600',
}

function formatCurrency(v: number | string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

// ---------------------------------------------------------------------------
// Transaction Detail Drawer
// ---------------------------------------------------------------------------

function TransactionDetailDrawer({ transactionId, onClose }: { transactionId: string | null; onClose: () => void }) {
  const { data: tx } = useTransactionDetail(transactionId)
  const { data: entries = [] } = useJournalEntries(transactionId)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const { data: lines = [] } = useJournalLines(selectedEntryId)
  const settleMutation = useSettleTransaction()
  const cancelMutation = useCancelTransaction()

  const handleSettle = async () => {
    if (!tx) return
    const today = new Date().toISOString().slice(0, 10)
    await settleMutation.mutateAsync({ id: tx.id, paymentDate: today })
  }

  const handleCancel = async () => {
    if (!tx) return
    if (!confirm('Tem certeza que deseja cancelar este lançamento?')) return
    await cancelMutation.mutateAsync({ id: tx.id, reason: 'Cancelamento manual' })
  }

  if (!tx) return null

  const StatusIcon = STATUS_ICONS[tx.status] || Clock

  return (
    <Drawer open={!!transactionId} onOpenChange={(o) => { if (!o) { onClose(); setSelectedEntryId(null) } }} title="Detalhes do Lançamento">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-semibold">{tx.description}</p>
            <p className="text-sm text-slate-500">{MOVEMENT_TYPE_LABELS[tx.movement_type]} &middot; {formatDate(tx.transaction_date)}</p>
          </div>
          <Badge className={STATUS_COLORS[tx.status]}><StatusIcon className="mr-1 size-3" />{getStatusLabel(tx.status, tx.movement_type)}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-slate-500">Valor</span><p className="font-semibold">{formatCurrency(tx.amount)}</p></div>
          <div><span className="text-slate-500">Competência</span><p>{formatDate(tx.competence_date)}</p></div>
          {tx.origin_account_name && <div><span className="text-slate-500">Conta Origem</span><p>{tx.origin_account_name}</p></div>}
          {tx.destination_account_name && <div><span className="text-slate-500">Conta Destino</span><p>{tx.destination_account_name}</p></div>}
          {tx.category_name && <div><span className="text-slate-500">Categoria</span><p>{tx.category_name}</p></div>}
          {tx.party_name && <div><span className="text-slate-500">Pessoa</span><p>{tx.party_name}</p></div>}
          {tx.review_required && <div className="col-span-2"><Badge className="bg-orange-100 text-orange-800">Revisão Pendente</Badge></div>}
        </div>

        {tx.status === 'pending' && (
          <div className="flex gap-3">
            <Button size="sm" onClick={handleSettle} disabled={settleMutation.isPending}>Liquidar</Button>
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={cancelMutation.isPending}>Cancelar</Button>
          </div>
        )}

        <div className="border-t border-slate-100 pt-4">
          <h3 className="mb-3 text-sm font-semibold">Lançamentos Contábeis</h3>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum lançamento contábil gerado.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <button key={e.id} type="button" onClick={() => setSelectedEntryId(selectedEntryId === e.id ? null : e.id)}
                  className={`w-full rounded-lg border p-3 text-left text-sm transition hover:bg-slate-50 ${selectedEntryId === e.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{e.description}</span>
                    <span className="text-xs text-slate-500">{formatDate(e.entry_date)}</span>
                  </div>
                  {e.review_required && <Badge className="mt-1 bg-orange-100 text-orange-800 text-xs">Revisão</Badge>}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedEntryId && lines.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Partidas Dobradas</h4>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                   <th className="px-3 py-2">Conta</th><th className="px-3 py-2 text-right">Débito</th><th className="px-3 py-2 text-right">Crédito</th>
                </tr></thead>
                <tbody>{lines.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50">
                    <td className="px-3 py-2">{l.chart_account_code ? `${l.chart_account_code} - ${l.chart_account_name}` : l.chart_account_name || '-'}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(l.debit) > 0 ? formatCurrency(l.debit) : '-'}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(l.credit) > 0 ? formatCurrency(l.credit) : '-'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// Transaction Create Drawer
// ---------------------------------------------------------------------------

function TransactionCreateDrawer({ open, onClose, defaultType }: { open: boolean; onClose: () => void; defaultType?: string | null }) {
  const createMutation = useCreateTransaction()
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useFinancialAccounts()
  const { data: parties = [] } = useParties()
  const { data: costCenters = [] } = useCostCenters()
  const { data: serviceLines = [] } = useServiceLines()
  const { data: paymentMethods = [] } = usePaymentMethods()

  const [fv, setFv] = useState<Partial<TransactionBaseFormValues>>({
    movement_type: (defaultType as TransactionBaseFormValues['movement_type']) || 'RECEITA',
    transaction_date: new Date().toISOString().slice(0, 10),
    competence_date: new Date().toISOString().slice(0, 10),
  })
  const [fe, setFe] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open && defaultType) {
      setFv(p => ({ ...p, movement_type: defaultType as TransactionBaseFormValues['movement_type'] }))
    }
  }, [open, defaultType])

  const activeAccounts = useMemo(() => accounts.filter(a => a.active), [accounts])
  const activeCategories = useMemo(() => categories.filter(c => c.active), [categories])
  const activeParties = useMemo(() => parties.filter(p => p.active), [parties])

  const filteredCategories = useMemo(() => {
    if (!fv.movement_type) return activeCategories
    return activeCategories.filter(c => c.movement_type === fv.movement_type)
  }, [activeCategories, fv.movement_type])

  const handleSubmit = async () => {
    if (createMutation.isPending) return
    const r = transactionBaseSchema.safeParse({
      ...fv,
      idempotency_key: fv.idempotency_key || crypto.randomUUID(),
    })
    if (!r.success) {
      const e: Record<string, string> = {}
      for (const i of r.error.issues) e[i.path[0] as string] = i.message
      setFe(e); return
    }
    setFe({})
    try {
      await createMutation.mutateAsync(r.data)
      onClose()
      setFv({ movement_type: 'RECEITA', transaction_date: new Date().toISOString().slice(0, 10), competence_date: new Date().toISOString().slice(0, 10) })
    } catch (err: any) {
      setFe({ _form: err?.message || 'Erro ao criar lançamento.' })
    }
  }

  const mt = fv.movement_type || 'RECEITA'
  const showOrigin = ['RECEITA', 'DESPESA', 'TRANSFERENCIA', 'EMPRESTIMO_PAGO', 'RETIRADA', 'IMOBILIZADO', 'SALDO_INICIAL'].includes(mt)
  const showDest = ['DESPESA', 'TRANSFERENCIA', 'EMPRESTIMO_RECEBIDO', 'APORTE', 'IMOBILIZADO', 'SALDO_INICIAL'].includes(mt)
  const showCategory = ['RECEITA', 'DESPESA', 'APORTE', 'RETIRADA', 'IMOBILIZADO', 'AJUSTE'].includes(mt)
  const showParty = ['RECEITA', 'DESPESA'].includes(mt)

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose() }} title="Novo Lançamento">
      <div className="space-y-4 px-1">
        {fe._form && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{fe._form}</p>}

        <div>
          <label className="mb-1 block text-sm font-medium">Tipo de Movimento *</label>
          <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={mt}
            onChange={e => setFv(p => ({ ...p, movement_type: e.target.value as TransactionBaseFormValues['movement_type'] }))}>
            {MOVEMENT_TYPE_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </optgroup>
            ))}
          </select>
          {fe.movement_type && <p className="mt-1 text-xs text-red-600">{fe.movement_type}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Descrição *</label>
          <Input value={fv.description || ''} onChange={e => setFv(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Pagamento fornecedor XYZ" />
          {fe.description && <p className="mt-1 text-xs text-red-600">{fe.description}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Data do Lançamento *</label>
            <Input type="date" value={fv.transaction_date || ''} onChange={e => setFv(p => ({ ...p, transaction_date: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Competência *</label>
            <Input type="date" value={fv.competence_date || ''} onChange={e => setFv(p => ({ ...p, competence_date: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Valor (R$) *</label>
          <Input type="number" step="0.01" min="0" value={fv.amount || ''} onChange={e => setFv(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} placeholder="0,00" />
          {fe.amount && <p className="mt-1 text-xs text-red-600">{fe.amount}</p>}
        </div>

        {showOrigin && (
          <div>
            <label className="mb-1 block text-sm font-medium">Conta Origem *</label>
            <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.origin_account_id || ''}
              onChange={e => setFv(p => ({ ...p, origin_account_id: e.target.value || null }))}>
              <option value="">Selecione</option>
              {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}

        {showDest && (
          <div>
            <label className="mb-1 block text-sm font-medium">Conta Destino *</label>
            <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.destination_account_id || ''}
              onChange={e => setFv(p => ({ ...p, destination_account_id: e.target.value || null }))}>
              <option value="">Selecione</option>
              {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}

        {showCategory && (
          <div>
            <label className="mb-1 block text-sm font-medium">Categoria *</label>
            <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.category_id || ''}
              onChange={e => setFv(p => ({ ...p, category_id: e.target.value || null }))}>
              <option value="">Selecione</option>
              {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {showParty && (
          <div>
            <label className="mb-1 block text-sm font-medium">Pessoa</label>
            <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.party_id || ''}
              onChange={e => setFv(p => ({ ...p, party_id: e.target.value || null }))}>
              <option value="">Selecione (opcional)</option>
              {activeParties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Centro de Custo</label>
            <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.cost_center_id || ''}
              onChange={e => setFv(p => ({ ...p, cost_center_id: e.target.value || null }))}>
              <option value="">Nenhum</option>
              {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Linha de Serviço</label>
            <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.service_line_id || ''}
              onChange={e => setFv(p => ({ ...p, service_line_id: e.target.value || null }))}>
              <option value="">Nenhuma</option>
              {serviceLines.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Data Vencimento</label>
            <Input type="date" value={fv.due_date || ''} onChange={e => setFv(p => ({ ...p, due_date: e.target.value || null }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Forma de Pagamento</label>
            <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={fv.payment_method_id || ''}
              onChange={e => setFv(p => ({ ...p, payment_method_id: e.target.value || null }))}>
              <option value="">Nenhuma</option>
              {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Observações</label>
          <Input value={fv.notes || ''} onChange={e => setFv(p => ({ ...p, notes: e.target.value || null }))} placeholder="Notas opcionais" />
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Criando...' : 'Criar Transacao'}
          </Button>
        </div>
      </div>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TransactionsPage() {
  const { data: transactions = [], isLoading } = useTransactions()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const createType = searchParams.get('create')
    if (createType) {
      setCreateOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const filtered = useMemo(() => {
    if (!search) return transactions
    const q = search.toLowerCase()
    return transactions.filter(t =>
      t.description.toLowerCase().includes(q) ||
      (t.category_name || '').toLowerCase().includes(q) ||
      (t.party_name || '').toLowerCase().includes(q)
    )
  }, [transactions, search])

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Lançamentos Financeiros</h1>
          <p className="mt-1 text-sm text-slate-600">Registre receitas, despesas, transferências e demais movimentações financeiras.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportData(filtered as any, TRANSACTION_COLUMNS, 'lancamentos', 'csv')}>
            <Download className="mr-1 size-3.5" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData(filtered as any, TRANSACTION_COLUMNS, 'lancamentos', 'xlsx')}>
            <Download className="mr-1 size-3.5" />XLSX
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 size-3.5" />Importar
          </Button>
          <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 size-4" />Novo lançamento</Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-10" placeholder="Buscar lançamento..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">Nenhum lançamento encontrado.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Descricao</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3 text-right">Valor</th>
                <th className="px-5 py-3">Categoria</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const isRevenue = ['RECEITA', 'APORTE', 'EMPRESTIMO_RECEBIDO'].includes(t.movement_type)
                const StatusIcon = STATUS_ICONS[t.status] || Clock
                return (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer" onClick={() => setDetailId(t.id)}>
                    <td className="px-5 py-3 font-medium max-w-[280px] truncate">{t.description}</td>
                    <td className="px-5 py-3"><Badge variant="outline">{MOVEMENT_TYPE_LABELS[t.movement_type]}</Badge></td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(t.transaction_date)}</td>
                    <td className="px-5 py-3 text-right font-mono">
                      <span className={isRevenue ? 'text-emerald-700' : 'text-red-600'}>
                        {isRevenue ? <ArrowUpRight className="inline size-3.5" /> : <ArrowDownRight className="inline size-3.5" />}
                        {' '}{formatCurrency(t.amount)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 truncate max-w-[160px]">{t.category_name || '-'}</td>
                    <td className="px-5 py-3"><Badge className={STATUS_COLORS[t.status]}><StatusIcon className="mr-1 size-3" />{getStatusLabel(t.status, t.movement_type)}</Badge></td>
                    <td className="px-5 py-3"><Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDetailId(t.id) }} aria-label="Ver detalhes"><Eye className="size-4" /></Button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <TransactionCreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} defaultType={searchParams.get('create')} />
      <TransactionDetailDrawer transactionId={detailId} onClose={() => setDetailId(null)} />
      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
