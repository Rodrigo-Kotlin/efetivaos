import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, XCircle, Clock, AlertTriangle, RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

type ImportBatch = {
  id: string
  file_name: string
  file_type: string
  file_size: number
  status: string
  total_rows: number | null
  valid_rows: number | null
  imported_rows: number | null
  skipped_rows: number | null
  duplicate_rows: number | null
  error_rows: number | null
  errors: string[] | null
  column_mapping: Record<string, string> | null
  created_at: string
  completed_at: string | null
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  pending: { label: 'Pendente', icon: Clock, className: 'bg-slate-100 text-slate-700' },
  processing: { label: 'Processando', icon: Clock, className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Concluído', icon: CheckCircle, className: 'bg-emerald-100 text-emerald-700' },
  completed_with_errors: { label: 'Parcial', icon: AlertTriangle, className: 'bg-amber-100 text-amber-700' },
  failed: { label: 'Falhou', icon: XCircle, className: 'bg-red-100 text-red-700' },
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleString('pt-BR')
}

export default function ImportHistoryPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['finance', 'import-batches'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('financial_import_batches' as any)
        .select('*') as any)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as ImportBatch[]
    },
  })

  const batches = useMemo(() => data ?? [], [data])

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Histórico de Importações</h1>
          <p className="mt-1 text-sm text-slate-600">{batches.length} importações realizadas.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCcw className="mr-1 size-3.5" />Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : batches.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">Nenhuma importação realizada.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Arquivo</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-center">Linhas</th>
                <th className="px-5 py-3 text-center">Importadas</th>
                <th className="px-5 py-3 text-center">Duplicadas</th>
                <th className="px-5 py-3 text-center">Erros</th>
                <th className="px-5 py-3">Criado em</th>
                <th className="px-5 py-3">Concluído em</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(b => {
                const st = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending
                const Icon = st.icon
                return (
                  <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <div className="font-medium">{b.file_name}</div>
                      <div className="text-xs text-slate-500">{b.file_type.toUpperCase()} &middot; {fmtSize(b.file_size)}</div>
                    </td>
                    <td className="px-5 py-3"><Badge className={st.className}><Icon className="mr-1 size-3" />{st.label}</Badge></td>
                    <td className="px-5 py-3 text-center font-mono">{b.total_rows ?? '-'}</td>
                    <td className="px-5 py-3 text-center font-mono text-emerald-700">{b.imported_rows ?? '-'}</td>
                    <td className="px-5 py-3 text-center font-mono text-slate-500">{b.duplicate_rows ?? 0}</td>
                    <td className="px-5 py-3 text-center font-mono text-red-600">{b.error_rows ?? 0}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{fmtDate(b.created_at)}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{b.completed_at ? fmtDate(b.completed_at) : '-'}</td>
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
