import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, type Locator, type Page } from '@playwright/test'

import { assertRemoteMutationAllowed, requiredEnv } from './env'

const execFileAsync = promisify(execFile)
const sqlDirectory = 'test-results/e2e-3d-sql'

export function marker3d(tag: string) {
  return `E2E_3D_${tag}_${Date.now()}_${randomUUID().slice(0, 8)}`
}

export function serviceClient3d(): SupabaseClient {
  assertRemoteMutationAllowed()
  return createClient(requiredEnv('VITE_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
}

function throwProvision(table: string, error: { message?: string } | null) {
  throw new Error(`Failed to provision E2E 3D fixture on ${table}: ${error?.message ?? 'unknown error'}`)
}

export async function provisionOwnCategory(client: SupabaseClient, name: string): Promise<string> {
  const { data, error } = await client.from('catalog_categories').insert({ name, active: true }).select('id').single()
  if (error) throwProvision('catalog_categories', error)
  return data!.id
}

export interface OwnCatalogItemFixture {
  id: string
  code: string
  name: string
}

export async function findOwnCatalogItem(client: SupabaseClient, name: string): Promise<OwnCatalogItemFixture> {
  const { data, error } = await client
    .from('catalog_items')
    .select('id, code, name')
    .eq('name', name)
    .eq('sourcing_type', 'own')
    .single()
  if (error) throwProvision('catalog_items', error)
  return data!
}

export async function listOwnProposalIds(client: SupabaseClient, catalogItemId: string): Promise<string[]> {
  const { data, error } = await client.from('own_price_proposals').select('id').eq('catalog_item_id', catalogItemId)
  if (error) throwProvision('own_price_proposals', error)
  return (data ?? []).map((row) => row.id)
}

export interface OwnJourneyCollection {
  prefix: string
  categoryIds: string[]
  catalogItemIds: string[]
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function currentWidth(page: Page) {
  return page.viewportSize()?.width ?? 1280
}

export function itemContainer(page: Page, itemName: string, width: number): Locator {
  return width < 768
    ? page.locator('main article').filter({ hasText: itemName })
    : page.getByRole('row', { name: new RegExp(escapeRegExp(itemName)) })
}

export function catalogRow(page: Page, itemName: string): Locator {
  return page.getByRole('table', { name: 'Itens do catalogo' }).getByRole('row').filter({ hasText: itemName })
}

export function priceRow(page: Page, itemName: string, width: number): Locator {
  return width < 768
    ? page.locator('main article').filter({ hasText: itemName })
    : page.getByRole('table', { name: 'Tabela de Precos' }).getByRole('row').filter({ hasText: itemName })
}

export async function createOwnServiceViaUi(page: Page, options: { itemName: string; categoryName: string; description: string }) {
  await page.goto('/pricing/catalog')
  await page.getByRole('button', { name: 'Novo item' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo item' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Nome *').fill(options.itemName)
  await dialog.getByLabel('Categoria *').selectOption({ label: options.categoryName })
  await dialog.locator('#item-sourcing').selectOption('own')
  await dialog.getByLabel('Unidade *').selectOption('servico')
  await dialog.getByLabel(/Descricao/).fill(options.description)
  await dialog.getByRole('button', { name: 'Criar item' }).click()
  await expect(dialog).not.toBeVisible()
  await page.getByLabel('Buscar itens').fill(options.itemName)
  await expect(page.getByText(options.itemName, { exact: true }).first()).toBeVisible()
}

export async function searchOwnPrices(page: Page, itemName: string) {
  await page.goto('/pricing/own-prices')
  await page.getByPlaceholder('Buscar servico, codigo ou categoria...').fill(itemName)
}

export async function submitOwnPriceProposal(
  page: Page,
  options: {
    mode: 'create' | 'reajuste'
    itemId: string
    itemName: string
    salePrice: string
    internalCost?: string
    notes: string
    width?: number
  },
) {
  const width = options.width ?? currentWidth(page)
  if (options.mode === 'create') {
    await page.getByRole('button', { name: 'Definir preco proprio', exact: true }).click()
  } else {
    await itemContainer(page, options.itemName, width)
      .getByRole('button', { name: new RegExp(`^Propor reajuste para ${escapeRegExp(options.itemName)}`) })
      .click()
  }

  const dialog = page.getByRole('dialog', {
    name: options.mode === 'create' ? 'Definir preco proprio' : 'Propor reajuste do preco proprio',
  })
  await expect(dialog).toBeVisible()
  if (options.mode === 'create') {
    await dialog.getByLabel('Servico (do Catalogo) *').selectOption(options.itemId)
    await dialog.getByLabel('Preco de venda *').fill(options.salePrice)
  } else {
    await expect(dialog.getByText('Preco atual aprovado')).toBeVisible()
    await dialog.getByLabel('Novo preco de venda *').fill(options.salePrice)
  }
  if (options.internalCost) await dialog.getByLabel(/Custo interno/).fill(options.internalCost)
  await dialog.getByLabel(options.mode === 'create' ? /Observacoes/ : /Justificativa do reajuste/).fill(options.notes)
  await dialog.getByRole('button', { name: options.mode === 'create' ? 'Enviar proposta' : 'Enviar reajuste' }).click()
  await expect(dialog).not.toBeVisible()
}

export function historyDialog(page: Page) {
  return page.getByRole('dialog', { name: /^Historico de precos/ })
}

export function historyEntries(dialog: Locator) {
  return dialog.getByLabel('Propostas em ordem cronologica decrescente').getByRole('article')
}

export function decisionDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Decidir proposta de preco proprio' })
}

export function retireDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Inativar preco proprio' })
}

export function closeDrawer(page: Page, dialog: Locator) {
  return dialog.getByRole('button', { name: 'Fechar painel' }).click()
}

export async function measureGlobalOverflow(page: Page) {
  return page.evaluate(() => {
    const html = document.documentElement
    return { viewport: html.clientWidth, scrollWidth: html.scrollWidth, bodyScrollWidth: document.body.scrollWidth }
  })
}

export async function assertLocalTableScroll(page: Page, width: number, tableName: string | RegExp, label: string) {
  const table = page.getByRole('table', { name: tableName })
  await expect(table).toBeVisible()
  const metrics = await table.evaluate((element) => {
    const shell = element.parentElement
    if (!shell) throw new Error('Tabela sem TableShell')
    shell.scrollLeft = shell.scrollWidth
    return { overflowX: getComputedStyle(shell).overflowX, clientWidth: shell.clientWidth, scrollWidth: shell.scrollWidth, scrollLeft: shell.scrollLeft }
  })
  expect(metrics.overflowX, `${label} deve manter overflow horizontal local`).toBe('auto')
  expect(metrics.clientWidth, `${label} nao pode ultrapassar a viewport`).toBeLessThanOrEqual(width)
  expect(metrics.scrollWidth, `${label} deve manter a tabela larga dentro do shell`).toBeGreaterThan(metrics.clientWidth)
  expect(metrics.scrollLeft, `${label} deve permitir alcancar o fim da tabela`).toBeGreaterThan(0)
}

export async function assertNoDrawerOverflow(dialog: Locator, width: number, label: string) {
  const metrics = await dialog.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }))
  expect(metrics.scrollWidth, `${label} em ${width}px`).toBeLessThanOrEqual(metrics.clientWidth + 1)
}

