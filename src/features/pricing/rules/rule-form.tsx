import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { textareaClassName } from '@/components/shared/operational-ui'
import { useCatalogCategories } from '@/features/pricing/catalog/catalog.queries'
import { useCatalogItems } from '@/features/pricing/catalog/catalog.queries'

import { ruleFormSchema, type RuleFormValues } from './rules-schema'
import { ruleCalculationLabels, ruleScopeLabels, type RuleInput, type RuleRow } from './rules-types'

const ruleFormDefaults = (): RuleFormValues => ({
  scope_type: 'global',
  calculation_type: 'percentage',
  value: '',
  notes: '',
  active: true,
  category_id: null,
  catalog_item_id: null,
})

function normalizeForInput(rule: RuleRow | null): RuleFormValues {
  if (!rule) return ruleFormDefaults()
  return {
    scope_type: rule.scope_type,
    calculation_type: rule.calculation_type,
    value: rule.value,
    notes: rule.notes ?? '',
    active: rule.active,
    category_id: rule.scope_type === 'category' ? rule.category_id : null,
    catalog_item_id: rule.scope_type === 'item' ? rule.catalog_item_id : null,
  }
}

function buildInput(values: RuleFormValues): RuleInput {
  return {
    scope_type: values.scope_type,
    calculation_type: values.calculation_type,
    value: values.value.trim(),
    active: values.active,
    notes: values.notes?.trim() || null,
    category_id: values.scope_type === 'category' ? values.category_id : null,
    catalog_item_id: values.scope_type === 'item' ? values.catalog_item_id : null,
  }
}

type RuleFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: RuleRow | null
  onSubmit: (input: RuleInput) => Promise<void>
  submitLabel: string
  title: string
  description: string
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Nao foi possivel salvar a regra.'
}

export function RuleForm({ open, onOpenChange, rule, onSubmit, submitLabel, title, description }: RuleFormProps) {
  const categoriesQuery = useCatalogCategories()
  const itemsQuery = useCatalogItems()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<RuleFormValues>({ resolver: zodResolver(ruleFormSchema), defaultValues: ruleFormDefaults() })
  // React Hook Form's `watch()` API cannot be memoized safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const scope = form.watch('scope_type')
  const calculation = form.watch('calculation_type')

  useEffect(() => {
    if (open) form.reset(normalizeForInput(rule))
  }, [open, rule, form])

  async function submit(values: RuleFormValues) {
    setSubmitting(true)
    try {
      await onSubmit(buildInput(values))
      onOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const categories = (categoriesQuery.data ?? []).filter((category) => category.active)
  const items = (itemsQuery.data ?? []).filter((item) => item.active)

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <form className="space-y-5" noValidate onSubmit={form.handleSubmit(submit)}>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-700">Escopo</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {(['global', 'category', 'item'] as const).map((option) => {
              const active = scope === option
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => form.setValue('scope_type', option, { shouldValidate: true, shouldDirty: true })}
                  className={`rounded-lg border px-3 py-3 text-sm font-semibold transition-colors ${active ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {ruleScopeLabels[option]}
                </button>
              )
            })}
          </div>
          {form.formState.errors.scope_type && (
            <p className="text-sm text-red-700">{form.formState.errors.scope_type.message}</p>
          )}
        </fieldset>

        {scope === 'category' && (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Categoria alvo</span>
            <select
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
              aria-label="Categoria alvo"
              aria-invalid={Boolean(form.formState.errors.category_id)}
              {...form.register('category_id', { setValueAs: (value) => (value === '' ? null : value) })}
            >
              <option value="">Selecione uma categoria ativa</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            {form.formState.errors.category_id && (
              <p className="mt-1 text-sm text-red-700">{form.formState.errors.category_id.message}</p>
            )}
          </label>
        )}

        {scope === 'item' && (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Item alvo</span>
            <select
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
              aria-label="Item alvo"
              aria-invalid={Boolean(form.formState.errors.catalog_item_id)}
              {...form.register('catalog_item_id', { setValueAs: (value) => (value === '' ? null : value) })}
            >
              <option value="">Selecione um item ativo</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
              ))}
            </select>
            {form.formState.errors.catalog_item_id && (
              <p className="mt-1 text-sm text-red-700">{form.formState.errors.catalog_item_id.message}</p>
            )}
          </label>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-700">Tipo de acrescimo</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(['percentage', 'fixed'] as const).map((option) => {
              const active = calculation === option
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => form.setValue('calculation_type', option, { shouldValidate: true, shouldDirty: true })}
                  className={`rounded-lg border px-3 py-3 text-sm font-semibold transition-colors ${active ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {ruleCalculationLabels[option]}
                </button>
              )
            })}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Valor</span>
          <Input
            className="mt-2"
            inputMode="decimal"
            placeholder={calculation === 'percentage' ? 'Ex: 30' : 'Ex: 25,00'}
            aria-label="Valor da regra"
            aria-invalid={Boolean(form.formState.errors.value)}
            {...form.register('value')}
          />
          {form.formState.errors.value && (
            <p className="mt-1 text-sm text-red-700">{form.formState.errors.value.message}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {calculation === 'percentage' ? 'Percentual aplicado sobre o menor custo.' : 'Valor somado ao menor custo.'}
          </p>
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
            {...form.register('active')}
          />
          Regra ativa
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Observacao</span>
          <textarea
            className={`${textareaClassName} mt-2`}
            rows={3}
            placeholder="Anotacoes internas sobre a regra (opcional)"
            aria-label="Observacao"
            {...form.register('notes')}
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>{submitLabel}</Button>
        </div>
      </form>
    </Drawer>
  )
}
