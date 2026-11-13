// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDiscardHandler } from '../../../../supabase/functions/discard-client-contract-document/handler'

const actor = '10000000-0000-4000-8000-000000000001'
const contract = '20000000-0000-4000-8000-000000000001'
const document = '30000000-0000-4000-8000-000000000001'
const url = 'https://unit-test.supabase.co'
let fault = ''
const calls: Array<{ url: string; body: Record<string, unknown>; method: string }> = []
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fetcher: typeof fetch = vi.fn(async (input, init) => {
  const target = String(input)
  const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}
  calls.push({ url: target, body, method: init?.method ?? 'GET' })
  if (target.includes('/auth/v1/user')) return fault === 'auth' ? json({ msg: 'invalid token' }, 401) : json({ id: actor, is_anonymous: fault === 'anonymous' })
  if (target.includes('/rpc/begin_')) {
    if (fault === 'inactive') return json({ code: '42501', message: 'inactive' }, 403)
    if (fault === 'ready') return json({ code: '23514', message: 'ready' }, 400)
    return json({ document_id: document, contract_id: contract, operation_id: actor, storage_bucket: fault === 'bucket' ? 'other' : 'client-contracts', storage_path: `${contract}/${document}.pdf`, state: 'discarding' })
  }
  if (target.includes('/rpc/finish_')) return json({ state: 'api_absent' })
  if (target.includes('/object/list/')) return json(fault === 'listed' ? [{ name: `${document}.pdf` }] : [])
  if (target.includes('/object/authenticated/')) {
    if (fault === 'get-forbidden') return json({ statusCode: '403' }, 403)
    if (fault === 'get-server-error') return json({ statusCode: '500' }, 500)
    if (fault === 'get-present') return new Response('PDF', { status: 200 })
    return json({ statusCode: '404', message: 'Object not found' }, 400)
  }
  if (target.includes('/object/client-contracts')) return fault === 'storage' ? json({ statusCode: '503', message: 'temporary failure' }, 503) : json([])
  throw new Error(`Unexpected unit request ${target}`)
})
function request(body: object = { contract_id: contract, document_id: document }, auth = true, origin = 'http://127.0.0.1:4185') {
  return new Request('http://localhost/discard', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer fake-test-token' } : {}), Origin: origin }, body: JSON.stringify(body) })
}
const handler = createDiscardHandler({ url, anonKey: 'fake-publishable', serviceKey: 'fake-server-secret', allowedOrigins: ['http://127.0.0.1:4185'], fetcher })
beforeEach(() => { fault = ''; calls.length = 0 })
describe('backend discard protocol', () => {
  it('confirma ausencia por API mas nunca promete eliminacao fisica', async () => {
    const response = await handler(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ confirmation: 'storage_api_absent', physical_erasure_verified: false })
    expect(calls.find((c) => c.url.includes('/rpc/begin_'))?.body.p_actor).toBe(actor)
    expect(calls.findIndex((c) => c.method === 'DELETE')).toBeGreaterThan(calls.findIndex((c) => c.url.includes('/rpc/begin_')))
  })
  it('rejeita ausencia de bearer antes de qualquer chamada', async () => {
    expect((await handler(request(undefined, false))).status).toBe(401); expect(calls).toHaveLength(0)
  })
  it('verifica token no Auth server', async () => {
    fault = 'auth'; expect((await handler(request())).status).toBe(401); expect(calls).toHaveLength(1)
  })
  it('nega sessao Auth anonima', async () => {
    fault = 'anonymous'; expect((await handler(request())).status).toBe(401)
  })
  it.each(['actor', 'path', 'bucket', 'operation_id'])('rejeita campo arbitrario %s', async (key) => {
    expect((await handler(request({ contract_id: contract, document_id: document, [key]: 'forged' }))).status).toBe(400)
    expect(calls).toHaveLength(0)
  })
  it('origem nao autorizada nao causa acesso remoto', async () => {
    expect((await handler(request(undefined, true, 'https://evil.example'))).status).toBe(403); expect(calls).toHaveLength(0)
  })
  it.each(['inactive', 'ready'])('nao remove bytes se RPC bloquear %s', async (scenario) => {
    fault = scenario; expect([403, 409]).toContain((await handler(request())).status)
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
  })
  it('valida bucket devolvido pela reserva sem confiar cegamente no shape', async () => {
    fault = 'bucket'; expect((await handler(request())).status).toBe(503)
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
  })
  it.each(['storage', 'listed', 'get-forbidden', 'get-server-error', 'get-present'])('mantem recuperacao pendente em %s', async (scenario) => {
    fault = scenario; expect((await handler(request())).status).toBe(503)
    expect(calls.filter((c) => c.url.includes('/rpc/finish_')).every((c) => c.body.p_error_code !== null)).toBe(true)
  })
  it('limita tamanho do payload antes da autenticacao remota', async () => {
    expect((await handler(request({ contract_id: contract, document_id: document, padding: 'x'.repeat(3000) }))).status).toBe(413)
    expect(calls).toHaveLength(0)
  })
})
