import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldError, selectClassName, textareaClassName } from '@/features/pricing/components/operational-ui'

import { catalogItemSchema, type CatalogItemFormData } from './catalog.schemas'
import type { CatalogCategoryRow, CatalogItemInput } from './catalog.types'

const suggestedUnits = ['exame', 'unidade', 'servico', 'pessoa', 'hora', 'dia', 'mes', 'pacote'] as const
const customUnit = '__custom__'

type CatalogItemFormProps = {
  categories: CatalogCategoryRow[]
  defaultValues?: CatalogItemFormData
  submitLabel: string
  onSubmit: (input: CatalogItemInput) => Promise<void> | void
  onCancel: () => void
}

export function CatalogItemForm({ categories, defaultValues, submitLabel, onSubmit, onCancel }: CatalogItemFormProps) {
  const initialUnit = defaultValues?.unit ?? ''
  const initialIsCustom = Boolean(initialUnit && !suggestedUnits.includes(initialUnit as (typeof suggestedUnits)[number]))
  const [customUnitSelected, setCustomUnitSelected] = useState(initialIsCustom)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CatalogItemFormData>({
    resolver: zodResolver(catalogItemSchema),
    defaultValues: defaultValues ?? { code: '', name: '', category_id: '', unit: '', description: '' },
  })

  const submit = handleSubmit(async (data) => {
    try {
      await onSubmit(data)
    } catch (error) {
      setError('root', { message: error instanceof Error ? error.message : 'Nao foi possivel salvar o item.' })
    }
  })

  return (
    <form id="catalog-item-form" className="space-y-5" onSubmit={submit} noValidate>
      <div className="grid gap-5 sm:grid-cols-[0.8fr_1.2fr]">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="item-code">Codigo *</label>
          <Input id="item-code" placeholder="EXA-001" autoComplete="off" aria-invalid={Boolean(errors.code)} aria-describedby={errors.code ? 'item-code-error' : undefined} {...register('code')} />
          <FieldError id="item-code-error">{errors.code?.message}</FieldError>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="item-name">Nome *</label>
          <Input id="item-name" placeholder="Hemograma completo" autoComplete="off" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'item-name-error' : undefined} {...register('name')} />
          <FieldError id="item-name-error">{errors.name?.message}</FieldError>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="item-category">Categoria *</label>
        <select id="item-category" className={`${selectClassName} w-full`} aria-invalid={Boolean(errors.category_id)} aria-describedby={errors.category_id ? 'item-category-error' : undefined} {...register('category_id')}>
          <option value="">Selecione uma categoria</option>
          {categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          {defaultValues?.category_id && categories.some((category) => category.id === defaultValues.category_id && !category.active) && (
            <option value={defaultValues.category_id} disabled>{categories.find((category) => category.id === defaultValues.category_id)?.name} (inativa)</option>
          )}
        </select>
        <FieldError id="item-category-error">{errors.category_id?.message}</FieldError>
      </div>

      <Controller
        control={control}
        name="unit"
        render={({ field }) => {
          const isCustom = customUnitSelected || Boolean(field.value && !suggestedUnits.includes(field.value as (typeof suggestedUnits)[number]))
          return (
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="item-unit">Unidade *</label>
              <select
                id="item-unit"
                className={`${selectClassName} w-full`}
                value={isCustom ? customUnit : field.value}
                aria-invalid={Boolean(errors.unit)}
                aria-describedby={errors.unit ? 'item-unit-error' : undefined}
                ref={field.ref}
                onBlur={field.onBlur}
                onChange={(event) => {
                  const custom = event.target.value === customUnit
                  setCustomUnitSelected(custom)
                  field.onChange(custom ? '' : event.target.value)
                }}
              >
                <option value="">Selecione uma unidade</option>
                {suggestedUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                <option value={customUnit}>Outra unidade...</option>
              </select>
              {isCustom && (
                <Input
                  className="mt-3"
                  aria-label="Unidade personalizada"
                  aria-invalid={Boolean(errors.unit)}
                  aria-describedby={errors.unit ? 'item-unit-error' : undefined}
                  placeholder="Informe a unidade"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                />
              )}
              <FieldError id="item-unit-error">{errors.unit?.message}</FieldError>
            </div>
          )
        }}
      />

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="item-description">Descricao <span className="font-normal text-slate-500">(opcional)</span></label>
        <textarea id="item-description" className={textareaClassName} placeholder="Detalhes para identificar o item ou servico" {...register('description')} />
      </div>

      {errors.root && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{errors.root.message}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : submitLabel}</Button>
      </div>
    </form>
  )
}
