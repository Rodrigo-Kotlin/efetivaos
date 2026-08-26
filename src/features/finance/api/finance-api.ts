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
