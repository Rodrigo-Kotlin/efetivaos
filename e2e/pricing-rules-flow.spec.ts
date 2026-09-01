import { expect, type Locator, type Page, test } from '@playwright/test'

import { readFixtureState, serviceClient } from './fixtures'

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

async function createActiveQuotation(
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
  await page.getByRole('button', { name: /^Ativar$/i }).click()
  await expect(page.getByText('Cotação ativada com sucesso.', { exact: true })).toBeVisible()
}

async function createRule(
  page: Page,
  scope: 'Global' | 'Categoria' | 'Item',
  value: string,
  notes: string,
  target?: string,
) {
  await page.goto('/pricing/rules')
  await expect(page.getByRole('heading', { name: /Regras de acrescimo/i })).toBeVisible()
  await page.getByRole('button', { name: /Nova regra/i }).first().click()
  const drawer = page.getByRole('dialog', { name: /Nova regra/i })
  await expect(drawer).toBeVisible()
  await drawer.getByRole('radio', { name: scope }).click()
  if (scope === 'Categoria') await chooseOption(drawer.getByLabel('Categoria alvo'), target ?? '')
  if (scope === 'Item') await chooseOption(drawer.getByLabel('Item alvo'), target ?? '')
  await drawer.getByRole('radio', { name: 'Percentual sobre custo' }).click()
  await drawer.getByLabel('Valor da regra').fill(value)
  await drawer.getByLabel('Observacao').fill(notes)
  await drawer.getByRole('button', { name: 'Criar regra' }).click()
  await expect(page.getByText('Regra criada com sucesso.', { exact: true })).toBeVisible()
}

test('Admin gerencia regras e a comparacao reflete o calculo autoritativo', async ({ page }) => {
  const client = serviceClient()
  await client.from('margin_rules').update({ active: false }).eq('active', true)

  const fixture = await readFixtureState()
  const reference = `${fixture.prefix}_RULE`
  const receivedAt = '2026-08-23'
  const unitPrice = '100.00'
  const catalogItemLabel = `${fixture.catalogItemCode} - ${fixture.catalogItemName}`

  await createActiveQuotation(page, fixture.supplierName, fixture.catalogItemName, reference, receivedAt, unitPrice)
  await createRule(page, 'Global', '20', `${fixture.prefix}_RULE_GLOBAL`)
  await page.goto('/pricing/comparison')
  const table = page.getByRole('table', { name: /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i })
  const itemRow = table.getByRole('row').filter({ hasText: fixture.catalogItemCode })
  await expect(itemRow).toBeVisible()
  await expect(itemRow).toContainText('R$ 100,00')
  await expect(itemRow).toContainText('R$ 120,00')
  await expect(itemRow).toContainText('20%')
  await expect(itemRow).toContainText('Global')

  await createRule(page, 'Categoria', '30', `${fixture.prefix}_RULE_CATEGORY`, fixture.categoryName)
  await page.goto('/pricing/comparison')
  const itemRowAfterCategory = table.getByRole('row').filter({ hasText: fixture.catalogItemCode })
  await expect(itemRowAfterCategory).toContainText('R$ 130,00')
  await expect(itemRowAfterCategory).toContainText('30%')
  await expect(itemRowAfterCategory).toContainText(`Categoria — ${fixture.categoryName}`)

  await createRule(page, 'Item', '35', `${fixture.prefix}_RULE_ITEM`, catalogItemLabel)
  await page.goto('/pricing/comparison')
  const itemRowAfterItem = table.getByRole('row').filter({ hasText: fixture.catalogItemCode })
  await expect(itemRowAfterItem).toContainText('R$ 135,00')
  await expect(itemRowAfterItem).toContainText('35%')
  await expect(itemRowAfterItem).toContainText(`Item — ${fixture.catalogItemName}`)

  await page.goto('/pricing/rules')
  const rulesTable = page.getByRole('table', { name: /Regras de acrescimo/i })
  const itemRuleRow = rulesTable.getByRole('row').filter({ hasText: fixture.catalogItemCode })
  const deactivateButton = itemRuleRow.getByRole('button', { name: /Inativar regra/ })
  await deactivateButton.click()
  await expect(page.getByText('Regra inativada.', { exact: true })).toBeVisible()

  await page.goto('/pricing/comparison')
  const itemRowAfterDeactivate = table.getByRole('row').filter({ hasText: fixture.catalogItemCode })
  await expect(itemRowAfterDeactivate).toContainText('R$ 130,00')
  await expect(itemRowAfterDeactivate).toContainText('30%')
  await expect(itemRowAfterDeactivate).toContainText(`Categoria — ${fixture.categoryName}`)
})
