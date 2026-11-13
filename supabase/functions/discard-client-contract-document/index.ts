// Deployment entrypoint only. The CC16 handler/protocol is unchanged.
import { createDiscardHandler } from './handler.ts'

function required(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing server configuration: ${name}`)
  return value
}

const allowedOrigins = required('CONTRACT_DISCARD_ALLOWED_ORIGINS').split(',').map((value) => value.trim())
for (const origin of allowedOrigins) {
  const parsed = new URL(origin)
  if (parsed.origin !== origin || (parsed.protocol !== 'https:' && !['http://127.0.0.1:4185', 'http://localhost:4185'].includes(origin))) {
    throw new Error('Invalid explicit CORS origin')
  }
}

Deno.serve(createDiscardHandler({
  url: required('SUPABASE_URL'),
  anonKey: required('SUPABASE_ANON_KEY'),
  serviceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  allowedOrigins,
}))
