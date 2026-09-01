import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldError, selectClassName } from '@/components/shared/operational-ui'

import { CATALOG_CATEGORY_PRESETS, CUSTOM_CATEGORY_VALUE } from './catalog.constants'
import { catalogCategorySchema, type CatalogCategoryFormData } from './catalog.schemas'
import type { CatalogCategoryInput } from './catalog.types'

type CatalogCategoryFormProps = {
  defaultValues?: CatalogCategoryFormData
  submitLabel: string
  onSubmit: (input: CatalogCategoryInput) => Promise<void> | void
  onCancel: () => void
}

export function CatalogCategoryForm({ defaultValues, submitLabel, onSubmit, onCancel }: CatalogCategoryFormProps) {
  const initialIsCustom = Boolean(defaultValues?.name && !CATALOG_CATEGORY_PRESETS.some((preset) => preset === defaultValues.name))
  const [customSelected, setCustomSelected] = useState(initialIsCustom)
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CatalogCategoryFormData>({
    resolver: zodResolver(catalogCategorySchema),
    defaultValues: defaultValues ?? { name: '', active: true },
  })

  const submit = handleSubmit(async (data) => {
    try {
      await onSubmit(data)
    } catch (error) {
      setError('root', { message: error instanceof Error ? error.message : 'Nao foi possivel salvar a categoria.' })
    }
  })

  return (
    <form id="catalog-category-form" className="space-y-5" onSubmit={submit} noValidate>
      <div>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <>
              <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="category-name">Nome *</label>
              <select
                id="category-name"
                className={`${selectClassName} w-full`}
                value={customSelected ? CUSTOM_CATEGORY_VALUE : field.value}
                ref={field.ref}
                onBlur={field.onBlur}
                onChange={(event) => {
                  const custom = event.target.value === CUSTOM_CATEGORY_VALUE
                  setCustomSelected(custom)
                  field.onChange(custom ? '' : event.target.value)
                }}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={`category-name-help${errors.name ? ' category-name-error' : ''}`}
              >
                <option value="">Selecione uma categoria</option>
                {CATALOG_CATEGORY_PRESETS.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
                <option value={CUSTOM_CATEGORY_VALUE}>+ Adicionar nova categoria</option>
              </select>
              <p id="category-name-help" className="mt-2 text-xs text-slate-500">Selecione uma categoria padronizada ou adicione uma nova.</p>
              {customSelected && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="custom-category-name">Nome da nova categoria</label>
                  <Input
                    id="custom-category-name"
                    placeholder="Ex.: Exames Toxicológicos"
                    autoComplete="off"
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? 'category-name-error' : undefined}
                  />
                </div>
              )}
              <FieldError id="category-name-error">{errors.name?.message}</FieldError>
            </>
          )}
        />
      </div>
      <Controller
        control={control}
        name="active"
        render={({ field }) => (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="category-status">Status</label>
            <select id="category-status" className={`${selectClassName} w-full`} value={field.value ? 'active' : 'inactive'} onBlur={field.onBlur} onChange={(event) => field.onChange(event.target.value === 'active')}>
              <option value="active">Ativa</option>
              <option value="inactive">Inativa</option>
            </select>
          </div>
        )}
      />
      {errors.root && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{errors.root.message}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : submitLabel}</Button>
      </div>
    </form>
  )
}
