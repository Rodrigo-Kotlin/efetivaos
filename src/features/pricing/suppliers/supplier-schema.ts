import { z } from 'zod'

import type { Supplier } from '@/types/database'

const optionalText = (max: number) => z.string().trim().max(max, `Use no maximo ${max} caracteres.`)

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do fornecedor.').max(160, 'Use no maximo 160 caracteres.'),
  legal_name: optionalText(200),
  tax_id: optionalText(32),
  category: optionalText(100),
  contact_name: optionalText(160),
  email: z.string().trim().max(254, 'Use no maximo 254 caracteres.').refine(
    (value) => value === '' || z.string().email().safeParse(value).success,
    'Informe um e-mail valido.',
  ),
  phone: optionalText(32),
  active: z.boolean(),
  notes: optionalText(1000),
})

export type SupplierFormValues = z.infer<typeof supplierSchema>

export type SupplierInput = {
  name: string
  legal_name: string | null
  tax_id: string | null
  category: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  active: boolean
  notes: string | null
}

const nullable = (value: string) => value.trim() || null

export function toSupplierInput(values: SupplierFormValues): SupplierInput {
  return {
    name: values.name.trim(),
    legal_name: nullable(values.legal_name),
    tax_id: nullable(values.tax_id),
    category: nullable(values.category),
    contact_name: nullable(values.contact_name),
    email: nullable(values.email),
    phone: nullable(values.phone),
    active: values.active,
    notes: nullable(values.notes),
  }
}

export function supplierFormDefaults(supplier?: Supplier): SupplierFormValues {
  return {
    name: supplier?.name ?? '',
    legal_name: supplier?.legal_name ?? '',
    tax_id: supplier?.tax_id ?? '',
    category: supplier?.category ?? '',
    contact_name: supplier?.contact_name ?? '',
    email: supplier?.email ?? '',
    phone: supplier?.phone ?? '',
    active: supplier?.active ?? true,
    notes: supplier?.notes ?? '',
  }
}
