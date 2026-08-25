import type { PostgrestError } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'
import type { Database, Client, ClientListRow } from '@/types/database'

const clientColumns = 'id, legal_name, trade_name, tax_id, client_type, status, email, phone, website, zip_code, street, number, complement, district, city, state, country, notes, created_at, created_by, updated_at, updated_by'

function clientError(error: PostgrestError, operation: string): Error {
  if (error.code === '23505') return new Error('Já existe um cliente cadastrado com este CPF/CNPJ.')
  if (error.code === '23503') return new Error('O cliente possui vínculos e não pode ser alterado dessa forma.')
  if (error.code === '42501') return new Error('Você não tem permissão para realizar esta operação.')
  if (error.code === 'PGRST116') return new Error('Cliente não encontrado.')
  return new Error(`Não foi possível ${operation} o cliente. Tente novamente.`)
}

export async function listClients(filters?: {
  search?: string
  type?: 'company' | 'individual'
  status?: 'active' | 'inactive'
}): Promise<{ data: ClientListRow[]; error?: Error }> {
  let query = supabase.from('client_list_v').select(clientColumns)

  if (filters?.search) {
    const term = filters.search.toLocaleLowerCase('pt-BR')
    query = query.or(`legal_name.ilike.%${term}%,trade_name.ilike.%${term}%,tax_id.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
  }

  if (filters?.type) {
    query = query.eq('client_type', filters.type)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query.order('legal_name')

  if (error) throw clientError(error, 'listar')

  return { data: data as ClientListRow[], error: undefined }
}

export async function getClient(id: string): Promise<{ data: ClientListRow; error?: Error }> {
  const { data, error } = await supabase.from('client_list_v').select(clientColumns).eq('id', id).single()
  if (error) throw clientError(error, 'buscar')
  return { data: data as ClientListRow, error: undefined }
}

export async function createClient(input: {
  legal_name: string
  trade_name: string | null
  client_type: 'company' | 'individual'
  tax_id: string
  email: string | null
  phone: string | null
  website: string | null
  zip_code: string | null | undefined
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  country: string
  notes: string | null
}): Promise<{ data: Client; error?: Error }> {
  const payload: Database['public']['Tables']['clients']['Insert'] = {
    legal_name: input.legal_name.trim(),
    trade_name: input.trade_name === '' ? null : input.trade_name || null,
    client_type: input.client_type,
    tax_id: input.tax_id.replace(/[^\d]/g, ''),
    email: input.email === '' ? null : input.email || null,
    phone: input.phone === '' ? null : input.phone || null,
    website: input.website === '' ? null : input.website || null,
    zip_code: input.zip_code != null && input.zip_code !== '' ? input.zip_code.replace(/[^\d-]/g, '') || null : null,
    street: input.street === '' ? null : input.street || null,
    number: input.number === '' ? null : input.number || null,
    complement: input.complement === '' ? null : input.complement || null,
    district: input.district === '' ? null : input.district || null,
    city: input.city === '' ? null : input.city || null,
    state: input.state || null,
    country: input.country || 'Brasil',
    notes: input.notes === '' ? null : input.notes || null,
  }

  const { data, error } = await supabase.from('clients').insert(payload).select(clientColumns).single()

  if (error) throw clientError(error, 'criar')

  return { data: data as Client, error: undefined }
}

export async function updateClient({
  id,
  input,
}: {
  id: string
  input: {
    legal_name: string
    trade_name: string | null
    client_type: 'company' | 'individual'
    tax_id: string
    email: string | null
    phone: string | null
    website: string | null
    zip_code: string | null | undefined
    street: string | null
    number: string | null
    complement: string | null
    district: string | null
    city: string | null
    state: string | null
    country: string
    notes: string | null
  }
}): Promise<{ data: Client; error?: Error }> {
  const payload: Database['public']['Tables']['clients']['Update'] = {
    legal_name: input.legal_name.trim(),
    trade_name: input.trade_name === '' ? null : input.trade_name || null,
    client_type: input.client_type,
    tax_id: input.tax_id.replace(/[^\d]/g, ''),
    email: input.email === '' ? null : input.email || null,
    phone: input.phone === '' ? null : input.phone || null,
    website: input.website === '' ? null : input.website || null,
    zip_code: input.zip_code != null && input.zip_code !== '' ? input.zip_code.replace(/[^\d-]/g, '') || null : null,
    street: input.street === '' ? null : input.street || null,
    number: input.number === '' ? null : input.number || null,
    complement: input.complement === '' ? null : input.complement || null,
    district: input.district === '' ? null : input.district || null,
    city: input.city === '' ? null : input.city || null,
    state: input.state || null,
    country: input.country || 'Brasil',
    notes: input.notes === '' ? null : input.notes || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('clients')
    .update(payload)
    .eq('id', id)
    .select(clientColumns)
    .single()

  if (error) throw clientError(error, 'atualizar')

  return { data: data as Client, error: undefined }
}

export async function setClientStatus({ id, status }: { id: string; status: 'active' | 'inactive' }): Promise<{ data: Client; error?: Error }> {
  const { data, error } = await supabase.from('clients').update({ status }).eq('id', id).select(clientColumns).single()

  if (error) throw clientError(error, 'inativar/reativar')

  return { data: data as Client, error: undefined }
}