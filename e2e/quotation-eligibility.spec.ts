import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import { expect, type Locator, test } from '@playwright/test'

import { assertRemoteMutationAllowed, requiredEnv } from './env'
import { readFixtureState } from './fixtures'

assertRemoteMutationAllowed()

async function chooseOption(control: Locator, optionValue: string) {
  await control.selectOption(optionValue)
}

async function chooseByName(control: Locator, name: string) {
  const option = control.locator('option').filter({ hasText: name }).first()
  await expect(option).toBeAttached()
  await control.selectOption(await option.getAttribute('value') ?? '')
}

test('offers only outsourced catalog items in a new quotation', async ({ page }) => {
  const marker = `E2E_3C2_${Date.now()}_${randomUUID().slice(0, 8)}`
  const service = createClient(requiredEnv('VITE_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
  const fixture = await readFixtureState()
  const category = await service.from('catalog_categories').insert({ name: `${marker}_CATEGORY`, active: true }).select('id').single()
  expect(category.error).toBeNull()
  const ownItem = await service.from('catalog_items').insert({
    name: `${marker}_OWN_ITEM`,
    category_id: category.data!.id,
    unit: 'servico',
    sourcing_type: 'own',
    active: true,
  }).select('id').single()
  expect(ownItem.error).toBeNull()
  const outsourcedItem = await service.from('catalog_items').insert({
    name: `${marker}_OUTSOURCED_ITEM`,
    category_id: category.data!.id,
    unit: 'servico',
    sourcing_type: 'outsourced',
    active: true,
  }).select('id').single()
  expect(outsourcedItem.error).toBeNull()

  try {
    await page.goto('/pricing/quotations/new')
    await expect(page.getByRole('heading', { name: /Nova cota(?:ç|c)(?:ã|a)o/i })).toBeVisible()
    await chooseByName(page.getByLabel(/Fornecedor/i).first(), fixture.supplierName)
    await page.getByLabel(/N.mero\s*\/\s*refer.ncia|Refer.ncia/i).first().fill(`${marker}_QUOTE`)
    await page.getByLabel(/Data recebida/i).first().fill('2026-09-24')
    await page.getByRole('button', { name: /Adicionar item|Novo item/i }).click()

    const catalog = page.getByLabel(/Item do cat.logo|Cat.logo Efetiva/i).first()
    await expect(catalog).toBeVisible()
    const ownOptions = catalog.locator('option', { hasText: `${marker}_OWN_ITEM` })
    await expect(ownOptions).toHaveCount(0)
    const outsourcedOptions = catalog.locator('option', { hasText: `${marker}_OUTSOURCED_ITEM` })
    await expect(outsourcedOptions).toHaveCount(1)

    await chooseOption(catalog, outsourcedItem.data!.id)
    await page.getByLabel(/Valor unit.rio|Pre.o unit.rio/i).first().fill('25,00')
    await page.getByRole('button', { name: /Salvar rascunho/i }).click()
    await expect(page.getByText('Cotação salva como rascunho.', { exact: true })).toBeVisible()
  } finally {
    const { data: quotations, error: quotationError } = await service
      .from('quotations')
      .select('id')
      .like('reference_number', `${marker}%`)
    expect(quotationError).toBeNull()
    const quotationIds = (quotations ?? []).map((quotation) => quotation.id)
    if (quotationIds.length) {
      const itemsError = await service.from('quotation_items').delete().in('quotation_id', quotationIds)
      expect(itemsError.error).toBeNull()
      const quotationsError = await service.from('quotations').delete().in('id', quotationIds)
      expect(quotationsError.error).toBeNull()
    }
    const itemDelete = await service.from('catalog_items').delete().in('id', [ownItem.data!.id, outsourcedItem.data!.id])
    expect(itemDelete.error).toBeNull()
    const categoryDelete = await service.from('catalog_categories').delete().eq('id', category.data!.id)
    expect(categoryDelete.error).toBeNull()
    const residue = await Promise.all([
      service.from('catalog_items').select('id', { count: 'exact', head: true }).in('id', [ownItem.data!.id, outsourcedItem.data!.id]),
      service.from('catalog_categories').select('id', { count: 'exact', head: true }).eq('id', category.data!.id),
      service.from('quotations').select('id', { count: 'exact', head: true }).like('reference_number', `${marker}%`),
    ])
    expect(residue.map((result) => result.count)).toEqual([0, 0, 0])
  }
})