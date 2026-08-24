import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

import { requiredEnv } from './env'
import { readFixtureState } from './fixtures'

function requiredFixtureValue(value: string | undefined, name: string) {
  if (!value) throw new Error(`Missing price-approval fixture value: ${name}`)
  return value
}

test('Equipe consulta tabela e rastreabilidade, mas nao decide preco comercial', async ({ page }) => {
  const { priceApproval: fixture } = await readFixtureState()
  const catalogItemId = requiredFixtureValue(fixture.catalogItemId, 'catalogItemId')
  const alternativeQuotationItemId = requiredFixtureValue(fixture.alternativeQuotationItemId, 'alternativeQuotationItemId')
  const marginRuleId = requiredFixtureValue(fixture.marginRuleId, 'marginRuleId')

  await page.goto('/pricing/prices')
  const priceTable = page.getByRole('table', { name: /Tabela de Precos/i })
  const priceRow = priceTable.getByRole('row').filter({ hasText: fixture.catalogItemCode })
  await expect(priceRow).toBeVisible()
  await expect(priceRow).toContainText(fixture.alternativeSupplierName)
  await expect(priceRow).toContainText('Manual')
  await expect(priceRow).toContainText('R$ 125,00')
  await expect(priceRow).toContainText('Inativo')

  await priceRow.getByRole('button', { name: /Rastreabilidade/i }).click()
  const traceDrawer = page.getByRole('dialog', { name: new RegExp(`Decisao comercial.*${fixture.catalogItemCode}`, 'i') })
  await expect(traceDrawer).toContainText('Snapshot aprovado')
  await expect(traceDrawer).toContainText(`${fixture.alternativeSupplierName} · Manual`)
  await expect(traceDrawer).toContainText(alternativeQuotationItemId)
  await expect(traceDrawer).toContainText(marginRuleId)
  await expect(traceDrawer.getByRole('button', { name: /Aprovar/i })).toHaveCount(0)
  await expect(traceDrawer.getByRole('button', { name: /Inativar/i })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.goto('/pricing/comparison')
  const comparisonRow = page.getByRole('table', { name: /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i }).getByRole('row').filter({ hasText: fixture.catalogItemCode })
  await expect(comparisonRow.getByRole('button', { name: /Decidir/i })).toHaveCount(0)
  await comparisonRow.getByRole('button', { name: /Detalhes/i }).last().click()
  const detailsDrawer = page.getByRole('dialog', { name: new RegExp(`Decisao comercial.*${fixture.catalogItemCode}`, 'i') })
  await expect(detailsDrawer).toContainText('Somente leitura')
  await expect(detailsDrawer.getByRole('radio')).toHaveCount(0)
  await expect(detailsDrawer.getByRole('button', { name: /Aprovar|Inativar/i })).toHaveCount(0)

  const client = createClient(requiredEnv('VITE_SUPABASE_URL'), requiredEnv('VITE_SUPABASE_ANON_KEY'), {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({
    email: requiredEnv('SPRINT0_EQUIPE_EMAIL'),
    password: requiredEnv('SPRINT0_EQUIPE_PASSWORD'),
  })
  expect(signInError).toBeNull()

  const { data: comparison, error: comparisonError } = await client
    .from('pricing_comparison_v')
    .select('decision_token')
    .eq('catalog_item_id', catalogItemId)
    .single()
  expect(comparisonError).toBeNull()

  const { error: approvalError } = await client.rpc('approve_price', {
    p_catalog_item_id: catalogItemId,
    p_expected_decision_token: comparison?.decision_token,
    p_source_quotation_item_id: alternativeQuotationItemId,
  })
  expect(approvalError).not.toBeNull()
  expect(approvalError?.message).toMatch(/Apenas Admin/i)
})
