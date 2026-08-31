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
  CashflowRealizedRow,
  CashflowForecastRow,
  CashflowStatementRow,
  Cashflow13WeekRow,
  CashflowSummaryRow,
  IncomeStatementRow,
  FinancialAssetList,
  BalanceSheetRow,
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

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('financial_categories')
    .delete()
    .eq('id', id)
  if (error) throw error
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
  financialAccountId: string,
  paymentMethodId?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('settle_financial_transaction', {
    p_transaction_id: transactionId,
    p_payment_date: paymentDate,
    p_financial_account_id: financialAccountId,
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

export async function reverseTransaction(
  transactionId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('cancel_financial_transaction', {
    p_transaction_id: transactionId,
    p_reason: reason,
  })
  if (error) throw error
}

export interface UpdateTransactionParams {
  transactionId: string
  expectedVersion: number
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
  notes?: string | null
  principalAmount?: number | null
  interestAmount?: number | null
}

export async function updateTransaction(params: UpdateTransactionParams): Promise<void> {
  const { transactionId, expectedVersion, ...rest } = params
  const { error } = await supabase.rpc('update_financial_transaction', {
    p_transaction_id: transactionId,
    p_expected_version: expectedVersion,
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

// ---------------------------------------------------------------------------
// Cash Flow / DFC (ETAPA 08D + 08D.1 corrections)
// ---------------------------------------------------------------------------

export interface CashflowFilters {
  from?: string | null
  to?: string | null
  financialAccountId?: string | null
  costCenterId?: string | null
  serviceLineId?: string | null
}

export async function fetchCashflowOpeningBalance(date: string, financialAccountId?: string | null): Promise<number> {
  // Resolve financialAccountId to chart_account_id
  let chartAccountId: string | null = null
  if (financialAccountId) {
    const { data: fa } = await supabase.from('financial_accounts').select('chart_account_id').eq('id', financialAccountId).single()
    chartAccountId = fa?.chart_account_id ?? null
  }
  const { data, error } = await supabase.rpc('cashflow_opening_balance', {
    p_date: date,
    p_account_id: chartAccountId,
  })
  if (error) throw error
  return Number(data ?? 0)
}

export async function fetchCashflowSummary(filters: CashflowFilters = {}): Promise<CashflowSummaryRow> {
  const { data, error } = await supabase.rpc('cashflow_summary', {
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_financial_account_id: filters.financialAccountId ?? null,
    p_cost_center_id: filters.costCenterId ?? null,
    p_service_line_id: filters.serviceLineId ?? null,
  })
  if (error) throw error
  return (data as unknown as CashflowSummaryRow) ?? {
    opening_balance: '0', realized_inflows: '0', realized_outflows: '0',
    closing_balance: '0', projected_inflows: '0', projected_outflows: '0', projected_balance: '0',
  }
}

export async function fetchCashflowRealized(filters: CashflowFilters = {}): Promise<CashflowRealizedRow[]> {
  let q = supabase.from('financial_cashflow_realized_v').select('*')
  if (filters.from) q = q.gte('entry_date', filters.from)
  if (filters.to) q = q.lte('entry_date', filters.to)
  // COR-4: resolve financialAccountId to chart_account_id
  if (filters.financialAccountId) {
    const { data: fa } = await supabase.from('financial_accounts').select('chart_account_id').eq('id', filters.financialAccountId).single()
    if (fa?.chart_account_id) q = q.contains('chart_account_ids', [fa.chart_account_id])
  }
  if (filters.costCenterId) q = q.eq('cost_center_id', filters.costCenterId)
  if (filters.serviceLineId) q = q.eq('service_line_id', filters.serviceLineId)
  q = q.order('entry_date', { ascending: true }).order('created_at', { ascending: true })
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CashflowRealizedRow[]
}

export async function fetchCashflowForecast(filters: CashflowFilters = {}): Promise<CashflowForecastRow[]> {
  let q = supabase.from('financial_cashflow_forecast_v').select('*')
  if (filters.from) q = q.gte('due_date', filters.from)
  if (filters.to) q = q.lte('due_date', filters.to)
  if (filters.costCenterId) q = q.eq('cost_center_id', filters.costCenterId)
  if (filters.serviceLineId) q = q.eq('service_line_id', filters.serviceLineId)
  q = q.order('due_date', { ascending: true, nullsFirst: true })
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CashflowForecastRow[]
}

export async function fetchCashflowStatement(filters: CashflowFilters = {}): Promise<CashflowStatementRow[]> {
  const { data, error } = await supabase.rpc('get_cash_flow_statement', {
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_cost_center_id: filters.costCenterId ?? null,
    p_service_line_id: filters.serviceLineId ?? null,
  })
  if (error) throw error
  return (data ?? []) as CashflowStatementRow[]
}

export async function fetchCashflow13Weeks(from?: string | null): Promise<Cashflow13WeekRow[]> {
  const { data, error } = await supabase.rpc('cashflow_13_week_projection', {
    p_from: from ?? null,
  })
  if (error) throw error
  return (data ?? []) as Cashflow13WeekRow[]
}

// ---------------------------------------------------------------------------
// Income Statement / DRE (ETAPA 08E)
// ---------------------------------------------------------------------------

export interface IncomeStatementFilters {
  from?: string | null
  to?: string | null
  costCenterId?: string | null
  serviceLineId?: string | null
}

export async function fetchIncomeStatement(filters: IncomeStatementFilters = {}): Promise<IncomeStatementRow[]> {
  const { data, error } = await supabase.rpc('get_income_statement', {
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_cost_center_id: filters.costCenterId ?? null,
    p_service_line_id: filters.serviceLineId ?? null,
  })
  if (error) throw error
  return (data ?? []) as IncomeStatementRow[]
}

// ---------------------------------------------------------------------------
// Assets (ETAPA 08F)
// ---------------------------------------------------------------------------

export async function fetchAssets(): Promise<FinancialAssetList[]> {
  const { data, error } = await supabase
    .from('financial_assets_list_v')
    .select('*')
    .order('asset_code', { ascending: true })
  if (error) throw error
  return (data ?? []) as FinancialAssetList[]
}

export async function fetchAsset(id: string): Promise<FinancialAssetList> {
  const { data, error } = await supabase
    .from('financial_assets_list_v')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as FinancialAssetList
}

export interface CreateAssetPayload {
  asset_code: string
  name: string
  description?: string | null
  category?: string | null
  acquisition_date?: string
  acquisition_value: number | string
  residual_value?: number | string
  useful_life_months?: number
  depreciation_start_date?: string | null
  location?: string | null
  responsible?: string | null
  serial_number?: string | null
  patrimony_number?: string | null
  notes?: string | null
  asset_chart_account_id?: string | null
  accumulated_depreciation_account_id?: string | null
  depreciation_expense_account_id?: string | null
  cost_center_id?: string | null
  service_line_id?: string | null
  party_id?: string | null
  acquisition_transaction_id?: string | null
}

export async function createAsset(payload: CreateAssetPayload): Promise<string> {
  const { data, error } = await supabase.rpc('create_asset', {
    p_asset_code: payload.asset_code,
    p_name: payload.name,
    p_description: payload.description ?? null,
    p_category: payload.category ?? null,
    p_acquisition_date: payload.acquisition_date ?? new Date().toISOString().slice(0, 10),
    p_acquisition_value: payload.acquisition_value,
    p_residual_value: payload.residual_value ?? 0,
    p_useful_life_months: payload.useful_life_months ?? 60,
    p_depreciation_start_date: payload.depreciation_start_date ?? null,
    p_location: payload.location ?? null,
    p_responsible: payload.responsible ?? null,
    p_serial_number: payload.serial_number ?? null,
    p_patrimony_number: payload.patrimony_number ?? null,
    p_notes: payload.notes ?? null,
    p_asset_chart_account_id: payload.asset_chart_account_id ?? null,
    p_accumulated_depreciation_account_id: payload.accumulated_depreciation_account_id ?? null,
    p_depreciation_expense_account_id: payload.depreciation_expense_account_id ?? null,
    p_cost_center_id: payload.cost_center_id ?? null,
    p_service_line_id: payload.service_line_id ?? null,
    p_party_id: payload.party_id ?? null,
    p_acquisition_transaction_id: payload.acquisition_transaction_id ?? null,
  })
  if (error) throw error
  return data as string
}

export interface UpdateAssetPayload {
  name?: string | null
  description?: string | null
  category?: string | null
  location?: string | null
  responsible?: string | null
  serial_number?: string | null
  patrimony_number?: string | null
  notes?: string | null
  asset_chart_account_id?: string | null
  accumulated_depreciation_account_id?: string | null
  depreciation_expense_account_id?: string | null
  cost_center_id?: string | null
  service_line_id?: string | null
  party_id?: string | null
}

export async function updateAsset(id: string, payload: UpdateAssetPayload): Promise<void> {
  const { error } = await supabase.rpc('update_asset', {
    p_asset_id: id,
    p_name: payload.name ?? null,
    p_description: payload.description ?? null,
    p_category: payload.category ?? null,
    p_location: payload.location ?? null,
    p_responsible: payload.responsible ?? null,
    p_serial_number: payload.serial_number ?? null,
    p_patrimony_number: payload.patrimony_number ?? null,
    p_notes: payload.notes ?? null,
    p_asset_chart_account_id: payload.asset_chart_account_id ?? null,
    p_accumulated_depreciation_account_id: payload.accumulated_depreciation_account_id ?? null,
    p_depreciation_expense_account_id: payload.depreciation_expense_account_id ?? null,
    p_cost_center_id: payload.cost_center_id ?? null,
    p_service_line_id: payload.service_line_id ?? null,
    p_party_id: payload.party_id ?? null,
  })
  if (error) throw error
}

export async function disposeAsset(id: string, notes?: string | null): Promise<void> {
  const { error } = await supabase.rpc('dispose_asset', {
    p_asset_id: id,
    p_notes: notes ?? null,
  })
  if (error) throw error
}

export async function postAssetDepreciation(assetId: string, competencePeriod: string, amount?: number | null): Promise<string> {
  const { data, error } = await supabase.rpc('post_asset_depreciation', {
    p_asset_id: assetId,
    p_competence_period: competencePeriod,
    p_amount: amount ?? null,
  })
  if (error) throw error
  return data as string
}

// ---------------------------------------------------------------------------
// Balance Sheet (ETAPA 08F)
// ---------------------------------------------------------------------------

export async function fetchBalanceSheet(asOfDate?: string | null): Promise<BalanceSheetRow[]> {
  const { data, error } = await supabase.rpc('get_balance_sheet', {
    p_as_of_date: asOfDate ?? new Date().toISOString().slice(0, 10),
  })
  if (error) throw error
  return (data ?? []) as BalanceSheetRow[]
}

// ---------------------------------------------------------------------------
// DMPL - Statement of Changes in Equity (ETAPA 08G)
// ---------------------------------------------------------------------------

export interface DmplRow {
  row_label: string
  capital_social: number
  reservas: number
  lucros_prejuizos_acumulados: number
  resultado_exercicio: number
  outros_componentes: number
  total_pl: number
  sort_order: number
}

export async function fetchDmpl(from?: string | null, to?: string | null): Promise<DmplRow[]> {
  const { data, error } = await supabase.rpc('get_statement_of_changes_in_equity', {
    p_from: from ?? null,
    p_to: to ?? new Date().toISOString().slice(0, 10),
  })
  if (error) throw error
  return (data ?? []) as DmplRow[]
}

// ---------------------------------------------------------------------------
// DLPA - Retained Earnings Statement (ETAPA 08G)
// ---------------------------------------------------------------------------

export interface DlpaRow {
  row_label: string
  amount: number
  sort_order: number
}

export async function fetchDlpa(from?: string | null, to?: string | null): Promise<DlpaRow[]> {
  const { data, error } = await supabase.rpc('get_retained_earnings_statement', {
    p_from: from ?? null,
    p_to: to ?? new Date().toISOString().slice(0, 10),
  })
  if (error) throw error
  return (data ?? []) as DlpaRow[]
}

// ---------------------------------------------------------------------------
// DVA - Value Added Statement (ETAPA 08G)
// ---------------------------------------------------------------------------

export interface DvaRow {
  row_label: string
  amount: number
  sort_order: number
}

export async function fetchDva(from?: string | null, to?: string | null): Promise<DvaRow[]> {
  const { data, error } = await supabase.rpc('get_value_added_statement', {
    p_from: from ?? null,
    p_to: to ?? new Date().toISOString().slice(0, 10),
  })
  if (error) throw error
  return (data ?? []) as DvaRow[]
}

// ---------------------------------------------------------------------------
// Adjustments (ETAPA 08G)
// ---------------------------------------------------------------------------

export interface AdjustmentLine {
  chart_account_id: string
  debit: number
  credit: number
  description?: string
}

export interface CreateAdjustmentPayload {
  entry_date: string
  competence_date: string
  description: string
  reference?: string | null
  cost_center_id?: string | null
  service_line_id?: string | null
  lines: AdjustmentLine[]
  idempotency_key?: string | null
  justification?: string | null
}

export async function createManualJournalAdjustment(payload: CreateAdjustmentPayload): Promise<string> {
  const { data, error } = await supabase.rpc('create_manual_journal_adjustment', {
    p_entry_date: payload.entry_date,
    p_competence_date: payload.competence_date,
    p_description: payload.description,
    p_reference: payload.reference ?? null,
    p_cost_center_id: payload.cost_center_id ?? null,
    p_service_line_id: payload.service_line_id ?? null,
    p_lines: payload.lines,
    p_idempotency_key: payload.idempotency_key ?? null,
    p_justification: payload.justification ?? null,
  })
  if (error) throw error
  return data as string
}

// ---------------------------------------------------------------------------
// Notes (ETAPA 08G)
// ---------------------------------------------------------------------------

export interface FinancialNote {
  id: string
  note_type: string
  title: string
  body: string | null
  reference_date: string | null
  period_start: string | null
  period_end: string | null
  chart_account_id: string | null
  transaction_id: string | null
  journal_entry_id: string | null
  asset_id: string | null
  report_type: string
  active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface NoteFormValues {
  note_type: string
  title: string
  body?: string | null
  reference_date?: string | null
  period_start?: string | null
  period_end?: string | null
  chart_account_id?: string | null
  transaction_id?: string | null
  journal_entry_id?: string | null
  asset_id?: string | null
  report_type: string
}

export async function fetchNotes(reportType?: string | null): Promise<FinancialNote[]> {
  let query = supabase
    .from('financial_notes')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (reportType) {
    query = query.eq('report_type', reportType)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as FinancialNote[]
}

export async function createNote(payload: NoteFormValues): Promise<FinancialNote> {
  const { data, error } = await supabase
    .from('financial_notes')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as FinancialNote
}

export async function updateNote(id: string, payload: Partial<NoteFormValues>): Promise<FinancialNote> {
  const { data, error } = await supabase
    .from('financial_notes')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as FinancialNote
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('financial_notes')
    .update({ active: false })
    .eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Financial Dashboard (ETAPA 08H)
// ---------------------------------------------------------------------------

export interface DashboardFilters {
  from?: string | null
  to?: string | null
  asOfDate?: string | null
  costCenterId?: string | null
  serviceLineId?: string | null
}

export interface FinancialDashboardData {
  period: { from: string; to: string; as_of_date: string }
  cashflow: {
    opening_balance: number; closing_balance: number
    realized_inflows: number; realized_outflows: number
    projected_inflows: number; projected_outflows: number; projected_balance: number
  }
  receivables: { open: number; overdue: number; due_in_7_days: number; due_in_30_days: number }
  payables: { open: number; overdue: number; due_in_7_days: number; due_in_30_days: number }
  income_statement: {
    revenue: number; revenue_deductions: number; net_revenue: number
    cogs: number; gross_profit: number; opex: number; depreciation: number
    ebitda: number; financial_result: number; other_income: number
    other_expense: number; tax: number; net_result: number
    margin_ebitda: number; margin_net: number
  }
  balance_sheet: {
    total_assets: number; current_assets: number
    current_liabilities: number; non_current_liabilities: number
    total_liabilities: number; equity: number
    working_capital: number; current_ratio: number; leverage: number
  }
}

export async function fetchFinancialDashboard(filters: DashboardFilters = {}): Promise<FinancialDashboardData> {
  const { data, error } = await supabase.rpc('get_financial_dashboard', {
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_as_of_date: filters.asOfDate ?? null,
    p_cost_center_id: filters.costCenterId ?? null,
    p_service_line_id: filters.serviceLineId ?? null,
  })
  if (error) throw error
  return (data as unknown as FinancialDashboardData)
}
