export const MAX_CONTRACT_PDF_BYTES = 10 * 1024 * 1024

export type PdfValidationResult = {
  valid: true
  bytes: Uint8Array
} | {
  valid: false
  reason: string
}

function asBytes(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input)
}

function latin1(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => String.fromCharCode(value)).join('')
}

export function hasPdfHeader(bytes: Uint8Array): boolean {
  return latin1(bytes.subarray(0, 8)).startsWith('%PDF-')
}

export function hasPdfEof(bytes: Uint8Array): boolean {
  const tail = latin1(bytes.subarray(Math.max(0, bytes.length - 2048)))
  return tail.includes('%%EOF')
}

export function validatePdfBytes(input: ArrayBuffer | Uint8Array, fileName?: string, mimeType?: string): PdfValidationResult {
  const bytes = asBytes(input)
  if (fileName && !fileName.toLowerCase().endsWith('.pdf')) return { valid: false, reason: 'Envie apenas PDF com extensão .pdf.' }
  if (mimeType && mimeType !== 'application/pdf') return { valid: false, reason: 'O tipo MIME informado não é application/pdf.' }
  if (bytes.byteLength < 16) return { valid: false, reason: 'O arquivo PDF está vazio ou incompleto.' }
  if (bytes.byteLength > MAX_CONTRACT_PDF_BYTES) return { valid: false, reason: 'Envie apenas PDF de até 10 MB.' }
  if (!hasPdfHeader(bytes)) return { valid: false, reason: 'O conteúdo não possui assinatura PDF válida.' }
  if (!hasPdfEof(bytes)) return { valid: false, reason: 'O PDF não possui marcador de finalização válido.' }
  return { valid: true, bytes }
}
