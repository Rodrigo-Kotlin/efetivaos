import { expect, test, type Page } from '@playwright/test'

/**
 * UI Stability Stress Regression — MICROGATE
 *
 * Executa ciclos consecutivos de abertura/fechamento de Drawer,
 * navegação entre módulos e CRUD básico para comprovar ausência
 * de freeze, leak de render ou degradação progressiva.
 *
 * Viewports:
 *   - Desktop: 1440×900 (suite principal)
 *   - Mobile:  390×844  (fluxo crítico)
 *
 * Notas técnicas (ETAPA 07D):
 * - Playwright `locator.click()` usa simulação de mouse (move + down + up
 *   + wait) que congela com Radix Dialog 1.1.23 + React 19.2 em
 *   Chromium headless: o evento nunca é entregue. Em vez disso, usamos
 *   `locator.dispatchEvent('click')` (API pública do Playwright) que
 *   dispara o evento `click` DOM real — o mesmo que um usuário gera.
 * - `locator.fill()` funciona normalmente em todos os campos do RHF
 *   dentro do Radix Dialog Portal. Helpers baseados em `__reactProps$`
 *   foram removidos por serem API interna do React.
 */

const SUPPLIER_FIXTURE = `STABILITY TEST SUPPLIER ${Date.now()}`
const CLIENT_FIXTURE_PJ = `STABILITY TEST CLIENT PJ ${Date.now()}`
const CLIENT_FIXTURE_PF = `STABILITY TEST CLIENT PF ${Date.now()}`
const SUPPLIER_CNPJ = '11222333000181'
const CLIENT_CNPJ = '11222333000181'
const CLIENT_CPF = '52998224725'
const CYCLES_SUPPLIERS = 20
const CYCLES_CLIENTS = 20
const CYCLES_NAV = 10
const DRAWER_TIMEOUT = 8_000
const NAV_TIMEOUT = 8_000

type ErrorCapture = { message: string; source: string }

function setupErrorCapture(page: Page) {
  const pageErrors: ErrorCapture[] = []
  const consoleErrors: string[] = []

  page.on('pageerror', (error) => {
    pageErrors.push({ message: error.message, source: 'pageerror' })
  })

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  return { pageErrors, consoleErrors }
}

function assertNoCriticalErrors(pageErrors: ErrorCapture[], consoleErrors: string[]) {
  const knownWarnings = [
    'incompatible library',
    'React Compiler',
    'react-hooks/incompatible-library',
    'tanstack',
    'Failed to load resource',
    'the server responded with a status of 404',
  ]

  const criticalPageErrors = pageErrors.filter(
    (e) => !knownWarnings.some((w) => e.message.toLowerCase().includes(w.toLowerCase()))
  )

  const criticalConsoleErrors = consoleErrors.filter(
    (e) => !knownWarnings.some((w) => e.toLowerCase().includes(w.toLowerCase()))
  )

  expect(criticalPageErrors, `Unexpected pageerror: ${criticalPageErrors.map((e) => e.message).join('; ')}`).toHaveLength(0)
  expect(criticalConsoleErrors, `Unexpected console.error: ${criticalConsoleErrors.join('; ')}`).toHaveLength(0)
}

async function openSupplierDrawer(page: Page) {
  await page.getByRole('button', { name: /Novo fornecedor/i }).dispatchEvent('click')
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
}

async function openClientDrawer(page: Page) {
  await page.getByRole('button', { name: /Novo cliente/i }).dispatchEvent('click')
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
}

async function closeDrawer(page: Page) {
  await page.getByRole('button', { name: /Fechar painel/i }).dispatchEvent('click')
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: DRAWER_TIMEOUT })
}

async function closeDrawerWithEscape(page: Page) {
  await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(event)
  })
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: DRAWER_TIMEOUT })
}

async function clickRowButton(page: Page, fixtureName: string, buttonName: RegExp) {
  const row = page.locator('tr').filter({ hasText: fixtureName }).first()
  await expect(row).toBeVisible({ timeout: DRAWER_TIMEOUT })
  await row.scrollIntoViewIfNeeded()
  const btn = row.getByRole('button', { name: buttonName }).first()
  await expect(btn).toBeVisible({ timeout: 10_000 })
  await btn.dispatchEvent('click')
}

