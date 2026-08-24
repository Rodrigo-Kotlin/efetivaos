import { expect, test } from '@playwright/test'

import { readFixtureState } from './fixtures'

test('mobile admin opens the persisted quotation draft', async ({ page }) => {
  const fixture = await readFixtureState()

  await page.goto('/pricing/quotations')
  await expect(page.getByRole('heading', { name: /^Cota(?:ç|c)(?:õ|o)es$/i })).toBeVisible()

  const card = page.locator('article').filter({ has: page.getByText(fixture.quotationReference, { exact: true }) })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Rascunho')
  await expect(card.getByRole('link', { name: /Editar cota(?:ç|c)(?:ã|a)o/i })).toBeVisible()
  if (!fixture.quotationId) throw new Error('Desktop E2E did not persist the quotation id')
  await page.goto(`/pricing/quotations/${fixture.quotationId}`)

  await expect(page.getByRole('heading', { name: fixture.quotationReference, exact: true })).toBeVisible()
  await expect(page.getByText('Rascunho', { exact: false }).first()).toBeVisible()
  await expect(page.getByLabel(/N.mero\s*\/\s*refer.ncia|Refer.ncia/i)).toHaveValue(fixture.quotationReference)
  await expect(page.getByLabel(/Valor unit.rio|Pre.o unit.rio/i)).toHaveValue(/^137[.,]45$/)
})
