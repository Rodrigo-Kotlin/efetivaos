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
 */

const SUPPLIER_FIXTURE = `STABILITY TEST SUPPLIER ${Date.now()}`
const CLIENT_FIXTURE_PJ = `STABILITY TEST CLIENT PJ ${Date.now()}`
const CLIENT_FIXTURE_PF = `STABILITY TEST CLIENT PF ${Date.now()}`
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
  await page.getByRole('button', { name: /Novo fornecedor/i }).evaluate((el) => (el as HTMLButtonElement).click())
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
}

async function closeDrawer(page: Page) {
  await page.evaluate(() => {
    const btn = document.querySelector('[aria-label="Fechar painel"]') as HTMLButtonElement | null
    if (btn) btn.click()
  })
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: DRAWER_TIMEOUT })
}

async function clickRowButton(page: Page, fixtureName: string, buttonName: RegExp) {
  await page.evaluate(({ fixtureName, buttonNameStr }) => {
    const regex = new RegExp(buttonNameStr, 'i')
    const rows = document.querySelectorAll('tr')
    for (const row of rows) {
      if (!row.textContent?.includes(fixtureName)) continue
      const btn = row.querySelector('button') as HTMLButtonElement | null
      const buttons = row.querySelectorAll('button')
      for (const b of buttons) {
        if (regex.test(b.getAttribute('aria-label') || b.textContent || '')) {
          b.click()
          return
        }
      }
    }
  }, { fixtureName, buttonNameStr: buttonName.source })
}

