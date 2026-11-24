import { describe, expect, it } from 'vitest'

import { inspectPdfProtection } from './pdf-signature'
import { hasPdfEof, hasPdfHeader, validatePdfBytes } from './pdf-validation'

const validPdf = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF')

describe('PDF validation and protection', () => {
  it('accepts a structurally signed PDF header and EOF marker', () => {
    expect(hasPdfHeader(validPdf)).toBe(true)
    expect(hasPdfEof(validPdf)).toBe(true)
    expect(validatePdfBytes(validPdf, 'contrato.pdf', 'application/pdf')).toMatchObject({ valid: true })
  })

  it('rejects invalid content, false extensions, MIME mismatch and oversize data', () => {
    expect(validatePdfBytes(new TextEncoder().encode('MZ executable'), 'contrato.pdf', 'application/pdf')).toMatchObject({ valid: false })
    expect(validatePdfBytes(validPdf, 'contrato.exe', 'application/pdf')).toMatchObject({ valid: false })
    expect(validatePdfBytes(validPdf, 'contrato.pdf', 'application/octet-stream')).toMatchObject({ valid: false })
    expect(validatePdfBytes(new Uint8Array(10 * 1024 * 1024 + 1), 'contrato.pdf', 'application/pdf')).toMatchObject({ valid: false })
  })

  it('detects digital signatures and encryption markers conservatively', () => {
    const signed = new TextEncoder().encode('%PDF-1.7\n/ByteRange [0 10 20 30]\n%%EOF')
    const encrypted = new TextEncoder().encode('%PDF-1.7\n/Encrypt 5 0 R\n%%EOF')
    expect(inspectPdfProtection(signed)).toMatchObject({ signed: true, encrypted: false })
    expect(inspectPdfProtection(encrypted)).toMatchObject({ signed: false, encrypted: true })
    expect(inspectPdfProtection(validPdf)).toEqual({ signed: false, encrypted: false, reason: undefined })
  })
})
