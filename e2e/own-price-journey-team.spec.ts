import { expect, test, type Browser } from '@playwright/test'

import {
  captureOwnJourneyResidue,
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
  priceRow,
  provisionOwnCategory,
  searchOwnPrices,
  serviceClient3d,
  submitOwnPriceProposal,
  type OwnJourneyCollection,
} from './own-price-journey.utils'

const service = serviceClient3d()
const prefix = marker3d('TEAM')
const collection: OwnJourneyCollection = { prefix, categoryIds: [], catalogItemIds: [] }
const categoryName = `${prefix}_CATEGORIA`
const teamItem = `${prefix}_ITEM`

async function openAdminPage(browser: Browser, baseURL: string) {
  const context = await browser.newContext({ storageState: 'playwright/.auth/admin.json', baseURL, viewport: { width: 1280, height: 720 } })
  return context.newPage()
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  collection.categoryIds.push(await provisionOwnCategory(service, categoryName))
})

test.afterAll(async () => {
  await cleanupOwnJourney(service, collection)
  const residue = await captureOwnJourneyResidue(service, collection)
  expect([residue.categories, residue.catalogItems, residue.ownPriceProposals, residue.priceList]).toEqual([0, 0, 0, 0])
})

test('Equipe propoe preco proprio, nao decide e nao enxerga custo interno', async ({ page, browser }, testInfo) => {
  test.setTimeout(300_000)
  const baseURL = String(testInfo.project.use.baseURL ?? 'http://127.0.0.1:4173')

  await test.step('cria servico proprio pelo Catalogo', async () => {
    await createOwnServiceViaUi(page, { itemName: teamItem, categoryName, description: prefix })
    const item = await findOwnCatalogItem(service, teamItem)
    collection.catalogItemIds.push(item.id)
  })

  await test.step('envia proposta e permanece aguardando decisao do Admin', async () => {
    await searchOwnPrices(page, teamItem)
    await submitOwnPriceProposal(page, {
      mode: 'create',
      itemId: (await findOwnCatalogItem(service, teamItem)).id,
      itemName: teamItem,
      salePrice: '310,00',
      notes: `${prefix}_PROPOSTA_EQUIPE`,
    })
    await expect(page.getByText(/Proposta enviada para aprova/i)).toBeVisible()
    const row = itemContainer(page, teamItem, currentWidth(page))
    await expect(row).toBeVisible()
    await expect(row.getByText('Proposta pendente')).toBeVisible()
    await expect(row.getByText('Aguardando decisao do Admin')).toBeVisible()
    await expect(row.getByText('R$ 310,00')).toBeVisible()
    await expect(row.getByRole('button', { name: /^Decidir proposta de/ })).toHaveCount(0)
    await expect(row.getByRole('button', { name: /^Inativar preco de/ })).toHaveCount(0)
    await expect(row.getByRole('button', { name: /^Propor reajuste para/ })).toHaveCount(0)
  })

  await test.step('historico da Equipe oculta custo interno', async () => {
    const row = itemContainer(page, teamItem, currentWidth(page))
    await row.getByRole('button', { name: new RegExp(`^Ver historico de ${escapeRegExp(teamItem)}`) }).click()
    const history = historyDialog(page)
    await expect(history).toBeVisible()
    const entries = historyEntries(history)
    await expect(entries).toHaveCount(1)
    await expect(entries.first().getByText('Pendente', { exact: true })).toBeVisible()
    await expect(entries.first().getByText('Preco vigente')).toHaveCount(0)
    await expect(entries.first()).toContainText('R$ 310,00')
    await expect(entries.first()).toContainText(`${prefix}_PROPOSTA_EQUIPE`)
    await expect(entries.first()).not.toContainText('Custo interno')
    await closeDrawer(page, history)
    await expect(history).not.toBeVisible()
  })

  await test.step('Tabela de Precos ainda nao publica o item pendente', async () => {
    await page.goto('/pricing/prices')
    await page.getByPlaceholder('Buscar item, codigo ou fonte...').fill(teamItem)
    await expect(priceRow(page, teamItem, currentWidth(page))).toHaveCount(0)
  })

  const adminPage = await openAdminPage(browser, baseURL)

  await test.step('Admin aprova e a Equipe passa a ver o preco vigente sem custo interno', async () => {
    await adminPage.goto('/pricing/own-prices')
    await adminPage.getByPlaceholder('Buscar servico, codigo ou categoria...').fill(teamItem)
    const adminRow = itemContainer(adminPage, teamItem, 1280)
    await expect(adminRow.getByText('Proposta pendente')).toBeVisible()
    await adminRow.getByRole('button', { name: new RegExp(`^Decidir proposta de ${escapeRegExp(teamItem)}`) }).click()
    const decision = decisionDialog(adminPage)
    await expect(decision.getByRole('button', { name: 'Aprovar preco' })).toBeEnabled({ timeout: 20_000 })
    adminPage.once('dialog', (browserDialog) => void browserDialog.accept())
    await decision.getByRole('button', { name: 'Aprovar preco' }).click()
    await expect(adminPage.getByText('Preco proprio aprovado.')).toBeVisible()
    await expect(adminRow.getByText('Preco aprovado')).toBeVisible()

    await page.goto('/pricing/own-prices')
    await page.getByPlaceholder('Buscar servico, codigo ou categoria...').fill(teamItem)
    const teamRow = itemContainer(page, teamItem, currentWidth(page))
    await expect(teamRow.getByText('Preco aprovado')).toBeVisible()
    await expect(teamRow.getByText('R$ 310,00')).toBeVisible()
    await expect(teamRow.getByText('Aguardando decisao do Admin')).toHaveCount(0)
    await expect(teamRow.getByRole('button', { name: /^Decidir proposta de/ })).toHaveCount(0)
    await expect(teamRow.getByRole('button', { name: /^Inativar preco de/ })).toHaveCount(0)
    await expect(teamRow.getByRole('button', { name: new RegExp(`^Propor reajuste para ${escapeRegExp(teamItem)}`) })).toBeVisible()

    await teamRow.getByRole('button', { name: new RegExp(`^Ver historico de ${escapeRegExp(teamItem)}`) }).click()
    const history = historyDialog(page)
    await expect(historyEntries(history).first().getByText('Aprovado', { exact: true })).toBeVisible()
    await expect(historyEntries(history).first().getByText('Preco vigente')).toBeVisible()
    await expect(history).not.toContainText('Custo interno')
    await closeDrawer(page, history)
  })

  await test.step('Tabela de Precos da Equipe mostra origem propria e custo restrito', async () => {
    await page.goto('/pricing/prices')
    await page.getByPlaceholder('Buscar item, codigo ou fonte...').fill(teamItem)
    const priceListRow = priceRow(page, teamItem, currentWidth(page))
    await expect(priceListRow).toHaveCount(1)
    await expect(priceListRow).toContainText('Proprio')
    await expect(priceListRow).toContainText('Aprovado')
    await expect(priceListRow).toContainText('R$ 310,00')
    await expect(priceListRow).toContainText('Restrito a Admin')
    await expect(priceListRow).not.toContainText('R$ 75,00')
  })

  await adminPage.context().close()
})

