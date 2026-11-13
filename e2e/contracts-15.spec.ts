import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'
import { randomUUID, createHash } from 'node:crypto'

const url = 'https://xktbqykxmfuuzepfnjns.supabase.co'
if (process.env.VITE_SUPABASE_URL !== url || !process.env.CC15_FIXTURE) throw new Error('Isolated CC15 fixture required')
const fixture = JSON.parse(process.env.CC15_FIXTURE) as { clientId: string; users: { email: string; password: string; id: string }[] }
const service = createClient(url, process.env.HML_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const pdf = Buffer.from(new jsPDF().output('arraybuffer'))
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const unexpected: string[] = []

test.beforeEach(async ({ page }) => {
  unexpected.length = 0
  await page.route('**/*', async (route) => {
    const target = new URL(route.request().url())
    if (target.hostname.endsWith('.supabase.co') && target.origin !== url) {
      unexpected.push(target.origin); await route.abort(); return
    }
    if (process.env.CC16_BACKEND_URL === 'http://127.0.0.1:4196' && target.href === `${url}/functions/v1/discard-client-contract-document`) {
      const response = await route.fetch({ url: 'http://127.0.0.1:4196/functions/v1/discard-client-contract-document' })
      await route.fulfill({ response }); return
    }
    await route.continue()
  })
})
test.afterEach(() => expect(unexpected, 'No traffic to production or Connect').toEqual([]))

async function login(page: Page, index: number) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(fixture.users[index].email)
  await page.getByRole('textbox', { name: 'Senha' }).fill(fixture.users[index].password)
  const authenticated = page.waitForResponse((r) => r.url().startsWith(`${url}/auth/v1/token?`), { timeout: 45_000 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  expect((await authenticated).status()).toBe(200)
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible({ timeout: 45_000 })
  await page.goto(`/crm/clients/${fixture.clientId}`)
  await expect(page.getByRole('heading', { name: 'Contratos', exact: true })).toBeVisible()
}
async function contract(page: Page) {
  const title = `CC15 browser ${randomUUID()}`
  await page.getByRole('button', { name: 'Novo contrato' }).click()
  await page.getByLabel('Número do contrato').fill(`CC15-${randomUUID()}`)
  await page.getByLabel('Título', { exact: true }).fill(title)
  await page.locator('form').getByLabel('Tipo', { exact: true }).fill('SST ficticio')
  await page.getByLabel('Modalidade').selectOption('one_off')
  await page.getByLabel('Início', { exact: true }).fill('2026-11-12')
  await page.getByRole('button', { name: 'Salvar contrato' }).click()
  const article = page.getByRole('article').filter({ hasText: title })
  await expect(article).toBeVisible()
  await article.getByRole('button', { name: 'Documentos e histórico' }).click()
  return article
}
for (const [index, role] of [[0, 'Admin'], [1, 'Equipe']] as const) {
  test(`${role}: upload real, ready, visualizacao, download e validacao de arquivos`, async ({ page, request }) => {
    await login(page, index)
    const article = await contract(page)
    const input = () => article.locator('input[type=file]')
    await input().setInputFiles({ name: 'invalid.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') })
    await expect(page.getByText('Envie apenas PDF de até 10 MB.').last()).toBeVisible()
    await input().setInputFiles({ name: 'large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10485761) })
    await expect(page.getByText('Envie apenas PDF de até 10 MB.').last()).toBeVisible()
    const filename = `CC15-${randomUUID()}.pdf`
    const finalization = page.waitForResponse((r) => r.url() === `${url}/rest/v1/rpc/finalize_client_contract_document`)
    await input().setInputFiles({ name: filename, mimeType: 'application/pdf', buffer: pdf })
    expect((await finalization).status()).toBe(200)
    await expect(article).toContainText('Concluído')
    await expect(article).toContainText(filename)
    const document = await service.from('client_contract_documents').select('*').eq('name', filename).single()
    expect(document.error).toBeNull()
    expect(document.data?.upload_status).toBe('ready')
    expect(document.data?.created_by).toBe(fixture.users[index].id)
    await article.getByRole('button', { name: 'Visualizar', exact: true }).click()
    const iframe = page.getByTitle(`Visualização de ${filename}`)
    await expect(iframe).toBeVisible()
    const signed = await iframe.getAttribute('src')
    expect(signed).toContain(url)
    const response = await request.get(signed!)
    expect(response.status()).toBe(200)
    expect(hash(await response.body())).toBe(hash(pdf))
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    const title = await article.getByRole('heading', { level: 3 }).textContent()
    const signedResponse = page.waitForResponse((r) => r.url().includes('/storage/v1/object/sign/'))
    await article.getByRole('button', { name: 'Baixar', exact: true }).click()
    const downloadResponse = await signedResponse
    expect(downloadResponse.status()).toBe(200)
    const payload = await downloadResponse.json() as { signedURL: string }
    const downloadURL = payload.signedURL.startsWith('http') ? payload.signedURL : `${url}/storage/v1${payload.signedURL}`
    const bytes = await request.get(downloadURL)
    expect(bytes.status()).toBe(200)
    expect(hash(await bytes.body())).toBe(hash(pdf))
    await page.reload()
    const persisted = page.getByRole('article').filter({ hasText: title! })
    await persisted.getByRole('button', { name: 'Documentos e histórico' }).click()
    await expect(persisted).toContainText(filename)
    await expect(persisted).toContainText('Concluído')
    const allDocuments = await service.from('client_contract_documents').select('id').eq('name', filename)
    expect(allDocuments.data).toHaveLength(1)
  })
}
test('falha de transporte no Storage compensa registro sem objeto orfao', async ({ page }) => {
  await login(page, 0)
  const article = await contract(page)
  const filename = `CC15-network-${randomUUID()}.pdf`
  // Deliberate fault injection only for this real upload; Auth/SQL/RLS remain real.
  await page.route(`${url}/storage/v1/object/client-contracts/**`, async (route) => {
    if (route.request().method() === 'POST') await route.abort('connectionfailed')
    else await route.continue()
  })
  await article.locator('input[type=file]').setInputFiles({ name: filename, mimeType: 'application/pdf', buffer: pdf })
  await expect(page.getByText('O upload não foi concluído. Nenhum documento foi anexado.').last()).toBeVisible()
  const rows = await service.from('client_contract_documents').select('id').eq('name', filename)
  expect(rows.error).toBeNull(); expect(rows.data).toHaveLength(0)
})
