import { createClient } from '@supabase/supabase-js'
import { expect, type Locator, type Page, test } from '@playwright/test'

import { requiredEnv } from './env'
import {
  activateQuotation,
  captureResidue,
  cleanupHomologation,
  execSql,
  findQuotationItem,
  insertQuotationItem,
  marker3c3,
  provisionCatalogItem,
  provisionCategory,
  provisionDraftQuotation,
  provisionMarginRule,
  provisionSupplier,
  serviceClient3c3,
  type HomologationCollection,
  type CatalogItemFixture,
} from './quotation-homologation.utils'

async function chooseByName(control: Locator, name: string) {
  const option = control.locator('option').filter({ hasText: name }).first()
  await expect(option).toBeAttached()
  await control.selectOption((await option.getAttribute('value')) ?? '')
}

function itemSelect(page: Page, index: number) {
  return page.getByLabel(`Item do Catálogo Efetiva ${index}`, { exact: true })
}

async function createAndActivateQuotation(page: Page, supplierName: string, item: CatalogItemFixture, reference: string, receivedAt: string, unitPrice: string) {
  await page.goto('/pricing/quotations/new')
  await expect(page.getByRole('heading', { name: /Nova cota(?:ç|c)(?:ã|a)o/i })).toBeVisible()

  await chooseByName(page.getByLabel(/Fornecedor/i).first(), supplierName)
  await page.getByLabel(/N.mero\s*\/\s*refer.ncia|Refer.ncia/i).first().fill(reference)
  await page.getByLabel(/Data recebida/i).first().fill(receivedAt)

  let catalog = itemSelect(page, 1)
  if (!(await catalog.count())) {
    await page.getByRole('button', { name: /Adicionar item|Novo item/i }).click()
    catalog = itemSelect(page, 1)
  }
  await chooseByName(catalog, item.name)
  await page.getByLabel(/Valor unit.rio|Pre.o unit.rio/i).first().fill(unitPrice)

  await page.getByRole('button', { name: /Salvar rascunho/i }).click()
  await expect(page.getByText('Cotação salva como rascunho.', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/pricing\/quotations\/[0-9a-f-]+\/?$/i)
  await page.getByRole('button', { name: /^Ativar$/i }).click()
  await expect(page.getByText('Cotação ativada com sucesso.', { exact: true })).toBeVisible()
}

test('Admin cria cotações, compara, aprova preço automático e valida persistência', async ({ page }) => {
  test.setTimeout(180_000)
  const prefix = marker3c3('ADMIN_JOURNEY')
  const service = serviceClient3c3()
  const collection: HomologationCollection = { prefix, supplierIds: [], categoryIds: [], catalogItemIds: [], marginRuleIds: [], quotationIds: [] }
  const bestSupplier = `${prefix}_BEST_SUPPLIER`
  const alternativeSupplier = `${prefix}_ALT_SUPPLIER`

  try {
    collection.supplierIds.push(await provisionSupplier(service, bestSupplier))
    collection.supplierIds.push(await provisionSupplier(service, alternativeSupplier))
    collection.categoryIds.push(await provisionCategory(service, `${prefix}_CATEGORY`))
    const item = await provisionCatalogItem(service, { name: `${prefix}_ITEM`, categoryId: collection.categoryIds[0], unit: 'unidade', sourcingType: 'outsourced', code: `${prefix}_ITEM` })
    collection.catalogItemIds.push(item.id)
    collection.marginRuleIds.push(await provisionMarginRule(service, { catalogItemId: item.id, value: '25.0000', notes: `${prefix}_RULE` }))
    const receivedAt = '2026-08-24'

    await createAndActivateQuotation(page, bestSupplier, item, `${prefix}_Q_BEST`, receivedAt, '100,00')
    collection.quotationIds[0] = page.url().split('/').filter(Boolean).at(-1) as string
    await createAndActivateQuotation(page, alternativeSupplier, item, `${prefix}_Q_ALT`, receivedAt, '110,00')
    collection.quotationIds[1] = page.url().split('/').filter(Boolean).at(-1) as string

    const { data: bestQuote } = await service.from('quotations').select('id').eq('reference_number', `${prefix}_Q_BEST`).single()
    if (!bestQuote) throw new Error('Best quotation was not persisted')
    const bestQuotationItemId = await findQuotationItem(service, bestQuote.id, item.id)

    await page.goto('/pricing/comparison')
    await expect(page.getByRole('heading', { name: /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i })).toBeVisible()
    const comparison = page.getByRole('table', { name: /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i })
    const comparisonRow = comparison.getByRole('row').filter({ hasText: item.code })
    await expect(comparisonRow).toBeVisible()
    await expect(comparisonRow).toContainText('R$ 100,00')
    await expect(comparisonRow).toContainText(bestSupplier)
    await expect(comparisonRow).toContainText('25%')

    await comparisonRow.getByRole('button', { name: /Revisar calculo|Decidir/i }).first().click()
    const decisionDrawer = page.getByRole('dialog', { name: new RegExp(`Decisao comercial.*${item.code}`, 'i') })
    await expect(decisionDrawer).toBeVisible()
    await expect(decisionDrawer).toContainText(bestSupplier)
    await expect(decisionDrawer).toContainText(alternativeSupplier)
    await decisionDrawer.getByRole('button', { name: /^Aprovar preco$/i }).click()
    await expect(page.getByText('Preco comercial aprovado em R$ 125,00.', { exact: true })).toBeVisible()
    await expect(decisionDrawer).not.toBeVisible()

    await page.goto('/pricing/prices')
    const priceTable = page.getByRole('table', { name: /Tabela de Precos/i })
    const priceRow = priceTable.getByRole('row').filter({ hasText: item.code })
    await expect(priceRow).toBeVisible()
    await expect(priceRow).toContainText(bestSupplier)
    await expect(priceRow).toContainText('Automatica')
    await expect(priceRow).toContainText('R$ 100,00')
    await expect(priceRow).toContainText('R$ 125,00')
    await expect(priceRow).toContainText('25%')
    await expect(priceRow).toContainText('Aprovado')

    await priceRow.getByRole('button', { name: /Rastreabilidade/i }).click()
    const traceDrawer = page.getByRole('dialog', { name: new RegExp(`Decisao comercial.*${item.code}`, 'i') })
    await expect(traceDrawer).toContainText('Snapshot aprovado')
    await expect(traceDrawer).toContainText(`${bestSupplier} · Automatica`)
    await expect(traceDrawer).toContainText(bestQuotationItemId)
    await expect(traceDrawer).toContainText(collection.marginRuleIds[0])

    const { data: priceList, error: priceListError } = await service.from('price_list').select('*').eq('catalog_item_id', item.id).single()
    expect(priceListError).toBeNull()
    expect(priceList).toMatchObject({
      catalog_item_id: item.id,
      cost_price: 100,
      final_price: 125,
      adjustment_type: 'percentage',
      adjustment_value: 25,
      manual_source: false,
      status: 'approved',
      margin_rule_id: collection.marginRuleIds[0],
      source_quotation_item_id: bestQuotationItemId,
    })
  } finally {
    await cleanupHomologation(service, collection)
    const residue = await captureResidue(service, collection)
    expect([residue.suppliers, residue.categories, residue.catalogItems, residue.quotations, residue.quotationItems, residue.marginRules, residue.priceList]).toEqual([0, 0, 0, 0, 0, 0, 0])
  }
})

test('Seletor oferece somente itens terceirizados ativos e o banco ainda bloqueia incompatíveis', async ({ page }) => {
  test.setTimeout(180_000)
  const prefix = marker3c3('ADMIN_ELIGIBILITY')
  const service = serviceClient3c3()
  const collection: HomologationCollection = { prefix, supplierIds: [], categoryIds: [], catalogItemIds: [], marginRuleIds: [], quotationIds: [] }

  try {
    collection.supplierIds.push(await provisionSupplier(service, `${prefix}_SUPPLIER`))
    collection.categoryIds.push(await provisionCategory(service, `${prefix}_CATEGORY`))
    const ownActive = await provisionCatalogItem(service, { name: `${prefix}_OWN_ACTIVE`, categoryId: collection.categoryIds[0], sourcingType: 'own', active: true })
    const ownInactive = await provisionCatalogItem(service, { name: `${prefix}_OWN_INACTIVE`, categoryId: collection.categoryIds[0], sourcingType: 'own', active: false })
    const outsourcedInactive = await provisionCatalogItem(service, { name: `${prefix}_OUT_INACTIVE`, categoryId: collection.categoryIds[0], sourcingType: 'outsourced', active: false })
    const outsourcedActive = await provisionCatalogItem(service, { name: `${prefix}_OUT_ACTIVE`, categoryId: collection.categoryIds[0], sourcingType: 'outsourced', active: true, code: `${prefix}_OUT_ACTIVE` })
    collection.catalogItemIds.push(ownActive.id, ownInactive.id, outsourcedInactive.id, outsourcedActive.id)

    await page.goto('/pricing/quotations/new')
    await expect(page.getByRole('heading', { name: /Nova cota(?:ç|c)(?:ã|a)o/i })).toBeVisible()
    await page.getByRole('button', { name: /Adicionar item|Novo item/i }).click()
    const catalog = itemSelect(page, 1)
    await expect(catalog).toBeVisible()
    await expect(catalog.locator('option', { hasText: ownActive.name })).toHaveCount(0)
    await expect(catalog.locator('option', { hasText: ownInactive.name })).toHaveCount(0)
    await expect(catalog.locator('option', { hasText: outsourcedInactive.name })).toHaveCount(0)
    await expect(catalog.locator('option', { hasText: outsourcedActive.name })).toHaveCount(1)

    const quotationId = await provisionDraftQuotation(service, {
      supplierId: collection.supplierIds[0],
      reference: `${prefix}_QUOTE`,
      receivedAt: '2026-09-24',
      notes: prefix,
    })
    collection.quotationIds.push(quotationId)
    await insertQuotationItem(service, { quotationId, catalogItemId: outsourcedActive.id, unitPrice: '30.00', notes: prefix })

    const ownInsert = await service.from('quotation_items').insert({
      quotation_id: quotationId,
      catalog_item_id: ownActive.id,
      supplier_description: 'own',
      unit_price: '40.00',
      notes: prefix,
    })
    expect(ownInsert.error).not.toBeNull()
    expect(ownInsert.error?.message).toMatch(/Servicos proprios da Efetiva nao podem ser incluidos/i)

    const inactiveInsert = await service.from('quotation_items').insert({
      quotation_id: quotationId,
      catalog_item_id: outsourcedInactive.id,
      supplier_description: 'inactive',
      unit_price: '40.00',
      notes: prefix,
    })
    expect(inactiveInsert.error).not.toBeNull()
    expect(inactiveInsert.error?.message).toMatch(/Item de catalogo inativo nao pode ser usado em nova cotacao/i)

    const sourcingChange = await service.from('catalog_items').update({ sourcing_type: 'own' }).eq('id', outsourcedActive.id)
    expect(sourcingChange.error).not.toBeNull()
    expect(sourcingChange.error?.message).toMatch(/A origem do item nao pode mudar/i)
  } finally {
    await cleanupHomologation(service, collection)
    const residue = await captureResidue(service, collection)
    expect([residue.suppliers, residue.categories, residue.catalogItems, residue.quotations, residue.quotationItems, residue.marginRules, residue.priceList]).toEqual([0, 0, 0, 0, 0, 0, 0])
  }
})

test('Editor preserva item histórico inativo, não inclui incompatíveis e bloqueia ativação', async ({ page }) => {
  test.setTimeout(180_000)
  const prefix = marker3c3('ADMIN_HISTORICAL')
  const service = serviceClient3c3()
  const collection: HomologationCollection = { prefix, supplierIds: [], categoryIds: [], catalogItemIds: [], marginRuleIds: [], quotationIds: [] }

  try {
    collection.supplierIds.push(await provisionSupplier(service, `${prefix}_SUPPLIER`))
    collection.categoryIds.push(await provisionCategory(service, `${prefix}_CATEGORY`))
    const inactiveItem = await provisionCatalogItem(service, { name: `${prefix}_DEACTIVATED`, categoryId: collection.categoryIds[0], unit: 'unidade', sourcingType: 'outsourced', active: true, code: `${prefix}_DEACTIVATED` })
    const activeItem = await provisionCatalogItem(service, { name: `${prefix}_ACTIVE`, categoryId: collection.categoryIds[0], unit: 'unidade', sourcingType: 'outsourced', active: true, code: `${prefix}_ACTIVE` })
    collection.catalogItemIds.push(inactiveItem.id, activeItem.id)

    const quotationId = await provisionDraftQuotation(service, {
      supplierId: collection.supplierIds[0],
      reference: `${prefix}_QUOTE`,
      receivedAt: '2026-09-24',
      notes: prefix,
    })
    collection.quotationIds.push(quotationId)
    await insertQuotationItem(service, { quotationId, catalogItemId: inactiveItem.id, unitPrice: '25.00', description: 'historico', notes: prefix })

    const deactivate = await service.from('catalog_items').update({ active: false }).eq('id', inactiveItem.id)
    expect(deactivate.error).toBeNull()

    await page.goto(`/pricing/quotations/${quotationId}`)
    await expect(page.getByRole('heading', { name: `${prefix}_QUOTE`, exact: true })).toBeVisible()
    const catalog = itemSelect(page, 1)
    await expect(catalog).toBeVisible()
    await expect(catalog.locator('option:checked')).toContainText(inactiveItem.name)
    await expect(catalog.locator('option:checked')).toContainText('(inativo - histórico)')
    await expect(
      page.getByText('Esta cotação possui fornecedor ou item histórico inativo. Você pode salvar o rascunho, mas deve reativar o cadastro ou selecionar outro registro antes de ativar.', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('Item inativo nas linhas 1. Reative-o no catálogo ou selecione outro item.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Ativar$/i })).toBeDisabled()

    await page.getByRole('button', { name: /^Adicionar item$/i }).click()
    const secondLine = itemSelect(page, 2)
    await expect(secondLine).toBeVisible()
    await expect(secondLine.locator('option', { hasText: inactiveItem.name })).toHaveCount(0)
    await expect(secondLine.locator('option', { hasText: activeItem.name })).toHaveCount(1)
  } finally {
    await cleanupHomologation(service, collection)
    const residue = await captureResidue(service, collection)
    expect([residue.suppliers, residue.categories, residue.catalogItems, residue.quotations, residue.quotationItems, residue.marginRules, residue.priceList]).toEqual([0, 0, 0, 0, 0, 0, 0])
  }
})

test('Item próprio já vinculado (fixture controlada) é identificado e bloqueia ativação', async ({ page }) => {
  test.setTimeout(180_000)
  const prefix = marker3c3('ADMIN_OWN_LINKED')
  const service = serviceClient3c3()
  const collection: HomologationCollection = { prefix, supplierIds: [], categoryIds: [], catalogItemIds: [], marginRuleIds: [], quotationIds: [] }

  try {
    collection.supplierIds.push(await provisionSupplier(service, `${prefix}_SUPPLIER`))
    collection.categoryIds.push(await provisionCategory(service, `${prefix}_CATEGORY`))
    const outsourcedItem = await provisionCatalogItem(service, { name: `${prefix}_OUT`, categoryId: collection.categoryIds[0], unit: 'unidade', sourcingType: 'outsourced', active: true })
    const ownItem = await provisionCatalogItem(service, { name: `${prefix}_OWN`, categoryId: collection.categoryIds[0], sourcingType: 'own', active: true })
    collection.catalogItemIds.push(outsourcedItem.id, ownItem.id)

    const quotationId = await provisionDraftQuotation(service, {
      supplierId: collection.supplierIds[0],
      reference: `${prefix}_QUOTE`,
      receivedAt: '2026-09-24',
      notes: prefix,
    })
    collection.quotationIds.push(quotationId)
    await insertQuotationItem(service, { quotationId, catalogItemId: outsourcedItem.id, unitPrice: '25.00', notes: prefix })

    await execSql(`begin;
set local session_replication_role = replica;
insert into public.quotation_items (quotation_id, catalog_item_id, supplier_description, unit_price, notes)
values ('${quotationId}', '${ownItem.id}', 'own linked fixture', '50.00', '${prefix}');
commit;
`, 'own-linked')
    const { error: residueError } = await service.from('quotation_items').select('id').eq('quotation_id', quotationId).eq('catalog_item_id', ownItem.id)
    expect(residueError).toBeNull()

    await page.goto(`/pricing/quotations/${quotationId}`)
    await expect(page.getByRole('heading', { name: `${prefix}_QUOTE`, exact: true })).toBeVisible()
    await expect(page.getByText('Serviços próprios da Efetiva não podem ser incluídos em cotações de fornecedores.', { exact: true })).toBeVisible()
    await expect(page.locator('option:checked').filter({ hasText: '(serviço próprio)' })).toHaveCount(1)
    await expect(page.getByText('Linha 2: serviço próprio da Efetiva não pode ser incluído em cotação de fornecedor.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Ativar$/i })).toBeDisabled()
  } finally {
    await cleanupHomologation(service, collection)
    const residue = await captureResidue(service, collection)
    expect([residue.suppliers, residue.categories, residue.catalogItems, residue.quotations, residue.quotationItems, residue.marginRules, residue.priceList]).toEqual([0, 0, 0, 0, 0, 0, 0])
  }
})

test('Admin bloqueia ativação por requisitos e trata indisponibilidade de rede', async ({ page }) => {
  test.setTimeout(180_000)
  const prefix = marker3c3('ADMIN_VALIDATION')
  const service = serviceClient3c3()
  const collection: HomologationCollection = { prefix, supplierIds: [], categoryIds: [], catalogItemIds: [], marginRuleIds: [], quotationIds: [] }

  try {
    collection.supplierIds.push(await provisionSupplier(service, `${prefix}_SUPPLIER`))
    collection.categoryIds.push(await provisionCategory(service, `${prefix}_CATEGORY`))
    const item = await provisionCatalogItem(service, { name: `${prefix}_ITEM`, categoryId: collection.categoryIds[0], unit: 'unidade', sourcingType: 'outsourced', active: true, code: `${prefix}_ITEM` })
    collection.catalogItemIds.push(item.id)

    await test.step('sem fornecedor, ativação fica indisponível', async () => {
      await page.goto('/pricing/quotations/new')
      await expect(page.getByRole('heading', { name: /Nova cota(?:ç|c)(?:ã|a)o/i })).toBeVisible()
      await page.getByRole('button', { name: /Adicionar item|Novo item/i }).click()
      await chooseByName(itemSelect(page, 1), item.name)
      await page.getByLabel(/Valor unit.rio|Pre.o unit.rio/i).first().fill('30,00')
      await expect(page.getByLabel('Requisitos para ativação').getByText('Selecione um fornecedor.', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Revisar pendências' })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Ativar$/i })).toBeDisabled()
    })

    await test.step('sem itens, ativação fica indisponível', async () => {
      await page.goto('/pricing/quotations/new')
      await expect(page.getByRole('heading', { name: /Nova cota(?:ç|c)(?:ã|a)o/i })).toBeVisible()
      await chooseByName(page.getByLabel(/Fornecedor/i).first(), `${prefix}_SUPPLIER`)
      await expect(page.getByLabel('Requisitos para ativação').getByText('Adicione ao menos um item.', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Ativar$/i })).toBeDisabled()
    })

    await test.step('validade anterior ao recebimento bloqueia ativação', async () => {
      await page.goto('/pricing/quotations/new')
      await expect(page.getByRole('heading', { name: /Nova cota(?:ç|c)(?:ã|a)o/i })).toBeVisible()
      await chooseByName(page.getByLabel(/Fornecedor/i).first(), `${prefix}_SUPPLIER`)
      await page.getByLabel(/Data recebida/i).first().fill('2026-09-30')
      await page.getByLabel(/Validade/i).first().fill('2026-09-01')
      await page.getByRole('button', { name: /Adicionar item|Novo item/i }).click()
      await chooseByName(itemSelect(page, 1), item.name)
      await page.getByLabel(/Valor unit.rio|Pre.o unit.rio/i).first().fill('30,00')
      await expect(page.getByLabel('Requisitos para ativação').getByText('A validade deve ser igual ou posterior ao recebimento.', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Ativar$/i })).toBeDisabled()
    })

    await test.step('sem conexão, ações ficam indisponíveis e nada persiste', async () => {
      await page.goto('/pricing/quotations/new')
      await expect(page.getByRole('heading', { name: /Nova cota(?:ç|c)(?:ã|a)o/i })).toBeVisible()
      await chooseByName(page.getByLabel(/Fornecedor/i).first(), `${prefix}_SUPPLIER`)
      await page.getByLabel(/Data recebida/i).first().fill('2026-09-24')
      await page.getByRole('button', { name: /Adicionar item|Novo item/i }).click()
      await chooseByName(itemSelect(page, 1), item.name)
      await page.getByLabel(/Valor unit.rio|Pre.o unit.rio/i).first().fill('30,00')
      await page.context().setOffline(true)
      try {
        await expect(page.getByText('Sem conexao. Os dados nao podem ser atualizados no momento.')).toBeVisible({ timeout: 10_000 })
        await expect(page.getByRole('button', { name: /Salvar rascunho/i })).toBeDisabled()
        await expect(page.getByRole('button', { name: /^Ativar$/i })).toBeDisabled()
      } finally {
        await page.context().setOffline(false)
      }
      const persisted = await service.from('quotations').select('id', { count: 'exact', head: true }).like('reference_number', `${prefix}%`)
      expect(persisted.count).toBe(0)
    })
  } finally {
    await cleanupHomologation(service, collection)
    const residue = await captureResidue(service, collection)
    expect([residue.suppliers, residue.categories, residue.catalogItems, residue.quotations, residue.quotationItems, residue.marginRules, residue.priceList]).toEqual([0, 0, 0, 0, 0, 0, 0])
  }
})

test('Editor, comparação e tabela de preços não excedem a largura da viewport em nenhum breakpoint', async ({ page }) => {
  test.setTimeout(240_000)
  const prefix = marker3c3('ADMIN_RESPONSIVE')
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

  async function openAndWait(presentLocator: () => Locator) {
    await page.reload()
    await expect(presentLocator()).toBeVisible({ timeout: 20_000 })
  }

  try {
    collection.supplierIds.push(await provisionSupplier(service, longSupplier))
    collection.categoryIds.push(await provisionCategory(service, longCategory))
    const item = await provisionCatalogItem(service, { name: longItem, categoryId: collection.categoryIds[0], unit: 'unidade', sourcingType: 'outsourced', active: true, code: longItem })
    collection.catalogItemIds.push(item.id)
    collection.marginRuleIds.push(await provisionMarginRule(service, { catalogItemId: item.id, value: '25.0000', notes: longText }))

    const draftId = await provisionDraftQuotation(service, {
      supplierId: collection.supplierIds[0],
      reference: `${longText}_DRAFT`,
      receivedAt: '2026-09-24',
      notes: longText,
    })
    collection.quotationIds.push(draftId)
    await insertQuotationItem(service, { quotationId: draftId, catalogItemId: item.id, unitPrice: '80.00', description: longText, notes: longText })

    const activeId = await provisionDraftQuotation(service, {
      supplierId: collection.supplierIds[0],
      reference: `${longText}_ACTIVE`,
      receivedAt: '2026-09-24',
      validUntil: '2027-09-24',
      notes: longText,
    })
    collection.quotationIds.push(activeId)
    await insertQuotationItem(service, { quotationId: activeId, catalogItemId: item.id, unitPrice: '80.00', description: longText, notes: longText })
    await activateQuotation(service, activeId)

    const { data: decision, error: decisionError } = await service.from('pricing_comparison_v').select('decision_token').eq('catalog_item_id', item.id).single()
    expect(decisionError).toBeNull()
    expect(decision?.decision_token).toBeNull()
    const approvedSourceId = (await service.from('quotation_items').select('id').eq('quotation_id', activeId).eq('catalog_item_id', item.id).single()).data?.id
    if (!approvedSourceId) throw new Error('A6 could not resolve the active quotation item')

    const adminClient = createClient(requiredEnv('VITE_SUPABASE_URL'), requiredEnv('VITE_SUPABASE_ANON_KEY'), {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    })
    const { error: adminSignInError } = await adminClient.auth.signInWithPassword({
      email: requiredEnv('SPRINT0_ADMIN_EMAIL'),
      password: requiredEnv('SPRINT0_ADMIN_PASSWORD'),
    })
    expect(adminSignInError).toBeNull()
    const { data: adminDecision, error: adminDecisionError } = await adminClient
      .from('pricing_comparison_v')
      .select('decision_token')
      .eq('catalog_item_id', item.id)
      .single()
    expect(adminDecisionError).toBeNull()
    if (!adminDecision?.decision_token) throw new Error('A6 admin session could not resolve the decision token')
    const approved = await adminClient.rpc('approve_price', {
      p_catalog_item_id: item.id,
      p_expected_decision_token: adminDecision.decision_token,
      p_source_quotation_item_id: approvedSourceId,
    })
    expect(approved.error).toBeNull()

    const comparisonLocatorAt = (width: number) => (width < 768
      ? page.locator('[aria-label="Comparacao em cartoes"]').getByText(item.code, { exact: false }).first()
      : page.getByRole('table', { name: /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i }).getByText(item.code, { exact: false }).first())
    const pricesLocatorAt = (width: number) => (width < 768
      ? page.locator('main article').getByText(item.code, { exact: false }).first()
      : page.getByRole('table', { name: 'Tabela de Precos' }).getByText(item.code, { exact: false }).first())

    for (const width of [375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/pricing/quotations/${draftId}`)
      await openAndWait(() => page.getByRole('heading', { name: `${longText}_DRAFT`, exact: true }))
      await expect(itemSelect(page, 1)).toBeVisible()
      await expect(page.getByRole('button', { name: /Salvar rascunho/i })).toBeVisible()
      await assertNoGlobalOverflow(width, 'editor de cotação')

      await page.goto('/pricing/comparison')
      await openAndWait(() => comparisonLocatorAt(width))
      await expect(comparisonLocatorAt(width)).toBeVisible()
      await assertNoGlobalOverflow(width, 'comparação')
      if (width >= 768) {
        await assertLocalTableScroll(width, /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i, 'comparação')
      }

      await page.goto('/pricing/prices')
      await openAndWait(() => pricesLocatorAt(width))
      await expect(pricesLocatorAt(width)).toBeVisible()
      await assertNoGlobalOverflow(width, 'tabela de preços')
      if (width >= 768) {
        await assertLocalTableScroll(width, /Tabela de Precos/i, 'tabela de preços')
      }
    }
  } finally {
    await cleanupHomologation(service, collection)
    const residue = await captureResidue(service, collection)
    expect([residue.suppliers, residue.categories, residue.catalogItems, residue.quotations, residue.quotationItems, residue.marginRules, residue.priceList]).toEqual([0, 0, 0, 0, 0, 0, 0])
  }
})