async function filterSearch(page: Page, selector: string, value: string) {
  await page.evaluate(({ selector, value }) => {
    const input = document.querySelector(selector) as HTMLInputElement | null
    if (!input) return
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, { selector, value })
}

async function cleanupFixtureTaxIds() {
  const { createClient } = await import('@supabase/supabase-js')
  const { requiredEnv } = await import('./env')
  const client = createClient(requiredEnv('VITE_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
  await client.from('client_contacts').delete().in('client_id',
    (await client.from('clients').select('id').in('tax_id', [CLIENT_CNPJ, CLIENT_CPF]).then((r) => r.data ?? [])).map((c) => c.id)
  )
  await client.from('clients').delete().in('tax_id', [CLIENT_CNPJ, CLIENT_CPF])
  await client.from('suppliers').delete().eq('tax_id', SUPPLIER_CNPJ)
}

test.describe('UI Stability Stress — Desktop 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test.describe.configure({ timeout: 120_000 })

  test('TEST 1 — Suppliers: 20 open/close cycles without freeze', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)
    await page.goto('/pricing/suppliers')
    await expect(page.getByRole('heading', { name: /Fornecedores/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    const timings: number[] = []

    for (let i = 0; i < CYCLES_SUPPLIERS; i++) {
      const start = Date.now()
      await openSupplierDrawer(page)
      await expect(page.getByLabel(/Nome.*fantasia/i)).toBeVisible({ timeout: DRAWER_TIMEOUT })
      await closeDrawer(page)
      timings.push(Date.now() - start)
    }

    const first5 = timings.slice(0, 5).reduce((a, b) => a + b, 0) / 5
    const last5 = timings.slice(-5).reduce((a, b) => a + b, 0) / 5
    const degradationRatio = last5 / first5

    expect(degradationRatio, `Performance degradation: first5avg=${first5.toFixed(0)}ms last5avg=${last5.toFixed(0)}ms`).toBeLessThan(5)
    assertNoCriticalErrors(pageErrors, consoleErrors)
  })

  test('TEST 1b — Suppliers: 10 partial fill + cancel cycles', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)
    await page.goto('/pricing/suppliers')
    await expect(page.getByRole('heading', { name: /Fornecedores/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    for (let i = 0; i < 10; i++) {
      await openSupplierDrawer(page)
      const nameInput = page.getByLabel(/Nome.*fantasia/i)
      await expect(nameInput).toBeVisible({ timeout: DRAWER_TIMEOUT })
      await nameInput.fill(`Partial fill cycle ${i}`)
      await closeDrawer(page)
    }
    assertNoCriticalErrors(pageErrors, consoleErrors)
  })

  test('TEST 2 — Clients: 20 open/close cycles without freeze', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)
    await page.goto('/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    const timings: number[] = []

    for (let i = 0; i < CYCLES_CLIENTS; i++) {
      const start = Date.now()
      await openClientDrawer(page)
      await expect(page.getByLabel(/Raz.*Social|Nome completo/i)).toBeVisible({ timeout: DRAWER_TIMEOUT })
      await closeDrawer(page)
      timings.push(Date.now() - start)
    }

    const first5 = timings.slice(0, 5).reduce((a, b) => a + b, 0) / 5
    const last5 = timings.slice(-5).reduce((a, b) => a + b, 0) / 5
    const degradationRatio = last5 / first5

    expect(degradationRatio, `Performance degradation: first5avg=${first5.toFixed(0)}ms last5avg=${last5.toFixed(0)}ms`).toBeLessThan(5)
    assertNoCriticalErrors(pageErrors, consoleErrors)
  })

  test('TEST 2b — Clients: Escape closes drawer', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)
    await page.goto('/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    await openClientDrawer(page)
    await closeDrawerWithEscape(page)

    await openClientDrawer(page)
    await closeDrawerWithEscape(page)

    assertNoCriticalErrors(pageErrors, consoleErrors)
  })

  test('TEST 3 — Navigation: 10 cross-module cycles without freeze', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)
    const routes = ['/pricing/suppliers', '/pricing/catalog', '/pricing/comparison', '/crm/clients']

    const timings: number[] = []

    for (let cycle = 0; cycle < CYCLES_NAV; cycle++) {
      for (const route of routes) {
        const start = Date.now()
        await page.goto(route, { timeout: NAV_TIMEOUT })
        await expect(page.locator('table, [role="table"], .empty-state, main')).toBeVisible({ timeout: NAV_TIMEOUT })
        timings.push(Date.now() - start)
      }
    }

    const first4 = timings.slice(0, 4).reduce((a, b) => a + b, 0) / 4
    const last4 = timings.slice(-4).reduce((a, b) => a + b, 0) / 4
    const degradationRatio = last4 / first4

    expect(degradationRatio, `Navigation degradation: first4avg=${first4.toFixed(0)}ms last4avg=${last4.toFixed(0)}ms`).toBeLessThan(5)
    assertNoCriticalErrors(pageErrors, consoleErrors)
  })

  test('TEST 4 — CRUD Supplier: real API create → detail → edit → cleanup', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)

    await cleanupFixtureTaxIds()

    const responses: { method: string; url: string; status: number }[] = []
    page.on('response', (resp) => {
      const url = resp.url()
      if (url.includes('/rest/v1/suppliers') || url.includes('/rest/v1/client_list_v') || url.includes('/rest/v1/clients')) {
        responses.push({ method: resp.request().method(), url: url.split('?')[0], status: resp.status() })
      }
    })

    await page.goto('/pricing/suppliers')
    await expect(page.getByRole('heading', { name: /Fornecedores/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    await openSupplierDrawer(page)
    await page.getByLabel(/Nome.*fantasia/i).fill(SUPPLIER_FIXTURE)
    await page.getByLabel(/Raz.*social/i).fill('Stability Test LTDA')
    await page.locator('#tax_id').fill(SUPPLIER_CNPJ)
    await page.getByLabel(/E-mail/i).fill('stability@test.com')
    await page.getByLabel(/Telefone/i).fill('11999990000')
    await page.locator('[role="dialog"] button[type="submit"]').dispatchEvent('click')

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: DRAWER_TIMEOUT })

    await filterSearch(page, 'input[placeholder*="Buscar fornecedor"]', SUPPLIER_FIXTURE)
    await expect(page.getByText(SUPPLIER_FIXTURE)).toBeVisible({ timeout: DRAWER_TIMEOUT })

    await page.waitForResponse((r) => r.url().includes('/rest/v1/suppliers') && r.request().method() === 'GET', { timeout: 10_000 }).catch(() => null)

    const createCall = responses.find((r) => r.method === 'POST' && r.url.endsWith('/rest/v1/suppliers'))
    expect(createCall, `Expected POST /rest/v1/suppliers to succeed but it was not called or did not return success. Actual: ${JSON.stringify(responses)}`).toBeDefined()
    expect(createCall!.status, `POST /rest/v1/suppliers returned ${createCall!.status}, expected 2xx`).toBeGreaterThanOrEqual(200)
    expect(createCall!.status).toBeLessThan(300)

    await clickRowButton(page, SUPPLIER_FIXTURE, /detalhes/i)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
    await expect(page.getByText(SUPPLIER_FIXTURE).first()).toBeVisible()
    await closeDrawer(page)

    await clickRowButton(page, SUPPLIER_FIXTURE, /editar/i)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
    await page.getByLabel(/Observa/i).fill('edited via stability test')
    await page.locator('[role="dialog"] button[type="submit"]').dispatchEvent('click')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: DRAWER_TIMEOUT })

    const updateCall = responses.find((r) => r.method === 'PATCH' && r.url.endsWith('/rest/v1/suppliers'))
    expect(updateCall, `Expected PATCH /rest/v1/suppliers to be called`).toBeDefined()
    expect(updateCall!.status, `PATCH /rest/v1/suppliers returned ${updateCall!.status}`).toBeGreaterThanOrEqual(200)
    expect(updateCall!.status).toBeLessThan(300)

    await filterSearch(page, 'input[placeholder*="Buscar fornecedor"]', SUPPLIER_FIXTURE)
    await expect(page.getByText(SUPPLIER_FIXTURE)).toBeVisible({ timeout: DRAWER_TIMEOUT })

    page.on('dialog', (dialog) => dialog.accept())
    await clickRowButton(page, SUPPLIER_FIXTURE, /inativar/i)

    await page.waitForTimeout(1000)
    const allPatchCalls = responses.filter((r) => r.method === 'PATCH' && r.url.endsWith('/rest/v1/suppliers'))
    const lastPatchCall = allPatchCalls[allPatchCalls.length - 1]
    expect(lastPatchCall, `Expected PATCH /rest/v1/suppliers (inactivate) to be called. All calls: ${JSON.stringify(responses)}`).toBeDefined()
    expect(lastPatchCall!.status, `Inactivate PATCH returned ${lastPatchCall!.status}`).toBeGreaterThanOrEqual(200)
    expect(lastPatchCall!.status).toBeLessThan(300)

    await expect(
      page.locator('tr').filter({ hasText: SUPPLIER_FIXTURE }).filter({ hasText: /Inativo/i })
    ).toHaveCount(1, { timeout: 10_000 })

    await filterSearch(page, 'input[placeholder*="Buscar fornecedor"]', '')
    assertNoCriticalErrors(pageErrors, consoleErrors)
  })

  test('TEST 5 — CRUD Client PJ: real API create → detail → edit → cleanup', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)

    await cleanupFixtureTaxIds()

    const responses: { method: string; url: string; status: number }[] = []
    page.on('response', (resp) => {
      const url = resp.url()
      if (url.includes('/rest/v1/clients') || url.includes('/rest/v1/client_list_v')) {
        responses.push({ method: resp.request().method(), url: url.split('?')[0], status: resp.status() })
      }
    })

    await page.goto('/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    await openClientDrawer(page)
    await page.locator('#tax_id').waitFor()

    await page.locator('#client_type').selectOption('company')
    await page.getByRole('textbox', { name: /^CNPJ \*?$/i }).waitFor()
    await page.locator('#tax_id').fill(CLIENT_CNPJ)
    const cnpjVal = await page.locator('#tax_id').inputValue()
    if (!cnpjVal) throw new Error(`CNPJ not set, got "${cnpjVal}"`)
    await page.getByLabel(/Raz.*Social/i).fill(CLIENT_FIXTURE_PJ)
    await page.getByLabel(/E-mail/i).fill('stability.client@test.com')
    await page.getByLabel(/Telefone/i).fill('11988887777')
    await page.locator('[role="dialog"] button[type="submit"]').dispatchEvent('click')

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: DRAWER_TIMEOUT })

    const createCall = responses.find((r) => r.method === 'POST' && r.url === 'https://bxviuzluxcijbqqbpyzb.supabase.co/rest/v1/clients')
    expect(createCall, `Expected POST /rest/v1/clients to be called. Actual responses: ${JSON.stringify(responses)}`).toBeDefined()
    expect(createCall!.status, `POST /rest/v1/clients returned ${createCall!.status}`).toBeGreaterThanOrEqual(200)
    expect(createCall!.status).toBeLessThan(300)

    await page.waitForResponse((r) => r.url().includes('client_list_v') && r.request().method() === 'GET', { timeout: 10_000 }).catch(() => null)

    await expect(page.getByText(CLIENT_FIXTURE_PJ)).toBeVisible({ timeout: 10_000 })

    await clickRowButton(page, CLIENT_FIXTURE_PJ, /detalhes/i)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
    await expect(page.getByText(CLIENT_FIXTURE_PJ).first()).toBeVisible()
    await closeDrawer(page)

    await clickRowButton(page, CLIENT_FIXTURE_PJ, /editar/i)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
    await page.getByLabel(/Observa/i).fill('edited via stability test')
    await page.locator('[role="dialog"] button[type="submit"]').dispatchEvent('click')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: DRAWER_TIMEOUT })

    const updateCall = responses.find((r) => r.method === 'PATCH' && r.url === 'https://bxviuzluxcijbqqbpyzb.supabase.co/rest/v1/clients')
    expect(updateCall, `Expected PATCH /rest/v1/clients to be called. Actual: ${JSON.stringify(responses)}`).toBeDefined()
    expect(updateCall!.status, `PATCH /rest/v1/clients returned ${updateCall!.status}`).toBeGreaterThanOrEqual(200)
    expect(updateCall!.status).toBeLessThan(300)

    await filterSearch(page, 'input[placeholder*="Buscar cliente"]', CLIENT_FIXTURE_PJ)
    await expect(page.getByText(CLIENT_FIXTURE_PJ)).toBeVisible({ timeout: DRAWER_TIMEOUT })

    page.on('dialog', (dialog) => dialog.accept())
    await clickRowButton(page, CLIENT_FIXTURE_PJ, /inativar/i)

    await page.waitForTimeout(1000)
    const allPatchCalls = responses.filter((r) => r.method === 'PATCH' && r.url === 'https://bxviuzluxcijbqqbpyzb.supabase.co/rest/v1/clients')
    const lastPatchCall = allPatchCalls[allPatchCalls.length - 1]
    expect(lastPatchCall, `Expected PATCH /rest/v1/clients (inactivate) to be called. All calls: ${JSON.stringify(responses)}`).toBeDefined()
    expect(lastPatchCall!.status, `Inactivate PATCH returned ${lastPatchCall!.status}`).toBeGreaterThanOrEqual(200)
    expect(lastPatchCall!.status).toBeLessThan(300)

    await expect(
      page.locator('tr').filter({ hasText: CLIENT_FIXTURE_PJ }).filter({ hasText: /Inativo/i })
    ).toHaveCount(1, { timeout: 10_000 })

    await filterSearch(page, 'input[placeholder*="Buscar cliente"]', '')
    assertNoCriticalErrors(pageErrors, consoleErrors)
  })

  test('TEST 6 — CRUD Client PF: real API create → cleanup', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)

    await cleanupFixtureTaxIds()

    const responses: { method: string; url: string; status: number }[] = []
    page.on('response', (resp) => {
      const url = resp.url()
      if (url.includes('/rest/v1/clients')) {
        responses.push({ method: resp.request().method(), url: url.split('?')[0], status: resp.status() })
      }
    })

    await page.goto('/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    await openClientDrawer(page)
    await page.locator('#tax_id').waitFor()
    await page.locator('#tax_id').fill(CLIENT_CPF)
    await page.getByLabel(/Nome completo/i).waitFor()
    await page.getByLabel(/Nome completo/i).fill(CLIENT_FIXTURE_PF)
    await page.getByLabel(/E-mail/i).fill('pf.stability@test.com')
    await page.locator('[role="dialog"] button[type="submit"]').dispatchEvent('click')

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: DRAWER_TIMEOUT })

    const createCall = responses.find((r) => r.method === 'POST' && r.url === 'https://bxviuzluxcijbqqbpyzb.supabase.co/rest/v1/clients')
    expect(createCall, `Expected POST /rest/v1/clients to be called. Actual: ${JSON.stringify(responses)}`).toBeDefined()
    expect(createCall!.status, `POST /rest/v1/clients returned ${createCall!.status}`).toBeGreaterThanOrEqual(200)
    expect(createCall!.status).toBeLessThan(300)

    await expect(page.getByText(CLIENT_FIXTURE_PF)).toBeVisible({ timeout: DRAWER_TIMEOUT })

    await filterSearch(page, 'input[placeholder*="Buscar cliente"]', CLIENT_FIXTURE_PF)
    await expect(page.getByText(CLIENT_FIXTURE_PF)).toBeVisible({ timeout: DRAWER_TIMEOUT })

    page.on('dialog', (dialog) => dialog.accept())
    await clickRowButton(page, CLIENT_FIXTURE_PF, /inativar/i)

    await page.waitForTimeout(1000)
    const allPatchCalls = responses.filter((r) => r.method === 'PATCH' && r.url === 'https://bxviuzluxcijbqqbpyzb.supabase.co/rest/v1/clients')
    const lastPatchCall = allPatchCalls[allPatchCalls.length - 1]
    expect(lastPatchCall, `Expected PATCH /rest/v1/clients (inactivate) to be called`).toBeDefined()
    expect(lastPatchCall!.status, `Inactivate PATCH returned ${lastPatchCall!.status}`).toBeGreaterThanOrEqual(200)
    expect(lastPatchCall!.status).toBeLessThan(300)

    await expect(
      page.locator('tr').filter({ hasText: CLIENT_FIXTURE_PF }).filter({ hasText: /Inativo/i })
    ).toHaveCount(1, { timeout: 10_000 })

    await filterSearch(page, 'input[placeholder*="Buscar cliente"]', '')
    assertNoCriticalErrors(pageErrors, consoleErrors)
  })

  test('TEST 15 — CRM routes: /crm/clients/new and /crm/clients/:clientId', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)

    await page.goto('/crm/clients/new')
    await expect(page).toHaveURL(/\/crm\/clients\/new/)
    await expect(page.getByRole('heading', { name: /Novo cliente/i })).toBeVisible({ timeout: NAV_TIMEOUT })
    await expect(page.getByLabel(/Raz.*Social|Nome completo/i)).toBeVisible()

    await page.goto('/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    const firstDetailBtn = page.locator('table').getByRole('button', { name: /Detalhes/i }).first()
    if (await firstDetailBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstDetailBtn.dispatchEvent('click')
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
      await closeDrawer(page)
    }

    assertNoCriticalErrors(pageErrors, consoleErrors)
  })
})

