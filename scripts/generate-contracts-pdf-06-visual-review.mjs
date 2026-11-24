import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const output = new URL('../artifacts/contracts-pdf-08-visual-review/', import.meta.url)
const baseUrl = process.env.CONTRACTS_PDF_08_BASE_URL ?? 'http://127.0.0.1:4178'
const directory = fileURLToPath(output)
await mkdir(directory, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(`${baseUrl}/e2e/contracts-pdf-06-visual.html`, { waitUntil: 'networkidle' })
const reviews = await page.evaluate(() => window.buildPdfReview())
await browser.close()

const manifest = []
for (const review of reviews) {
  const prefix = `contracts-pdf-08-${review.id}`
  const files = [
    [`${prefix}-original.pdf`, Buffer.from(review.originalPdf)],
    [`${prefix}-optimized.pdf`, Buffer.from(review.optimizedPdf)],
    [`${prefix}-original.png`, Buffer.from(review.originalPng.split(',')[1], 'base64')],
    [`${prefix}-optimized.png`, Buffer.from(review.optimizedPng.split(',')[1], 'base64')],
    [`${prefix}-diff.png`, Buffer.from(review.diffPng.split(',')[1], 'base64')],
    [`${prefix}-detail-text-values.png`, Buffer.from(review.detailPngs.textValues.split(',')[1], 'base64')],
    [`${prefix}-detail-signature-stamp.png`, Buffer.from(review.detailPngs.signatureStamp.split(',')[1], 'base64')],
  ]
  for (const [name, data] of files) {
    await writeFile(new URL(name, output), data)
    manifest.push({ name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') })
  }
  review.originalPdf = undefined
  review.optimizedPdf = undefined
  review.originalPng = undefined
  review.optimizedPng = undefined
  review.diffPng = undefined
  review.detailPngs = undefined
}

const report = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Contracts PDF 08 — synthetic scanned contracts</title><style>body{font:16px system-ui;max-width:1280px;margin:2rem auto;color:#172033}article{border:1px solid #d6dde5;border-radius:12px;padding:1rem;margin:1rem 0}figure{display:inline-block;vertical-align:top;width:31%;margin:0 1% 0 0}figure.detail{width:48%}img{width:100%;border:1px solid #d6dde5;cursor:zoom-in}figcaption{font-size:.85em;margin:.35rem 0 1rem}a{color:#0f5132}code{font-size:.85em}</style><h1>Contracts PDF 08 — contratos digitalizados sintéticos</h1><p>Documentos fictícios com cláusulas, valores, tabelas, assinaturas manuscritas simuladas e carimbos. Originais e resultados renderizados pelo mesmo PDF.js/Chromium, escala 1.5. A aprovação visual humana permanece <strong>PENDING</strong>.</p>${reviews.map((review) => `<article><h2>${review.label}</h2><p>Status: <code>${review.status}</code> · páginas ${review.originalPageCount} → ${review.optimizedPageCount} · original ${review.originalBytes} bytes · final ${review.finalBytes} bytes · economia ${(review.savedRatio * 100).toFixed(2)}% · pixels alterados ${(review.changedPixelRatio * 100).toFixed(2)}% · delta médio ${review.meanAbsoluteDelta.toFixed(2)} · delta máximo ${review.maxDelta}</p><p>${review.reason ?? ''}</p><figure><a href="./contracts-pdf-08-${review.id}-original.png" target="_blank" rel="noreferrer"><img alt="original render" src="./contracts-pdf-08-${review.id}-original.png"></a><figcaption>PDF original renderizado</figcaption></figure><figure><a href="./contracts-pdf-08-${review.id}-optimized.png" target="_blank" rel="noreferrer"><img alt="optimized render" src="./contracts-pdf-08-${review.id}-optimized.png"></a><figcaption>PDF resultante renderizado</figcaption></figure><figure><a href="./contracts-pdf-08-${review.id}-diff.png" target="_blank" rel="noreferrer"><img alt="difference map" src="./contracts-pdf-08-${review.id}-diff.png"></a><figcaption>Mapa real de diferenças</figcaption></figure><figure class="detail"><a href="./contracts-pdf-08-${review.id}-detail-text-values.png" target="_blank" rel="noreferrer"><img alt="text and monetary values detail" src="./contracts-pdf-08-${review.id}-detail-text-values.png"></a><figcaption>Ampliação: texto pequeno, tabela e valores</figcaption></figure><figure class="detail"><a href="./contracts-pdf-08-${review.id}-detail-signature-stamp.png" target="_blank" rel="noreferrer"><img alt="signature and stamp detail" src="./contracts-pdf-08-${review.id}-detail-signature-stamp.png"></a><figcaption>Ampliação: assinaturas e carimbo</figcaption></figure></article>`).join('')}</html>`
await writeFile(new URL('contracts-pdf-08-visual-review.html', output), report)
await writeFile(new URL('contracts-pdf-08-visual-review.json', output), JSON.stringify({ generatedAt: new Date().toISOString(), humanApproval: 'PENDING', reviews, files: manifest }, null, 2))
await writeFile(new URL('contracts-pdf-08-visual-review-manifest.json', output), JSON.stringify({ generatedAt: new Date().toISOString(), files: manifest }, null, 2))
console.log(JSON.stringify({ output: directory, documents: reviews.length, files: manifest.length }, null, 2))
