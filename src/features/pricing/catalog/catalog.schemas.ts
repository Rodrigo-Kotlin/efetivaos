import { z } from 'zod'

const requiredText = (message: string, max: number) => z.string().trim().min(1, message).max(max, `Use no maximo ${max} caracteres.`)

export const catalogItemSchema = z.object({
  name: requiredText('Informe o nome do item.', 160),
  category_id: requiredText('Selecione uma categoria.', 64),
  unit: requiredText('Informe a unidade do item.', 80),
  description: z.string().trim().max(1000, 'Use no maximo 1000 caracteres.'),
})

export const catalogCategorySchema = z.object({
  name: z.string().trim().min(3, 'Informe ao menos 3 caracteres.').max(160, 'Use no maximo 160 caracteres.'),
  active: z.boolean(),
})

export type CatalogItemFormData = z.infer<typeof catalogItemSchema>
export type CatalogCategoryFormData = z.infer<typeof catalogCategorySchema>
