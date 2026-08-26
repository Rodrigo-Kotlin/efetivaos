import { supabase } from '@/lib/supabase'
import type {
  Database,
  ChartAccount,
  CostCenter,
  ServiceLine,
  FinancialCategory,
  FinancialCategoryList,
  FinancialAccount,
  FinancialAccountList,
  PaymentMethod,
  FinancialParty,
  FinancialTransactionList,
  FinancialJournalEntryList,
  FinancialJournalLineList,
  FinancialMovementType,
  FinancialTransactionStatus,
} from '@/types/database'

type FinanceTables = Database['public']['Tables']

// ---------------------------------------------------------------------------
// Chart Accounts (Plano de Contas)
// ---------------------------------------------------------------------------

export async function fetchChartAccounts(): Promise<ChartAccount[]> {
  const { data, error } = await supabase
    .from('financial_chart_accounts')
    .select('*')
    .order('code', { ascending: true })
  if (error) throw error
  return (data ?? []).map(a => ({ ...a, presentation_sign: a.presentation_sign as 1 | -1 }))
}

export async function createChartAccount(payload: FinanceTables['financial_chart_accounts']['Insert']): Promise<ChartAccount> {
  const { data, error } = await supabase
    .from('financial_chart_accounts')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return { ...data, presentation_sign: data.presentation_sign as 1 | -1 }
}

export async function updateChartAccount(id: string, payload: FinanceTables['financial_chart_accounts']['Update']): Promise<ChartAccount> {
  const { data, error } = await supabase
    .from('financial_chart_accounts')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return { ...data, presentation_sign: data.presentation_sign as 1 | -1 }
}

// ---------------------------------------------------------------------------
// Cost Centers
// ---------------------------------------------------------------------------

