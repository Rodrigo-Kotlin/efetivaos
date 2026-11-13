import { createClient } from '@supabase/supabase-js'

type Options = {
  url: string
  anonKey: string
  serviceKey: string
  allowedOrigins: readonly string[]
  // Dependency injection for transport faults in tests; never read from HTTP headers.
  fetcher?: typeof fetch
}
type Job = {
  document_id: string
  operation_id: string
  contract_id: string
  storage_bucket: string
  storage_path: string
  state: 'discarding' | 'api_absent'
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Standard Request/Response handler, exercised locally against real Supabase.
// No deployment/cron is installed by this module. Server credentials stay here.
export function createDiscardHandler(options: Options) {
  const baseFetch = options.fetcher ?? fetch
  const transport: typeof fetch = (input, init) => baseFetch(input, {
    ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
  })
  const service = createClient(options.url, options.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: transport },
  })
  const auth = createClient(options.url, options.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: transport },
  })
  return async function discard(request: Request): Promise<Response> {
    const origin = request.headers.get('origin')
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' })
    const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers })
    if (origin) {
      if (!options.allowedOrigins.includes(origin)) return reply(403, { error: 'origin_denied' })
      headers.set('Access-Control-Allow-Origin', origin)
      headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info')
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'authentication_required' })
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415, { error: 'json_required' })
    let body: { contract_id: string; document_id: string }
    try {
      if (Number(request.headers.get('content-length')) > 2048) return reply(413, { error: 'request_too_large' })
      const reader = request.body?.getReader()
      if (!reader) return reply(400, { error: 'invalid_request' })
      const chunks: Uint8Array[] = []; let length = 0
      while (true) {
        const part = await reader.read(); if (part.done) break
        length += part.value.byteLength
        if (length > 2048) { await reader.cancel(); return reply(413, { error: 'request_too_large' }) }
        chunks.push(part.value)
      }
      const bytes = new Uint8Array(length); let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
      const values = parsed as Record<string, unknown>
      if (Object.keys(values).sort().join(',') !== 'contract_id,document_id' || typeof values.contract_id !== 'string' || typeof values.document_id !== 'string'
        || !uuid.test(values.contract_id) || !uuid.test(values.document_id)) throw new Error()
      body = { contract_id: values.contract_id, document_id: values.document_id }
    } catch { return reply(400, { error: 'invalid_request' }) }
    const attemptId = crypto.randomUUID()
    let actor: string
    let job: Job
    try {
      // Verify with Auth server. Do not trust getSession(), decode-only JWT or body.actor.
      const user = await auth.auth.getUser(authorization.slice(7))
      if (user.error || !user.data.user || user.data.user.is_anonymous) return reply(401, { error: 'authentication_required' })
      actor = user.data.user.id
      const reservation = await service.rpc('begin_client_contract_document_discard', {
        p_actor: actor, p_contract_id: body.contract_id, p_document_id: body.document_id, p_attempt_id: attemptId,
      })
      if (reservation.error) {
        const code = reservation.error.code
        return reply(code === '42501' ? 403 : code === 'P0002' ? 404 : code === '23514' ? 409 : 503, { error: 'discard_not_authorized_or_unavailable' })
      }
      job = reservation.data as Job
      // Defense in depth: only DB-derived canonical bucket/path, never HTTP input paths.
      if (job.storage_bucket !== 'client-contracts' || job.storage_path !== `${body.contract_id}/${body.document_id}.pdf`
        || job.document_id !== body.document_id || job.contract_id !== body.contract_id) throw new Error('invalid_reservation')
    } catch { return reply(503, { error: 'reservation_unavailable', retryable: true }) }

    let phase: 'storage_api_failed' | 'verification_failed' = 'storage_api_failed'
    try {
      const removal = await service.storage.from('client-contracts').remove([job.storage_path])
      if (removal.error) throw new Error('storage_api_failed')
      phase = 'verification_failed'
      const [folder, filename] = job.storage_path.split('/')
      const listed = await service.storage.from('client-contracts').list(folder, { search: filename, limit: 100 })
      if (listed.error || listed.data.some((object) => object.name === filename)) throw new Error('object_still_listed')
      const response = await transport(`${options.url}/storage/v1/object/authenticated/client-contracts/${job.storage_path}?cc16=${attemptId}`, {
        method: 'GET', headers: { apikey: options.serviceKey, Authorization: `Bearer ${options.serviceKey}`, 'Cache-Control': 'no-cache' }, cache: 'no-store',
      })
      // Never mistake 401/403/5xx/network errors for confirmed absence.
      const missing: unknown = await response.json().catch(() => null)
      if ((response.status !== 404 && response.status !== 400) || !missing || typeof missing !== 'object'
        || !('statusCode' in missing) || String(missing.statusCode) !== '404') throw new Error('absence_unconfirmed')
      const completion = await service.rpc('finish_client_contract_document_discard', {
        p_actor: actor, p_document_id: body.document_id, p_operation_id: job.operation_id, p_attempt_id: attemptId, p_error_code: null,
      })
      if (completion.error) throw new Error('database_confirmation_failed')
      return reply(200, { status: 'discarded', document_id: body.document_id, confirmation: 'storage_api_absent', physical_erasure_verified: false })
    } catch {
      // Best effort audit; if DB is down, started attempt + reserved document remain
      // durable. A later identical authenticated request reconciles either boundary.
      try {
        await service.rpc('finish_client_contract_document_discard', {
          p_actor: actor, p_document_id: body.document_id, p_operation_id: job.operation_id, p_attempt_id: attemptId, p_error_code: phase,
        })
      } catch { /* Durable started attempt is reconciled by the next authenticated retry. */ }
      return reply(503, { error: 'discard_pending_reconciliation', retryable: true, document_id: body.document_id })
    }
  }
}
