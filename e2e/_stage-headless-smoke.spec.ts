import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

async function cleanupFixtureClients() {
  const url = process.env.VITE_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const c = createClient(url, key, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } })
  const { data: clients } = await c.from('clients').select('id').or('legal_name.like.STAGE%,legal_name.like.STABILITY%,tax_id.eq.52998224725')
  const ids = (clients ?? []).map((x) => x.id)
  if (ids.length) {
    await c.from('client_contacts').delete().in('client_id', ids)
    await c.from('clients').delete().in('id', ids)
  }
}

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('https://efetivaos.pages.dev/login')
  await page.getByLabel(/^E-mail$/i).fill(email)
  await page.getByLabel(/^Senha$/i).fill(password)
  await page.getByRole('button', { name: /^Entrar$/i }).click()
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15_000 })
}

test.describe('Headed Smoke — Production URL', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
  })

  test('H1: Login as Admin via real pointer click', async ({ page }) => {
    test.setTimeout(60_000)
    await login(page, process.env.SPRINT0_ADMIN_EMAIL!, process.env.SPRINT0_ADMIN_PASSWORD!)
    await expect(page.getByRole('button', { name: /^Sair$/i })).toBeVisible({ timeout: 15_000 })
    console.log(`[H1] admin logged in, current URL: ${page.url()}`)
  })

  test('H2: Suppliers drawer open/close × 5 via dispatchEvent', async ({ page }) => {
    test.setTimeout(60_000)
    await login(page, process.env.SPRINT0_ADMIN_EMAIL!, process.env.SPRINT0_ADMIN_PASSWORD!)
    await page.goto('https://efetivaos.pages.dev/pricing/suppliers')
    await expect(page.getByRole('heading', { name: /Fornecedores/i })).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2_000)

    const newBtn = page.getByRole('button', { name: /Novo fornecedor/i })
    const closeBtn = page.getByRole('button', { name: /Fechar painel/i })

    for (let i = 0; i < 5; i++) {
      const t0 = Date.now()
      await newBtn.dispatchEvent('click')
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
      await closeBtn.dispatchEvent('click')
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 })
      console.log(`[H2] cycle ${i + 1} ok in ${Date.now() - t0}ms`)
    }
  })

  test('H3: Clients drawer open/close × 5 via dispatchEvent', async ({ page }) => {
    test.setTimeout(60_000)
    await login(page, process.env.SPRINT0_ADMIN_EMAIL!, process.env.SPRINT0_ADMIN_PASSWORD!)
    await page.goto('https://efetivaos.pages.dev/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: 15_000 })

    const newBtn = page.getByRole('button', { name: /Novo cliente/i })
    const cancelBtn = page.getByRole('button', { name: /^Cancelar$/i })

    for (let i = 0; i < 5; i++) {
      const t0 = Date.now()
      await newBtn.dispatchEvent('click')
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
      await expect(page.locator('#tax_id')).toBeVisible({ timeout: 5_000 })
      await page.getByLabel(/Tipo de cliente/i).selectOption('individual')
      await page.getByLabel(/Nome completo/i).waitFor({ timeout: 3_000 })
      await page.getByLabel(/Tipo de cliente/i).selectOption('company')
      await page.getByLabel(/Raz.*Social/i).waitFor({ timeout: 3_000 })
      await cancelBtn.dispatchEvent('click')
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 })
      console.log(`[H3] cycle ${i + 1} ok in ${Date.now() - t0}ms`)
    }
  })

  test('H4: PF CRUD full flow via dispatchEvent + fill (Admin)', async ({ page }) => {
    test.setTimeout(90_000)
    await cleanupFixtureClients()
    await login(page, process.env.SPRINT0_ADMIN_EMAIL!, process.env.SPRINT0_ADMIN_PASSWORD!)

    const fixtureName = `STAGE PF ${Date.now()}`
    const fixtureCpf = '52998224725'

    await page.goto('https://efetivaos.pages.dev/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: /Novo cliente/i }).dispatchEvent('click')
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await page.locator('#tax_id').fill(fixtureCpf)
    await page.getByLabel(/Nome completo/i).fill(fixtureName)
    await page.getByLabel(/E-mail/i).fill('stage-pf@test.com')
    await page.getByRole('button', { name: /Cadastrar cliente/i }).dispatchEvent('click')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(fixtureName)).toBeVisible({ timeout: 15_000 })
    console.log(`[H4] create ok: ${fixtureName}`)

    const row = page.locator('tr').filter({ hasText: fixtureName }).first()
    await row.getByRole('button', { name: /detalhes/i }).first().dispatchEvent('click')
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(fixtureName).first()).toBeVisible()
    await page.getByRole('button', { name: /Fechar painel/i }).dispatchEvent('click')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 })

    await row.getByRole('button', { name: /editar/i }).first().dispatchEvent('click')
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await page.getByLabel(/Observa/i).fill('edit via headed smoke')
    await page.getByRole('button', { name: /Salvar altera/i }).dispatchEvent('click')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 })
    console.log(`[H4] edit ok`)

    await page.goto('https://efetivaos.pages.dev/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(fixtureName)).toBeVisible({ timeout: 10_000 })
    console.log(`[H4] reload ok`)

    page.on('dialog', (d) => d.accept())
    const row2 = page.locator('tr').filter({ hasText: fixtureName }).first()
    await row2.getByRole('button', { name: /inativar/i }).first().dispatchEvent('click')
    await expect(page.locator('tr').filter({ hasText: fixtureName }).filter({ hasText: /Inativo/i })).toHaveCount(1, { timeout: 10_000 })
    console.log(`[H4] inactivate ok`)
  })

  test('H5: Equipe CRUD full flow via dispatchEvent + fill', async ({ page }) => {
    test.setTimeout(90_000)
    await cleanupFixtureClients()
    await login(page, process.env.SPRINT0_EQUIPE_EMAIL!, process.env.SPRINT0_EQUIPE_PASSWORD!)

    const fixtureName = `STAGE TEAM PF ${Date.now()}`
    const fixtureCpf = '52998224725'

    await page.goto('https://efetivaos.pages.dev/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: /Novo cliente/i }).dispatchEvent('click')
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await page.locator('#tax_id').fill(fixtureCpf)
    await page.getByLabel(/Nome completo/i).fill(fixtureName)
    await page.getByLabel(/E-mail/i).fill('stage-team@test.com')
    await page.getByRole('button', { name: /Cadastrar cliente/i }).dispatchEvent('click')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(fixtureName)).toBeVisible({ timeout: 10_000 })
    console.log(`[H5] team create ok`)

    const row = page.locator('tr').filter({ hasText: fixtureName }).first()
    await row.getByRole('button', { name: /editar/i }).first().dispatchEvent('click')
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await page.getByLabel(/Observa/i).fill('edit via team headed smoke')
    await page.getByRole('button', { name: /Salvar altera/i }).dispatchEvent('click')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 })
    console.log(`[H5] team edit ok`)

    page.on('dialog', (d) => d.accept())
    await row.getByRole('button', { name: /inativar/i }).first().dispatchEvent('click')
    await expect(page.locator('tr').filter({ hasText: fixtureName }).filter({ hasText: /Inativo/i })).toHaveCount(1, { timeout: 10_000 })

    await row.getByRole('button', { name: /reativar/i }).first().dispatchEvent('click')
    await expect(page.locator('tr').filter({ hasText: fixtureName }).filter({ hasText: /Ativo/i })).toHaveCount(1, { timeout: 10_000 })
    console.log(`[H5] team inactivate+reactivate ok`)

    await row.getByRole('button', { name: /inativar/i }).first().dispatchEvent('click')
    await expect(page.locator('tr').filter({ hasText: fixtureName }).filter({ hasText: /Inativo/i })).toHaveCount(1, { timeout: 10_000 })
    console.log(`[H5] team cleanup ok`)
  })

  test('H6: CRM routes deep-link + invalid UUID error handling', async ({ page }) => {
    test.setTimeout(60_000)
    await login(page, process.env.SPRINT0_ADMIN_EMAIL!, process.env.SPRINT0_ADMIN_PASSWORD!)

    await page.goto('https://efetivaos.pages.dev/crm/clients/new')
    await expect(page).toHaveURL(/\/crm\/clients\/new/)
    await expect(page.getByRole('heading', { name: /Novo cliente/i })).toBeVisible({ timeout: 10_000 })

    await page.goto('https://efetivaos.pages.dev/crm/clients/00000000-0000-0000-0000-000000000000')
    await page.waitForTimeout(2_000)
    const crash = await page.evaluate(() => {
      const body = document.body.textContent ?? ''
      return /Application error|Unhandled Error|Internal Server Error/i.test(body)
    })
    expect(crash, 'Invalid UUID route must not crash with application error').toBe(false)
    console.log(`[H6] invalid uuid did not crash`)
  })
})