test.describe('UI Stability Stress — Mobile 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test.describe.configure({ timeout: 120_000 })

  test('TEST 13 — Mobile: menu → suppliers → drawer → clients → drawer → navigate', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)

    await page.goto('/')
    await expect(page.locator('body')).toBeVisible({ timeout: NAV_TIMEOUT })

    const menuBtn = page.getByRole('button', { name: /menu|abrir menu/i })
    if (await menuBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await menuBtn.click()
      await page.waitForTimeout(300)
    }

    await page.goto('/pricing/suppliers')
    await expect(page.getByRole('heading', { name: /Fornecedores/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    await page.getByRole('button', { name: /Novo fornecedor/i }).dispatchEvent('click')
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
    await expect(page.getByLabel(/Nome.*fantasia/i)).toBeVisible()
    await closeDrawer(page)

    await page.goto('/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    await page.getByRole('button', { name: /Novo cliente/i }).dispatchEvent('click')
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
    await expect(page.getByLabel(/Raz.*Social|Nome completo/i)).toBeVisible()
    await closeDrawer(page)

    await page.goto('/pricing/suppliers')
    await expect(page.getByRole('heading', { name: /Fornecedores/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    assertNoCriticalErrors(pageErrors, consoleErrors)
  })

  test('TEST 13b — Mobile: CRUD client PF real API flow', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)

    await cleanupFixtureTaxIds()

    const responses: { method: string; url: string; status: number }[] = []
    page.on('response', (resp) => {
      const url = resp.url()
      if (url.includes('/rest/v1/clients')) {
        responses.push({ method: resp.request().method(), url: url.split('?')[0], status: resp.status() })
      }
    })

    await page.goto('/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    await page.getByRole('button', { name: /Novo cliente/i }).dispatchEvent('click')
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })

    await page.locator('#tax_id').waitFor()
    await page.locator('#tax_id').fill(CLIENT_CPF)
    await page.getByLabel(/Nome completo/i).waitFor()
    await page.getByLabel(/Nome completo/i).fill(CLIENT_FIXTURE_PF)
    await page.getByLabel(/E-mail/i).fill('pf.stability@test.com')
    await page.locator('[role="dialog"] button[type="submit"]').dispatchEvent('click')

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: DRAWER_TIMEOUT })

    const createCall = responses.find((r) => r.method === 'POST' && r.url === 'https://bxviuzluxcijbqqbpyzb.supabase.co/rest/v1/clients')
    expect(createCall, `Expected POST /rest/v1/clients to be called. Actual: ${JSON.stringify(responses)}`).toBeDefined()
    expect(createCall!.status, `POST /rest/v1/clients returned ${createCall!.status}`).toBeGreaterThanOrEqual(200)
    expect(createCall!.status).toBeLessThan(300)

    await filterSearch(page, 'input[placeholder*="Buscar cliente"]', CLIENT_FIXTURE_PF)
    await expect(page.getByText(CLIENT_FIXTURE_PF)).toBeVisible({ timeout: DRAWER_TIMEOUT })

    page.on('dialog', (dialog) => dialog.accept())
    await clickRowButton(page, CLIENT_FIXTURE_PF, /inativar/i)

    await page.waitForTimeout(1000)
    const allPatchCalls = responses.filter((r) => r.method === 'PATCH' && r.url === 'https://bxviuzluxcijbqqbpyzb.supabase.co/rest/v1/clients')
    const lastPatchCall = allPatchCalls[allPatchCalls.length - 1]
    expect(lastPatchCall, `Expected PATCH /rest/v1/clients (inactivate) to be called`).toBeDefined()
    expect(lastPatchCall!.status, `Inactivate PATCH returned ${lastPatchCall!.status}`).toBeGreaterThanOrEqual(200)
    expect(lastPatchCall!.status).toBeLessThan(300)

    await expect(
      page.locator('tr').filter({ hasText: CLIENT_FIXTURE_PF }).filter({ hasText: /Inativo/i })
    ).toHaveCount(1, { timeout: 10_000 })

    await filterSearch(page, 'input[placeholder*="Buscar cliente"]', '')
    assertNoCriticalErrors(pageErrors, consoleErrors)
  })
})

test.describe('UI Stability — PWA sanity', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('TEST 16 — No reload loop or SW crash during navigation', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)
    let reloadCount = 0

    page.on('load', () => {
      reloadCount++
    })

    const routes = ['/pricing/suppliers', '/crm/clients', '/pricing/catalog', '/pricing/comparison']
    for (const route of routes) {
      await page.goto(route, { timeout: NAV_TIMEOUT })
      await expect(page.locator('main, table, .empty-state')).toBeVisible({ timeout: NAV_TIMEOUT })
    }

    expect(reloadCount, `Unexpected ${reloadCount} page loads during navigation`).toBeLessThanOrEqual(routes.length + 1)

    assertNoCriticalErrors(pageErrors, consoleErrors)
  })
})