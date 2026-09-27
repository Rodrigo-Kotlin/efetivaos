import { expect, test } from '@playwright/test'

import {
  assertNoDrawerOverflow,
  assertLocalTableScroll,
  captureOwnJourneyResidue,
  catalogRow,
  cleanupOwnJourney,
  closeDrawer,
  createOwnServiceViaUi,
  currentWidth,
  decisionDialog,
  escapeRegExp,
  findOwnCatalogItem,
  historyDialog,
  historyEntries,
  itemContainer,
  marker3d,
  measureGlobalOverflow,
  priceRow,
  provisionOwnCategory,
  retireDialog,
  searchOwnPrices,
  serviceClient3d,
  submitOwnPriceProposal,
  type OwnJourneyCollection,
} from './own-price-journey.utils'

const service = serviceClient3d()
const prefix = marker3d('JOURNEY')
const collection: OwnJourneyCollection = { prefix, categoryIds: [], catalogItemIds: [] }
const categoryName = `${prefix}_CATEGORIA`

const lifecycleItem = `${prefix}_ITEM_A`
const staleItem = `${prefix}_ITEM_B`
const rejectedItem = `${prefix}_ITEM_C`
const responsiveItem = `${prefix}_ITEM_D`
const retireItem = `${prefix}_ITEM_E`

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  collection.categoryIds.push(await provisionOwnCategory(service, categoryName))
})

test.afterAll(async () => {
  await cleanupOwnJourney(service, collection)
  const residue = await captureOwnJourneyResidue(service, collection)
  expect([residue.categories, residue.catalogItems, residue.ownPriceProposals, residue.priceList]).toEqual([0, 0, 0, 0])
})

