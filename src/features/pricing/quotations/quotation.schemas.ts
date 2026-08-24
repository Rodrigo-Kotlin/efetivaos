import { z } from 'zod'

import type { QuotationDetail } from './quotation.types'

const emptyToNull = (value: string) => value.trim() || null

export function parseBrlDecimal(value: string): string | null {
  const clean = value.trim().replace(/\s|R\$/gi, '')
  if (!clean) return null

  let integerPart: string
  let decimalPart = ''
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(clean)) {
    const [integer, decimal = ''] = clean.split(',')
    integerPart = integer.replace(/\./g, '')
    decimalPart = decimal
  } else if (/^\d+(?:[.,]\d{1,2})?$/.test(clean)) {
    const separator = clean.includes(',') ? ',' : '.'
    const parts = clean.split(separator)
    integerPart = parts[0]
    decimalPart = parts[1] ?? ''
  } else {
    return null
  }

  integerPart = integerPart.replace(/^0+(?=\d)/, '')
  if (integerPart.length > 12 || !/[1-9]/.test(`${integerPart}${decimalPart}`)) return null
  return `${integerPart}.${decimalPart.padEnd(2, '0')}`
}

export const quotationItemSchema = z.object({
  id: z.string().optional(),
  catalog_item_id: z.string(),
  supplier_description: z.string().max(500, 'Use no maximo 500 caracteres.'),
  supplier_item_code: z.string().max(100, 'Use no maximo 100 caracteres.'),
  unit_price: z.string().refine((value) => parseBrlDecimal(value) !== null, 'Informe um valor maior que zero.'),
  notes: z.string().max(1000, 'Use no maximo 1000 caracteres.'),
})

export const quotationSchema = z.object({
  supplier_id: z.string().min(1, 'Selecione o fornecedor.'),
  reference_number: z.string().max(100, 'Use no maximo 100 caracteres.'),
  received_at: z.string().min(1, 'Informe a data de recebimento.'),
  valid_until: z.string(),
  notes: z.string().max(2000, 'Use no maximo 2000 caracteres.'),
  items: z.array(quotationItemSchema),
}).superRefine((value, context) => {
  if (value.valid_until && value.received_at && value.valid_until < value.received_at) {
    context.addIssue({ code: 'custom', path: ['valid_until'], message: 'A validade deve ser igual ou posterior ao recebimento.' })
  }
  const selected = value.items.map((item) => item.catalog_item_id).filter(Boolean)
  if (new Set(selected).size !== selected.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'O mesmo item do catalogo nao pode aparecer duas vezes.' })
  }
})

export type QuotationFormValues = z.infer<typeof quotationSchema>

export function quotationDefaults(quotation?: QuotationDetail): QuotationFormValues {
  return {
    supplier_id: quotation?.supplier_id ?? '',
    reference_number: quotation?.reference_number ?? '',
    received_at: quotation?.received_at ?? '',
    valid_until: quotation?.valid_until ?? '',
    notes: quotation?.notes ?? '',
    items: quotation?.quotation_items.map((item) => ({
      id: item.id,
      catalog_item_id: item.catalog_item_id ?? '',
      supplier_description: item.supplier_description ?? '',
      supplier_item_code: item.supplier_item_code ?? '',
      unit_price: String(item.unit_price).replace('.', ','),
      notes: item.notes ?? '',
    })) ?? [],
  }
}

export function validateActivation(values: QuotationFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (values.items.length === 0) errors.items = 'Adicione ao menos um item antes de ativar.'
  values.items.forEach((item, index) => {
    if (!item.catalog_item_id) errors[`items.${index}.catalog_item_id`] = `Linha ${index + 1}: vincule um item do Catalogo Efetiva.`
    if (!parseBrlDecimal(item.unit_price)) errors[`items.${index}.unit_price`] = `Linha ${index + 1}: informe um valor maior que zero.`
  })
  return errors
}

export function normalizeQuotationValues(values: QuotationFormValues) {
  return {
    supplier_id: values.supplier_id,
    reference_number: emptyToNull(values.reference_number),
    received_at: values.received_at,
    valid_until: emptyToNull(values.valid_until),
    notes: emptyToNull(values.notes),
    items: values.items.map((item) => ({
      id: item.id,
      catalog_item_id: emptyToNull(item.catalog_item_id),
      supplier_description: emptyToNull(item.supplier_description),
      supplier_item_code: emptyToNull(item.supplier_item_code),
      unit_price: parseBrlDecimal(item.unit_price)!,
      notes: emptyToNull(item.notes),
    })),
  }
}