export async function fetchCostCenters(): Promise<CostCenter[]> {
  const { data, error } = await supabase
    .from('financial_cost_centers')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCostCenter(payload: FinanceTables['financial_cost_centers']['Insert']): Promise<CostCenter> {
  const { data, error } = await supabase
    .from('financial_cost_centers')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCostCenter(id: string, payload: FinanceTables['financial_cost_centers']['Update']): Promise<CostCenter> {
  const { data, error } = await supabase
    .from('financial_cost_centers')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Service Lines
// ---------------------------------------------------------------------------

export async function fetchServiceLines(): Promise<ServiceLine[]> {
  const { data, error } = await supabase
    .from('financial_service_lines')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createServiceLine(payload: FinanceTables['financial_service_lines']['Insert']): Promise<ServiceLine> {
  const { data, error } = await supabase
    .from('financial_service_lines')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateServiceLine(id: string, payload: FinanceTables['financial_service_lines']['Update']): Promise<ServiceLine> {
  const { data, error } = await supabase
    .from('financial_service_lines')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function fetchCategories(): Promise<FinancialCategoryList[]> {
  const { data, error } = await supabase
    .from('financial_categories_list_v')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCategory(payload: FinanceTables['financial_categories']['Insert']): Promise<FinancialCategory> {
  const { data, error } = await supabase
    .from('financial_categories')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id: string, payload: FinanceTables['financial_categories']['Update']): Promise<FinancialCategory> {
  const { data, error } = await supabase
    .from('financial_categories')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Financial Accounts (Contas de Caixa/Banco)
// ---------------------------------------------------------------------------

export async function fetchFinancialAccounts(): Promise<FinancialAccountList[]> {
  const { data, error } = await supabase
    .from('financial_accounts_list_v')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createFinancialAccount(payload: FinanceTables['financial_accounts']['Insert']): Promise<FinancialAccount> {
  const { data, error } = await supabase
    .from('financial_accounts')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateFinancialAccount(id: string, payload: FinanceTables['financial_accounts']['Update']): Promise<FinancialAccount> {
  const { data, error } = await supabase
    .from('financial_accounts')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Parties (Pessoas)
// ---------------------------------------------------------------------------

export async function fetchParties(): Promise<FinancialParty[]> {
  const { data, error } = await supabase
    .from('financial_parties')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ---------------------------------------------------------------------------
// Payment Methods
// ---------------------------------------------------------------------------

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from('financial_payment_methods')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createPaymentMethod(payload: FinanceTables['financial_payment_methods']['Insert']): Promise<PaymentMethod> {
  const { data, error } = await supabase
    .from('financial_payment_methods')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePaymentMethod(id: string, payload: FinanceTables['financial_payment_methods']['Update']): Promise<PaymentMethod> {
  const { data, error } = await supabase
    .from('financial_payment_methods')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Transactions (Motor de Lançamentos)
// ---------------------------------------------------------------------------

export async function fetchTransactions(): Promise<FinancialTransactionList[]> {
  const { data, error } = await supabase
    .from('financial_transactions_list_v')
    .select('*')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as FinancialTransactionList[]
}

export async function fetchTransactionById(id: string): Promise<FinancialTransactionList> {
  const { data, error } = await supabase
    .from('financial_transactions_list_v')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as FinancialTransactionList
}

export interface CreateTransactionParams {
  description: string
  transactionDate: string
  competenceDate: string
  movementType: FinancialMovementType
  amount: number
  categoryId?: string | null
  originAccountId?: string | null
  destinationAccountId?: string | null
  partyId?: string | null
  costCenterId?: string | null
  serviceLineId?: string | null
  paymentMethodId?: string | null
  dueDate?: string | null
  paymentDate?: string | null
  notes?: string | null
  principalAmount?: number | null
  interestAmount?: number | null
  idempotencyKey?: string | null
}

export async function createTransaction(params: CreateTransactionParams): Promise<string> {
  const { data, error } = await supabase.rpc('create_financial_transaction', {
    p_description: params.description,
    p_transaction_date: params.transactionDate,
    p_competence_date: params.competenceDate,
    p_movement_type: params.movementType,
    p_amount: params.amount,
    p_category_id: params.categoryId ?? null,
    p_origin_account_id: params.originAccountId ?? null,
    p_destination_account_id: params.destinationAccountId ?? null,
    p_party_id: params.partyId ?? null,
    p_cost_center_id: params.costCenterId ?? null,
    p_service_line_id: params.serviceLineId ?? null,
    p_payment_method_id: params.paymentMethodId ?? null,
    p_due_date: params.dueDate ?? null,
    p_payment_date: params.paymentDate ?? null,
    p_notes: params.notes ?? null,
    p_principal_amount: params.principalAmount ?? null,
    p_interest_amount: params.interestAmount ?? null,
    p_idempotency_key: params.idempotencyKey ?? null,
  })
  if (error) throw error
  return data as string
}

export async function settleTransaction(
  transactionId: string,
  paymentDate: string,
  paymentMethodId?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('settle_financial_transaction', {
    p_transaction_id: transactionId,
    p_payment_date: paymentDate,
    p_payment_method_id: paymentMethodId ?? null,
  })
  if (error) throw error
}

export async function cancelTransaction(
  transactionId: string,
  reason?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('cancel_financial_transaction', {
    p_transaction_id: transactionId,
    p_reason: reason ?? null,
  })
  if (error) throw error
}

export interface UpdateTransactionParams {
  transactionId: string
  expectedVersion?: number
  description?: string | null
  transactionDate?: string | null
  competenceDate?: string | null
  movementType?: FinancialMovementType | null
  amount?: number | null
  categoryId?: string | null
  originAccountId?: string | null
  destinationAccountId?: string | null
  partyId?: string | null
  costCenterId?: string | null
  serviceLineId?: string | null
  paymentMethodId?: string | null
  dueDate?: string | null
  paymentDate?: string | null
  notes?: string | null
  principalAmount?: number | null
  interestAmount?: number | null
}

export async function updateTransaction(params: UpdateTransactionParams): Promise<void> {
  const { transactionId, expectedVersion, ...rest } = params
  const { error } = await supabase.rpc('update_financial_transaction', {
    p_transaction_id: transactionId,
    p_expected_version: expectedVersion ?? null,
    p_description: rest.description ?? null,
    p_transaction_date: rest.transactionDate ?? null,
    p_competence_date: rest.competenceDate ?? null,
    p_movement_type: rest.movementType ?? null,
    p_amount: rest.amount ?? null,
    p_category_id: rest.categoryId ?? null,
    p_origin_account_id: rest.originAccountId ?? null,
    p_destination_account_id: rest.destinationAccountId ?? null,
    p_party_id: rest.partyId ?? null,
    p_cost_center_id: rest.costCenterId ?? null,
    p_service_line_id: rest.serviceLineId ?? null,
    p_payment_method_id: rest.paymentMethodId ?? null,
    p_due_date: rest.dueDate ?? null,
    p_payment_date: rest.paymentDate ?? null,
    p_notes: rest.notes ?? null,
    p_principal_amount: rest.principalAmount ?? null,
    p_interest_amount: rest.interestAmount ?? null,
  })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Journal Entries (Lançamentos Contábeis)
// ---------------------------------------------------------------------------

export async function fetchJournalEntriesByTransaction(transactionId: string): Promise<FinancialJournalEntryList[]> {
  const { data, error } = await supabase
    .from('financial_journal_entries_list_v')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('entry_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as FinancialJournalEntryList[]
}

export async function fetchJournalLinesByEntry(entryId: string): Promise<FinancialJournalLineList[]> {
  const { data, error } = await supabase
    .from('financial_journal_lines_list_v')
    .select('*')
    .eq('entry_id', entryId)
    .order('debit', { ascending: false })
  if (error) throw error
  return (data ?? []) as FinancialJournalLineList[]
}
