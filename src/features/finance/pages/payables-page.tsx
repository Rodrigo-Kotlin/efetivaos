import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Clock, CheckCircle, XCircle, AlertTriangle, Download, Eye, Filter, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { getStatusLabel } from '../schemas/finance-schemas'
import { exportData, PAYABLE_COLUMNS } from '../lib/export-utils'
import { fetchAllPayables, type PayableListFilters, type PayableListParams, type PayableSort } from '../api/finance-api'
import { usePayables, usePayablesTotal, useSettleTransaction, useReverseTransaction, useFinancialAccounts, usePaymentMethods, useCategories, useParties } from '../queries/finance-queries'
import { FilteredTotalCard } from '../components/filtered-total-card'
import { CollectionActions, CollectionFilters, CollectionResultsCount, CollectionSearch, CollectionSort, CollectionToolbar, ClearFiltersButton, FilterChip } from '@/components/shared/collection-toolbar'
import { EmptyState, ErrorState, TableShell, TableSkeleton, selectClassName } from '@/components/shared/operational-ui'
import { normalizeCollectionPage, parseCollectionUrl, serializeCollectionUrl, type CollectionPageSize, type CollectionUrlOptions, type CollectionUrlState } from '@/components/shared/collection-url-state'
import { PaginationControls } from '@/components/shared/pagination-controls'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { FinancialPayableList, FinancialTransactionStatus } from '@/types/database'
import { FinancialTitleDetailDrawer } from '../financial-title-detail-drawer'

type PayableRow = FinancialPayableList

const STATUS_ICONS: Record<string, typeof Clock> = { pending: Clock, settled: CheckCircle, cancelled: XCircle }
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  settled: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-600',
}

function fmt(v: number | string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
}

