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
  movement_type: z.enum(['RECEITA', 'DESPESA', 'TRANSFERENCIA', 'EMPRESTIMO_RECEBIDO', 'EMPRESTIMO_PAGO', 'APORTE', 'RETIRADA', 'IMOBILIZADO', 'SALDO_INICIAL', 'AJUSTE', 'DEPRECIACAO']),
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

// ---------------------------------------------------------------------------
// Transaction schemas (Motor de Lançamentos 08B)
// ---------------------------------------------------------------------------

const MOVEMENT_TYPES = ['RECEITA', 'DESPESA', 'TRANSFERENCIA', 'EMPRESTIMO_RECEBIDO', 'EMPRESTIMO_PAGO', 'APORTE', 'RETIRADA', 'IMOBILIZADO', 'SALDO_INICIAL', 'AJUSTE', 'DEPRECIACAO'] as const

export const transactionBaseSchema = z.object({
  description: z.string().min(3, 'Descricao deve ter ao menos 3 caracteres').max(500),
  transaction_date: z.string().min(1, 'Data da transacao e obrigatoria'),
  competence_date: z.string().min(1, 'Data de competencia e obrigatoria'),
  movement_type: z.enum(MOVEMENT_TYPES),
  amount: z.coerce.number().positive('Valor deve ser maior que zero'),
  origin_account_id: z.string().nullable().default(null),
  destination_account_id: z.string().nullable().default(null),
  category_id: z.string().nullable().default(null),
  party_id: z.string().nullable().default(null),
  cost_center_id: z.string().nullable().default(null),
  service_line_id: z.string().nullable().default(null),
  payment_method_id: z.string().nullable().default(null),
  due_date: z.string().nullable().default(null),
  payment_date: z.string().nullable().default(null),
  notes: z.string().max(1000).nullable().default(null),
  principal_amount: z.coerce.number().nullable().default(null),
  interest_amount: z.coerce.number().nullable().default(null),
  idempotency_key: z.string().nullable().default(null),
})

export type TransactionBaseFormValues = z.infer<typeof transactionBaseSchema>

export const transactionSchema = transactionBaseSchema.refine(
  (data) => {
    switch (data.movement_type) {
      case 'RECEITA':
      case 'DESPESA':
      case 'APORTE':
      case 'RETIRADA':
        return !!data.category_id
      case 'TRANSFERENCIA':
      case 'IMOBILIZADO':
      case 'SALDO_INICIAL':
        return !!data.origin_account_id || !!data.destination_account_id
      case 'EMPRESTIMO_RECEBIDO':
        return !!data.destination_account_id
      case 'EMPRESTIMO_PAGO':
        return !!data.origin_account_id
      case 'AJUSTE':
        return !!data.category_id
      default:
        return true
    }
  },
  { message: 'Preencha os campos obrigatorios para o tipo de movimento', path: ['movement_type'] },
)

export type TransactionFormValues = z.infer<typeof transactionSchema>

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
  TRANSFERENCIA: 'Transferência',
  EMPRESTIMO_RECEBIDO: 'Empréstimo Recebido',
  EMPRESTIMO_PAGO: 'Empréstimo Pago',
  APORTE: 'Aporte',
  RETIRADA: 'Retirada',
  IMOBILIZADO: 'Imobilizado',
  SALDO_INICIAL: 'Saldo Inicial',
  AJUSTE: 'Ajuste',
}

export type MovementTypeGroup = {
  label: string
  types: { value: string; label: string }[]
}

export const MOVEMENT_TYPE_GROUPS: MovementTypeGroup[] = [
  {
    label: 'Entradas',
    types: [
      { value: 'RECEITA', label: 'Receita' },
      { value: 'APORTE', label: 'Aporte' },
      { value: 'EMPRESTIMO_RECEBIDO', label: 'Empréstimo Recebido' },
    ],
  },
  {
    label: 'Saídas',
    types: [
      { value: 'DESPESA', label: 'Despesa' },
      { value: 'EMPRESTIMO_PAGO', label: 'Empréstimo Pago' },
      { value: 'RETIRADA', label: 'Retirada' },
    ],
  },
  {
    label: 'Movimentação Interna',
    types: [
      { value: 'TRANSFERENCIA', label: 'Transferência' },
      { value: 'IMOBILIZADO', label: 'Imobilizado' },
      { value: 'SALDO_INICIAL', label: 'Saldo Inicial' },
      { value: 'AJUSTE', label: 'Ajuste' },
    ],
  },
]

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  settled: 'Liquidado',
  cancelled: 'Cancelado',
}

const REVENUE_TYPES = ['RECEITA', 'APORTE', 'EMPRESTIMO_RECEBIDO']
const EXPENSE_TYPES = ['DESPESA', 'EMPRESTIMO_PAGO', 'RETIRADA']
const TRANSFER_TYPES = ['TRANSFERENCIA']

export function getStatusLabel(status: string, movementType: string): string {
  if (status === 'cancelled') return 'Cancelado'
  if (REVENUE_TYPES.includes(movementType)) {
    return status === 'settled' ? 'Recebido' : 'A receber'
  }
  if (EXPENSE_TYPES.includes(movementType)) {
    return status === 'settled' ? 'Pago' : 'A pagar'
  }
  if (TRANSFER_TYPES.includes(movementType)) {
    return status === 'settled' ? 'Concluída' : 'Pendente'
  }
  return STATUS_LABELS[status] || status
}
