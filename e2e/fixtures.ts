import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { promisify } from 'node:util'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { assertRemoteMutationAllowed, requiredEnv } from './env'

export const fixtureStatePath = 'test-results/e2e-fixture-state.json'
const cleanupSqlPath = 'test-results/e2e-cleanup.sql'
const execFileAsync = promisify(execFile)

export interface FixtureState {
  prefix: string
  supplierId?: string
  supplierName: string
  categoryId?: string
  categoryName: string
  catalogItemId?: string
  catalogItemCode: string
  catalogItemName: string
  attachmentExpected?: boolean
  quotationId?: string
  quotationReference: string
  priceApproval: {
    categoryId?: string
    categoryName: string
    catalogItemId?: string
    catalogItemCode: string
    catalogItemName: string
    bestSupplierId?: string
    bestSupplierName: string
    alternativeSupplierId?: string
    alternativeSupplierName: string
    bestQuotationId?: string
    bestQuotationItemId?: string
    bestQuotationReference: string
    alternativeQuotationId?: string
    alternativeQuotationItemId?: string
    alternativeQuotationReference: string
    marginRuleId?: string
  }
}

export function createFixtureState(): FixtureState {
  const unique = `${Date.now()}_${randomUUID().slice(0, 8)}`
  const prefix = `E2E_S2_${unique}`

  return {
    prefix,
    supplierName: `${prefix}_SUPPLIER`,
    categoryName: `${prefix}_CATEGORY`,
    catalogItemCode: `${prefix}_ITEM`,
    catalogItemName: `${prefix}_CATALOG_ITEM`,
    quotationReference: `${prefix}_QUOTE`,
    priceApproval: {
      categoryName: `${prefix}_PRICE_CATEGORY`,
      catalogItemCode: `${prefix}_PRICE_ITEM`,
      catalogItemName: `${prefix}_PRICE_APPROVAL_ITEM`,
      bestSupplierName: `${prefix}_PRICE_SUPPLIER_BEST`,
      alternativeSupplierName: `${prefix}_PRICE_SUPPLIER_ALTERNATIVE`,
      bestQuotationReference: `${prefix}_PRICE_QUOTE_BEST`,
      alternativeQuotationReference: `${prefix}_PRICE_QUOTE_ALTERNATIVE`,
    },
  }
}

