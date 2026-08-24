import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { assertRemoteMutationAllowed, requiredEnv } from './env'

export const fixtureStatePath = 'test-results/e2e-fixture-state.json'

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

async function deleteOwnedById(client: SupabaseClient, table: string, id: string | undefined, ownershipColumn: string, expectedValue: string) {
  if (!id) return
  const { data, error: lookupError } = await client.from(table).select(`id, ${ownershipColumn}`).eq('id', id).maybeSingle()
  if (lookupError) throw new Error(`Failed to verify E2E ownership in ${table}: ${lookupError.message}`)
  if (!data) return
  const ownedRow = data as unknown as Record<string, unknown>
  if (ownedRow[ownershipColumn] !== expectedValue || !expectedValue.startsWith('E2E_S2_')) {
    throw new Error(`Refusing to clean a non-E2E row from ${table}`)
  }

  const { error } = await client.from(table).delete().eq('id', id).eq(ownershipColumn, expectedValue)
  if (error) throw new Error(`Failed to clean E2E table ${table}: ${error.message}`)
}

export async function cleanupFixtures(client: SupabaseClient, state: FixtureState) {
  if (!state.prefix.startsWith('E2E_S2_')) throw new Error('Refusing cleanup for a non-E2E fixture prefix')

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

    const { error: itemError } = await client.from('quotation_items').delete().in('quotation_id', quotationIds)
    if (itemError) throw new Error(`Failed to clean E2E quotation items: ${itemError.message}`)

    const { error: quotationError } = await client.from('quotations').delete().in('id', quotationIds)
    if (quotationError) throw new Error(`Failed to clean E2E quotations: ${quotationError.message}`)
  }

  await deleteOwnedById(client, 'catalog_items', state.catalogItemId, 'code', state.catalogItemCode)
  await deleteOwnedById(client, 'catalog_categories', state.categoryId, 'name', state.categoryName)
  await deleteOwnedById(client, 'suppliers', state.supplierId, 'name', state.supplierName)
}
