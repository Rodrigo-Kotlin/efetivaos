import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { ErrorState, TableSkeleton } from '@/components/shared/operational-ui'

import { CommercialStatusBadge } from './commercial-status'
import { reviewReasonLabel } from './commercial-status-helpers'
import { formatComparisonCurrency, formatComparisonDate, formatRuleScope, formatRuleValue } from './comparison-helpers'
import { useApprovePrice, useComparisonOffers, useInactivatePrice } from './comparison-queries'
import type { ComparisonRow } from './comparison-types'

type ReviewDrawerProps = {
  row: ComparisonRow | null
  onOpenChange: (open: boolean) => void
  isAdmin: boolean
  online: boolean
  onConfigureRule: () => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Nao foi possivel concluir a operacao.'
}

export function ReviewDrawer({ row, onOpenChange, isAdmin, online, onConfigureRule }: ReviewDrawerProps) {
  const offersQuery = useComparisonOffers(row?.catalog_item_id ?? null)
  const approveMutation = useApprovePrice()
  const inactivateMutation = useInactivatePrice()
  const eligible = (offersQuery.data ?? []).filter((offer) => offer.is_eligible)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const approvedStillEligible = eligible.some((offer) => offer.quotation_item_id === row?.approved_source_quotation_item_id)
  const currentSelectionIsEligible = eligible.some((offer) => offer.quotation_item_id === selectedSourceId)
  const preserveManualSource = row?.manual_source === true && approvedStillEligible
  const effectiveSourceId = currentSelectionIsEligible ? selectedSourceId : preserveManualSource ? row?.approved_source_quotation_item_id ?? null : row?.best_quotation_item_id ?? null
  const selectedOffer = eligible.find((offer) => offer.quotation_item_id === effectiveSourceId) ?? null
  const isAutomatic = effectiveSourceId === row?.best_quotation_item_id
  const difference = selectedOffer && row?.best_cost ? Number(selectedOffer.unit_price) - Number(row.best_cost) : null
  const pending = approveMutation.isPending || inactivateMutation.isPending
  const handleOpenChange = (open: boolean) => {
    if (!open) setSelectedSourceId(null)
    onOpenChange(open)
  }

  const approve = async () => {
    if (!row || !effectiveSourceId) return
    if (!online) { toast.error('Sem conexao. Reconecte para aprovar o preco.'); return }
    try {
      const result = await approveMutation.mutateAsync({
        catalogItemId: row.catalog_item_id,
        decisionToken: row.decision_token,
        sourceQuotationItemId: isAutomatic ? null : effectiveSourceId,
      })
      toast.success(`Preco comercial aprovado em ${formatComparisonCurrency(result.final_price)}.`)
      handleOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const inactivate = async () => {
    if (!row) return
    if (!window.confirm(`Inativar o preco comercial de ${row.item_name}? O registro permanecera na Tabela de Precos.`)) return
    if (!online) { toast.error('Sem conexao. Reconecte para inativar o preco.'); return }
    try {
      await inactivateMutation.mutateAsync({ catalogItemId: row.catalog_item_id, decisionToken: row.decision_token })
      toast.success('Preco comercial inativado.')
      handleOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const reason = row ? reviewReasonLabel(row.review_reason) : null

  return (
    <Drawer
      open={Boolean(row)}
      onOpenChange={handleOpenChange}
      title={row ? `Decisao comercial · ${row.code}` : 'Decisao comercial'}
      description={row ? `${row.item_name} · unidade ${row.unit}` : ''}
      className="max-w-2xl"
      footer={row && isAdmin ? (
        <div className="flex flex-wrap justify-end gap-2">
          {row.price_list_id && row.effective_status !== 'inactive' && (
            <Button type="button" variant="destructive" disabled={pending || !online} onClick={() => void inactivate()}>Inativar preco</Button>
          )}
          {row.catalog_item_active && (
            <Button type="button" disabled={pending || !online || !effectiveSourceId || row.resolved_margin_rule_id === null} onClick={() => void approve()}>
              {pending ? 'Processando...' : row.price_list_id ? 'Aprovar atualizacao' : 'Aprovar preco'}
            </Button>
          )}
        </div>
      ) : undefined}
    >
      {row && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Situacao comercial">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Status comercial</p>
                <div className="mt-1"><CommercialStatusBadge status={row.effective_status} /></div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Preco final aprovado</p>
                <p className="mt-1 font-serif text-2xl font-bold text-emerald-950">{row.approved_final_price === null ? 'Ainda nao aprovado' : formatComparisonCurrency(row.approved_final_price)}</p>
              </div>
            </div>
            {reason && <p className="mt-3 text-sm font-semibold text-amber-900">Motivo: {reason}</p>}
          </section>

          {row.price_list_id && (
            <section aria-labelledby="approved-snapshot">
              <h3 id="approved-snapshot" className="font-serif text-base font-semibold text-slate-950">Snapshot aprovado</h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-4 text-sm">
                <div><dt className="text-xs font-semibold uppercase text-slate-500">Custo aprovado</dt><dd className="mt-1 font-semibold">{formatComparisonCurrency(row.approved_cost_price)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-slate-500">Fonte</dt><dd className="mt-1 font-semibold">{row.approved_supplier_name ?? '—'} · {row.manual_source ? 'Manual' : 'Automatica'}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-slate-500">Acrescimo aprovado</dt><dd className="mt-1">{formatRuleValue(row.approved_adjustment_type, row.approved_adjustment_value)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-slate-500">Validade da fonte</dt><dd className="mt-1">{formatComparisonDate(row.approved_source_valid_until)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-slate-500">Aprovado em</dt><dd className="mt-1">{formatComparisonDate(row.approved_at)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase text-slate-500">Aprovador</dt><dd className="mt-1 break-all font-mono text-xs">{row.approved_by ?? '—'}</dd></div>
                <div className="col-span-2">
                  <dt className="text-xs font-semibold uppercase text-slate-500">Rastreabilidade</dt>
                  <dd className="mt-1 text-xs">
                    {row.approved_quotation_id ? (
                      <Link className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline" to={`/pricing/quotations/${row.approved_quotation_id}`}>
                        Cotacao {row.approved_quotation_reference || 'sem referencia'} <ExternalLink className="size-3.5" />
                      </Link>
                    ) : <span>Cotacao sem referencia disponivel</span>}
                    <span className="mt-1 block break-all font-mono text-slate-500">Item fonte {row.approved_source_quotation_item_id} · Regra {row.approved_margin_rule_id}</span>
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <section aria-labelledby="source-selection">
            <div className="flex items-center justify-between gap-3">
              <h3 id="source-selection" className="font-serif text-base font-semibold text-slate-950">Fonte para a decisao</h3>
              {!isAdmin && <Badge variant="secondary">Somente leitura</Badge>}
            </div>
            {offersQuery.isLoading ? <div className="mt-3"><TableSkeleton columns={3} /></div> : offersQuery.isError ? (
              <div className="mt-3"><ErrorState onRetry={() => void offersQuery.refetch()} /></div>
            ) : eligible.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">Nenhuma fonte elegivel para aprovacao.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {eligible.map((offer) => {
                  const automatic = offer.quotation_item_id === row.best_quotation_item_id
                  const checked = offer.quotation_item_id === effectiveSourceId
                  return (
                    <label key={offer.quotation_item_id} className={`flex gap-3 rounded-xl border p-3 ${checked ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'}`}>
                      {isAdmin && <input type="radio" name="approval-source" checked={checked} onChange={() => setSelectedSourceId(offer.quotation_item_id)} />}
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="flex flex-wrap items-center justify-between gap-2"><strong>{offer.supplier_name}</strong><strong>{formatComparisonCurrency(offer.unit_price)}</strong></span>
                        <span className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">Cotacao {offer.reference_number || 'sem referencia'} <Badge variant={automatic ? 'default' : 'outline'}>{automatic ? 'Fonte automatica' : 'Fonte alternativa'}</Badge></span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="decision-preview">
            <h3 id="decision-preview" className="font-serif text-base font-semibold text-slate-950">Previa da decisao</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Selecao</dt><dd className="mt-1 font-semibold">{isAutomatic ? 'Automatica · menor custo' : 'Manual · fonte alternativa'}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Diferenca para menor custo</dt><dd className="mt-1 font-semibold">{difference === null ? '—' : formatComparisonCurrency(difference.toFixed(2))}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Regra atual</dt><dd className="mt-1">{formatRuleValue(row.resolved_adjustment_type, row.resolved_adjustment_value)} · {formatRuleScope(row.resolved_rule_scope)}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-slate-500">Preco sugerido pelo servidor</dt><dd className="mt-1 font-serif text-xl font-bold text-emerald-950">{isAutomatic ? formatComparisonCurrency(row.suggested_price) : 'Calculado ao aprovar'}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">A sugestao nao e preco comercial. O servidor valida novamente fonte, regra e token, calcula o valor final e so entao grava a aprovacao.</p>
            {row.resolved_margin_rule_id === null && isAdmin && <Button className="mt-3" type="button" variant="outline" onClick={onConfigureRule}><ExternalLink className="size-4" /> Configurar regra</Button>}
          </section>
        </div>
      )}
    </Drawer>
  )
}
