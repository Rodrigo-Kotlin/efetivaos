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

  test('equipe sees empty state', async ({ page }) => {
    await page.goto('/crm/clients')
    await expect(page.getByText('Nenhum cliente cadastrado')).toBeVisible({ timeout: 10_000 })
  })

  test('equipe can use search', async ({ page }) => {
    await page.goto('/crm/clients')
    await expect(page.getByPlaceholder(/Buscar por nome/i)).toBeVisible({ timeout: 10_000 })
    await page.getByPlaceholder(/Buscar por nome/i).fill('test')
    await expect(page.getByText('Nenhum cliente encontrado')).toBeVisible()
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
