import { z } from 'zod'

function isPositiveNumber(value: string): boolean {
  const normalized = value.replace(',', '.').trim()
  const number = Number(normalized)
  return Boolean(normalized) && Number.isFinite(number) && number > 0
}

const overZero = 'Informe um valor maior que zero.'

const positiveMoney = z
  .string()
  .trim()
  .min(1, 'Informe o preco de venda.')
  .refine(isPositiveNumber, overZero)

const optionalPositiveMoney = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || isPositiveNumber(value), overZero)

export const ownPriceCreationSchema = z.object({
  catalog_item_id: z.string().trim().min(1, 'Selecione um servico proprio do catalogo.'),
  sale_price: positiveMoney,
  internal_cost: optionalPositiveMoney,
  notes: z.string().trim().max(1000, 'Use no maximo 1000 caracteres.'),
})

export const ownPriceReajusteSchema = z.object({
  catalog_item_id: z.string().trim().min(1, 'Selecione um servico proprio do catalogo.'),
  sale_price: positiveMoney,
  internal_cost: optionalPositiveMoney,
  notes: z.string().trim().min(3, 'Informe a justificativa do reajuste.').max(1000, 'Use no maximo 1000 caracteres.'),
})

export type OwnPriceCreationFormData = z.infer<typeof ownPriceCreationSchema>
export type OwnPriceReajusteFormData = z.infer<typeof ownPriceReajusteSchema>