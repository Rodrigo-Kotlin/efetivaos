import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

import { assertRemoteMutationAllowed, requiredEnv } from './env'

assertRemoteMutationAllowed()

test('exibe historico de precos proprios e reajustes pela interface', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const marker = `E2E_3C_${testInfo.project.name.toUpperCase()}_${Date.now()}_${randomUUID().slice(0, 8)}`
  const isTeam = testInfo.project.name === 'team-chromium'
  const service = createClient(requiredEnv('VITE_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
  const category = await service.from('catalog_categories').insert({ name: `${marker}_CATEGORY`, active: true }).select('id').single()
  expect(category.error).toBeNull()
  const item = await service
    .from('catalog_items')
    .insert({
      name: `${marker}_ITEM`,
      category_id: category.data!.id,
      unit: 'servico',
      sourcing_type: 'own',
      active: true,
    })
    .select('id, code')
    .single()
  expect(item.error).toBeNull()
  const itemCode = item.data!.code

  const proposalReads: unknown[] = []
  page.on('response', async (response) => {
    if (new URL(response.url()).pathname === '/rest/v1/rpc/get_own_price_proposals' && response.ok()) {
      proposalReads.push(await response.json())
    }
  })
  page.on('dialog', (dialog) => dialog.accept())

  try {
    await test.step('cria e aprova preco proprio (proposta, aprovacao, reajuste, aprovacao)', async () => {
      await page.goto('/pricing/own-prices')
      const firstDialog = page.getByRole('dialog', { name: 'Definir preco proprio' })
      await page.getByRole('button', { name: 'Definir preco proprio', exact: true }).click()
      await firstDialog.getByLabel('Servico (do Catalogo) *').selectOption(item.data!.id)
      await firstDialog.getByLabel('Preco de venda *').fill('100,00')
      if (!isTeam) {
        await firstDialog.getByLabel(/Custo interno/).fill('60,00')
      }
      await firstDialog.getByLabel(/Observacoes/).fill(`${marker}_P1`)
      await firstDialog.getByRole('button', { name: 'Enviar proposta' }).click()
      await expect(page.getByText('Proposta enviada para aprovação.')).toBeVisible()

      if (!isTeam) {
        const table = page.getByRole('table', { name: 'Precos Proprios' })
        const row = table.getByRole('row').filter({ hasText: `${marker}_ITEM` })
        await row.getByRole('button', { name: /Decidir proposta de/i }).click()
        const decision = page.getByRole('dialog', { name: 'Decidir proposta de preco proprio' })
        await decision.getByRole('button', { name: 'Aprovar preco' }).click()
        await expect(decision).not.toBeVisible({ timeout: 5_000 })
        await expect(page.getByText('Preco proprio aprovado.')).toBeVisible()

        await page.getByRole('button', { name: new RegExp(`Propor reajuste para ${marker}_ITEM`) }).click()
        const reajuste = page.getByRole('dialog', { name: 'Propor reajuste do preco proprio' })
        await reajuste.getByLabel('Novo preco de venda *').fill('120,00')
        await reajuste.getByLabel(/Justificativa do reajuste/).fill('Reajuste anual de mercado')
        await reajuste.getByRole('button', { name: 'Enviar reajuste' }).click()
        await expect(page.getByText('Reajuste enviado para aprovação.')).toBeVisible()

        await page.getByRole('button', { name: new RegExp(`Decidir proposta de ${marker}_ITEM`) }).click()
        const secondDecision = page.getByRole('dialog', { name: 'Decidir proposta de preco proprio' })
        await secondDecision.getByRole('button', { name: 'Aprovar preco' }).click()
        await expect(secondDecision).not.toBeVisible({ timeout: 5_000 })
        await expect(page.getByText('Preco proprio aprovado.').last()).toBeVisible()
      }
    })

    if (!isTeam) {
      await test.step('verifica historico em Precos Proprios e responsividade', async () => {
        await page.goto('/pricing/own-prices')
        const history = page.getByRole('dialog', { name: /Historico de precos/i })
        await page.getByRole('button', { name: new RegExp(`Ver historico de ${marker}_ITEM`) }).click()
        await expect(history).toBeVisible()
        await expect(history.getByLabel('Propostas em ordem cronologica decrescente').getByRole('article').nth(0)).toContainText('R$ 120,00')
        await expect(history.getByLabel('Propostas em ordem cronologica decrescente').getByRole('article').nth(1)).toContainText('R$ 100,00')
        await expect(history.getByText('Preco vigente')).toBeVisible()
        await expect(history.getByText('Comparacao com o preco aprovado anterior')).toBeVisible()
        await expect(history.getByText('Preco anterior')).toBeVisible()
        await expect(history.getByText('Novo preco')).toBeVisible()
        await expect(history.getByText('Diferenca')).toBeVisible()
        await expect(history.getByText('Variacao')).toBeVisible()
        await expect(history.getByText('20,00%')).toBeVisible()
        await expect(history.getByText('Custo interno')).toHaveCount(2)
        await expect(history.getByText('R$ 60,00')).toBeVisible()
        await expect(history.getByText('Reajuste anual de mercado')).toBeVisible()

        for (const viewport of [{ width: 1280, height: 800 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 375, height: 667 }]) {
          await page.getByRole('button', { name: 'Fechar painel' }).click()
          await expect(history).not.toBeVisible({ timeout: 5_000 })
          await page.setViewportSize(viewport)
          const closedWidth = await page.evaluate(() => document.documentElement.scrollWidth)
          await page.getByRole('button', { name: new RegExp(`Ver historico de ${marker}_ITEM`) }).click()
          await expect(history).toBeVisible({ timeout: 5_000 })
          await expect(history.getByRole('heading', { name: new RegExp(`Historico de precos · ${itemCode}`) })).toBeVisible({ timeout: 5_000 })
          await expect(history.getByText('Comparacao com o preco aprovado anterior')).toBeVisible({ timeout: 5_000 })
          const { scrollWidth, clientWidth } = await history.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }))
          expect(scrollWidth, `History drawer horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(clientWidth + 1)
          const openWidth = await page.evaluate(() => document.documentElement.scrollWidth)
          expect(openWidth, `Opening history drawer at ${viewport.width}px must not widen the page`).toBeLessThanOrEqual(closedWidth + 1)
        }
      })

      await test.step('verifica historico pela rastreabilidade na Tabela de Precos', async () => {
        await page.setViewportSize({ width: 1280, height: 800 })
        await page.getByRole('button', { name: 'Fechar painel' }).click()
        await page.goto('/pricing/prices')
        const priceTable = page.getByRole('table', { name: 'Tabela de Precos' })
        const priceRow = priceTable.getByRole('row').filter({ hasText: `${marker}_ITEM` })
        await expect(priceRow).toContainText('R$ 120,00')
        await priceRow.getByRole('button', { name: 'Rastreabilidade' }).click()
        const trace = page.getByRole('dialog', { name: new RegExp(itemCode) })
        await expect(trace).toBeVisible()
        await trace.getByRole('button', { name: 'Ver historico' }).click()
        const pricingHistory = page.getByRole('dialog', { name: new RegExp(`Historico de precos · ${itemCode}`) })
        await expect(pricingHistory).toBeVisible()
        await expect(pricingHistory.getByText('Preco vigente')).toBeVisible()
        await expect(pricingHistory.getByText('Comparacao com o preco aprovado anterior')).toBeVisible()
      })
    } else {
      await test.step('equipe ve historico sem custo interno', async () => {
        const opened = page.getByRole('dialog', { name: /Historico de precos/i })
        await page.getByRole('button', { name: new RegExp(`Ver historico de ${marker}_ITEM`) }).click()
        await expect(opened).toBeVisible()
        await expect(opened).toContainText('Pendente')
        await expect(opened).not.toContainText('Custo interno')
        await expect(opened).toContainText(itemCode)

        expect(proposalReads.length).toBeGreaterThan(0)
        const rows = proposalReads.flatMap((response) => Array.isArray(response) ? response : [])
        expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ catalog_item_id: item.data!.id, internal_cost: null })]))
        expect(rows.every((proposal) => (
          typeof proposal === 'object'
          && proposal !== null
          && 'internal_cost' in proposal
          && proposal.internal_cost === null
        ))).toBe(true)
      })
    }
  } finally {
    await service.from('price_list').delete().eq('catalog_item_id', item.data!.id)
    await service.from('own_price_proposals').delete().eq('catalog_item_id', item.data!.id)
    await service.from('catalog_items').delete().eq('id', item.data!.id)
    await service.from('catalog_categories').delete().eq('id', category.data!.id)
    const [proposalResidue, itemResidue, categoryResidue] = await Promise.all([
      service.from('own_price_proposals').select('id', { count: 'exact', head: true }).eq('catalog_item_id', item.data!.id),
      service.from('catalog_items').select('id', { count: 'exact', head: true }).like('name', `${marker}%`),
      service.from('catalog_categories').select('id', { count: 'exact', head: true }).like('name', `${marker}%`),
    ])
    expect([proposalResidue.count, itemResidue.count, categoryResidue.count]).toEqual([0, 0, 0])
  }
})