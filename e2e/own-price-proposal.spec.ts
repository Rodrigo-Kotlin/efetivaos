import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

import { assertRemoteMutationAllowed, requiredEnv } from './env'

assertRemoteMutationAllowed()

test('envia proposta de preco proprio pela interface', async ({ page }, testInfo) => {
  const marker = `E2E_3B_${testInfo.project.name.toUpperCase()}_${Date.now()}_${randomUUID().slice(0, 8)}`
  const isTeam = testInfo.project.name === 'team-chromium'
  const service = createClient(requiredEnv('VITE_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
  const category = await service.from('catalog_categories').insert({ name: `${marker}_CATEGORY`, active: true }).select('id').single()
  expect(category.error).toBeNull()
  const item = await service.from('catalog_items').insert({
    name: `${marker}_ITEM`,
    category_id: category.data!.id,
    unit: 'servico',
    sourcing_type: 'own',
    active: true,
  }).select('id').single()
  expect(item.error).toBeNull()

  const proposalRequests: string[] = []
  const proposalReads: unknown[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/rest/v1/own_price_proposals') {
      proposalRequests.push(request.postData() ?? '')
    }
  })
  page.on('response', async (response) => {
    if (new URL(response.url()).pathname === '/rest/v1/rpc/get_own_price_proposals' && response.ok()) {
      proposalReads.push(await response.json())
    }
  })

  try {
    await page.goto('/pricing/own-prices')
    await page.getByRole('button', { name: 'Definir preco proprio', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Definir preco proprio' })
    await dialog.getByLabel('Servico (do Catalogo) *').selectOption(item.data!.id)
    await dialog.getByLabel('Preco de venda *').fill('120,00')
    if (!isTeam) await dialog.getByLabel(/Custo interno/).fill('70,00')
    await dialog.getByLabel(/Observacoes/).fill(marker)

    const inserted = page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/rest/v1/own_price_proposals'
    ))
    await dialog.getByRole('button', { name: 'Enviar proposta' }).click()
    expect((await inserted).status()).toBe(201)

    await expect(page.getByText('Proposta enviada para aprovação.')).toBeVisible()
    await expect(dialog).not.toBeVisible()
    expect(proposalRequests).toHaveLength(1)

    const persisted = await service
      .from('own_price_proposals')
      .select('id, catalog_item_id, sale_price, internal_cost, decision_notes, status')
      .eq('catalog_item_id', item.data!.id)
      .single()
    expect(persisted.error).toBeNull()
    expect(persisted.data).toMatchObject({
      catalog_item_id: item.data!.id,
      sale_price: 120,
      internal_cost: isTeam ? null : 70,
      decision_notes: marker,
      status: 'pending',
    })

    const row = page.getByRole('table', { name: 'Precos Proprios' }).getByRole('row').filter({ hasText: `${marker}_ITEM` })
    await expect(row).toContainText('R$ 120,00')
    await expect(row).toContainText('Proposta pendente')

    if (isTeam) {
      expect(proposalReads.length).toBeGreaterThan(0)
      const rows = proposalReads.flatMap((response) => Array.isArray(response) ? response : [])
      expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ catalog_item_id: item.data!.id, internal_cost: null })]))
      expect(rows.every((proposal) => (
        typeof proposal === 'object'
        && proposal !== null
        && 'internal_cost' in proposal
        && proposal.internal_cost === null
      ))).toBe(true)
    }
  } finally {
    await service.from('own_price_proposals').delete().eq('catalog_item_id', item.data!.id)
    await service.from('catalog_items').delete().eq('id', item.data!.id)
    await service.from('catalog_categories').delete().eq('id', category.data!.id)
    const [proposalResidue, itemResidue, categoryResidue] = await Promise.all([
      service.from('own_price_proposals').select('id', { count: 'exact', head: true }).eq('decision_notes', marker),
      service.from('catalog_items').select('id', { count: 'exact', head: true }).like('name', `${marker}%`),
      service.from('catalog_categories').select('id', { count: 'exact', head: true }).like('name', `${marker}%`),
    ])
    expect([proposalResidue.count, itemResidue.count, categoryResidue.count]).toEqual([0, 0, 0])
  }
})

test('nao excede a largura da viewport em nenhum breakpoint com dados', async ({ page }, testInfo) => {
  const marker = `E2E_3B_${testInfo.project.name.toUpperCase()}_${Date.now()}_${randomUUID().slice(0, 8)}`
  const service = createClient(requiredEnv('VITE_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
  const category = await service.from('catalog_categories').insert({ name: `${marker}_CATEGORY`, active: true }).select('id').single()
  expect(category.error).toBeNull()
  const item = await service.from('catalog_items').insert({
    name: `${marker}_ITEM`,
    category_id: category.data!.id,
    unit: 'servico',
    sourcing_type: 'own',
    active: true,
  }).select('id').single()
  expect(item.error).toBeNull()

  try {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/pricing/own-prices')
    await page.getByText(`${marker}_ITEM`, { exact: false }).locator('visible=true').first().waitFor({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Definir preco proprio', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Definir preco proprio' })
    await dialog.getByLabel('Servico (do Catalogo) *').selectOption(item.data!.id)
    await dialog.getByLabel('Preco de venda *').fill('120,00')
    if (testInfo.project.name === 'chromium') await dialog.getByLabel(/Custo interno/).fill('70,00')
    const inserted = page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/rest/v1/own_price_proposals'
    ))
    await dialog.getByRole('button', { name: 'Enviar proposta' }).click()
    expect((await inserted).status()).toBe(201)
    await expect(page.getByText('Proposta enviada para aprovação.')).toBeVisible()

    for (const width of [375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.reload()
      await page.getByText(`${marker}_ITEM`, { exact: false }).locator('visible=true').first().waitFor({ timeout: 15_000 })
      const overflow = await page.evaluate(() => {
        const html = document.documentElement
        return { viewport: html.clientWidth, scrollWidth: html.scrollWidth, bodyScrollWidth: document.body.scrollWidth }
      })
      expect(
        overflow,
        `scrollWidth deve caber na viewport em ${width}px (scrollWidth=${String(overflow.scrollWidth)}, body=${String(overflow.bodyScrollWidth)})`,
      ).toEqual({ viewport: width, scrollWidth: width, bodyScrollWidth: width })
    }
  } finally {
    await service.from('own_price_proposals').delete().eq('catalog_item_id', item.data!.id)
    await service.from('catalog_items').delete().eq('id', item.data!.id)
    await service.from('catalog_categories').delete().eq('id', category.data!.id)
    const [proposalResidue, itemResidue, categoryResidue] = await Promise.all([
      service.from('own_price_proposals').select('id', { count: 'exact', head: true }).eq('decision_notes', marker),
      service.from('catalog_items').select('id', { count: 'exact', head: true }).like('name', `${marker}%`),
      service.from('catalog_categories').select('id', { count: 'exact', head: true }).like('name', `${marker}%`),
    ])
    expect([proposalResidue.count, itemResidue.count, categoryResidue.count]).toEqual([0, 0, 0])
  }
})
