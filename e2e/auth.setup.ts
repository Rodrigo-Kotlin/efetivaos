import { mkdir } from 'node:fs/promises'

import { expect, test as setup } from '@playwright/test'

import { requiredEnv } from './env'

const authFile = 'playwright/.auth/admin.json'

setup('authenticate as Sprint 0 admin', async ({ page }) => {
  const email = requiredEnv('SPRINT0_ADMIN_EMAIL')
  const password = requiredEnv('SPRINT0_ADMIN_PASSWORD')

  await page.goto('/login')
  await page.getByLabel(/^E-mail$/i).fill(email)
  await page.getByLabel(/^Senha$/i).fill(password)
  await page.getByRole('button', { name: /^Entrar$/i }).click()

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/)
  await expect(page.getByRole('button', { name: /^Sair$/i })).toBeVisible()

  await mkdir('playwright/.auth', { recursive: true })
  await page.context().storageState({ path: authFile })
})
