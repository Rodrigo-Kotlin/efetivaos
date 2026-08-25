import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table'
import { ArrowUpDown, Pencil, Plus, Power, RotateCcw, Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, PageHeader, selectClassName, TableShell, TableSkeleton } from '@/components/shared/operational-ui'
import { useAuth } from '@/features/auth/auth-context'
import { useOnlineStatus } from '@/hooks/use-online-status'

import { RuleForm } from './rule-form'
import { RuleScopeBadge } from './rule-scope-badge'
import { useCreateRule, useRules, useSetRuleActive, useUpdateRule } from './rules-queries'
import { formatRuleValue, ruleCalculationLabels, type RuleFilter, type RuleInput, type RuleRow, type StatusFilter } from './rules-types'
import { formatDateTime } from '@/features/pricing/quotations/quotation.helpers'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Nao foi possivel concluir a operacao.'
}

function responsiveClass(id: string) {
  if (id === 'actions') return 'sticky right-0 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)]'
  if (id === 'target') return 'hidden md:table-cell'
  if (id === 'updated_at') return 'hidden lg:table-cell'
  if (id === 'calculation_type') return 'hidden md:table-cell'
  return ''
}

function targetName(rule: RuleRow): string {
  if (rule.scope_type === 'category' && rule.category) return rule.category.name
  if (rule.scope_type === 'item' && rule.catalog_item) return `${rule.catalog_item.code} - ${rule.catalog_item.name}`
  return '—'
}