test('Admin cria servico proprio, propoe, aprova, reajusta preservando o preco vigente e publica na Tabela de Precos', async ({ page }) => {
  test.setTimeout(300_000)

  await test.step('cria servico proprio pelo Catalogo pela interface', async () => {
    await createOwnServiceViaUi(page, { itemName: lifecycleItem, categoryName, description: prefix })
    const item = await findOwnCatalogItem(service, lifecycleItem)
    collection.catalogItemIds.push(item.id)
    expect(item.code).not.toBe('')
  })

  await test.step('envia proposta de preco de venda com custo interno', async () => {
    await searchOwnPrices(page, lifecycleItem)
    await submitOwnPriceProposal(page, {
      mode: 'create',
      itemId: (await findOwnCatalogItem(service, lifecycleItem)).id,
      itemName: lifecycleItem,
      salePrice: '120,00',
      internalCost: '70,00',
      notes: `${prefix}_PROPOSTA_INICIAL`,
    })
    await expect(page.getByText(/Proposta enviada para aprova/i)).toBeVisible()
    const row = itemContainer(page, lifecycleItem, currentWidth(page))
    await expect(row).toBeVisible()
    await expect(row.getByText('Proposta pendente')).toBeVisible()
    await expect(row.getByText('R$ 120,00')).toBeVisible()
    await expect(row.getByText('Sem oferta vigente')).toBeVisible()
    await expect(row.getByText('Aguardando decisao do Admin')).toHaveCount(0)
  })

  await test.step('aprova a proposta e confere o historico com custo interno', async () => {
    const row = itemContainer(page, lifecycleItem, currentWidth(page))
    await row.getByRole('button', { name: new RegExp(`^Decidir proposta de ${escapeRegExp(lifecycleItem)}`) }).click()
    const decision = decisionDialog(page)
    await expect(decision).toBeVisible()
    await expect(decision.getByText('Nao ha preco vigente')).toBeVisible()
    await expect(decision.getByText('R$ 70,00')).toBeVisible()
    await expect(decision.getByRole('button', { name: 'Aprovar preco' })).toBeEnabled({ timeout: 20_000 })
    page.once('dialog', (browserDialog) => void browserDialog.accept())
    await decision.getByRole('button', { name: 'Aprovar preco' }).click()
    await expect(page.getByText('Preco proprio aprovado.')).toBeVisible()
    await expect(decision).not.toBeVisible()
    await expect(row.getByText('Preco aprovado')).toBeVisible()
    await expect(row.getByText('R$ 120,00')).toBeVisible()

    await row.getByRole('button', { name: new RegExp(`^Ver historico de ${escapeRegExp(lifecycleItem)}`) }).click()
    const history = historyDialog(page)
    await expect(history).toBeVisible()
    const entries = historyEntries(history)
    await expect(entries).toHaveCount(1)
    await expect(entries.first().getByText('Aprovado', { exact: true })).toBeVisible()
    await expect(entries.first().getByText('Preco vigente')).toBeVisible()
    await expect(entries.first().getByText(/Revisao \d+/)).toBeVisible()
    await expect(entries.first()).toContainText('R$ 120,00')
    await expect(entries.first().getByText('Custo interno')).toBeVisible()
    await expect(entries.first()).toContainText('R$ 70,00')
    await expect(entries.first()).toContainText(`${prefix}_PROPOSTA_INICIAL`)
    await expect(entries.first()).not.toContainText('Comparacao com o preco aprovado anterior')
    await closeDrawer(page, history)
    await expect(history).not.toBeVisible()
  })

  await test.step('reajuste pendente mantem o preco vigente e nao publica na Tabela de Precos', async () => {
    const row = itemContainer(page, lifecycleItem, currentWidth(page))
    await submitOwnPriceProposal(page, {
      mode: 'reajuste',
      itemId: (await findOwnCatalogItem(service, lifecycleItem)).id,
      itemName: lifecycleItem,
      salePrice: '150,00',
      internalCost: '80,00',
      notes: `${prefix}_REAJUSTE_ANUAL`,
    })
    await expect(page.getByText(/Reajuste enviado para aprova/i)).toBeVisible()
    await expect(row.getByText('Proposta pendente')).toBeVisible()
    await expect(row.getByText('R$ 150,00')).toBeVisible()
    await expect(row.getByText('R$ 120,00')).toBeVisible()
    await expect(row.getByRole('button', { name: /^Inativar preco de/ })).toHaveCount(0)

    await page.goto('/pricing/prices')
    await page.getByPlaceholder('Buscar item, codigo ou fonte...').fill(lifecycleItem)
    const priceListRow = priceRow(page, lifecycleItem, currentWidth(page))
    await expect(priceListRow).toHaveCount(1)
    await expect(priceListRow).toContainText('R$ 120,00')
    await expect(priceListRow).not.toContainText('R$ 150,00')
  })

  await test.step('aprova o reajuste e confere variacao e preco anterior no historico', async () => {
    await searchOwnPrices(page, lifecycleItem)
    const row = itemContainer(page, lifecycleItem, currentWidth(page))
    await row.getByRole('button', { name: new RegExp(`^Decidir proposta de ${escapeRegExp(lifecycleItem)}`) }).click()
    const decision = decisionDialog(page)
    await expect(decision.getByRole('button', { name: 'Aprovar preco' })).toBeEnabled({ timeout: 20_000 })
    page.once('dialog', (browserDialog) => void browserDialog.accept())
    await decision.getByRole('button', { name: 'Aprovar preco' }).click()
    await expect(page.getByText('Preco proprio aprovado.')).toBeVisible()
    await expect(decision).not.toBeVisible()
    await expect(row.getByText('Preco aprovado')).toBeVisible()
    await expect(row.getByText('R$ 150,00')).toBeVisible()
    await expect(row.getByText('R$ 120,00')).toHaveCount(0)

    await row.getByRole('button', { name: new RegExp(`^Ver historico de ${escapeRegExp(lifecycleItem)}`) }).click()
    const history = historyDialog(page)
    const entries = historyEntries(history)
    await expect(entries).toHaveCount(2)
    await expect(entries.first().getByText('Preco vigente')).toBeVisible()
    await expect(entries.first()).toContainText('R$ 150,00')
    await expect(entries.first().getByText('Comparacao com o preco aprovado anterior')).toBeVisible()
    await expect(entries.first()).toContainText('R$ 30,00')
    await expect(entries.first()).toContainText('25,00%')
    await expect(entries.first()).toContainText(`${prefix}_REAJUSTE_ANUAL`)
    await expect(entries.nth(1).getByText('Aprovado', { exact: true })).toBeVisible()
    await expect(entries.nth(1)).toContainText('R$ 120,00')
    await expect(entries.nth(1).getByText('Preco vigente')).toHaveCount(0)
    await expect(entries.nth(1).getByText('Aprovada em')).toBeVisible()
    await closeDrawer(page, history)
    await expect(history).not.toBeVisible()
  })

  await test.step('Tabela de Precos expoe origem propria, custo interno e rastreabilidade', async () => {
    const item = await findOwnCatalogItem(service, lifecycleItem)
    await page.goto('/pricing/prices')
    await page.getByPlaceholder('Buscar item, codigo ou fonte...').fill(lifecycleItem)
    const priceListRow = priceRow(page, lifecycleItem, currentWidth(page))
    await expect(priceListRow).toHaveCount(1)
    await expect(priceListRow).toContainText('Proprio')
    await expect(priceListRow).toContainText('Aprovado')
    await expect(priceListRow).toContainText('R$ 150,00')
    await expect(priceListRow).toContainText('R$ 80,00')
    await expect(priceListRow).not.toContainText('Restrito a Admin')

    await priceListRow.getByRole('button', { name: 'Rastreabilidade' }).click()
    const trace = page.getByRole('dialog', { name: new RegExp(escapeRegExp(item.code)) })
    await expect(trace).toBeVisible()
    await expect(trace.getByText('Rastreabilidade do preco proprio')).toBeVisible()
    await expect(trace).toContainText('Efetiva')
    await expect(trace).toContainText('R$ 80,00')
    await expect(trace).toContainText(`${prefix}_REAJUSTE_ANUAL`)
    await closeDrawer(page, trace)
    await expect(trace).not.toBeVisible()
  })
})