test('Equipe nao altera decisao de preco proprio e recusa exige Admin', async ({ page }) => {
  test.setTimeout(240_000)

  const protectedItem = `${prefix}_ITEM_PROTEGIDO`
  await createOwnServiceViaUi(page, { itemName: protectedItem, categoryName, description: prefix })
  const item = await findOwnCatalogItem(service, protectedItem)
  collection.catalogItemIds.push(item.id)

  await searchOwnPrices(page, protectedItem)
  await submitOwnPriceProposal(page, {
    mode: 'create',
    itemId: item.id,
    itemName: protectedItem,
    salePrice: '95,00',
    notes: `${prefix}_PROTEGIDO`,
  })
  await expect(page.getByText(/Proposta enviada para aprova/i)).toBeVisible()

  const row = itemContainer(page, protectedItem, currentWidth(page))
  await expect(row.getByText('Aguardando decisao do Admin')).toBeVisible()
  await expect(row.getByRole('button', { name: /Aprovar|Recusar|Inativar/ })).toHaveCount(0)

  const apiCalls: string[] = []
  page.on('request', (request) => {
    if (request.method() !== 'GET') apiCalls.push(`${request.method()} ${new URL(request.url()).pathname}`)
  })
  await page.reload()
  await page.getByPlaceholder('Buscar servico, codigo ou categoria...').fill(protectedItem)
  await expect(itemContainer(page, protectedItem, currentWidth(page)).getByText('Proposta pendente')).toBeVisible()
  expect(apiCalls.filter((call) => call.includes('approve_own_price_proposal') || call.includes('inactivate_own_price_proposal'))).toEqual([])
})
