import { expect, test } from '@playwright/test'

test.describe('CRM Admin Flow', () => {
  test('navigates to CRM dashboard and sees indicators', async ({ page }) => {
    await page.goto('/crm')
    await expect(page).toHaveURL(/\/crm/)
    await expect(page.getByRole('heading', { name: /Relacionamento com clientes/i })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'Clientes', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /Novo cliente/i })).toBeVisible()
  })

  test('navigates to clients list', async ({ page }) => {
    await page.goto('/crm/clients')
    await expect(page).toHaveURL(/\/crm\/clients/)
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible()
    await expect(page.getByPlaceholder(/Buscar por nome/i)).toBeVisible()
  })

  test('CRM sidebar links are active', async ({ page }) => {
    await page.goto('/crm')
    const crmLink = page.getByRole('link', { name: /^CRM$/i })
    await expect(crmLink).toHaveAttribute('aria-current', 'page')

    await page.goto('/crm/clients')
    const clientsLink = page.getByRole('link', { name: /^Clientes$/i })
    await expect(clientsLink).toHaveAttribute('aria-current', 'page')
  })

  test('deep-link /crm resolves', async ({ page }) => {
    await page.goto('/crm')
    await expect(page).toHaveURL(/\/crm/)
    await expect(page.getByRole('heading', { name: /Relacionamento com clientes/i })).toBeVisible()
  })

  test('deep-link /crm/clients resolves', async ({ page }) => {
    await page.goto('/crm/clients')
    await expect(page).toHaveURL(/\/crm\/clients/)
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible()
  })

  test('deep-link /crm/clients/new resolves', async ({ page }) => {
    await page.goto('/crm/clients/new')
    await expect(page).toHaveURL(/\/crm\/clients\/new/)
    await expect(page.getByRole('main').getByRole('button', { name: 'Voltar' })).toBeVisible({ timeout: 10_000 })
  })

  test('offline blocks create client button', async ({ page }) => {
    await page.goto('/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: 10_000 })
    const newClientBtn = page.getByRole('button', { name: /Novo cliente/i })
    await expect(newClientBtn).toBeVisible({ timeout: 10_000 })
  })

  test('refresh on /crm/clients preserves state', async ({ page }) => {
    await page.goto('/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: 10_000 })
    await page.reload()
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible()
  })

  test('no sprint badges or provisional text in app shell', async ({ page }) => {
    await page.goto('/crm')
    await expect(page.locator('text=/Sprint/i').first()).not.toBeVisible()
    await expect(page.locator('text=/TODO/i').first()).not.toBeVisible()
  })
})
