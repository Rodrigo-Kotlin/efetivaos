import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { jsPDF } from 'jspdf'

const url = 'https://xktbqykxmfuuzepfnjns.supabase.co'
if (process.env.VITE_SUPABASE_URL !== url || !process.env.CC19_FIXTURE) throw new Error('Hosted CC19 HML required')
const fixture = JSON.parse(process.env.CC19_FIXTURE) as { clientId: string; users: { id: string; email: string; password: string }[] }
const service = createClient(url, process.env.HML_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const pdf = Buffer.from(new jsPDF().output('arraybuffer'))
for (const [index, role] of [[0, 'Admin'], [1, 'Equipe']] as const) {
  test(`${role}: CORS de navegador e descarte direto na Edge hospedada`, async ({ page }) => {
    const denied: string[] = [], hostedCalls: string[] = []
    await page.route('**/*', async (route) => {
      const target = new URL(route.request().url())
      if (target.hostname.endsWith('.supabase.co') && target.origin !== url) { denied.push(target.origin); await route.abort(); return }
      // No route.fetch, fulfill or proxy. Every allowed request goes to its real URL.
      await route.continue()
    })
    page.on('request', (request) => { if (request.url() === `${url}/functions/v1/discard-client-contract-document` && request.method() === 'POST') hostedCalls.push(request.url()) })
    const id = randomUUID(), title = `CC19 browser ${id}`
    expect((await service.from('client_contracts').insert({ id, client_id: fixture.clientId, contract_number: title, title, contract_type: 'SST ficticio', modality: 'one_off', starts_at: '2026-11-12' })).error).toBeNull()
    const docs = []
    for (const state of ['pending','failed','ready']) {
      const document = randomUUID(), path = `${id}/${document}.pdf`
      expect((await service.from('client_contract_documents').insert({ id: document, contract_id: id, document_type: 'main', name: `CC19-${state}.pdf`, storage_path: path, size_bytes: pdf.length, created_by: fixture.users[index].id })).error).toBeNull()
      expect((await service.storage.from('client-contracts').upload(path, pdf, { contentType: 'application/pdf' })).error).toBeNull()
      if (state !== 'pending') expect((await service.from('client_contract_documents').update(state === 'ready' ? { upload_status: state, uploaded_at: new Date().toISOString() } : { upload_status: state, upload_error: 'CC19 simulated' }).eq('id', document)).error).toBeNull()
      docs.push({ id: document, state })
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
    for (let i=0;i<2;i++) {
      const response = page.waitForResponse((r) => r.url() === `${url}/functions/v1/discard-client-contract-document` && r.request().method() === 'POST')
      await article.getByRole('button', { name: 'Descartar documento incompleto' }).first().click()
      const result = await response
      expect(result.status()).toBe(200); expect(result.headers()['access-control-allow-origin']).toBe('http://127.0.0.1:4185')
      expect(await result.json()).toMatchObject({ status: 'discarded', confirmation: 'storage_api_absent', physical_erasure_verified: false })
      await expect(article.getByRole('button', { name: 'Descartar documento incompleto' })).toHaveCount(1-i)
    }
    expect(hostedCalls).toHaveLength(2); expect(denied).toEqual([])
    for (const d of docs) {
      const rows = await service.from('client_contract_documents').select('id').eq('id', d.id)
      expect(rows.error).toBeNull(); expect(rows.data?.length).toBe(d.state === 'ready' ? 1 : 0)
      const objects = await service.storage.from('client-contracts').list(id, { search: `${d.id}.pdf` })
      expect(objects.error).toBeNull(); expect(objects.data?.some((o) => o.name === `${d.id}.pdf`)).toBe(d.state === 'ready')
    }
    await expect(article).toContainText('CC19-ready.pdf')
  })
}
