import { mkdir } from 'node:fs/promises'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { chromium } from '@playwright/test'

const output = 'artifacts/contracts-create-form-verification'
await mkdir(output, { recursive: true })

const pdf = await PDFDocument.create()
const page = pdf.addPage([595, 842])
const font = await pdf.embedFont(StandardFonts.Helvetica)
page.drawText('Contrato sintético de validação', { x: 48, y: 780, size: 12, font })
page.drawText('PDF fictício para seleção antes do cadastro contratual.', { x: 48, y: 755, size: 10, font })
const pdfBytes = await pdf.save()

const browser = await chromium.launch({ headless: true })
const pageView = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 })
await pageView.route('**/rest/v1/client_contracts*', async (route) => {
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Content-Range': '*/0' }, body: '[]' })
})
await pageView.goto('http://127.0.0.1:4191/e2e/contracts-create-form-verification.html', { waitUntil: 'networkidle' })
await pageView.getByRole('button', { name: 'Novo contrato' }).click()
await pageView.getByRole('heading', { name: 'Cadastrar contrato' }).waitFor()
await pageView.screenshot({ path: `${output}/contracts-create-form-empty.png`, fullPage: true })
await pageView.locator('input[type=file]').setInputFiles({ name: 'contrato-sintetico.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdfBytes) })
await pageView.getByText('O PDF será enviado após o cadastro do contrato.').waitFor()
await pageView.screenshot({ path: `${output}/contracts-create-form-prepared.png`, fullPage: true })
await browser.close()
console.log(JSON.stringify({ output, screenshots: 2 }, null, 2))