test('Admin: sessoes concorrentes nao duplicam aprovacao nem inativacao de preco proprio', async ({ page }) => {
  test.setTimeout(300_000)

  await test.step('prepara proposta pendente', async () => {
    await createOwnServiceViaUi(page, { itemName: staleItem, categoryName, description: prefix })
    const item = await findOwnCatalogItem(service, staleItem)
    collection.catalogItemIds.push(item.id)
    await searchOwnPrices(page, staleItem)
    await submitOwnPriceProposal(page, {
      mode: 'create',
      itemId: item.id,
      itemName: staleItem,
      salePrice: '135,00',
      internalCost: '75,00',
      notes: `${prefix}_CONCORRENCIA`,
    })
    await expect(itemContainer(page, staleItem, currentWidth(page)).getByText('Proposta pendente')).toBeVisible()
  })

  await test.step('segunda sessao Admin aprova e a primeira sessao e rejeitada', async () => {
    const row = itemContainer(page, staleItem, currentWidth(page))
    await row.getByRole('button', { name: new RegExp(`^Decidir proposta de ${escapeRegExp(staleItem)}`) }).click()
    const staleDecision = decisionDialog(page)
    await expect(staleDecision.getByRole('button', { name: 'Aprovar preco' })).toBeEnabled({ timeout: 20_000 })

    const secondSession = await page.context().newPage()
    await searchOwnPrices(secondSession, staleItem)
    const secondRow = itemContainer(secondSession, staleItem, currentWidth(secondSession))
    await secondRow.getByRole('button', { name: new RegExp(`^Decidir proposta de ${escapeRegExp(staleItem)}`) }).click()
    const secondDecision = decisionDialog(secondSession)
    await expect(secondDecision.getByRole('button', { name: 'Aprovar preco' })).toBeEnabled({ timeout: 20_000 })
    secondSession.once('dialog', (browserDialog) => void browserDialog.accept())
    await secondDecision.getByRole('button', { name: 'Aprovar preco' }).click()
    await expect(secondSession.getByText('Preco proprio aprovado.')).toBeVisible()
    await expect(secondRow.getByText('Preco aprovado')).toBeVisible()
    await secondSession.close()

    page.once('dialog', (browserDialog) => void browserDialog.accept())
    await staleDecision.getByRole('button', { name: 'Aprovar preco' }).click()
    await expect(page.getByText('Somente propostas pendentes podem ser aprovadas.')).toBeVisible()
    await expect(staleDecision).toBeVisible()
    await closeDrawer(page, staleDecision)
    await expect(row.getByText('Proposta pendente')).toHaveCount(0)
    await expect(row.getByText('Preco aprovado')).toBeVisible()
    await expect(row.getByText('R$ 135,00')).toBeVisible()
  })

  await test.step('Tabela de Precos publica uma unica versao aprovada', async () => {
    await page.goto('/pricing/prices')
    await page.getByPlaceholder('Buscar item, codigo ou fonte...').fill(staleItem)
    const priceListRow = priceRow(page, staleItem, currentWidth(page))
    await expect(priceListRow).toHaveCount(1)
    await expect(priceListRow).toContainText('Aprovado')
    await expect(priceListRow).toContainText('R$ 135,00')
  })

  await test.step('segunda sessao Admin inativa e a primeira sessao e rejeitada', async () => {
    await searchOwnPrices(page, staleItem)
    const row = itemContainer(page, staleItem, currentWidth(page))
    await row.getByRole('button', { name: new RegExp(`^Inativar preco de ${escapeRegExp(staleItem)}`) }).click()
    const staleRetire = retireDialog(page)
    await expect(staleRetire.getByRole('button', { name: 'Inativar preco' })).toBeEnabled({ timeout: 20_000 })

    const secondSession = await page.context().newPage()
    await searchOwnPrices(secondSession, staleItem)
    await itemContainer(secondSession, staleItem, currentWidth(secondSession))
      .getByRole('button', { name: new RegExp(`^Inativar preco de ${escapeRegExp(staleItem)}`) })
      .click()
    const secondRetire = retireDialog(secondSession)
    await expect(secondRetire.getByRole('button', { name: 'Inativar preco' })).toBeEnabled({ timeout: 20_000 })
    secondSession.once('dialog', (browserDialog) => void browserDialog.accept())
    await secondRetire.getByRole('button', { name: 'Inativar preco' }).click()
    await expect(secondSession.getByText('Preco proprio inativado.')).toBeVisible()
    await expect(itemContainer(secondSession, staleItem, currentWidth(secondSession)).getByText('Preco inativo')).toBeVisible()
    await secondSession.close()

    page.once('dialog', (browserDialog) => void browserDialog.accept())
    await staleRetire.getByRole('button', { name: 'Inativar preco' }).click()
    await expect(page.getByText('Somente propostas pendentes ou aprovadas podem ser inativadas.')).toBeVisible()
    await expect(staleRetire).toBeVisible()
    await closeDrawer(page, staleRetire)
    await expect(row.getByText('Preco inativo')).toBeVisible()
    await expect(row.getByText('Sem oferta vigente')).toBeVisible()
  })

  await test.step('historico preserva a proposta sem preco vigente', async () => {
    const row = itemContainer(page, staleItem, currentWidth(page))
    await row.getByRole('button', { name: new RegExp(`^Ver historico de ${escapeRegExp(staleItem)}`) }).click()
    const history = historyDialog(page)
    await expect(historyEntries(history)).toHaveCount(1)
    await expect(history.getByText('Preco vigente')).toHaveCount(0)
    await expect(historyEntries(history).first().getByText('Inativo', { exact: true })).toBeVisible()
    await closeDrawer(page, history)
  })
})

