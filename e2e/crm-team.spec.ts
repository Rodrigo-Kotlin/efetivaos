import { expect, test } from '@playwright/test'

test.describe('CRM Team Flow', () => {
  test('equipe can access CRM dashboard', async ({ page }) => {
    await page.goto('/crm')
    await expect(page).toHaveURL(/\/crm/)
    await expect(page.getByRole('heading', { name: /Relacionamento com clientes/i })).toBeVisible()
  })

  test('equipe can access clients list', async ({ page }) => {
    await page.goto('/crm/clients')
    await expect(page).toHaveURL(/\/crm\/clients/)
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible()
  })

  test('equipe deep-link /crm resolves', async ({ page }) => {
    await page.goto('/crm')
    await expect(page).toHaveURL(/\/crm/)
    await expect(page.getByRole('heading', { name: /Relacionamento com clientes/i })).toBeVisible()
  })

  test('equipe deep-link /crm/clients resolves', async ({ page }) => {
    await page.goto('/crm/clients')
    await expect(page).toHaveURL(/\/crm\/clients/)
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible()
  })

  test('CRM sidebar active for equipe', async ({ page }) => {
    await page.goto('/crm')
    const crmLink = page.getByRole('link', { name: /^CRM$/i })
    await expect(crmLink).toHaveAttribute('aria-current', 'page')
  })
})