export default function RulesPage() {
  const { profile } = useAuth()
  const online = useOnlineStatus()
  const query = useRules()
  const createMutation = useCreateRule()
  const updateMutation = useUpdateRule()
  const setActiveMutation = useSetRuleActive()
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<RuleFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updated_at', desc: true }])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<RuleRow | null>(null)

  const isAdmin = profile?.role === 'admin'
  const rules = useMemo(() => query.data ?? [], [query.data])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return rules.filter((rule) => {
      if (scope !== 'all' && rule.scope_type !== scope) return false
      if (status === 'active' && !rule.active) return false
      if (status === 'inactive' && rule.active) return false
      if (!term) return true
      return [
        rule.category?.name ?? '',
        rule.catalog_item?.code ?? '',
        rule.catalog_item?.name ?? '',
        ruleCalculationLabels[rule.calculation_type],
        rule.notes ?? '',
      ].some((field) => field.toLocaleLowerCase('pt-BR').includes(term))
    })
  }, [rules, search, scope, status])

  const toggle = useCallback(async (rule: RuleRow) => {
    try {
      await setActiveMutation.mutateAsync({ id: rule.id, active: !rule.active })
      toast.success(rule.active ? 'Regra inativada.' : 'Regra reativada.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }, [setActiveMutation])

  const columns = useMemo<ColumnDef<RuleRow>[]>(() => [
    { accessorKey: 'scope_type', header: 'Escopo', cell: ({ row }) => <RuleScopeBadge scope={row.original.scope_type} /> },
    { id: 'target', header: 'Aplicada a', cell: ({ row }) => targetName(row.original) },
    { id: 'calculation_type', header: 'Tipo', cell: ({ row }) => ruleCalculationLabels[row.original.calculation_type] },
    { accessorKey: 'value', header: 'Valor', cell: ({ row }) => formatRuleValue(row.original.calculation_type, row.original.value) },
    { accessorKey: 'active', header: 'Status', cell: ({ row }) => row.original.active ? <Badge>Ativa</Badge> : <Badge variant="secondary">Inativa</Badge> },
    { accessorKey: 'updated_at', header: 'Atualizado em', cell: ({ row }) => formatDateTime(row.original.updated_at) },
    {
      id: 'actions',
      enableSorting: false,
      header: () => <span className="sr-only">Acoes</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" disabled={!isAdmin || !online || updateMutation.isPending} onClick={() => { setEditing(row.original); setDrawerOpen(true) }} aria-label={`Editar regra ${targetName(row.original)}`}>
            <Pencil className="size-4" /><span className="hidden lg:inline">Editar</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!isAdmin || !online || setActiveMutation.isPending}
            onClick={() => void toggle(row.original)}
            aria-label={row.original.active ? `Inativar regra ${targetName(row.original)}` : `Reativar regra ${targetName(row.original)}`}
          >
            {row.original.active ? <><Power className="size-4" /><span className="hidden lg:inline">Inativar</span></> : <><RotateCcw className="size-4" /><span className="hidden lg:inline">Reativar</span></>}
          </Button>
        </div>
      ),
    },
  ], [isAdmin, online, updateMutation.isPending, setActiveMutation.isPending, toggle])

  // TanStack Table intentionally exposes non-memoizable functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  async function handleSubmit(input: RuleInput) {
    if (!isAdmin) throw new Error('Apenas Admin pode gerenciar regras.')
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, input })
      toast.success('Regra atualizada.')
    } else {
      await createMutation.mutateAsync(input)
      toast.success('Regra criada com sucesso.')
    }
  }

  function openNew() {
    setEditing(null)
    setDrawerOpen(true)
  }

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Motor de Precos"
        title="Regras de acrescimo"
        description="Cadastre regras percentuais ou fixas para item, categoria ou escopo global."
        actions={
          isAdmin ? (
            <Button onClick={openNew} disabled={!online}>
              <Plus className="size-4" /> Nova regra
            </Button>
          ) : undefined
        }
      />

      {!online && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          Voce esta sem conexao. Criacao, edicao e inativacao ficam bloqueadas ate reconectar.
        </div>
      )}

      {!isAdmin && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          Apenas Admin pode criar, editar ou inativar regras. A regra aplicada aparece na tela de Comparacao.
        </div>
      )}

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_14rem_14rem]">
        <label className="relative">
          <span className="sr-only">Buscar regras</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar por categoria, item, tipo..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          <span className="sr-only">Filtrar por escopo</span>
          <select className={`${selectClassName} w-full`} value={scope} onChange={(event) => setScope(event.target.value as RuleFilter)}>
            <option value="all">Escopo: todos</option>
            <option value="global">Global</option>
            <option value="category">Categoria</option>
            <option value="item">Item</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar por status</span>
          <select className={`${selectClassName} w-full`} value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            <option value="all">Status: todos</option>
            <option value="active">Ativas</option>
            <option value="inactive">Inativas</option>
          </select>
        </label>
      </div>

      {query.isLoading ? (
        <TableSkeleton columns={6} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : !isAdmin ? (
        <EmptyState
          title="Acesso restrito"
          description="Apenas Admin pode gerenciar regras de acrescimo. Acompanhe a regra aplicada na Comparacao."
          action={<Button asChild variant="outline"><Link to="/pricing/comparison">Abrir comparacao</Link></Button>}
        />
      ) : rules.length === 0 ? (
        <EmptyState
          title="Nenhuma regra de acrescimo configurada"
          description="Crie uma regra global para definir um padrao ou configure regras especificas por categoria/item."
          action={<Button onClick={openNew} disabled={!online}><Plus className="size-4" /> Criar regra</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma regra encontrada"
          description="Ajuste a busca ou os filtros para ver outras regras."
          action={<Button variant="outline" onClick={() => { setSearch(''); setScope('all'); setStatus('all') }}>Limpar filtros</Button>}
        />
      ) : (
        <TableShell>
          <table className="w-full min-w-[820px] text-left text-sm" aria-label="Regras de acrescimo">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => {
                    const direction = header.column.getIsSorted()
                    return (
                      <th key={header.id} className={`px-4 py-3 ${responsiveClass(header.column.id)}`} aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}>
                        {header.column.getCanSort() ? (
                          <button className="inline-flex items-center gap-1.5 hover:text-slate-900" type="button" onClick={header.column.getToggleSortingHandler()}>
                            {flexRender(header.column.columnDef.header, header.getContext())}<ArrowUpDown className="size-3.5" />
                          </button>
                        ) : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  {row.getVisibleCells().map((cell) => (
                    <td className={`px-4 py-3.5 align-top text-slate-700 ${responsiveClass(cell.column.id)}`} key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}

      <RuleForm
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) setEditing(null)
        }}
        rule={editing}
        onSubmit={(input) => handleSubmit(input).then(() => undefined)}
        submitLabel={editing ? 'Salvar alteracoes' : 'Criar regra'}
        title={editing ? 'Editar regra' : 'Nova regra'}
        description="Regras inativas nao disputam o calculo. Apenas uma regra ativa por escopo/alvo."
      />
    </div>
  )
}
