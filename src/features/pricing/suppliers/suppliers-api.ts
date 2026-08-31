import type { PostgrestError } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'
import type { Database, Supplier } from '@/types/database'

import type { SupplierInput } from './supplier-schema'

const supplierColumns = 'id, code, name, legal_name, tax_id, category, contact_name, email, phone, active, notes, created_at, created_by, updated_at, updated_by'

function supplierError(error: PostgrestError, operation: 'listar' | 'criar' | 'atualizar' | 'alterar status'): Error {
  if (error.code === '23505') return new Error('Ja existe um fornecedor com esses dados.')
  if (error.code === '23503') return new Error('O fornecedor possui vinculos e nao pode ser alterado dessa forma.')
  if (error.code === '42501') return new Error('Voce nao tem permissao para realizar esta operacao.')
  if (error.code === 'PGRST116') return new Error('Fornecedor nao encontrado.')
  return new Error(`Nao foi possivel ${operation} o fornecedor. Tente novamente.`)
}

function normalizeInput(input: SupplierInput): SupplierInput {
  const nullable = (value: string | null) => value?.trim() || null
  return {
    name: input.name.trim(),
    legal_name: nullable(input.legal_name),
    tax_id: nullable(input.tax_id),
    category: nullable(input.category),
    contact_name: nullable(input.contact_name),
    email: nullable(input.email),
    phone: nullable(input.phone),
    active: input.active,
    notes: nullable(input.notes),
  }
}

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select(supplierColumns).order('name')
  if (error) throw supplierError(error, 'listar')
  return data
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const payload: Database['public']['Tables']['suppliers']['Insert'] = normalizeInput(input)
  const { data, error } = await supabase.from('suppliers').insert(payload).select(supplierColumns).single()
  if (error) throw supplierError(error, 'criar')
  return data
}

export async function updateSupplier({ id, input }: { id: string; input: SupplierInput }): Promise<Supplier> {
  const payload: Database['public']['Tables']['suppliers']['Update'] = normalizeInput(input)
  const { data, error } = await supabase.from('suppliers').update(payload).eq('id', id).select(supplierColumns).single()
  if (error) throw supplierError(error, 'atualizar')
  return data
}

export async function setSupplierStatus({ id, active }: { id: string; active: boolean }): Promise<Supplier> {
  const { data, error } = await supabase.from('suppliers').update({ active }).eq('id', id).select(supplierColumns).single()
  if (error) throw supplierError(error, 'alterar status')
  return data
}
