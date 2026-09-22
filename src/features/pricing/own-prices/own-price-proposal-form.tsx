import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldError, selectClassName, textareaClassName } from '@/components/shared/operational-ui'
import type { OwnPriceProposalInsert } from '@/types/database'

import { ownPriceCreationSchema, ownPriceReajusteSchema, type OwnPriceCreationFormData } from './own-prices.schemas'
import type { OwnCatalogItem } from './own-prices.types'

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

type OwnPriceProposalFormProps = {
  mode: 'create' | 'reajuste'
  items: OwnCatalogItem[]
  item?: OwnCatalogItem
  currentPrice?: string | null
  pending?: boolean
  onCancel: () => void
  onSubmit: (input: OwnPriceProposalInsert) => void | Promise<void>
}

export function OwnPriceProposalForm({ mode, items, item, currentPrice, pending = false, onCancel, onSubmit }: OwnPriceProposalFormProps) {
  const isReajuste = mode === 'reajuste'
  const schema = isReajuste ? ownPriceReajusteSchema : ownPriceCreationSchema
  const defaultItemId = item?.id ?? ''
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm<OwnPriceCreationFormData>({
    resolver: zodResolver(schema),
    defaultValues: { catalog_item_id: defaultItemId, sale_price: '', internal_cost: '', notes: '' },
  })

  const salePrice = watch('sale_price')
  const comparison = useMemo(() => {
    if (!isReajuste) return null
    const proposed = Number(salePrice.replace(',', '.'))
    const current = currentPrice ? Number(currentPrice) : null
    if (current === null || !Number.isFinite(proposed)) return null
    const difference = proposed - current
    const variation = current > 0 ? (difference / current) * 100 : null
    return { difference, variation }
  }, [isReajuste, salePrice, currentPrice])

  const submit = handleSubmit(async (data) => {
    try {
      if (isReajuste) {
        await onSubmit({ catalog_item_id: data.catalog_item_id, sale_price: data.sale_price, internal_cost: data.internal_cost || null, decision_notes: data.notes })
      } else {
        await onSubmit({ catalog_item_id: data.catalog_item_id, sale_price: data.sale_price, internal_cost: data.internal_cost || null, decision_notes: data.notes || null })
      }
    } catch (error) {
      setError('root', { message: error instanceof Error ? error.message : 'Nao foi possivel salvar a proposta.' })
    }
  })

  const itemOptions = items

  return (
    <form id="own-price-proposal-form" className="space-y-5" onSubmit={submit} noValidate>
      {isReajuste && item && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-mono text-xs font-bold text-emerald-900">{item.code}</p>
          <p className="font-serif text-lg font-semibold text-slate-950">{item.name}</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs font-semibold text-slate-500">Preco atual aprovado</dt><dd className="font-bold text-slate-950">{currentPrice ? formatMoney(Number(currentPrice)) : '—'}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Unidade</dt><dd className="text-slate-950">{item.unit}</dd></div>
          </dl>
        </div>
      )}

      {!isReajuste && (
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="proposal-item">Servico (do Catalogo) *</label>
          <select id="proposal-item" className={`${selectClassName} w-full`} disabled={Boolean(item)} aria-invalid={Boolean(errors.catalog_item_id)} aria-describedby={errors.catalog_item_id ? 'proposal-item-error' : undefined} {...register('catalog_item_id')}>
            <option value="">Selecione um item de servico proprio</option>
            {itemOptions.map((option) => <option key={option.id} value={option.id}>{option.code} — {option.name}</option>)}
          </select>
          <FieldError id="proposal-item-error">{errors.catalog_item_id?.message}</FieldError>
        </div>
      )}
      {isReajuste && item && <input type="hidden" {...register('catalog_item_id')} value={item.id} />}

      {comparison && comparison.difference !== null && (
        <div className={`rounded-xl border p-4 text-sm ${comparison.difference >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Efeito do reajuste</p>
          <p className="mt-1 font-bold">{comparison.difference >= 0 ? '+' : ''}{formatMoney(comparison.difference)} {comparison.variation !== null ? `(${comparison.variation >= 0 ? '+' : ''}${comparison.variation.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)` : ''}</p>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="proposal-sale-price">{isReajuste ? 'Novo preco de venda *' : 'Preco de venda *'}</label>
        <Input id="proposal-sale-price" inputMode="decimal" placeholder="0,00" autoComplete="off" aria-invalid={Boolean(errors.sale_price)} aria-describedby={errors.sale_price ? 'proposal-sale-price-error' : undefined} {...register('sale_price')} />
        <FieldError id="proposal-sale-price-error">{errors.sale_price?.message}</FieldError>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="proposal-internal-cost">Custo interno <span className="font-normal text-slate-500">(opcional)</span></label>
        <Input id="proposal-internal-cost" inputMode="decimal" placeholder="0,00" autoComplete="off" aria-invalid={Boolean(errors.internal_cost)} aria-describedby={errors.internal_cost ? 'proposal-internal-cost-error' : undefined} {...register('internal_cost')} />
        <FieldError id="proposal-internal-cost-error">{errors.internal_cost?.message}</FieldError>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="proposal-notes">
          {isReajuste ? 'Justificativa do reajuste *' : 'Observacoes'}
          {!isReajuste && <span className="font-normal text-slate-500"> (opcional)</span>}
        </label>
        <textarea id="proposal-notes" className={textareaClassName} placeholder={isReajuste ? 'Explique o motivo do novo preco' : 'Detalhes ou contexto desta proposta'} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? 'proposal-notes-error' : undefined} {...register('notes')} />
        <FieldError id="proposal-notes-error">{errors.notes?.message}</FieldError>
      </div>

      {errors.root && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{errors.root.message}</div>}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={pending || isSubmitting}>{isSubmitting || pending ? 'Salvando...' : isReajuste ? 'Enviar reajuste' : 'Enviar proposta'}</Button>
      </div>
    </form>
  )
}