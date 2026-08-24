import { expect, test } from '@playwright/test'

import { readFixtureState } from './fixtures'

function requiredFixtureValue(value: string | undefined, name: string) {
  if (!value) throw new Error(`Missing price-approval fixture value: ${name}`)
  return value
}

test('Admin aprova fonte manual, valida snapshots e inativa o preco comercial', async ({ page }) => {
  const { priceApproval: fixture } = await readFixtureState()
  const alternativeQuotationItemId = requiredFixtureValue(fixture.alternativeQuotationItemId, 'alternativeQuotationItemId')
  const marginRuleId = requiredFixtureValue(fixture.marginRuleId, 'marginRuleId')

  await page.goto('/pricing/comparison')
  const comparison = page.getByRole('table', { name: /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i })
  const comparisonRow = comparison.getByRole('row').filter({ hasText: fixture.catalogItemCode })
  await expect(comparisonRow).toBeVisible()
  await expect(comparisonRow).toContainText('R$ 80,00')
  await expect(comparisonRow).toContainText(fixture.bestSupplierName)
  await expect(comparisonRow).toContainText('25%')

  await comparisonRow.getByRole('button', { name: /Revisar calculo|Decidir/i }).first().click()
  const decisionDrawer = page.getByRole('dialog', { name: new RegExp(`Decisao comercial.*${fixture.catalogItemCode}`, 'i') })
  await expect(decisionDrawer).toBeVisible()
  await expect(decisionDrawer).toContainText(fixture.bestSupplierName)
  await expect(decisionDrawer).toContainText(fixture.alternativeSupplierName)

  await decisionDrawer.getByRole('radio', { name: new RegExp(fixture.alternativeSupplierName, 'i') }).check()
  await expect(decisionDrawer).toContainText('Manual · fonte alternativa')
  await decisionDrawer.getByRole('button', { name: /^Aprovar preco$/i }).click()
  await expect(page.getByText('Preco comercial aprovado em R$ 125,00.', { exact: true })).toBeVisible()
  await expect(decisionDrawer).not.toBeVisible()

  const approvedRow = comparison.getByRole('row').filter({ hasText: fixture.catalogItemCode })
  await expect(approvedRow).toContainText('R$ 125,00')
  await expect(approvedRow).toContainText('Aprovado')
  await approvedRow.getByRole('button', { name: /Revisar calculo|Decidir/i }).first().click()
  await expect(decisionDrawer).toContainText('Snapshot aprovado')
  await expect(decisionDrawer).toContainText('R$ 100,00')
  await expect(decisionDrawer).toContainText(`${fixture.alternativeSupplierName} · Manual`)
  await expect(decisionDrawer).toContainText('25%')
  await expect(decisionDrawer).toContainText(alternativeQuotationItemId)
  await expect(decisionDrawer).toContainText(marginRuleId)
  await page.keyboard.press('Escape')

  await page.goto('/pricing/prices')
  const priceTable = page.getByRole('table', { name: /Tabela de Precos/i })
  const priceRow = priceTable.getByRole('row').filter({ hasText: fixture.catalogItemCode })
  await expect(priceRow).toBeVisible()
  await expect(priceRow).toContainText(fixture.alternativeSupplierName)
  await expect(priceRow).toContainText('Manual')
  await expect(priceRow).toContainText('R$ 100,00')
  await expect(priceRow).toContainText('R$ 125,00')
  await expect(priceRow).toContainText('25%')
  await expect(priceRow).toContainText('Aprovado')

  await priceRow.getByRole('button', { name: /Rastreabilidade/i }).click()
  const traceDrawer = page.getByRole('dialog', { name: new RegExp(`Decisao comercial.*${fixture.catalogItemCode}`, 'i') })
  await expect(traceDrawer).toContainText(`${fixture.alternativeSupplierName} · Manual`)
  page.once('dialog', (dialog) => { void dialog.accept() })
  await traceDrawer.getByRole('button', { name: /Inativar preco/i }).click()
  await expect(page.getByText('Preco comercial inativado.', { exact: true })).toBeVisible()
  await expect(traceDrawer).not.toBeVisible()
  await expect(priceRow).toContainText('Inativo')
})