function fmtDate(d: string | null) {
  if (!d) return '-'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

const PAYABLE_FILTER_KEYS = ['dueDateFrom', 'dueDateTo', 'overdue', 'status', 'personId', 'accountId', 'categoryId'] as const
const PAYABLE_URL_OPTIONS: CollectionUrlOptions = {
  defaultPageSize: 25,
  defaultSort: 'due_date',
  defaultDirection: 'asc',
  sortKeys: ['due_date', 'original_amount', 'status'],
  filterKeys: PAYABLE_FILTER_KEYS,
}

function filterValue(state: CollectionUrlState, key: string): string {
  return state.filters[key]?.[0] ?? ''
}

function validDate(value: string): boolean {
  return value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function validStatus(value: string): value is FinancialTransactionStatus {
  return value === '' || value === 'pending' || value === 'settled' || value === 'cancelled'
}

function validOverdue(value: string): value is NonNullable<PayableListParams['overdue']> {
  return value === 'overdue' || value === 'upcoming'
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return fallback
}

// ---------------------------------------------------------------------------
// Settle Dialog (COR-3, COR-16)
// ---------------------------------------------------------------------------

function SettleDialog({ tx, open, onClose }: { tx: PayableRow | null; open: boolean; onClose: () => void }) {
  const settleMutation = useSettleTransaction()
  const { data: accounts = [] } = useFinancialAccounts()
  const { data: paymentMethods = [] } = usePaymentMethods()
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [financialAccountId, setFinancialAccountId] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')

  const activeAccounts = useMemo(() => accounts.filter(a => a.active), [accounts])

  const handleSettle = async () => {
    if (!tx || !financialAccountId) return
    try {
      await settleMutation.mutateAsync({
        id: tx.transaction_id,
        paymentDate,
        financialAccountId,
        paymentMethodId: paymentMethodId || null,
      })
      toast.success('Pagamento registrado com sucesso.')
      onClose()
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Erro ao registrar pagamento.'))
    }
  }

  if (!tx) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar Titulo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{tx.description} &middot; {fmt(tx.original_amount)}</p>
          <div>
            <label className="mb-1 block text-sm font-medium">Data *</label>
            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Conta Financeira *</label>
            <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={financialAccountId} onChange={e => setFinancialAccountId(e.target.value)}>
              <option value="">Selecione</option>
              {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Forma de Pagamento</label>
            <select className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={paymentMethodId} onChange={e => setPaymentMethodId(e.target.value)}>
              <option value="">Nenhuma</option>
              {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSettle} disabled={settleMutation.isPending || !financialAccountId}>
            {settleMutation.isPending ? 'Pagando...' : 'Confirmar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Reverse Dialog
// ---------------------------------------------------------------------------

function ReverseDialog({ tx, open, onClose }: { tx: PayableRow | null; open: boolean; onClose: () => void }) {
  const reverseMutation = useReverseTransaction()
  const [reason, setReason] = useState('')

  const handleReverse = async () => {
    if (!tx || !reason.trim()) return
    try {
      await reverseMutation.mutateAsync({ id: tx.transaction_id, reason: reason.trim() })
      toast.success('Estorno realizado com sucesso.')
      onClose()
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Erro ao estornar.'))
    }
  }

  if (!tx) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Estornar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            O estorno ira reverter todas as entradas contabeis de <strong>{tx.description}</strong> ({fmt(tx.original_amount)}).
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium">Motivo do Estorno *</label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo obrigatorio" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button variant="destructive" onClick={handleReverse} disabled={reverseMutation.isPending || !reason.trim()}>
            {reverseMutation.isPending ? 'Estornando...' : 'Confirmar Estorno'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PayablesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlState = useMemo(() => parseCollectionUrl(searchParams, PAYABLE_URL_OPTIONS), [searchParams])
  const [searchDraft, setSearchDraft] = useState(urlState.search)
  const debouncedSearch = useDebouncedValue(searchDraft, 300)
  const [settleTx, setSettleTx] = useState<PayableRow | null>(null)
  const [reverseTx, setReverseTx] = useState<PayableRow | null>(null)
  const [detailTx, setDetailTx] = useState<PayableRow | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const { data: financialAccounts = [] } = useFinancialAccounts()
  const { data: categories = [] } = useCategories()
  const { data: parties = [] } = useParties()

  const filterParams = useMemo<PayableListFilters>(() => {
    const personId = filterValue(urlState, 'personId')
    const categoryId = filterValue(urlState, 'categoryId')
    const overdue = filterValue(urlState, 'overdue')
    const status = filterValue(urlState, 'status')
    return {
      search: urlState.search,
      dueDateFrom: validDate(filterValue(urlState, 'dueDateFrom')) ? filterValue(urlState, 'dueDateFrom') || undefined : undefined,
      dueDateTo: validDate(filterValue(urlState, 'dueDateTo')) ? filterValue(urlState, 'dueDateTo') || undefined : undefined,
      overdue: validOverdue(overdue) ? overdue : undefined,
      status: validStatus(status) && status ? status : undefined,
      personId: personId || undefined,
      categoryName: categories.find(category => category.id === categoryId)?.name,
      accountId: filterValue(urlState, 'accountId') || undefined,
    }
  }, [categories, urlState])
  const queryParams = useMemo<PayableListParams>(() => ({
    ...filterParams,
    page: urlState.page,
    pageSize: urlState.pageSize,
    sort: urlState.sort as PayableSort,
    direction: urlState.direction,
  }), [filterParams, urlState.page, urlState.pageSize, urlState.sort, urlState.direction])
  const { data, isLoading, isFetching, isError, refetch } = usePayables(queryParams)
  const { data: filteredTotal, isLoading: isTotalLoading, isError: isTotalError } = usePayablesTotal(filterParams)
  const payables = data?.rows ?? []
  const total = data?.count ?? 0

  const updateUrl = useCallback((patch: Partial<CollectionUrlState>, resetPage = true, replace = false) => {
    const current = parseCollectionUrl(searchParams, PAYABLE_URL_OPTIONS)
    const filters = patch.filters
      ? Object.keys(patch.filters).length === 0 ? {} : { ...current.filters, ...patch.filters }
      : current.filters
    const next: CollectionUrlState = {
      ...current,
      ...patch,
      page: resetPage ? 1 : patch.page ?? current.page,
      filters,
    }
    const collectionKeys = new Set(['page', 'pageSize', 'search', 'sort', 'direction', ...PAYABLE_FILTER_KEYS])
    const nextParams = new URLSearchParams()
    for (const [key, value] of searchParams.entries()) {
      if (!collectionKeys.has(key)) nextParams.append(key, value)
    }
    const collectionParams = serializeCollectionUrl(next, PAYABLE_URL_OPTIONS)
    for (const [key, value] of collectionParams.entries()) nextParams.append(key, value)
    setSearchParams(nextParams, { replace })
  }, [searchParams, setSearchParams])

  const setFilter = useCallback((key: string, value: string) => {
    updateUrl({ filters: { [key]: value ? [value] : [] } })
  }, [updateUrl])

  useEffect(() => {
    if (debouncedSearch !== urlState.search) updateUrl({ search: debouncedSearch }, true, true)
  }, [debouncedSearch, updateUrl, urlState.search])

  useEffect(() => {
    if (searchDraft !== urlState.search && debouncedSearch === urlState.search) {
      // Keep the input synchronized with browser back/forward without changing collection state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchDraft(urlState.search)
    }
  }, [debouncedSearch, searchDraft, urlState.search])

  useEffect(() => {
    if (isLoading || isFetching || isError || !data) return
    const normalizedPage = normalizeCollectionPage(urlState.page, data.count, data.pageCount)
    if (normalizedPage !== urlState.page) updateUrl({ page: normalizedPage }, false, true)
  }, [data, isError, isFetching, isLoading, updateUrl, urlState.page])

  const activeFilters = useMemo(() => Object.entries(urlState.filters).flatMap(([key, values]) => values.map(value => ({ key, value }))), [urlState.filters])
  const hasActiveFilters = Boolean(urlState.search || activeFilters.length)
  const sortValue = `${urlState.sort}:${urlState.direction}`
  const statusOptions: Array<[string, string]> = [['pending', 'Pendente'], ['settled', 'Liquidado'], ['cancelled', 'Cancelado']]
  const overdueOptions: Array<[string, string]> = [['overdue', 'Vencidos'], ['upcoming', 'A vencer']]
  const accountLabel = (id: string) => financialAccounts.find(account => account.id === id)?.name ?? id
  const categoryLabel = (id: string) => categories.find(category => category.id === id)?.name ?? id
  const partyLabel = (id: string) => parties.find(party => party.id === id)?.name ?? id
  const filterLabels: Record<string, (value: string) => string> = {
    dueDateFrom: value => `Vencimento desde ${value}`,
    dueDateTo: value => `Vencimento ate ${value}`,
    overdue: value => overdueOptions.find(([key]) => key === value)?.[1] ?? value,
    status: value => `Status: ${statusOptions.find(([key]) => key === value)?.[1] ?? value}`,
    personId: value => `Pessoa: ${partyLabel(value)}`,
    accountId: value => `Conta: ${accountLabel(value)}`,
    categoryId: value => `Categoria: ${categoryLabel(value)}`,
  }

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setIsExporting(true)
    try {
      const rows = await fetchAllPayables(queryParams)
      exportData(rows as unknown as Record<string, unknown>[], PAYABLE_COLUMNS, 'contas_a_pagar', format)
      toast.success(`${rows.length} contas a pagar exportadas.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel exportar as contas a pagar.')
    } finally {
      setIsExporting(false)
    }
  }

  const clearFilters = () => {
    setSearchDraft('')
    updateUrl({ search: '', filters: {} })
  }

  const renderActions = (tx: PayableRow) => (
    <>
      <Button variant="ghost" size="sm" onClick={() => setDetailTx(tx)}><Eye className="mr-1 size-3" />Ver detalhes</Button>
      {tx.status === 'pending' && <Button variant="outline" size="sm" onClick={() => setSettleTx(tx)}>Pagar</Button>}
      {tx.status === 'settled' && <Button variant="outline" size="sm" onClick={() => setReverseTx(tx)}>Estornar</Button>}
    </>
  )

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Contas a Pagar</h1>
          <p className="mt-1 text-sm text-slate-600">Acompanhe vencimentos, saldos em aberto e pagamentos do financeiro.</p>
        </div>
        <FilteredTotalCard className="w-full sm:w-auto sm:min-w-[240px]" title="Total a pagar" total={filteredTotal} isLoading={isTotalLoading} isError={isTotalError} />
      </div>

      <CollectionToolbar
        className="mb-6"
        actions={
          <>
            <CollectionResultsCount page={urlState.page} pageSize={urlState.pageSize} total={total} label="contas a pagar" />
            <CollectionActions>
              <CollectionSort
                value={sortValue}
                onChange={value => {
                  const [sort, direction] = value.split(':') as [PayableSort, 'asc' | 'desc']
                  updateUrl({ sort, direction })
                }}
                options={[{ value: 'due_date:asc', label: 'Vencimento mais próximo' }, { value: 'due_date:desc', label: 'Vencimento mais distante' }, { value: 'original_amount:desc', label: 'Maior valor' }, { value: 'original_amount:asc', label: 'Menor valor' }]}
              />
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={isExporting}><Download className="mr-1 size-3.5" />CSV</Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('xlsx')} disabled={isExporting}><Download className="mr-1 size-3.5" />XLSX</Button>
            </CollectionActions>
          </>
        }
      >
        <CollectionSearch value={searchDraft} onChange={setSearchDraft} placeholder="Buscar por descricao, pessoa ou categoria..." />
        <CollectionFilters>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">De<Input type="date" value={filterValue(urlState, 'dueDateFrom')} onChange={event => setFilter('dueDateFrom', event.target.value)} className="h-10" /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Ate<Input type="date" value={filterValue(urlState, 'dueDateTo')} onChange={event => setFilter('dueDateTo', event.target.value)} className="h-10" /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Vencimento<select className={selectClassName} value={filterValue(urlState, 'overdue')} onChange={event => setFilter('overdue', event.target.value)}><option value="">Todos</option>{overdueOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Status<select className={selectClassName} value={filterValue(urlState, 'status')} onChange={event => setFilter('status', event.target.value)}><option value="">Todos</option>{statusOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Pessoa<select className={selectClassName} value={filterValue(urlState, 'personId')} onChange={event => setFilter('personId', event.target.value)}><option value="">Todas</option>{parties.map(party => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
          <details className="relative">
            <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><Filter className="size-4" />Mais filtros</summary>
            <div className="absolute left-0 z-20 mt-2 grid min-w-[280px] gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Conta<select className={selectClassName} value={filterValue(urlState, 'accountId')} onChange={event => setFilter('accountId', event.target.value)}><option value="">Todas</option>{financialAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Categoria<select className={selectClassName} value={filterValue(urlState, 'categoryId')} onChange={event => setFilter('categoryId', event.target.value)}><option value="">Todas</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            </div>
          </details>
          <ClearFiltersButton onClick={clearFilters} disabled={!hasActiveFilters} />
        </CollectionFilters>
        {(hasActiveFilters || isExporting) && <div className="flex basis-full flex-wrap items-center gap-2">{urlState.search && <FilterChip label={`Busca: ${urlState.search}`} onRemove={() => { setSearchDraft(''); updateUrl({ search: '' }) }} />}{activeFilters.map(({ key, value }) => <FilterChip key={`${key}-${value}`} label={filterLabels[key]?.(value) ?? `${key}: ${value}`} onRemove={() => setFilter(key, '')} />)}{isExporting && <span className="text-xs text-slate-500"><Loader2 className="mr-1 inline size-3.5 animate-spin" />Exportando todos os resultados...</span>}</div>}
      </CollectionToolbar>

      {isLoading ? <TableSkeleton columns={7} /> : isError ? <ErrorState onRetry={() => void refetch()} /> : payables.length === 0 ? (
        <EmptyState title={hasActiveFilters ? 'Nenhuma conta a pagar atende aos filtros' : 'Nenhuma conta a pagar encontrada'} description={hasActiveFilters ? 'Limpe ou ajuste os filtros para tentar novamente.' : 'As contas a pagar cadastradas aparecerão aqui.'} action={hasActiveFilters ? <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button> : <span className="text-sm text-slate-500">Nenhum título disponível.</span>} />
      ) : (
        <TableShell>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Descricao</th><th className="px-5 py-3">Pessoa</th><th className="px-5 py-3">Vencimento</th><th className="px-5 py-3 text-right">Valor Original</th><th className="px-5 py-3 text-right">Valor em Aberto</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>{payables.map(t => { const StatusIcon = STATUS_ICONS[t.status] || Clock; return <tr key={t.transaction_id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${t.overdue ? 'bg-red-50/30' : ''}`}><td className="max-w-[280px] truncate px-5 py-3 font-medium">{t.description}</td><td className="px-5 py-3 text-slate-600">{t.party_name || '-'}</td><td className="px-5 py-3"><span className={t.overdue ? 'font-medium text-red-700' : 'text-slate-600'}>{t.overdue && <AlertTriangle className="mr-1 inline size-3 text-red-500" />}{fmtDate(t.due_date)}{t.overdue && t.days_overdue && t.days_overdue > 0 && <span className="ml-1 text-xs text-red-500">({t.days_overdue}d)</span>}</span></td><td className="px-5 py-3 text-right font-mono text-slate-600">{fmt(t.original_amount)}</td><td className="px-5 py-3 text-right font-mono font-medium">{fmt(t.open_amount)}</td><td className="px-5 py-3"><Badge className={STATUS_COLORS[t.status]}><StatusIcon className="mr-1 size-3" />{getStatusLabel(t.status, t.movement_type)}</Badge></td><td className="px-5 py-3"><div className="flex gap-2">{renderActions(t)}</div></td></tr> })}</tbody>
          </table>
          <div className="divide-y divide-slate-100 md:hidden">{payables.map(t => { const StatusIcon = STATUS_ICONS[t.status] || Clock; return <article key={t.transaction_id} className={`space-y-3 p-4 ${t.overdue ? 'bg-red-50/30' : ''}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-medium text-slate-950">{t.description}</h2><p className="mt-1 text-sm text-slate-600">{t.party_name || 'Pessoa nao informada'}</p></div><Badge className={STATUS_COLORS[t.status]}><StatusIcon className="mr-1 size-3" />{getStatusLabel(t.status, t.movement_type)}</Badge></div><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-500">Vencimento</p><p className={t.overdue ? 'font-medium text-red-700' : 'text-slate-700'}>{fmtDate(t.due_date)}</p></div><div><p className="text-xs text-slate-500">Em aberto</p><p className="font-mono font-medium text-slate-900">{fmt(t.open_amount)}</p></div></div><div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">Original: {fmt(t.original_amount)}</span><div className="flex gap-2">{renderActions(t)}</div></div></article> })}</div>
        </TableShell>
      )}

      {!isLoading && !isError && total > 0 && <PaginationControls page={urlState.page} pageSize={urlState.pageSize} total={total} onPageChange={page => updateUrl({ page }, false)} onPageSizeChange={pageSize => updateUrl({ pageSize: pageSize as CollectionPageSize })} />}

      <SettleDialog tx={settleTx} open={!!settleTx} onClose={() => setSettleTx(null)} />
      <ReverseDialog tx={reverseTx} open={!!reverseTx} onClose={() => setReverseTx(null)} />
      <FinancialTitleDetailDrawer
        transactionId={detailTx?.transaction_id ?? null}
        title="Detalhes da conta a pagar"
        settleLabel="Pagar titulo"
        onClose={() => setDetailTx(null)}
        onSettle={() => { if (detailTx) setSettleTx(detailTx); setDetailTx(null) }}
        onReverse={() => { if (detailTx) setReverseTx(detailTx); setDetailTx(null) }}
      />
    </div>
  )
}
