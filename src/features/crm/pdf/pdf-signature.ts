function latin1(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => String.fromCharCode(value)).join('')
}

export type PdfProtection = {
  signed: boolean
  encrypted: boolean
  reason?: string
}

export function inspectPdfProtection(bytes: Uint8Array): PdfProtection {
  const source = latin1(bytes)
  const signed = /\/ByteRange\b|\/Type\s*\/Sig\b|\/SubFilter\s*\/adbe\./.test(source)
  const encrypted = /\/Encrypt\b/.test(source)
  return {
    signed,
    encrypted,
    reason: signed ? 'PDF assinado digitalmente; o original foi preservado.' : encrypted ? 'PDF criptografado; o original foi preservado.' : undefined,
  }
}
