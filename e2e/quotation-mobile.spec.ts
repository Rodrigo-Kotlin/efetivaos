import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { serviceClient } from './fixtures'

type MobileFixture = {
  client: ReturnType<typeof serviceClient>
  prefix: string
  supplierId: string
  categoryId: string
  catalogItemId: string
  quotationId: string
  quotationReference: string
}

async function provisionMobileFixture(): Promise<MobileFixture> {
  const client = serviceClient()
  const prefix = `E2E_MOBILE_${Date.now()}_${randomUUID().slice(0, 8)}`
  let supplierId: string | undefined
  let categoryId: string | undefined
  let catalogItemId: string | undefined
  let quotationId: string | undefined

  try {
    const { data: supplier, error: supplierError } = await client.from('suppliers').insert({ name: `${prefix}_SUPPLIER`, active: true, notes: prefix }).select('id').single()
    if (supplierError || !supplier) throw new Error(`Failed to provision mobile supplier: ${supplierError?.message ?? 'missing id'}`)
    supplierId = supplier.id

    const { data: category, error: categoryError } = await client.from('catalog_categories').insert({ name: `${prefix}_CATEGORY`, active: true }).select('id').single()
    if (categoryError || !category) throw new Error(`Failed to provision mobile category: ${categoryError?.message ?? 'missing id'}`)
    categoryId = category.id

    const { data: item, error: itemError } = await client.from('catalog_items').insert({ code: `${prefix}_ITEM`, name: `${prefix}_ITEM`, category_id: categoryId, unit: 'unidade', active: true, description: prefix }).select('id').single()
    if (itemError || !item) throw new Error(`Failed to provision mobile catalog item: ${itemError?.message ?? 'missing id'}`)
    catalogItemId = item.id

    const quotationReference = `${prefix}_QUOTE`
    const { data: quotation, error: quotationError } = await client.from('quotations').insert({ supplier_id: supplierId, reference_number: quotationReference, received_at: '2026-09-24', status: 'draft', notes: prefix }).select('id').single()
    if (quotationError || !quotation) throw new Error(`Failed to provision mobile quotation: ${quotationError?.message ?? 'missing id'}`)
    quotationId = quotation.id

    const { error: itemLineError } = await client.from('quotation_items').insert({ quotation_id: quotationId, catalog_item_id: catalogItemId, supplier_description: `${prefix}_OFFER`, unit_price: '137.45', notes: prefix })
    if (itemLineError) throw new Error(`Failed to provision mobile quotation item: ${itemLineError.message}`)

    return { client, prefix, supplierId, categoryId, catalogItemId, quotationId, quotationReference }
  } catch (error) {
    await cleanupMobileFixture(client, { prefix, supplierId, categoryId, catalogItemId, quotationId })
    throw error
  }
}

async function cleanupMobileFixture(client: ReturnType<typeof serviceClient>, ids: { prefix: string; supplierId?: string; categoryId?: string; catalogItemId?: string; quotationId?: string }) {
  if (ids.quotationId) await client.from('quotation_items').delete().eq('quotation_id', ids.quotationId)
  if (ids.quotationId) await client.from('quotations').delete().eq('id', ids.quotationId)
  if (ids.catalogItemId) await client.from('catalog_items').delete().eq('id', ids.catalogItemId)
  if (ids.categoryId) await client.from('catalog_categories').delete().eq('id', ids.categoryId)
  if (ids.supplierId) await client.from('suppliers').delete().eq('id', ids.supplierId)
}

test('mobile admin opens the persisted quotation draft', async ({ page }) => {
  const fixture = await provisionMobileFixture()
  try {
    await page.goto('/pricing/quotations')
    await expect(page.getByRole('heading', { name: /^Cota(?:ç|c)(?:õ|o)es$/i })).toBeVisible()

    const card = page.locator('article').filter({ has: page.getByText(fixture.quotationReference, { exact: true }) })
    await expect(card).toBeVisible()
    await expect(card).toContainText('Rascunho')
    await expect(card.getByRole('link', { name: /Editar cota(?:ç|c)(?:ã|a)o/i })).toBeVisible()
    await page.goto(`/pricing/quotations/${fixture.quotationId}`)

    await expect(page.getByRole('heading', { name: fixture.quotationReference, exact: true })).toBeVisible()
    await expect(page.getByText('Rascunho', { exact: false }).first()).toBeVisible()
    await expect(page.getByLabel(/N.mero\s*\/\s*refer.ncia|Refer.ncia/i)).toHaveValue(fixture.quotationReference)
    await expect(page.getByLabel(/Valor unit.rio|Pre.o unit.rio/i)).toHaveValue(/^137[.,]45$/)
  } finally {
    await cleanupMobileFixture(fixture.client, fixture)
  }
})
