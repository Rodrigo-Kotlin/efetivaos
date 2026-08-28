import { useMemo, useState } from 'react'
import { Search, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { getStatusLabel } from '../schemas/finance-schemas'

type PayableRow = {
  transaction_id: string
  description: string
  movement_type: string
  status: string
  original_amount: number
  settled_amount: number
  open_amount: number
  transaction_date: string
  competence_date: string | null
  due_date: string | null
  overdue: boolean
  days_overdue: number
  party_name: string | null
  category_name: string | null
}

const STATUS_ICONS: Record<string, typeof Clock> = { pending: Clock, settled: CheckCircle, cancelled: XCircle }
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  settled: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-600',
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtDate(d: string | null) {
  if (!d) return '-'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

export default function PayablesPage() {
  const [search, setSearch] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['finance', 'payables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_payables_v' as any)
        .select('*')
        .order('due_date', { ascending: true })
      if (error) throw error
      return data as unknown as PayableRow[]
    },
  })

  const filtered = useMemo(() => {
    if (!data) return []
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter(t =>
      t.description.toLowerCase().includes(q) ||
      (t.party_name || '').toLowerCase().includes(q) ||
      (t.category_name || '').toLowerCase().includes(q)
    )
  }, [data, search])

  const totalOpen = useMemo(() => filtered.reduce((s, r) => s + Number(r.open_amount), 0), [filtered])
  const totalOverdue = useMemo(() => filtered.reduce((s, r) => s + (r.overdue ? Number(r.open_amount) : 0), 0), [filtered])

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Contas a Pagar</h1>
          <p className="mt-1 text-sm text-slate-600">
            {filtered.length} títulos &middot; Total em aberto: {fmt(totalOpen)}
            {totalOverdue > 0 && <span className="ml-2 text-red-600">({fmt(totalOverdue)} vencidos)</span>}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-10" placeholder="Buscar por descrição, pessoa ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">Nenhum título a pagar encontrado.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Descrição</th>
                <th className="px-5 py-3">Pessoa</th>
                <th className="px-5 py-3">Vencimento</th>
                <th className="px-5 py-3 text-right">Valor Original</th>
                <th className="px-5 py-3 text-right">Valor em Aberto</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const StatusIcon = STATUS_ICONS[t.status] || Clock
                return (
                  <tr key={t.transaction_id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${t.overdue ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-3 font-medium max-w-[280px] truncate">{t.description}</td>
                    <td className="px-5 py-3 text-slate-600">{t.party_name || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={t.overdue ? 'font-medium text-red-700' : 'text-slate-600'}>
                        {t.overdue && <AlertTriangle className="mr-1 inline size-3 text-red-500" />}
                        {fmtDate(t.due_date)}
                        {t.overdue && t.days_overdue > 0 && <span className="ml-1 text-xs text-red-500">({t.days_overdue}d)</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-600">{fmt(t.original_amount)}</td>
                    <td className="px-5 py-3 text-right font-mono font-medium">{fmt(t.open_amount)}</td>
                    <td className="px-5 py-3"><Badge className={STATUS_COLORS[t.status]}><StatusIcon className="mr-1 size-3" />{getStatusLabel(t.status, t.movement_type)}</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
