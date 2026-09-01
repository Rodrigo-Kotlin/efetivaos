import { expect, test } from '@playwright/test'

const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 900 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]

test('dashboard opera sem overflow nos breakpoints e preserva deep links', async ({ page, context }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/pricing')
    await expect(page.getByRole('heading', { name: 'Visão operacional' })).toBeVisible()
    await expect(page.getByText('Preços aprovados', { exact: true })).toBeVisible()
    await expect(page.getByText('Em revisão', { exact: true })).toBeVisible()
    await expect(page.getByText('Itens sem regra', { exact: true })).toBeVisible()
    await expect(page.getByText('Itens sem oferta vigente', { exact: true })).toBeVisible()
    await expect(page.getByText('Cotações vencendo em 7 dias', { exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }

  await page.goto('/pricing/prices')
  await expect(page.getByRole('heading', { name: /Tabela de Pre(?:ç|c)os/i })).toBeVisible()
  await page.goto('/pricing/comparison')
  await expect(page.getByRole('heading', { name: /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i })).toBeVisible()

  await page.goto('/pricing')
  await expect(page.getByRole('heading', { name: 'Visão operacional' })).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByText('Sem conexao. Os dados nao podem ser atualizados no momento.')).toBeVisible({ timeout: 10_000 })
  await context.setOffline(false)

  expect(browserErrors).toEqual([])
})
