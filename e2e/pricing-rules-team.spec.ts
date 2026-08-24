import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

import { requiredEnv } from './env'
import { readFixtureState } from './fixtures'

test('Equipe visualiza o calculo e nao pode gerenciar regras', async ({ page }) => {
  const fixture = await readFixtureState()

  await page.goto('/pricing/comparison')
  const table = page.getByRole('table', { name: /Compara(?:ç|c)(?:ã|a)o de pre(?:ç|c)os/i })
  const itemRow = table.getByRole('row').filter({ hasText: fixture.catalogItemCode })
  await expect(itemRow).toContainText('R$ 130,00')
  await expect(itemRow).toContainText('30%')
  await expect(itemRow).toContainText(`Categoria — ${fixture.categoryName}`)

  await page.goto('/pricing/rules')
  await expect(page.getByText('Acesso restrito', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Nova regra/i })).toHaveCount(0)

  const client = createClient(requiredEnv('VITE_SUPABASE_URL'), requiredEnv('VITE_SUPABASE_ANON_KEY'), {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({
    email: requiredEnv('SPRINT0_EQUIPE_EMAIL'),
    password: requiredEnv('SPRINT0_EQUIPE_PASSWORD'),
  })
  expect(signInError).toBeNull()

  const { error: mutationError } = await client.from('margin_rules').insert({
    scope_type: 'category',
    category_id: fixture.categoryId,
    catalog_item_id: null,
    calculation_type: 'percentage',
    value: '99.0000',
    active: true,
    notes: `${fixture.prefix}_FORBIDDEN_TEAM_RULE`,
  })
  expect(mutationError?.code).toBe('42501')
})
