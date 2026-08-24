import { expect, type Locator, type Page, test } from '@playwright/test'

import { readFixtureState } from './fixtures'

async function chooseOption(control: Locator, optionName: string) {
  await expect(control).toBeVisible()
  if ((await control.evaluate((element) => element.tagName)) === 'SELECT') {
    const option = control.locator('option').filter({ hasText: optionName }).first()
    await expect(option).toBeAttached()
    await control.selectOption(await option.getAttribute('value') ?? '')
    return
  }

  await control.click()
  await control.page().getByRole('option', { name: optionName }).click()
}

async function createAndActivateQuotation(
  page: Page,
  supplierName: string,
  catalogItemName: string,
  reference: string,
  receivedAt: string,
  unitPrice: string,
) {
  await page.goto('/pricing/quotations/new')
  await expect(page.getByRole('heading', { name: /Nova cota(?:ç|c)(?:ã|a)o/i })).toBeVisible()

  const supplier = page.getByLabel(/Fornecedor/i).first()
  const referenceControl = page.getByLabel(/N.mero\s*\/\s*refer.ncia|Refer.ncia/i).first()
  const received = page.getByLabel(/Data recebida/i).first()
  await chooseOption(supplier, supplierName)
  await referenceControl.fill(reference)
  await received.fill(receivedAt)

  let catalogItem = page.getByLabel(/Item do cat.logo|Cat.logo Efetiva/i).first()
  if (!(await catalogItem.count())) {
    await page.getByRole('button', { name: /Adicionar item|Novo item/i }).click()
    catalogItem = page.getByLabel(/Item do cat.logo|Cat.logo Efetiva/i).first()
  }
  await chooseOption(catalogItem, catalogItemName)

  const value = page.getByLabel(/Valor unit.rio|Pre.o unit.rio/i).first()
  await value.fill(unitPrice)
  await page.getByRole('button', { name: /Salvar rascunho/i }).click()
  await expect(page.getByText('Cotação salva como rascunho.', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/pricing\/quotations\/[0-9a-f-]+\/?$/i)
  await page.getByRole('button', { name: /^Ativar$/i }).click()
  await expect(page.getByText('Cotação ativada com sucesso.', { exact: true })).toBeVisible()
}

async function cancelCurrentQuotation(page: Page) {
  page.once('dialog', (dialog) => { void dialog.accept() })
  await page.getByRole('button', { name: /Cancelar cota(?:ç|c)(?:ã|a)o/i }).click()
  await expect(page.getByText('Cotação cancelada.', { exact: true })).toBeVisible()
}

test('admin compara custos, identifica o menor e valida a promocao apos cancelamento', async ({ page }) => {
  const fixture = await readFixtureState()
  const referenceA = `${fixture.prefix}_QUOTE_A`
  const referenceB = `${fixture.prefix}_QUOTE_B`
  const receivedAt = '2026-08-23'

  await createAndActivateQuotation(page, fixture.supplierName, fixture.catalogItemName, referenceA, receivedAt, '180.00')
  await createAndActivateQuotation(page, fixture.supplierName, fixture.catalogItemName, referenceB, receivedAt, '150.00')

  await page.goto('/pricing/comparison')
  await expect(page.getByRole('heading', { name: /Compara(?:ç|c)(?:ã|a)o de custos/i })).toBeVisible()

  const table = page.getByRole('table', { name: /Compara(?:ç|c)(?:ã|a)o de custos/i })
  const itemRow = table.getByRole('row').filter({ hasText: fixture.catalogItemCode })
  await expect(itemRow).toBeVisible()
  await expect(itemRow).toContainText('R$ 150,00')
  await expect(itemRow).toContainText('Melhor custo')

  await page.getByRole('button', { name: new RegExp(`Ver 2 ofertas de ${fixture.catalogItemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') }).click()
  const drawer = page.getByRole('dialog', { name: new RegExp(fixture.catalogItemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText('R$ 180,00')
  await expect(drawer).toContainText('R$ 150,00')
  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible()

  await page.goto('/pricing/quotations')
  const rowB = page.getByRole('row').filter({ hasText: referenceB })
  await rowB.getByRole('link', { name: /Ver detalhes/i }).first().click()
  await cancelCurrentQuotation(page)

  await page.goto('/pricing/comparison')
  const promotedTable = page.getByRole('table', { name: /Compara(?:ç|c)(?:ã|a)o de custos/i })
  const promotedRow = promotedTable.getByRole('row').filter({ hasText: fixture.catalogItemCode })
  await expect(promotedRow).toContainText('R$ 180,00')
  await expect(promotedRow).toContainText('Melhor custo')
})
