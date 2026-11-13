import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { jsPDF } from 'jspdf'

const url = 'https://xktbqykxmfuuzepfnjns.supabase.co'
if (process.env.VITE_SUPABASE_URL !== url || process.env.CC16_BACKEND_URL !== 'http://127.0.0.1:4196' || !process.env.CC15_FIXTURE) throw new Error('CC16 environment required')
const fixture = JSON.parse(process.env.CC15_FIXTURE) as { clientId: string; users: { id: string; email: string; password: string }[] }
const service = createClient(url, process.env.HML_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const pdf = Buffer.from(new jsPDF().output('arraybuffer'))
for (const [index, role] of [[0, 'Admin'], [1, 'Equipe']] as const) {
  test(`${role}: descarta pending e failed por backend real local; ready sem botao`, async ({ page }) => {
    const blocked: string[] = []
    await page.route('**/*', async (route) => {
      const target = new URL(route.request().url())
      if (target.hostname.endsWith('.supabase.co') && target.origin !== url) { blocked.push(target.origin); await route.abort(); return }
      if (target.href === `${url}/functions/v1/discard-client-contract-document`) {
        const response = await route.fetch({ url: 'http://127.0.0.1:4196/functions/v1/discard-client-contract-document' })
        await route.fulfill({ response }); return
      }
      await route.continue()
    })
    const contractId = randomUUID()
    const title = `CC16 UI ${contractId}`
    const contract = await service.from('client_contracts').insert({ id: contractId, client_id: fixture.clientId, contract_number: title, title, contract_type: 'SST ficticio', modality: 'one_off', starts_at: '2026-11-12' })
    expect(contract.error).toBeNull()
    const docs = []
    for (const status of ['pending', 'failed', 'ready']) {
      const id = randomUUID(); const path = `${contractId}/${id}.pdf`
      const row = await service.from('client_contract_documents').insert({ id, contract_id: contractId, document_type: 'main', name: `CC16-${status}.pdf`, storage_path: path, size_bytes: pdf.length, created_by: fixture.users[index].id })
      expect(row.error).toBeNull()
      expect((await service.storage.from('client-contracts').upload(path, pdf, { contentType: 'application/pdf' })).error).toBeNull()
      if (status !== 'pending') {
        const update = await service.from('client_contract_documents').update(status === 'ready' ? { upload_status: status, uploaded_at: new Date().toISOString() } : { upload_status: status, upload_error: 'CC16 simulated' }).eq('id', id)
        expect(update.error).toBeNull()
      }
      docs.push({ id, path, status })
    }
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(fixture.users[index].email)
    await page.getByRole('textbox', { name: 'Senha' }).fill(fixture.users[index].password)
    await page.getByRole('textbox', { name: 'Senha' }).press('Tab')
    await expect(page.getByLabel('E-mail')).toHaveValue(fixture.users[index].email)
    await expect.poll(async () => (await page.getByRole('textbox', { name: 'Senha' }).inputValue()).length).toBe(fixture.users[index].password.length)
    const auth = page.waitForResponse((r) => r.url().startsWith(`${url}/auth/v1/token?`), { timeout: 45_000 })
    await page.getByRole('button', { name: 'Entrar' }).click(); expect((await auth).status()).toBe(200)
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible({ timeout: 45_000 })
    await page.goto(`/crm/clients/${fixture.clientId}`)
    const article = page.getByRole('article').filter({ hasText: title })
    await article.getByRole('button', { name: 'Documentos e histórico' }).click()
    await expect(article.getByRole('button', { name: 'Descartar documento incompleto' })).toHaveCount(2)
    for (let i = 0; i < 2; i++) {
      const discarded = page.waitForResponse((r) => r.url() === `${url}/functions/v1/discard-client-contract-document` && r.request().method() === 'POST')
      await article.getByRole('button', { name: 'Descartar documento incompleto' }).first().click()
      expect((await discarded).status()).toBe(200)
      await expect(article.getByRole('button', { name: 'Descartar documento incompleto' })).toHaveCount(1 - i)
    }
    for (const d of docs) {
      const row = await service.from('client_contract_documents').select('id').eq('id', d.id)
      expect(row.error).toBeNull(); expect(row.data?.length).toBe(d.status === 'ready' ? 1 : 0)
      const object = await service.storage.from('client-contracts').list(contractId, { search: `${d.id}.pdf` })
      expect(object.error).toBeNull(); expect(object.data?.some((o) => o.name === `${d.id}.pdf`)).toBe(d.status === 'ready')
    }
    await expect(article).toContainText('CC16-ready.pdf')
    expect(blocked).toEqual([])
  })
}
