import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'

const output = new URL('../artifacts/contracts-interface-verification/', import.meta.url)
await mkdir(output, { recursive: true })
await writeFile(new URL('.keep', output), '')
const directory = fileURLToPath(output)

const pdf = await PDFDocument.create()
const page = pdf.addPage([595, 842])
const font = await pdf.embedFont(StandardFonts.Helvetica)
page.drawText('Contrato sintético de validação', { x: 48, y: 780, size: 12, font })
page.drawText('Documento fictício para testar a seleção local do anexo.', { x: 48, y: 755, size: 10, font })
const pdfBytes = await pdf.save()

const browser = await chromium.launch({ headless: true })
const pageView = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
pageView.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`))
pageView.on('pageerror', (error) => console.error(`[browser:error] ${error.message}`))
const baseUrl = process.env.CONTRACTS_INTERFACE_BASE_URL ?? 'http://127.0.0.1:4190'
await pageView.goto(`${baseUrl}/e2e/contracts-interface-verification.html`, { waitUntil: 'networkidle' })
await pageView.getByRole('button', { name: 'Anexar PDF do contrato' }).screenshot({ path: `${directory}/contracts-interface-upload-button.png` })
await pageView.locator('input[type=file]').setInputFiles({ name: 'contrato-sintetico.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdfBytes) })
await pageView.getByText('Revise o resultado e confirme o envio.').waitFor()
await pageView.screenshot({ path: `${directory}/contracts-interface-upload-confirmation.png`, fullPage: true })
await browser.close()
console.log(JSON.stringify({ output: output.pathname, screenshots: 2 }, null, 2))