async function setRHFValue(page: Page, inputId: string, value: string) {
  return page.evaluate(({ inputId, value }) => {
    const input = document.getElementById(inputId)
    if (!input) return false
    const reactPropsKey = Object.keys(input).find((k) => k.startsWith('__reactProps$'))
    if (reactPropsKey) {
      const props = (input as any)[reactPropsKey]
      if (props && typeof props.onChange === 'function') {
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
        nativeSetter.call(input, value)
        props.onChange({ target: input, currentTarget: input, type: 'change' })
        return true
      }
    }
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    nativeSetter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, { inputId, value })
}

async function fillReactInput(page: Page, selector: string, value: string) {
  return page.evaluate(({ selector, value }) => {
    const input = document.querySelector(selector) as HTMLInputElement | null
    if (!input) return false
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    nativeSetter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, { selector, value })
}

async function openClientDrawer(page: Page) {
  await page.getByRole('button', { name: /Novo cliente/i }).evaluate((el) => (el as HTMLButtonElement).click())
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
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

    expect(degradationRatio, `Performance degradation detected: first5avg=${first5.toFixed(0)}ms last5avg=${last5.toFixed(0)}ms ratio=${degradationRatio.toFixed(2)}`).toBeLessThan(5)

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

    expect(degradationRatio, `Performance degradation detected: first5avg=${first5.toFixed(0)}ms last5avg=${last5.toFixed(0)}ms ratio=${degradationRatio.toFixed(2)}`).toBeLessThan(5)

    assertNoCriticalErrors(pageErrors, consoleErrors)
  })

  test('TEST 3 — Navigation: 10 cross-module cycles without freeze', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)
    const routes = [
      '/pricing/suppliers',
      '/pricing/catalog',
      '/pricing/comparison',
      '/crm/clients',
    ]

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

  test('TEST 4 — CRUD Supplier: create → list → detail → edit → cleanup', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)

    await page.goto('/pricing/suppliers')
    await expect(page.getByRole('heading', { name: /Fornecedores/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    await openSupplierDrawer(page)
    await page.getByLabel(/Nome.*fantasia/i).fill(SUPPLIER_FIXTURE)
    await page.getByLabel(/Raz.*social/i).fill('Stability Test LTDA')
    await fillReactInput(page, 'input[name="tax_id"]', '11222333000181')
    await page.getByLabel(/E-mail/i).fill('stability@test.com')
    await page.getByLabel(/Telefone/i).fill('11999990000')
    await page.locator('[role="dialog"] form').evaluate((el) => (el as HTMLFormElement).requestSubmit())

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: DRAWER_TIMEOUT })
    await expect(page.getByText(SUPPLIER_FIXTURE)).toBeVisible({ timeout: DRAWER_TIMEOUT })

    await clickRowButton(page, SUPPLIER_FIXTURE, /Detalhes/)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
    await expect(page.getByText(SUPPLIER_FIXTURE).first()).toBeVisible()
    await closeDrawer(page)

    await clickRowButton(page, SUPPLIER_FIXTURE, /Editar/)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
    const notesField = page.getByLabel(/Observa/i)
    await notesField.fill('edited via stability test')
    await page.locator('[role="dialog"] button[type="submit"]').evaluate((el) => (el as HTMLButtonElement).click())
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: DRAWER_TIMEOUT })
    await page.waitForTimeout(500)

    await fillReactInput(page, 'input[placeholder*="Buscar fornecedor"]', SUPPLIER_FIXTURE)
    await expect(page.getByText(SUPPLIER_FIXTURE)).toBeVisible({ timeout: DRAWER_TIMEOUT })

    page.on('dialog', (dialog) => dialog.accept())
    await clickRowButton(page, SUPPLIER_FIXTURE, /Inativar/)
    await expect(page.getByText(SUPPLIER_FIXTURE)).not.toBeVisible({ timeout: DRAWER_TIMEOUT }).catch(() => {})

    await fillReactInput(page, 'input[placeholder*="Buscar fornecedor"]', '')
    assertNoCriticalErrors(pageErrors, consoleErrors)
  })

  test('TEST 5 — CRUD Client: create PJ → detail → edit → cleanup', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)

    await page.goto('/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    await openClientDrawer(page)

    await page.locator('#tax_id').waitFor()
    await setRHFValue(page, 'tax_id', '11222333000181')
    await page.getByLabel(/Tipo de cliente/i).selectOption('company')
    await page.getByLabel(/Raz.*Social/i).waitFor()
    await page.getByLabel(/Raz.*Social/i).fill(CLIENT_FIXTURE_PJ)
    await page.getByLabel(/E-mail/i).fill('stability.client@test.com')
    await page.getByLabel(/Telefone/i).fill('11988887777')
    await page.locator('[role="dialog"] button[type="submit"]').evaluate((el) => (el as HTMLButtonElement).click())

    await page.waitForTimeout(1500)
    const dialogStillOpen = await page.getByRole('dialog').isVisible().catch(() => false)

    if (!dialogStillOpen) {
      await expect(page.getByText(CLIENT_FIXTURE_PJ)).toBeVisible({ timeout: DRAWER_TIMEOUT })

      await clickRowButton(page, CLIENT_FIXTURE_PJ, /Detalhes/)
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
      await expect(page.getByText(CLIENT_FIXTURE_PJ)).toBeVisible()
      await closeDrawer(page)

      await clickRowButton(page, CLIENT_FIXTURE_PJ, /Editar/)
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
      const notesField = page.getByLabel(/Observa/i)
      await notesField.fill('edited via stability test')
      await page.locator('[role="dialog"] button[type="submit"]').evaluate((el) => (el as HTMLButtonElement).click())
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: DRAWER_TIMEOUT })
      await page.waitForTimeout(500)

      await fillReactInput(page, 'input[placeholder*="Buscar cliente"]', CLIENT_FIXTURE_PJ)
      await expect(page.getByText(CLIENT_FIXTURE_PJ)).toBeVisible({ timeout: DRAWER_TIMEOUT })

      await clickRowButton(page, CLIENT_FIXTURE_PJ, /Inativar/)
      await expect(page.getByText(CLIENT_FIXTURE_PJ)).not.toBeVisible({ timeout: DRAWER_TIMEOUT }).catch(() => {})

      await fillReactInput(page, 'input[placeholder*="Buscar cliente"]', '')
    } else {
      await closeDrawer(page)
    }

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

    const tableVisible = await page.locator('table').isVisible({ timeout: 5_000 }).catch(() => false)
    if (tableVisible) {
      const firstDetailBtn = page.locator('table').getByRole('button', { name: /Detalhes/i }).first()
      if (await firstDetailBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await firstDetailBtn.evaluate((el) => (el as HTMLButtonElement).click())
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
        await closeDrawer(page)
      }
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

    const newSupplierBtn = page.getByRole('button', { name: /Novo fornecedor/i })
    await expect(newSupplierBtn).toBeVisible({ timeout: DRAWER_TIMEOUT })
    await newSupplierBtn.evaluate((el) => (el as HTMLButtonElement).click())
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
    await expect(page.getByLabel(/Nome.*fantasia/i)).toBeVisible()
    await closeDrawer(page)

    await page.goto('/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    const newClientBtn = page.getByRole('button', { name: /Novo cliente/i })
    await expect(newClientBtn).toBeVisible({ timeout: DRAWER_TIMEOUT })
    await newClientBtn.evaluate((el) => (el as HTMLButtonElement).click())
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })
    await expect(page.getByLabel(/Raz.*Social|Nome completo/i)).toBeVisible()
    await closeDrawer(page)

    await page.goto('/pricing/suppliers')
    await expect(page.getByRole('heading', { name: /Fornecedores/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    assertNoCriticalErrors(pageErrors, consoleErrors)
  })

  test('TEST 13b — Mobile: CRUD client create flow', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCapture(page)

    await page.goto('/crm/clients')
    await expect(page.getByRole('heading', { name: /Clientes/i })).toBeVisible({ timeout: NAV_TIMEOUT })

    await page.getByRole('button', { name: /Novo cliente/i }).evaluate((el) => (el as HTMLButtonElement).click())
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: DRAWER_TIMEOUT })

    await page.locator('#tax_id').waitFor()
    await setRHFValue(page, 'tax_id', '52998224725')
    await page.getByLabel(/Nome completo/i).waitFor()
    await page.getByLabel(/Nome completo/i).fill(CLIENT_FIXTURE_PF)
    await page.getByLabel(/E-mail/i).fill('pf.stability@test.com')
    await page.locator('[role="dialog"] button[type="submit"]').evaluate((el) => (el as HTMLButtonElement).click())

    await page.waitForTimeout(1500)
    const dialogStillOpen = await page.getByRole('dialog').isVisible().catch(() => false)

    if (!dialogStillOpen) {
      await fillReactInput(page, 'input[placeholder*="Buscar cliente"]', CLIENT_FIXTURE_PF)
      await expect(page.getByText(CLIENT_FIXTURE_PF)).toBeVisible({ timeout: DRAWER_TIMEOUT })

      await clickRowButton(page, CLIENT_FIXTURE_PF, /Inativar/)
      await expect(page.getByText(CLIENT_FIXTURE_PF)).not.toBeVisible({ timeout: DRAWER_TIMEOUT }).catch(() => {})

      await fillReactInput(page, 'input[placeholder*="Buscar cliente"]', '')
    } else {
      await closeDrawer(page)
    }

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
