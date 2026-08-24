import { ExternalLink, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'

import { formatComparisonCurrency, formatComparisonDate, formatRuleScope, formatRuleValue } from './comparison-helpers'
import type { ComparisonRow } from './comparison-types'

type ReviewDrawerProps = {
  row: ComparisonRow | null
  onOpenChange: (open: boolean) => void
  canEditRules: boolean
  onConfigureRule: () => void
}

function ruleFormula(item: ComparisonRow): string {
  if (item.resolved_adjustment_type === null || item.resolved_adjustment_value === null) return '—'
  const value = Number(item.resolved_adjustment_value)
  const cost = item.best_cost === null ? 0 : Number(item.best_cost)
  if (item.resolved_adjustment_type === 'percentage') {
    return `Preco sugerido = R$ ${cost.toFixed(2)} x (1 + ${value}% / 100) = R$ ${(item.suggested_price ? Number(item.suggested_price) : 0).toFixed(2)}`
  }
  return `Preco sugerido = R$ ${cost.toFixed(2)} + R$ ${value.toFixed(2)} = R$ ${(item.suggested_price ? Number(item.suggested_price) : 0).toFixed(2)}`
}

export function ReviewDrawer({ row, onOpenChange, canEditRules, onConfigureRule }: ReviewDrawerProps) {
  const open = Boolean(row)
  const title = row ? `Revisao de calculo · ${row.code}` : 'Revisao de calculo'
  const description = row ? `${row.item_name} · unidade ${row.unit}` : ''

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {row && (
        <div className="space-y-5">
          <section aria-labelledby="review-custo">
            <h3 id="review-custo" className="font-serif text-base font-semibold text-slate-950">Custo</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Menor custo</dt>
                <dd className="mt-1 font-serif text-lg font-bold text-emerald-900">{formatComparisonCurrency(row.best_cost)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Fornecedor fonte</dt>
                <dd className="mt-1 font-semibold text-slate-800">{row.best_supplier_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Validade</dt>
                <dd className="mt-1 text-slate-800">
                  {row.best_validity_not_informed || row.best_valid_until === null
                    ? <Badge variant="outline" className="border-amber-300 text-amber-800">Validade nao informada</Badge>
                    : formatComparisonDate(row.best_valid_until)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Ofertas vigentes</dt>
                <dd className="mt-1 text-slate-800">{row.eligible_offer_count}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="review-regra">
            <h3 id="review-regra" className="font-serif text-base font-semibold text-slate-950">Regra aplicada</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Origem</dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {row.resolved_rule_scope === null
                    ? <Badge variant="warning">Sem regra</Badge>
                    : formatRuleScope(row.resolved_rule_scope, { category_name: row.category_name, item_name: row.item_name })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Tipo</dt>
                <dd className="mt-1 text-slate-800">
                  {row.resolved_adjustment_type === 'percentage' ? 'Percentual sobre custo' : row.resolved_adjustment_type === 'fixed' ? 'Valor fixo' : '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-semibold uppercase text-slate-500">Valor</dt>
                <dd className="mt-1 text-slate-800">{formatRuleValue(row.resolved_adjustment_type, row.resolved_adjustment_value)}</dd>
              </div>
            </dl>
            {row.resolved_rule_scope === null && canEditRules && (
              <Button className="mt-3" type="button" variant="outline" onClick={onConfigureRule}>
                <ExternalLink className="size-4" /> Configurar regra
              </Button>
            )}
          </section>

          <section aria-labelledby="review-formula">
            <h3 id="review-formula" className="font-serif text-base font-semibold text-slate-950">Formula e preco sugerido</h3>
            <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <p className="font-mono text-xs text-slate-700">{ruleFormula(row)}</p>
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Preco sugerido</p>
                <p className="font-serif text-2xl font-bold text-emerald-900">{formatComparisonCurrency(row.suggested_price)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Este valor ainda NAO e preco comercial aprovado. A Etapa 05 tratara da aprovacao.
            </p>
          </section>

          <button
            type="button"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </Drawer>
  )
}
