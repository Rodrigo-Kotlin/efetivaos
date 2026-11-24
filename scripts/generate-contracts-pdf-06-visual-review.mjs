import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const output = new URL('../artifacts/contracts-pdf-06-visual-review/', import.meta.url)
const baseUrl = process.env.CONTRACTS_PDF_06_BASE_URL ?? 'http://127.0.0.1:4178'
const directory = fileURLToPath(output)
await mkdir(directory, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(`${baseUrl}/e2e/contracts-pdf-06-visual.html`, { waitUntil: 'networkidle' })
const reviews = await page.evaluate(() => window.buildPdfReview())
await browser.close()

const manifest = []
for (const review of reviews) {
  const prefix = `contracts-pdf-06-${review.id}`
  const files = [
    [`${prefix}-original.pdf`, Buffer.from(review.originalPdf)],
    [`${prefix}-optimized.pdf`, Buffer.from(review.optimizedPdf)],
    [`${prefix}-original.png`, Buffer.from(review.originalPng.split(',')[1], 'base64')],
    [`${prefix}-optimized.png`, Buffer.from(review.optimizedPng.split(',')[1], 'base64')],
    [`${prefix}-diff.png`, Buffer.from(review.diffPng.split(',')[1], 'base64')],
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
}

const report = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Contracts PDF 06 — visual review</title><style>body{font:16px system-ui;max-width:1200px;margin:2rem auto;color:#172033}article{border:1px solid #d6dde5;border-radius:12px;padding:1rem;margin:1rem 0}img{width:30%;border:1px solid #d6dde5}code{font-size:.85em}</style><h1>Contracts PDF 06 — revisão visual</h1><p>Documentos sintéticos, gerados localmente. A aprovação visual humana permanece <strong>PENDING</strong>.</p>${reviews.map((review) => `<article><h2>${review.label}</h2><p>Status: <code>${review.status}</code> · original ${review.originalBytes} bytes · final ${review.finalBytes} bytes · economia ${(review.savedRatio * 100).toFixed(2)}% · imagens analisadas ${review.imagesAnalyzed} · recomprimidas ${review.imagesRecompressed}</p><p>${review.reason ?? ''}</p><img alt="original" src="./contracts-pdf-06-${review.id}-original.png"><img alt="optimized" src="./contracts-pdf-06-${review.id}-optimized.png"><img alt="difference map" src="./contracts-pdf-06-${review.id}-diff.png"></article>`).join('')}</html>`
await writeFile(new URL('contracts-pdf-06-visual-review.html', output), report)
await writeFile(new URL('contracts-pdf-06-visual-review.json', output), JSON.stringify({ generatedAt: new Date().toISOString(), humanApproval: 'PENDING', reviews, files: manifest }, null, 2))
await writeFile(new URL('contracts-pdf-06-visual-review-manifest.json', output), JSON.stringify({ generatedAt: new Date().toISOString(), files: manifest }, null, 2))
console.log(JSON.stringify({ output: directory, documents: reviews.length, files: manifest.length }, null, 2))