test('Admin recusa proposta com observacao e o servico volta a ficar sem preco', async ({ page }) => {
  test.setTimeout(240_000)

  await createOwnServiceViaUi(page, { itemName: rejectedItem, categoryName, description: prefix })
  const item = await findOwnCatalogItem(service, rejectedItem)
  collection.catalogItemIds.push(item.id)
  await searchOwnPrices(page, rejectedItem)
  await submitOwnPriceProposal(page, {
    mode: 'create',
    itemId: item.id,
    itemName: rejectedItem,
    salePrice: '45,00',
    notes: `${prefix}_PROPOSTA_RECUSADA`,
  })
  await expect(page.getByText(/Proposta enviada para aprova/i)).toBeVisible()

  const row = itemContainer(page, rejectedItem, currentWidth(page))
  await expect(row.getByText('Proposta pendente')).toBeVisible()
  await row.getByRole('button', { name: new RegExp(`^Decidir proposta de ${escapeRegExp(rejectedItem)}`) }).click()
  const decision = decisionDialog(page)
  await expect(decision.getByRole('button', { name: 'Aprovar preco' })).toBeEnabled({ timeout: 20_000 })
  await decision.getByRole('button', { name: 'Recusar proposta' }).click()
  await decision.getByLabel(/Observacao da recusa/).fill(`${prefix}_MOTIVO_RECUSA`)
  page.once('dialog', (browserDialog) => void browserDialog.accept())
  await decision.getByRole('button', { name: 'Confirmar recusa' }).click()
  await expect(page.getByText('Proposta recusada.')).toBeVisible()
  await expect(decision).not.toBeVisible()
  await expect(row.getByText('Proposta pendente')).toHaveCount(0)
  await expect(row.getByText('Preco inativo')).toBeVisible()
  await expect(row.getByRole('button', { name: new RegExp(`^Definir preco proprio para ${escapeRegExp(rejectedItem)}`) })).toBeVisible()

  await row.getByRole('button', { name: new RegExp(`^Ver historico de ${escapeRegExp(rejectedItem)}`) }).click()
  const history = historyDialog(page)
  await expect(historyEntries(history)).toHaveCount(1)
  await expect(historyEntries(history).first().getByText('Inativo', { exact: true })).toBeVisible()
  await expect(historyEntries(history).first()).toContainText(`${prefix}_MOTIVO_RECUSA`)
  await expect(history.getByText('Preco vigente')).toHaveCount(0)
  await closeDrawer(page, history)

  await page.goto('/pricing/prices')
  await page.getByPlaceholder('Buscar item, codigo ou fonte...').fill(rejectedItem)
  await expect(priceRow(page, rejectedItem, currentWidth(page))).toHaveCount(0)
})

