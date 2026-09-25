import { createClient } from '@supabase/supabase-js'
import { expect, type Locator, type Page, test } from '@playwright/test'

import { requiredEnv } from './env'
import {
  activateQuotation,
  captureResidue,
  cleanupHomologation,
  insertQuotationItem,
  marker3c3,
  provisionCatalogItem,
  provisionCategory,
  provisionDraftQuotation,
  provisionMarginRule,
  provisionSupplier,
  serviceClient3c3,
  type HomologationCollection,
} from './quotation-homologation.utils'

async function chooseByName(control: Locator, name: string) {
  const option = control.locator('option').filter({ hasText: name }).first()
  await expect(option).toBeAttached()
  await control.selectOption((await option.getAttribute('value')) ?? '')
}

function itemSelect(page: Page, index: number) {
  return page.getByLabel(`Item do Catálogo Efetiva ${index}`, { exact: true })
}

test('Equipe cria e ativa cotação, consulta comparação sem decidir e backend rejeita aprovação e regra', async ({ page }) => {
  test.setTimeout(180_000)
  const prefix = marker3c3('TEAM_JOURNEY')
  const service = serviceClient3c3()
  const collection: HomologationCollection = { prefix, supplierIds: [], categoryIds: [], catalogItemIds: [], marginRuleIds: [], quotationIds: [] }

  try {
    const supplierName = `${prefix}_SUPPLIER`
    collection.supplierIds.push(await provisionSupplier(service, supplierName))
    collection.categoryIds.push(await provisionCategory(service, `${prefix}_CATEGORY`))
    const item = await provisionCatalogItem(service, { name: `${prefix}_ITEM`, categoryId: collection.categoryIds[0], unit: 'unidade', sourcingType: 'outsourced', active: true, code: `${prefix}_ITEM` })
    collection.catalogItemIds.push(item.id)
    collection.marginRuleIds.push(await provisionMarginRule(service, { catalogItemId: item.id, value: '20.0000', notes: `${prefix}_RULE` }))

    await page.goto('/pricing/quotations/new')
    await expect(page.getByRole('heading', { name: /Nova cota(?:ç|c)(?:ã|a)o/i })).toBeVisible()
    await chooseByName(page.getByLabel(/Fornecedor/i).first(), supplierName)
    await page.getByLabel(/N.mero\s*\/\s*refer.ncia|Refer.ncia/i).first().fill(`${prefix}_QUOTE`)
    await page.getByLabel(/Data recebida/i).first().fill('2026-09-24')
    await page.getByLabel(/Validade/i).first().fill('2027-09-24')
    await page.getByRole('button', { name: /Adicionar item|Novo item/i }).click()
    await chooseByName(itemSelect(page, 1), item.name)
    await page.getByLabel(/Valor unit.rio|Pre.o unit.rio/i).first().fill('100,00')
    await page.getByRole('button', { name: /Salvar rascunho/i }).click()
    await expect(page.getByText('Cotação salva como rascunho.', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/pricing\/quotations\/[0-9a-f-]+\/?$/i)
    collection.quotationIds[0] = page.url().split('/').filter(Boolean).at(-1) as string
    await page.getByRole('button', { name: /^Ativar$/i }).click()
    await expect(page.getByText('Cotação ativada com sucesso.', { exact: true })).toBeVisible()

    await page.goto('/pricing/comparison')
    await expect(page.getByRole('heading', { name: /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i })).toBeVisible()
    const comparisonRow = page.getByRole('table', { name: /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i }).getByRole('row').filter({ hasText: item.code })
    await expect(comparisonRow).toBeVisible()
    await expect(comparisonRow).toContainText('R$ 100,00')
    await expect(comparisonRow.getByRole('button', { name: /Decidir/i })).toHaveCount(0)
    await comparisonRow.getByRole('button', { name: /Ver detalhes de preco sugerido/i }).first().click()
    const detailsDrawer = page.getByRole('dialog', { name: new RegExp(`Decisao comercial.*${item.code}`, 'i') })
    await expect(detailsDrawer).toBeVisible()
    await expect(detailsDrawer).toContainText('Somente leitura')
    await expect(detailsDrawer.getByRole('radio')).toHaveCount(0)
    await expect(detailsDrawer.getByRole('button', { name: /Aprovar|Inativar/i })).toHaveCount(0)

    const client = createClient(requiredEnv('VITE_SUPABASE_URL'), requiredEnv('VITE_SUPABASE_ANON_KEY'), {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    })
    const { error: signInError } = await client.auth.signInWithPassword({
      email: requiredEnv('SPRINT0_EQUIPE_EMAIL'),
      password: requiredEnv('SPRINT0_EQUIPE_PASSWORD'),
    })
    expect(signInError).toBeNull()

    const { data: comparison, error: comparisonError } = await client
      .from('pricing_comparison_v')
      .select('decision_token')
      .eq('catalog_item_id', item.id)
      .single()
    expect(comparisonError).toBeNull()

    const quotationItemId = (await service.from('quotation_items').select('id').eq('quotation_id', collection.quotationIds[0]).eq('catalog_item_id', item.id).single())!.data!.id

    const { error: approvalError } = await client.rpc('approve_price', {
      p_catalog_item_id: item.id,
      p_expected_decision_token: comparison?.decision_token,
      p_source_quotation_item_id: quotationItemId,
    })
    expect(approvalError).not.toBeNull()
    expect(approvalError?.message).toMatch(/Apenas Admin/i)

    const { error: ruleError } = await client.from('margin_rules').insert({
      scope_type: 'global',
      category_id: null,
      catalog_item_id: null,
      calculation_type: 'percentage',
      value: '10.0000',
      active: true,
      notes: 'E2E_3C3 rejected',
    })
    expect(ruleError).not.toBeNull()
    expect(ruleError?.code === '42501' || /permission|row.level.security|security policy|rls/i.test(ruleError?.message ?? '')).toBe(true)
  } finally {
    await cleanupHomologation(service, collection)
    const residue = await captureResidue(service, collection)
    expect([residue.suppliers, residue.categories, residue.catalogItems, residue.quotations, residue.quotationItems, residue.marginRules, residue.priceList]).toEqual([0, 0, 0, 0, 0, 0, 0])
  }
})

test('Equipe consulta comparação e tabela de preços sem overflow nem ações de decisão', async ({ page }) => {
  test.setTimeout(180_000)
  const prefix = marker3c3('TEAM_RESPONSIVE')
  const service = serviceClient3c3()
  const collection: HomologationCollection = { prefix, supplierIds: [], categoryIds: [], catalogItemIds: [], marginRuleIds: [], quotationIds: [] }
  const longText = `${prefix}_${'DESCRICAO_'.repeat(12)}`
  const longSupplier = `${prefix}_FORNECEDOR_${'NOME_'.repeat(8)}`
  const longCategory = `${prefix}_CATEGORY_${'AREA_'.repeat(8)}`
  const longItem = `${prefix}_ITEM_${'SERVICO_'.repeat(10)}`

  async function assertNoGlobalOverflow(width: number, label: string) {
    const overflow = await page.evaluate(() => {
      const html = document.documentElement
      return { viewport: html.clientWidth, scrollWidth: html.scrollWidth, bodyScrollWidth: document.body.scrollWidth, scrollingElementScrollWidth: document.scrollingElement?.scrollWidth ?? 0 }
    })
    expect(overflow, `${label} scrollWidth deve caber na viewport em ${width}px (scrollWidth=${String(overflow.scrollWidth)}, body=${String(overflow.bodyScrollWidth)})`).toEqual({ viewport: width, scrollWidth: width, bodyScrollWidth: width, scrollingElementScrollWidth: width })
  }

  async function assertLocalTableScroll(width: number, tableName: string | RegExp, label: string) {
    const table = page.getByRole('table', { name: tableName })
    await expect(table).toBeVisible()
    const metrics = await table.evaluate((element) => {
      const shell = element.parentElement
      if (!shell) throw new Error('Tabela sem TableShell')
      shell.scrollLeft = shell.scrollWidth
      return { overflowX: getComputedStyle(shell).overflowX, clientWidth: shell.clientWidth, scrollWidth: shell.scrollWidth, scrollLeft: shell.scrollLeft }
    })
    expect(metrics.overflowX, `${label} deve manter overflow horizontal local`).toBe('auto')
    expect(metrics.clientWidth, `${label} não pode ultrapassar a viewport`).toBeLessThanOrEqual(width)
    expect(metrics.scrollWidth, `${label} deve manter a tabela larga dentro do shell`).toBeGreaterThan(metrics.clientWidth)
    expect(metrics.scrollLeft, `${label} deve permitir alcançar o fim da tabela`).toBeGreaterThan(0)
  }

  try {
    collection.supplierIds.push(await provisionSupplier(service, longSupplier))
    collection.categoryIds.push(await provisionCategory(service, longCategory))
    const item = await provisionCatalogItem(service, { name: longItem, categoryId: collection.categoryIds[0], unit: 'unidade', sourcingType: 'outsourced', active: true, code: longItem })
    collection.catalogItemIds.push(item.id)
    collection.marginRuleIds.push(await provisionMarginRule(service, { catalogItemId: item.id, value: '20.0000', notes: longText }))

    const activeId = await provisionDraftQuotation(service, {
      supplierId: collection.supplierIds[0],
      reference: `${longText}_QUOTE`,
      receivedAt: '2026-09-24',
      validUntil: '2027-09-24',
      notes: longText,
    })
    collection.quotationIds.push(activeId)
    const approvedSourceId = await insertQuotationItem(service, { quotationId: activeId, catalogItemId: item.id, unitPrice: '100.00', description: longText, notes: longText })
    await activateQuotation(service, activeId)

    const adminClient = createClient(requiredEnv('VITE_SUPABASE_URL'), requiredEnv('VITE_SUPABASE_ANON_KEY'), {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    })
    const { error: adminSignInError } = await adminClient.auth.signInWithPassword({
      email: requiredEnv('SPRINT0_ADMIN_EMAIL'),
      password: requiredEnv('SPRINT0_ADMIN_PASSWORD'),
    })
    expect(adminSignInError).toBeNull()
    const { data: decision, error: decisionError } = await adminClient
      .from('pricing_comparison_v')
      .select('decision_token')
      .eq('catalog_item_id', item.id)
      .single()
    expect(decisionError).toBeNull()
    if (!decision?.decision_token) throw new Error('A6 could not resolve the admin decision token')
    const { error: approvalError } = await adminClient.rpc('approve_price', {
      p_catalog_item_id: item.id,
      p_expected_decision_token: decision.decision_token,
      p_source_quotation_item_id: approvedSourceId,
    })
    expect(approvalError).toBeNull()

    for (const width of [375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })

      await page.goto('/pricing/comparison')
      const comparisonLocator = width < 768
        ? page.locator('[aria-label="Comparacao em cartoes"]').getByText(item.code, { exact: false }).first()
        : page.getByRole('table', { name: /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i }).getByText(item.code, { exact: false }).first()
      await expect(comparisonLocator).toBeVisible({ timeout: 20_000 })
      await assertNoGlobalOverflow(width, 'comparação')
      await expect(page.getByRole('button', { name: /Decidir/i })).toHaveCount(0)
      if (width >= 768) {
        await assertLocalTableScroll(width, /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i, 'comparação')
      }

      await page.goto('/pricing/prices')
      const pricesLocator = width < 768
        ? page.locator('main article').getByText(item.code, { exact: false }).first()
        : page.getByRole('table', { name: 'Tabela de Precos' }).getByText(item.code, { exact: false }).first()
      await expect(pricesLocator).toBeVisible({ timeout: 20_000 })
      await assertNoGlobalOverflow(width, 'tabela de preços')
      if (width >= 768) {
        await assertLocalTableScroll(width, /Tabela de Precos/i, 'tabela de preços')
      }
    }

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/pricing/comparison')
    const comparisonRow = page.getByRole('table', { name: /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i }).getByRole('row').filter({ hasText: item.code })
    await expect(comparisonRow).toBeVisible()
    await expect(comparisonRow.getByRole('button', { name: /Decidir/i })).toHaveCount(0)
    await comparisonRow.getByRole('button', { name: /Ver detalhes de preco sugerido/i }).first().click()
    await expect(page.getByRole('dialog', { name: new RegExp(`Decisao comercial.*${item.code}`, 'i') })).toContainText('Somente leitura')
  } finally {
    await cleanupHomologation(service, collection)
    const residue = await captureResidue(service, collection)
    expect([residue.suppliers, residue.categories, residue.catalogItems, residue.quotations, residue.quotationItems, residue.marginRules, residue.priceList]).toEqual([0, 0, 0, 0, 0, 0, 0])
  }
})