import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'
import uri from 'fast-uri'
import { z } from 'zod'

test('DOMPurify scrubs expressions assembled inside an attached shadow root', () => {
  const window = new JSDOM('<!doctype html>').window
  try {
    const purify = createDOMPurify(window)
    const host = window.document.createElement('div')
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.append(window.document.createTextNode('$'), window.document.createElement('object'), window.document.createTextNode('{untrusted}'))
    purify.sanitize(host, { IN_PLACE: true, SAFE_FOR_TEMPLATES: true })
    assert(!shadow.textContent.includes('${untrusted}'))
  } finally { window.close() }
})

test('DOMPurify ordinary string sanitization remains compatible', () => {
  const window = new JSDOM('<!doctype html>').window
  try {
    assert.equal(createDOMPurify(window).sanitize('<p>Contrato</p><script>untrusted</script>'), '<p>Contrato</p>')
  } finally { window.close() }
})

test('fast-uri rejects authority injection and encoded schemes', () => {
  assert.throws(() => uri.serialize({ scheme: 'http', host: 'trusted.example', port: '@127.0.0.1:8124', path: '/app' }), /port is malformed/)
  assert.match(uri.parse('%6Aavascript:untrusted').error, /scheme is malformed/)
  assert.equal(uri.parse('https://example.invalid/path').host, 'example.invalid')
})

test('Zod rejects oversized bounded collections before parsing elements', () => {
  let calls = 0
  const element = z.string().superRefine(() => { calls++ })
  const schema = z.array(element).max(1)
  assert.equal(schema.safeParse(['a', 'b', 'c']).success, false)
  assert.equal(calls, 0)
  assert.deepEqual(schema.parse(['a']), ['a'])
  assert.equal(calls, 1)
})
