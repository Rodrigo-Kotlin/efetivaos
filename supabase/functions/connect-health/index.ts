import { corsHeaders, correlationId, errorResponse, jsonResponse } from '../_shared/http.ts'

Deno.serve((request) => {
  const id = correlationId(request)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }

  if (request.method !== 'GET') {
    return errorResponse(request, 'METHOD_NOT_ALLOWED', 'Only GET is supported.', 405, id)
  }

  return jsonResponse(request, {
    data: { ok: true, service: 'efetivaconnect', version: 'v1' },
    meta: { correlation_id: id },
  }, 200, id)
})
