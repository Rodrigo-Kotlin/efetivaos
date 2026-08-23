import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldError, selectClassName } from '@/features/pricing/components/operational-ui'

import { catalogCategorySchema, type CatalogCategoryFormData } from './catalog.schemas'
import type { CatalogCategoryInput } from './catalog.types'

type CatalogCategoryFormProps = {
  defaultValues?: CatalogCategoryFormData
  submitLabel: string
  onSubmit: (input: CatalogCategoryInput) => Promise<void> | void
  onCancel: () => void
}

export function CatalogCategoryForm({ defaultValues, submitLabel, onSubmit, onCancel }: CatalogCategoryFormProps) {
  const {
    register,
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
        <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="category-name">Nome *</label>
        <Input id="category-name" placeholder="Exames laboratoriais" autoComplete="off" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'category-name-error' : undefined} {...register('name')} />
        <FieldError id="category-name-error">{errors.name?.message}</FieldError>
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