test('Admin inativa o preco vigente sem reativar o preco anterior', async ({ page }) => {
  test.setTimeout(300_000)

  await createOwnServiceViaUi(page, { itemName: retireItem, categoryName, description: prefix })
  const item = await findOwnCatalogItem(service, retireItem)
  collection.catalogItemIds.push(item.id)

  await searchOwnPrices(page, retireItem)
  await submitOwnPriceProposal(page, {
    mode: 'create',
    itemId: item.id,
    itemName: retireItem,
    salePrice: '100,00',
    internalCost: '55,00',
    notes: `${prefix}_INATIVACAO_BASE`,
  })
  await expect(page.getByText(/Proposta enviada para aprova/i)).toBeVisible()
  await itemContainer(page, retireItem, currentWidth(page)).getByRole('button', { name: /^Decidir proposta de/ }).click()
  await expect(decisionDialog(page).getByRole('button', { name: 'Aprovar preco' })).toBeEnabled({ timeout: 20_000 })
  page.once('dialog', (browserDialog) => void browserDialog.accept())
  await decisionDialog(page).getByRole('button', { name: 'Aprovar preco' }).click()
  await expect(page.getByText('Preco proprio aprovado.')).toBeVisible()

  await submitOwnPriceProposal(page, {
    mode: 'reajuste',
    itemId: item.id,
    itemName: retireItem,
    salePrice: '180,00',
    internalCost: '90,00',
    notes: `${prefix}_INATIVACAO_REAJUSTE`,
  })
  await expect(page.getByText(/Reajuste enviado para aprova/i)).toBeVisible()
  await itemContainer(page, retireItem, currentWidth(page)).getByRole('button', { name: /^Decidir proposta de/ }).click()
  await expect(decisionDialog(page).getByRole('button', { name: 'Aprovar preco' })).toBeEnabled({ timeout: 20_000 })
  page.once('dialog', (browserDialog) => void browserDialog.accept())
  await decisionDialog(page).getByRole('button', { name: 'Aprovar preco' }).click()
  await expect(page.getByText('Preco proprio aprovado.')).toBeVisible()

  const row = itemContainer(page, retireItem, currentWidth(page))
  await expect(row.getByText('R$ 180,00')).toBeVisible()
  await row.getByRole('button', { name: new RegExp(`^Inativar preco de ${escapeRegExp(retireItem)}`) }).click()
  const retire = retireDialog(page)
  await expect(retire.getByRole('button', { name: 'Inativar preco' })).toBeEnabled({ timeout: 20_000 })
  page.once('dialog', (browserDialog) => void browserDialog.accept())
  await retire.getByRole('button', { name: 'Inativar preco' }).click()
  await expect(page.getByText('Preco proprio inativado.')).toBeVisible()
  await expect(retire).not.toBeVisible()

  await expect(row.getByText('Preco inativo')).toBeVisible()
  await expect(row.getByText('Sem oferta vigente')).toBeVisible()
  await expect(row.getByText('R$ 100,00')).toHaveCount(0)
  await expect(row.getByText('R$ 180,00')).toHaveCount(0)
  await expect(row.getByRole('button', { name: /^Inativar preco de/ })).toHaveCount(0)
  await expect(row.getByRole('button', { name: new RegExp(`^Definir preco proprio para ${escapeRegExp(retireItem)}`) })).toBeVisible()

  await row.getByRole('button', { name: new RegExp(`^Ver historico de ${escapeRegExp(retireItem)}`) }).click()
  const history = historyDialog(page)
  await expect(history.getByText('Preco vigente')).toHaveCount(0)
  await closeDrawer(page, history)

  await page.goto('/pricing/prices')
  await page.getByPlaceholder('Buscar item, codigo ou fonte...').fill(retireItem)
  const retiredRowText = (await priceRow(page, retireItem, currentWidth(page)).allInnerTexts()).join(' | ')
  expect(retiredRowText).not.toContain('Aprovado')
})

