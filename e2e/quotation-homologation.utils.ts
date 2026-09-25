import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { assertRemoteMutationAllowed, requiredEnv } from './env'

const execFileAsync = promisify(execFile)
const sqlDirectory = 'test-results/e2e-3c3-sql'

export function marker3c3(tag: string) {
  const unique = `${Date.now()}_${randomUUID().slice(0, 8)}`
  return `E2E_3C3_${tag}_${unique}`
}

export function serviceClient3c3(): SupabaseClient {
  assertRemoteMutationAllowed()
  return createClient(requiredEnv('VITE_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
}

function throwProvision(table: string, error: { message?: string } | null) {
  throw new Error(`Failed to provision E2E 3C3 fixture on ${table}: ${error?.message ?? 'unknown error'}`)
}

export async function provisionSupplier(client: SupabaseClient, name: string): Promise<string> {
  const { data, error } = await client.from('suppliers').insert({ name, active: true, notes: name }).select('id').single()
  if (error) throwProvision('suppliers', error)
  return data!.id
}

export async function provisionCategory(client: SupabaseClient, name: string): Promise<string> {
  const { data, error } = await client.from('catalog_categories').insert({ name, active: true }).select('id').single()
  if (error) throwProvision('catalog_categories', error)
  return data!.id
}

export interface CatalogItemFixture {
  id: string
  code: string
  name: string
}

export async function provisionCatalogItem(
  client: SupabaseClient,
  options: {
    name: string
    categoryId: string
    sourcingType: 'outsourced' | 'own'
    active?: boolean
    unit?: string
    code?: string
  },
): Promise<CatalogItemFixture> {
  const { data, error } = await client
    .from('catalog_items')
    .insert({
      name: options.name,
      category_id: options.categoryId,
      unit: options.unit ?? 'servico',
      sourcing_type: options.sourcingType,
      active: options.active ?? true,
      description: options.name,
      ...(options.code ? { code: options.code } : {}),
    })
    .select('id, code, name')
    .single()
  if (error) throwProvision('catalog_items', error)
  return data!
}

export async function provisionMarginRule(
  client: SupabaseClient,
  options: { catalogItemId: string; value: string; notes: string },
): Promise<string> {
  const { data, error } = await client
    .from('margin_rules')
    .insert({
      scope_type: 'item',
      category_id: null,
      catalog_item_id: options.catalogItemId,
      calculation_type: 'percentage',
      value: options.value,
      active: true,
      notes: options.notes,
    })
    .select('id')
    .single()
  if (error) throwProvision('margin_rules', error)
  return data!.id
}

export async function provisionDraftQuotation(
  client: SupabaseClient,
  options: { supplierId: string; reference: string; receivedAt: string; validUntil?: string; notes: string },
): Promise<string> {
  const { data, error } = await client
    .from('quotations')
    .insert({
      supplier_id: options.supplierId,
      reference_number: options.reference,
      received_at: options.receivedAt,
      ...(options.validUntil ? { valid_until: options.validUntil } : {}),
      status: 'draft',
      notes: options.notes,
    })
    .select('id')
    .single()
  if (error) throwProvision('quotations', error)
  return data!.id
}

export async function insertQuotationItem(
  client: SupabaseClient,
  options: { quotationId: string; catalogItemId: string; unitPrice: string; description?: string; notes?: string },
): Promise<string> {
  const { data, error } = await client
    .from('quotation_items')
    .insert({
      quotation_id: options.quotationId,
      catalog_item_id: options.catalogItemId,
      supplier_description: options.description ?? '3C3 offer',
      unit_price: options.unitPrice,
      notes: options.notes,
    })
    .select('id')
    .single()
  if (error) throwProvision('quotation_items', error)
  return data!.id
}

export async function activateQuotation(client: SupabaseClient, quotationId: string) {
  const { error } = await client.from('quotations').update({ status: 'active' }).eq('id', quotationId)
  if (error) throw new Error(`Failed to activate E2E 3C3 quotation: ${error.message}`)
}

export async function findQuotationItem(client: SupabaseClient, quotationId: string, catalogItemId: string): Promise<string> {
  const { data, error } = await client
    .from('quotation_items')
    .select('id')
    .eq('quotation_id', quotationId)
    .eq('catalog_item_id', catalogItemId)
    .single()
  if (error) throw new Error(`Failed to find E2E 3C3 quotation item: ${error.message}`)
  return data!.id
}

export async function execSql(sql: string, label: string) {
  await mkdir(sqlDirectory, { recursive: true })
  const file = join(sqlDirectory, `${label}-${randomUUID().slice(0, 8)}.sql`)
  await writeFile(file, sql, { encoding: 'utf8', mode: 0o600 })
  try {
    if (process.platform === 'win32') {
      await execFileAsync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `supabase db query --linked --file ${file}`], { windowsHide: true })
    } else {
      await execFileAsync('supabase', ['db', 'query', '--linked', '--file', file])
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to run E2E 3C3 SQL (${label}) through Supabase CLI: ${detail}`)
  } finally {
    await rm(file, { force: true })
  }
}

export interface HomologationCollection {
  prefix: string
  supplierIds: string[]
  categoryIds: string[]
  catalogItemIds: string[]
  marginRuleIds: string[]
  quotationIds: string[]
}

function uuidArray(ids: string[]) {
  if (!ids.length) return 'ARRAY[]::uuid[]'
  return `ARRAY[${ids.map((id) => `'${id}'`).join(', ')}]::uuid[]`
}

export async function cleanupHomologation(client: SupabaseClient, collection: HomologationCollection) {
  if (!/^E2E_3C3_\w+_\d+_[0-9a-f]{8}$/.test(collection.prefix)) {
    throw new Error('Refusing cleanup for an invalid E2E 3C3 fixture prefix')
  }

  const sql = `begin;
set local session_replication_role = replica;
delete from public.price_list
where catalog_item_id = any(${uuidArray(collection.catalogItemIds)})
   or source_quotation_item_id in (
      select qi.id from public.quotation_items qi
      where qi.quotation_id = any(${uuidArray(collection.quotationIds)})
   )
   or margin_rule_id = any(${uuidArray(collection.marginRuleIds)});
delete from public.margin_rules where id = any(${uuidArray(collection.marginRuleIds)});
delete from public.own_price_proposals where catalog_item_id = any(${uuidArray(collection.catalogItemIds)});
delete from public.quotation_items where quotation_id = any(${uuidArray(collection.quotationIds)});
delete from public.quotations where id = any(${uuidArray(collection.quotationIds)});
delete from public.catalog_items
where id = any(${uuidArray(collection.catalogItemIds)})
  and left(coalesce(description, name), length('${collection.prefix}')) = '${collection.prefix}';
delete from public.catalog_categories
where id = any(${uuidArray(collection.categoryIds)})
  and left(name, length('${collection.prefix}')) = '${collection.prefix}';
delete from public.suppliers
where id = any(${uuidArray(collection.supplierIds)})
  and left(coalesce(notes, name), length('${collection.prefix}')) = '${collection.prefix}';
commit;
`

  await execSql(sql, 'cleanup')
}

export interface HomologationResidue {
  suppliers: number
  categories: number
  catalogItems: number
  quotations: number
  quotationItems: number
  marginRules: number
  priceList: number
}

const noUuid = '00000000-0000-0000-0000-000000000000'

export async function captureResidue(client: SupabaseClient, collection: HomologationCollection): Promise<HomologationResidue> {
  const supplierIds = collection.supplierIds.length ? collection.supplierIds : [noUuid]
  const categoryIds = collection.categoryIds.length ? collection.categoryIds : [noUuid]
  const itemIds = collection.catalogItemIds.length ? collection.catalogItemIds : [noUuid]
  const quotationIds = collection.quotationIds.length ? collection.quotationIds : [noUuid]
  const ruleIds = collection.marginRuleIds.length ? collection.marginRuleIds : [noUuid]

  const [suppliers, categories, catalogItems, quotations, quotationItems, marginRules, priceList] = await Promise.all([
    client.from('suppliers').select('id', { count: 'exact', head: true }).in('id', supplierIds),
    client.from('catalog_categories').select('id', { count: 'exact', head: true }).in('id', categoryIds),
    client.from('catalog_items').select('id', { count: 'exact', head: true }).in('id', itemIds),
    client.from('quotations').select('id', { count: 'exact', head: true }).in('id', quotationIds),
    client.from('quotation_items').select('id', { count: 'exact', head: true }).in('quotation_id', quotationIds),
    client.from('margin_rules').select('id', { count: 'exact', head: true }).in('id', ruleIds),
    client.from('price_list').select('id', { count: 'exact', head: true }).in('catalog_item_id', itemIds),
  ])

  const count = (result: { count: number | null; error: { message?: string } | null }) => {
    if (result.error) throw new Error(`Failed to inspect E2E 3C3 residue: ${result.error.message}`)
    return result.count ?? 0
  }

  return {
    suppliers: count(suppliers),
    categories: count(categories),
    catalogItems: count(catalogItems),
    quotations: count(quotations),
    quotationItems: count(quotationItems),
    marginRules: count(marginRules),
    priceList: count(priceList),
  }
}