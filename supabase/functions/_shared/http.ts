const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

function allowedOrigin(request: Request): string {
  const origin = request.headers.get('origin')
  if (!origin) return 'null'

  const configured = Deno.env.get('CONNECT_ALLOWED_ORIGINS')
    ?.split(',')
    .map(value => value.trim())
    .filter(Boolean) ?? []

  return [...DEFAULT_ALLOWED_ORIGINS, ...configured].includes(origin) ? origin : 'null'
}

export function corsHeaders(request: Request): HeadersInit {
  return {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Origin': allowedOrigin(request),
    'Vary': 'Origin',
  }
}

export function correlationId(request: Request): string {
  const provided = request.headers.get('x-correlation-id')?.trim()
  return provided && /^[a-zA-Z0-9._:-]{1,120}$/.test(provided) ? provided : crypto.randomUUID()
}

export function jsonResponse(request: Request, body: unknown, status = 200, id = correlationId(request)): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json', 'X-Correlation-Id': id },
  })
}

export function errorResponse(request: Request, code: string, message: string, status: number, id = correlationId(request)): Response {
  return jsonResponse(request, { error: { code, message }, meta: { correlation_id: id } }, status, id)
}
