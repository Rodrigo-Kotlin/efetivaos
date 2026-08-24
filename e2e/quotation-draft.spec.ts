import { expect, type Locator, type Page, test } from '@playwright/test'

import { readFixtureState, saveFixtureState } from './fixtures'

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

async function expectSelected(control: Locator, optionName: string) {
  if ((await control.evaluate((element) => element.tagName)) === 'SELECT') {
    await expect(control.locator('option:checked')).toContainText(optionName)
    return
  }

  await expect(control).toContainText(optionName)
}

async function openQuotations(page: Page) {
  const link = page.getByRole('link', { name: /^Cota(?:ç|c)(?:õ|o)es$/i }).first()
  if (await link.count()) await link.click()
  else await page.goto('/pricing/quotations')
  await expect(page.getByRole('heading', { name: /^Cota(?:ç|c)(?:õ|o)es$/i })).toBeVisible()
}

test('admin saves and reopens an isolated quotation draft', async ({ page }) => {
  const fixture = await readFixtureState()
  const unitPrice = '137.45'
  const receivedAt = '2026-08-23'

  await page.goto('/')
  await openQuotations(page)
  await expect(page.locator('a[href="/pricing/quotations/new"]').first()).toBeVisible()
  await page.goto('/pricing/quotations/new')
  await expect(page).toHaveURL(/\/pricing\/quotations\/new\/?$/)
  await expect(page.getByRole('heading', { name: /Nova cota(?:ç|c)(?:ã|a)o/i })).toBeVisible()

  const supplier = page.getByLabel(/Fornecedor/i).first()
  const reference = page.getByLabel(/N.mero\s*\/\s*refer.ncia|Refer.ncia/i).first()
  const received = page.getByLabel(/Data recebida/i).first()
  await chooseOption(supplier, fixture.supplierName)
  await reference.fill(fixture.quotationReference)
  await received.fill(receivedAt)

  let catalogItem = page.getByLabel(/Item do cat.logo|Cat.logo Efetiva/i).first()
  if (!(await catalogItem.count())) {
    await page.getByRole('button', { name: /Adicionar item|Novo item/i }).click()
    catalogItem = page.getByLabel(/Item do cat.logo|Cat.logo Efetiva/i).first()
  }
  await chooseOption(catalogItem, fixture.catalogItemName)

  const value = page.getByLabel(/Valor unit.rio|Pre.o unit.rio/i).first()
  await value.fill(unitPrice)
  await page.getByLabel(/Arquivo original/i).setInputFiles({ name: 'quotation-e2e.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%E2E\n') })
  await page.getByRole('button', { name: /Salvar rascunho/i }).click()
  await expect(page.getByText('Cotação salva como rascunho.', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/pricing\/quotations\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/?$/i)
  const draftUrl = page.url()
  fixture.quotationId = draftUrl.split('/').filter(Boolean).at(-1)
  fixture.attachmentExpected = true
  await saveFixtureState(fixture)

  await openQuotations(page)
  const row = page.getByRole('row').filter({ hasText: fixture.quotationReference })
  await expect(row).toBeVisible()
  await page.goto(draftUrl)

  const reopenedSupplier = page.getByLabel(/Fornecedor/i).first()
  const reopenedReference = page.getByLabel(/N.mero\s*\/\s*refer.ncia|Refer.ncia/i).first()
  const reopenedReceived = page.getByLabel(/Data recebida/i).first()
  const reopenedItem = page.getByLabel(/Item do cat.logo|Cat.logo Efetiva/i).first()
  const reopenedValue = page.getByLabel(/Valor unit.rio|Pre.o unit.rio/i).first()

  await expect(reopenedReference).toHaveValue(fixture.quotationReference)
  await expect(reopenedReceived).toHaveValue(receivedAt)
  await expectSelected(reopenedSupplier, fixture.supplierName)
  await expectSelected(reopenedItem, fixture.catalogItemName)
  await expect(reopenedValue).toHaveValue(/^137[.,]45$/)
  await expect(page.getByText('Rascunho', { exact: false }).first()).toBeVisible()
  const attachmentButton = page.getByRole('button', { name: /Abrir anexo atual/i })
  await expect(attachmentButton).toBeVisible()
  const signedResponsePromise = page.context().waitForEvent('response', {
    predicate: (response) => response.request().method() === 'GET' && response.url().includes('/storage/v1/object/sign/supplier-quotes/'),
  })
  const popupPromise = page.waitForEvent('popup')
  await attachmentButton.click()
  const popup = await popupPromise
  try {
    const signedResponse = await signedResponsePromise
    expect(signedResponse.ok()).toBe(true)
    const signedUrl = new URL(signedResponse.url())
    expect(signedUrl.protocol).toBe('https:')
    expect(signedUrl.pathname).toContain('/storage/v1/object/sign/supplier-quotes/')
    expect(signedUrl.searchParams.has('token')).toBe(true)
  } finally {
    await popup.close()
  }
})