test('Catalogo, Precos Proprios, drawer de decisao, Historico e Tabela de Precos nao excedem a viewport', async ({ page }) => {
  test.setTimeout(300_000)

  await createOwnServiceViaUi(page, { itemName: responsiveItem, categoryName, description: prefix })
  const item = await findOwnCatalogItem(service, responsiveItem)
  collection.catalogItemIds.push(item.id)
  await searchOwnPrices(page, responsiveItem)
  await submitOwnPriceProposal(page, {
    mode: 'create',
    itemId: item.id,
    itemName: responsiveItem,
    salePrice: '260,00',
    internalCost: '140,00',
    notes: `${prefix}_RESPONSIVO`,
  })
  await expect(itemContainer(page, responsiveItem, 1280).getByText('Proposta pendente')).toBeVisible()

  const overflows: string[] = []
  const recordOverflow = async (label: string, width: number) => {
    const metrics = await measureGlobalOverflow(page)
    if (metrics.scrollWidth > metrics.viewport || metrics.bodyScrollWidth > metrics.viewport) {
      overflows.push(`${label} em ${width}px (viewport=${String(metrics.viewport)}, scrollWidth=${String(metrics.scrollWidth)}, body=${String(metrics.bodyScrollWidth)})`)
    }
  }

  for (const width of [375, 390, 768, 900, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })

    await page.goto('/pricing/catalog')
    await page.getByLabel('Buscar itens').fill(responsiveItem)
    await expect(catalogRow(page, responsiveItem)).toBeVisible()
    await expect(catalogRow(page, responsiveItem).getByText('Proprio', { exact: false }).first()).toBeVisible()
    await recordOverflow('Catalogo', width)
    await assertLocalTableScroll(page, width, 'Itens do catalogo', 'Catalogo')

    await page.goto('/pricing/own-prices')
    await page.getByPlaceholder('Buscar servico, codigo ou categoria...').fill(responsiveItem)
    const container = itemContainer(page, responsiveItem, width)
    await expect(container).toBeVisible()
    await expect(container.getByText('Proposta pendente').first()).toBeVisible()
    await recordOverflow('Precos Proprios', width)
    if (width >= 768) {
      await assertLocalTableScroll(page, width, 'Precos Proprios', 'Precos Proprios')
    }

    await container.getByRole('button', { name: new RegExp(`^Decidir proposta de ${escapeRegExp(responsiveItem)}`) }).click()
    const decision = decisionDialog(page)
    await expect(decision).toBeVisible()
    await expect(decision.getByRole('button', { name: 'Aprovar preco' })).toBeEnabled({ timeout: 20_000 })
    await assertNoDrawerOverflow(decision, width, 'Drawer de decisao')
    await recordOverflow('Drawer de decisao', width)
    await closeDrawer(page, decision)
    await expect(decision).not.toBeVisible()

    await container.getByRole('button', { name: new RegExp(`^Ver historico de ${escapeRegExp(responsiveItem)}`) }).click()
    const history = historyDialog(page)
    await expect(history).toBeVisible()
    await expect(historyEntries(history)).toHaveCount(1)
    await expect(history.getByText('Pendente', { exact: true })).toBeVisible()
    await expect(history.getByText('Custo interno')).toBeVisible()
    await assertNoDrawerOverflow(history, width, 'Drawer de historico')
    await recordOverflow('Drawer de historico', width)
    await closeDrawer(page, history)
    await expect(history).not.toBeVisible()

    await page.goto('/pricing/prices')
    await expect(page.getByPlaceholder('Buscar item, codigo ou fonte...')).toBeVisible()
    await recordOverflow('Tabela de Precos', width)
    if (width >= 768) {
      await assertLocalTableScroll(page, width, 'Tabela de Precos', 'Tabela de Precos')
    }
  }

  await page.setViewportSize({ width: 1280, height: 720 })
  expect(overflows, 'Telas com overflow horizontal global').toEqual([])
})
