import { z } from 'zod'

const MAX_NAME = 200
const MAX_CODE = 20
const MAX_TEXT_500 = 500

export const chartAccountSchema = z.object({
  code: z.string().min(1, 'Codigo e obrigatorio').max(MAX_CODE),
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(MAX_NAME),
  class: z.enum(['ATIVO', 'PASSIVO', 'PL', 'RECEITA', 'CUSTO', 'DESPESA']),
  nature: z.enum(['DEBITO', 'CREDITO']),
  posting: z.boolean().default(true),
  active: z.boolean().default(true),
  current_class: z.enum(['CIRCULANTE', 'NAO_CIRCULANTE']).nullable().default(null),
  bp_group: z.string().max(120).default(''),
  dre_class: z.string().max(60).default(''),
  dfc_default: z.enum(['OPERACIONAL', 'INVESTIMENTO', 'FINANCIAMENTO', 'NAO_CAIXA', 'TRANSFERENCIA']).default('OPERACIONAL'),
  dva_class: z.string().max(60).default(''),
  is_cash: z.boolean().default(false),
  presentation_sign: z.union([z.literal(1), z.literal(-1)]).default(1),
})

export type ChartAccountFormValues = z.infer<typeof chartAccountSchema>

export const costCenterSchema = z.object({
  code: z.string().max(MAX_CODE).nullable().default(null),
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(120),
  active: z.boolean().default(true),
  description: z.string().max(MAX_TEXT_500).nullable().default(null),
})

export type CostCenterFormValues = z.infer<typeof costCenterSchema>

export const serviceLineSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(160),
  active: z.boolean().default(true),
  description: z.string().max(MAX_TEXT_500).nullable().default(null),
})

export type ServiceLineFormValues = z.infer<typeof serviceLineSchema>

export const categorySchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(200),
  movement_type: z.enum(['RECEITA', 'DESPESA', 'TRANSFERENCIA', 'EMPRESTIMO_RECEBIDO', 'EMPRESTIMO_PAGO', 'APORTE', 'RETIRADA', 'IMOBILIZADO', 'SALDO_INICIAL', 'AJUSTE']),
  counter_account_id: z.string().nullable().default(null),
  cost_center_id: z.string().nullable().default(null),
  service_line_id: z.string().nullable().default(null),
  cash_flow_class: z.enum(['OPERACIONAL', 'INVESTIMENTO', 'FINANCIAMENTO', 'NAO_CAIXA', 'TRANSFERENCIA']).default('OPERACIONAL'),
  active: z.boolean().default(true),
})

export type CategoryFormValues = z.infer<typeof categorySchema>

export const financialAccountSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(120),
  chart_account_id: z.string().min(1, 'Conta contabil e obrigatoria'),
  institution: z.string().max(120).nullable().default(null),
  account_type: z.enum(['CAIXA', 'CONTA_CORRENTE', 'POUPANCA', 'CARTAO', 'INVESTIMENTO', 'OUTRO']).default('CONTA_CORRENTE'),
  active: z.boolean().default(true),
  opening_date: z.string().nullable().default(null),
  notes: z.string().max(500).nullable().default(null),
})

export type FinancialAccountFormValues = z.infer<typeof financialAccountSchema>

export const paymentMethodSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(80),
  active: z.boolean().default(true),
})

export type PaymentMethodFormValues = z.infer<typeof paymentMethodSchema>
