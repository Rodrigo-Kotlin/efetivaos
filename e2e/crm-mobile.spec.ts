import { expect, test } from '@playwright/test'

test.describe('CRM Mobile Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/crm')
    await expect(page.getByRole('heading', { name: /Relacionamento com clientes/i })).toBeVisible({ timeout: 15_000 })
  })

  test('CRM dashboard loads on mobile', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Relacionamento com clientes/i })).toBeVisible()
  })

  test('mobile hamburger opens menu', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /Abrir menu/i })
    await expect(menuButton).toBeVisible()
    await menuButton.click()

    const nav = page.getByRole('navigation', { name: /Navegacao principal/i })
    await expect(nav).toBeVisible()

    const crmLink = nav.getByRole('link', { name: /^CRM$/i })
    await expect(crmLink).toBeVisible()

    const clientsLink = nav.getByRole('link', { name: /^Clientes$/i })
    await expect(clientsLink).toBeVisible()
  })

  test('mobile menu navigates to clients', async ({ page }) => {
    await page.getByRole('button', { name: /Abrir menu/i }).click()
    const nav = page.getByRole('navigation', { name: /Navegacao principal/i })
    await nav.getByRole('link', { name: /^Clientes$/i }).click()

    await expect(page).toHaveURL(/\/crm\/clients/)
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible()
  })

  test('clients list loads on mobile', async ({ page }) => {
    await page.goto('/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByPlaceholder(/Buscar por nome/i)).toBeVisible()
  })

  test('CRM dashboard buttons visible on mobile', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Clientes/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Novo cliente/i })).toBeVisible()
  })

  test('deep-link /crm on mobile', async ({ page }) => {
    await page.goto('/crm')
    await expect(page).toHaveURL(/\/crm/)
    await expect(page.getByRole('heading', { name: /Relacionamento com clientes/i })).toBeVisible()
  })

  test('deep-link /crm/clients on mobile', async ({ page }) => {
    await page.goto('/crm/clients')
    await expect(page).toHaveURL(/\/crm\/clients/)
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible()
  })

  test('search and filter functional on mobile', async ({ page }) => {
    await page.goto('/crm/clients')
    await expect(page.getByPlaceholder(/Buscar por nome/i)).toBeVisible({ timeout: 10_000 })
    await page.getByPlaceholder(/Buscar por nome/i).fill('mobile_test')
    await expect(page.getByText('Nenhum cliente encontrado')).toBeVisible()
  })
})
