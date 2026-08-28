import { Drawer } from '@/components/ui/drawer'
import { useCrmPipelineAnalytics } from '../queries/pipeline-queries'
import type { CrmPipelineAnalytics, CrmStageMetric, CrmLossAnalysis, CrmForecastMonth } from '@/types/database'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

type Props = {
  open: boolean
  onClose: () => void
  pipelineId?: string
}

export function IndicatorsDrawer({ open, onClose, pipelineId }: Props) {
  const { data: analytics, isLoading } = useCrmPipelineAnalytics(
    pipelineId ? { pipeline_id: pipelineId } : undefined
  )

  return (
    <Drawer open={open} onOpenChange={o => { if (!o) onClose() }} title="Indicadores do Pipeline">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 animate-pulse rounded bg-slate-100" />)}
        </div>
      ) : !analytics ? (
        <p className="text-sm text-slate-500">Sem dados disponíveis.</p>
      ) : (
        <div className="space-y-6">
          {/* Totals */}
          <section>
            <h3 className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Resumo</h3>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Abertas" value={String(analytics.totals.open_count)} sub={fmt(analytics.totals.open_value)} />
              <StatCard label="Ponderado" value={fmt(analytics.totals.weighted_value)} />
              <StatCard label="Ganhas" value={String(analytics.totals.won_count)} sub={fmt(analytics.totals.won_value)} accent="emerald" />
              <StatCard label="Perdidas" value={String(analytics.totals.lost_count)} sub={fmt(analytics.totals.lost_value)} accent="red" />
            </div>
          </section>

          {/* Conversion */}
          <section>
            <h3 className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Conversão</h3>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-slate-800">{analytics.conversion.rate}%</span>
                <span className="text-xs text-slate-500">({analytics.conversion.won} ganhas / {analytics.conversion.won + analytics.conversion.lost} finalizadas)</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Taxa de conversão = ganhas / (ganhas + perdidas)</p>
            </div>
          </section>

          {/* Stage Funnel */}
          <section>
            <h3 className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Funil por Etapa</h3>
            <div className="space-y-1">
              {analytics.stage_metrics.map((sm: CrmStageMetric) => (
                <div key={sm.stage_id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{sm.stage_name}</p>
                    <p className="text-[11px] text-slate-400">
                      Entradas: {sm.entered_count} · Saídas: {sm.exited_count} · Atual: {sm.current_count}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">{sm.avg_duration_days > 0 ? `${sm.avg_duration_days}d média` : '-'}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Loss Reasons */}
          {analytics.loss_reasons.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Motivos de Perda</h3>
              <div className="space-y-1">
                {analytics.loss_reasons.map((lr: CrmLossAnalysis) => (
                  <div key={lr.reason_id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{lr.reason_name}</p>
                      <p className="text-[11px] text-slate-400">{lr.count} ocorrências · {lr.percentage}%</p>
                    </div>
                    <span className="text-xs font-medium text-red-600">{fmt(lr.value)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Forecast */}
          <section>
            <h3 className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Previsão Comercial</h3>
            <div className="space-y-1">
              {analytics.forecast.map((f: CrmForecastMonth) => (
                <div key={f.month} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{f.month_label}</p>
                    <p className="text-[11px] text-slate-400">{f.opportunity_count} oportunidades</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-800">{fmt(f.total_value)}</p>
                    <p className="text-[11px] text-slate-400">Ponderado: {fmt(f.weighted_value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Drawer>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'emerald' | 'red' }) {
  const color = accent === 'emerald' ? 'text-emerald-700' : accent === 'red' ? 'text-red-600' : 'text-slate-800'
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}