export function serviceClient() {
  assertRemoteMutationAllowed()
  return createClient(requiredEnv('VITE_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
}

export async function saveFixtureState(state: FixtureState) {
  await mkdir(dirname(fixtureStatePath), { recursive: true })
  await writeFile(fixtureStatePath, JSON.stringify(state), { encoding: 'utf8', mode: 0o600 })
}

export async function readFixtureState() {
  return JSON.parse(await readFile(fixtureStatePath, 'utf8')) as FixtureState
}

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

export async function cleanupFixtures(client: SupabaseClient, state: FixtureState) {
  if (!/^E2E_S2_\d+_[0-9a-f]{8}$/.test(state.prefix)) throw new Error('Refusing cleanup for an invalid E2E fixture prefix')

  const { data: quotations, error: quotationLookupError } = await client
    .from('quotations')
    .select('id, reference_number, source_file_path, source_file_pending')
    .eq('reference_number', state.quotationReference)

  if (quotationLookupError) throw new Error(`Failed to find E2E quotations for cleanup: ${quotationLookupError.message}`)

  // Tambem localiza cotacoes adicionais da mesma fixture por prefixo,
  // cobrindo o caso de Sprint 3 (multiplas cotacoes por fixture).
  const { data: prefixQuotations, error: prefixError } = await client
    .from('quotations')
    .select('id, reference_number, source_file_path, source_file_pending')
    .like('reference_number', `${state.prefix}%`)

  if (prefixError) throw new Error(`Failed to find prefixed E2E quotations for cleanup: ${prefixError.message}`)

  const seen = new Set<string>()
  const allQuotations = [...(quotations ?? []), ...(prefixQuotations ?? [])]
    .filter((quotation) => {
      if (seen.has(quotation.id)) return false
      seen.add(quotation.id)
      return Boolean(quotation.reference_number?.startsWith(state.prefix))
    })

  const quotationIds = allQuotations.map((quotation) => quotation.id)
  const attachedIds = allQuotations
    .filter((quotation) => Boolean(quotation.source_file_path) && !quotation.source_file_pending)
    .map((quotation) => quotation.id)

  if (quotationIds.length) {
    if (state.attachmentExpected) {
      const { data: objects, error: listError } = await client.storage.from('supplier-quotes').list(attachedIds[0] ?? quotationIds[0], { search: 'original' })
      if (listError) throw new Error(`Failed to verify E2E quotation attachment: ${listError.message}`)
      if (!(objects ?? []).some((object) => object.name === 'original')) throw new Error('Expected E2E quotation attachment was not persisted')
    }

    if (attachedIds.length) {
      const { error: storageError } = await client.storage.from('supplier-quotes').remove(attachedIds.map((id) => `${id}/original`))
      if (storageError) throw new Error(`Failed to clean E2E quotation attachments: ${storageError.message}`)
    }

  }

  const catalogItemId = state.catalogItemId ?? '00000000-0000-0000-0000-000000000000'
  const priceCatalogItemId = state.priceApproval.catalogItemId ?? '00000000-0000-0000-0000-000000000000'
  const categoryId = state.categoryId ?? '00000000-0000-0000-0000-000000000000'
  const priceCategoryId = state.priceApproval.categoryId ?? '00000000-0000-0000-0000-000000000000'
  const supplierId = state.supplierId ?? '00000000-0000-0000-0000-000000000000'
  const bestSupplierId = state.priceApproval.bestSupplierId ?? '00000000-0000-0000-0000-000000000000'
  const alternativeSupplierId = state.priceApproval.alternativeSupplierId ?? '00000000-0000-0000-0000-000000000000'

  const sql = `begin;
set local session_replication_role = replica;
delete from public.price_list where catalog_item_id in (
  ${sqlLiteral(catalogItemId)}::uuid,
  ${sqlLiteral(priceCatalogItemId)}::uuid
) or source_quotation_item_id in (
  select qi.id from public.quotation_items qi
  join public.quotations q on q.id = qi.quotation_id
  where left(q.reference_number, length(${sqlLiteral(state.prefix)})) = ${sqlLiteral(state.prefix)}
) or margin_rule_id in (
  select id from public.margin_rules
  where left(notes, length(${sqlLiteral(state.prefix)})) = ${sqlLiteral(state.prefix)}
);
delete from public.margin_rules where left(notes, length(${sqlLiteral(state.prefix)})) = ${sqlLiteral(state.prefix)};
delete from public.quotation_items where quotation_id in (
  select id from public.quotations where left(reference_number, length(${sqlLiteral(state.prefix)})) = ${sqlLiteral(state.prefix)}
);
delete from public.quotations where left(reference_number, length(${sqlLiteral(state.prefix)})) = ${sqlLiteral(state.prefix)};
delete from public.catalog_items
where (id = ${sqlLiteral(catalogItemId)}::uuid and code = ${sqlLiteral(state.catalogItemCode)})
   or (id = ${sqlLiteral(priceCatalogItemId)}::uuid and code = ${sqlLiteral(state.priceApproval.catalogItemCode)});
delete from public.catalog_categories
where (id = ${sqlLiteral(categoryId)}::uuid and name = ${sqlLiteral(state.categoryName)})
   or (id = ${sqlLiteral(priceCategoryId)}::uuid and name = ${sqlLiteral(state.priceApproval.categoryName)});
delete from public.suppliers
where ((id = ${sqlLiteral(supplierId)}::uuid and name = ${sqlLiteral(state.supplierName)})
    or (id = ${sqlLiteral(bestSupplierId)}::uuid and name = ${sqlLiteral(state.priceApproval.bestSupplierName)})
    or (id = ${sqlLiteral(alternativeSupplierId)}::uuid and name = ${sqlLiteral(state.priceApproval.alternativeSupplierName)}))
  and left(coalesce(notes, ''), length(${sqlLiteral(state.prefix)})) = ${sqlLiteral(state.prefix)};
commit;
`

  await mkdir(dirname(cleanupSqlPath), { recursive: true })
  await writeFile(cleanupSqlPath, sql, { encoding: 'utf8', mode: 0o600 })
  try {
    if (process.platform === 'win32') {
      await execFileAsync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `supabase db query --linked --file ${cleanupSqlPath}`], { windowsHide: true })
    } else {
      await execFileAsync('supabase', ['db', 'query', '--linked', '--file', cleanupSqlPath])
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to clean E2E relational fixtures through Supabase CLI: ${detail}`)
  } finally {
    await rm(cleanupSqlPath, { force: true })
  }
}
