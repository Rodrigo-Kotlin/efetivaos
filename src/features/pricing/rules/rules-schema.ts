import { z } from 'zod'

import { parseRuleValue } from './rules-types'

const requiredText = (message: string, max: number) => z.string().trim().min(1, message).max(max, `Use no maximo ${max} caracteres.`)
const optionalText = (max: number) => z.string().trim().max(max, `Use no maximo ${max} caracteres.`)

const percentageSchema = z.string()
  .trim()
  .min(1, 'Informe o percentual.')
  .refine((raw) => Number.isFinite(parseRuleValue(raw)), 'Percentual invalido.')
  .refine((raw) => parseRuleValue(raw) >= 0, 'Percentual nao pode ser negativo.')
  .refine((raw) => parseRuleValue(raw) <= 1000, 'Percentual acima do limite operacional (1000%).')

const fixedSchema = z.string()
  .trim()
  .min(1, 'Informe o valor fixo.')
  .refine((raw) => Number.isFinite(parseRuleValue(raw)), 'Valor invalido.')
  .refine((raw) => parseRuleValue(raw) >= 0, 'Valor fixo nao pode ser negativo.')
  .refine((raw) => parseRuleValue(raw) <= 9999999, 'Valor fixo acima do limite operacional.')

const baseSchema = z.object({
  scope_type: z.enum(['global', 'category', 'item']),
  calculation_type: z.enum(['percentage', 'fixed']),
  value: z.string().trim().min(1, 'Informe o valor da regra.'),
  notes: optionalText(500),
  active: z.boolean(),
  category_id: z.string().trim().nullable(),
  catalog_item_id: z.string().trim().nullable(),
}).superRefine((data, ctx) => {
  if (data.scope_type === 'category' && !data.category_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['category_id'], message: 'Selecione a categoria alvo.' })
  }
  if (data.scope_type === 'item' && !data.catalog_item_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['catalog_item_id'], message: 'Selecione o item alvo.' })
  }
  if (data.scope_type === 'global' && (data.category_id || data.catalog_item_id)) {
    if (data.category_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['category_id'], message: 'Regra global nao pode ter categoria.' })
    }
    if (data.catalog_item_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['catalog_item_id'], message: 'Regra global nao pode ter item.' })
    }
  }
  const parsed = parseRuleValue(data.value)
  if (Number.isFinite(parsed) && parsed >= 0) {
    if (data.calculation_type === 'percentage') {
      if (parsed > 1000) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Percentual acima do limite operacional (1000%).' })
    } else {
      if (parsed > 9999999) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Valor fixo acima do limite operacional.' })
    }
  }
})

export const ruleFormSchema = baseSchema

export type RuleFormValues = z.infer<typeof ruleFormSchema>

export function validateRuleValue(calculationType: 'percentage' | 'fixed', raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return calculationType === 'percentage' ? 'Informe o percentual.' : 'Informe o valor fixo.'
  const parsed = parseRuleValue(trimmed)
  if (!Number.isFinite(parsed)) return 'Valor invalido.'
  if (parsed < 0) return 'Valor nao pode ser negativo.'
  if (calculationType === 'percentage' && parsed > 1000) return 'Percentual acima do limite operacional (1000%).'
  if (calculationType === 'fixed' && parsed > 9999999) return 'Valor fixo acima do limite operacional.'
  return null
}

export { percentageSchema, fixedSchema, requiredText }
