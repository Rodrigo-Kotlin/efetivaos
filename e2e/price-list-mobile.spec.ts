import { expect, test } from '@playwright/test'

import { readFixtureState } from './fixtures'

test('tabela comercial exibe o preco manual em cartao no celular', async ({ page }) => {
  const { priceApproval: fixture } = await readFixtureState()

  await page.goto('/pricing/prices')
  await expect(page.getByRole('heading', { name: /Tabela de Precos/i })).toBeVisible()
  await expect(page.getByRole('table', { name: /Tabela de Precos/i })).toBeHidden()

  const card = page.locator('article').filter({ hasText: fixture.catalogItemCode })
  await expect(card).toBeVisible()
  await expect(card).toContainText('R$ 125,00')
  await expect(card).toContainText(fixture.alternativeSupplierName)
  await expect(card).toContainText('Manual')
  await expect(card).toContainText('Inativo')
  await expect(card.getByRole('button', { name: /Ver rastreabilidade/i })).toBeVisible()
})
