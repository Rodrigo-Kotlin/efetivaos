import { createServer } from 'node:http'
import { createDiscardHandler } from '../supabase/functions/discard-client-contract-document/handler.ts'
import { url } from './cc15-hml.mjs'

// Loopback-only test host. No deployment, public tunnel or secret in browser.
export async function startDiscardServer(keys, fetcher = fetch) {
  const handler = createDiscardHandler({ url, anonKey: keys.anon, serviceKey: keys.service, allowedOrigins: ['http://127.0.0.1:4185'], fetcher })
  const server = createServer(async (req, res) => {
    if (req.url !== '/functions/v1/discard-client-contract-document') { res.writeHead(404).end(); return }
    try {
      const chunks = []; let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 2048) { res.writeHead(413).end(); return }
        chunks.push(chunk)
      }
      const headers = new Headers()
      for (const name of ['authorization', 'apikey', 'content-type', 'origin', 'x-client-info']) {
        if (typeof req.headers[name] === 'string') headers.set(name, req.headers[name])
      }
      const response = await handler(new Request(`http://127.0.0.1:4196${req.url}`, {
        method: req.method, headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
      }))
      response.headers.forEach((value, key) => res.setHeader(key, value))
      res.writeHead(response.status).end(Buffer.from(await response.arrayBuffer()))
    } catch { res.writeHead(503, { 'Content-Type': 'application/json' }).end('{"error":"local_backend_unavailable"}') }
  })
  server.requestTimeout = 30000
  server.headersTimeout = 10000
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4196, '127.0.0.1', resolve) })
  return { endpoint: 'http://127.0.0.1:4196/functions/v1/discard-client-contract-document', close: () => new Promise((resolve, reject) => server.close((e) => e ? reject(e) : resolve())) }
}