async function execSql3d(sql: string, label: string) {
  await mkdir(sqlDirectory, { recursive: true })
  const file = join(sqlDirectory, `${label}-${randomUUID().slice(0, 8)}.sql`)
  await writeFile(file, sql, { encoding: 'utf8', mode: 0o600 })
  try {
    if (process.platform === 'win32') {
      await execFileAsync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `supabase db query --linked --file ${file}`], { windowsHide: true })
    } else {
      await execFileAsync('supabase', ['db', 'query', '--linked', '--file', file])
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to run E2E 3D SQL (${label}) through Supabase CLI: ${detail}`)
  } finally {
    await rm(file, { force: true })
  }
}

function uuidArray(ids: string[]) {
  return ids.length ? `ARRAY[${ids.map((id) => `'${id}'`).join(', ')}]::uuid[]` : 'ARRAY[]::uuid[]'
}

export async function cleanupOwnJourney(client: SupabaseClient, collection: OwnJourneyCollection) {
  if (!/^E2E_3D_\w+_\d+_[0-9a-f]{8}$/.test(collection.prefix)) {
    throw new Error('Refusing cleanup for an invalid E2E 3D fixture prefix')
  }

  const sql = `begin;
set local session_replication_role = replica;
delete from public.price_list where catalog_item_id = any(${uuidArray(collection.catalogItemIds)});
delete from public.own_price_proposals where catalog_item_id = any(${uuidArray(collection.catalogItemIds)});
delete from public.catalog_items
where id = any(${uuidArray(collection.catalogItemIds)})
  and left(coalesce(description, name), length('${collection.prefix}')) = '${collection.prefix}';
delete from public.catalog_categories
where id = any(${uuidArray(collection.categoryIds)})
  and left(name, length('${collection.prefix}')) = '${collection.prefix}';
commit;
`

  await execSql3d(sql, 'cleanup')
}

export interface OwnJourneyResidue {
  categories: number
  catalogItems: number
  ownPriceProposals: number
  priceList: number
}

const noUuid = '00000000-0000-0000-0000-000000000000'

export async function captureOwnJourneyResidue(client: SupabaseClient, collection: OwnJourneyCollection): Promise<OwnJourneyResidue> {
  const categoryIds = collection.categoryIds.length ? collection.categoryIds : [noUuid]
  const itemIds = collection.catalogItemIds.length ? collection.catalogItemIds : [noUuid]

  const [categories, catalogItems, ownPriceProposals, priceList] = await Promise.all([
    client.from('catalog_categories').select('id', { count: 'exact', head: true }).in('id', categoryIds),
    client.from('catalog_items').select('id', { count: 'exact', head: true }).in('id', itemIds),
    client.from('own_price_proposals').select('id', { count: 'exact', head: true }).in('catalog_item_id', itemIds),
    client.from('price_list').select('id', { count: 'exact', head: true }).in('catalog_item_id', itemIds),
  ])

  const count = (result: { count: number | null; error: { message?: string } | null }) => {
    if (result.error) throw new Error(`Failed to inspect E2E 3D residue: ${result.error.message}`)
    return result.count ?? 0
  }

  return {
    categories: count(categories),
    catalogItems: count(catalogItems),
    ownPriceProposals: count(ownPriceProposals),
    priceList: count(priceList),
  }
}
