import { fingerprintPdf } from './pdf-fingerprint'
import { validatePdfBytes } from './pdf-validation'
import type { OptimizePdfOptions, PdfOptimizationResult } from './pdf-optimizer'

export type PreparedContractPdf = {
  file: File
  result: PdfOptimizationResult
  sourceFingerprint: string
  metadata: {
    original_bytes: number
    final_bytes: number
    saved_ratio: number
    optimization_status: PdfOptimizationResult['status']
    optimization_reason?: string
    optimization_method?: PdfOptimizationResult['method']
    source_fingerprint: string
  }
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

export async function prepareContractPdf(file: File, options: OptimizePdfOptions = {}): Promise<PreparedContractPdf> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const validation = validatePdfBytes(bytes, file.name, file.type)
  if (!validation.valid) throw new Error(validation.reason)
  const sourceFingerprint = await fingerprintPdf(bytes)
  const { optimizePdfBytes } = await import('./pdf-optimizer')
  const result = await optimizePdfBytes(bytes, options)
  const preparedBytes = result.bytes
  const preparedFile = new File([ownedArrayBuffer(preparedBytes)], file.name, { type: 'application/pdf', lastModified: file.lastModified })
  return {
    file: preparedFile,
    result,
    sourceFingerprint,
    metadata: {
      original_bytes: result.originalBytes,
      final_bytes: result.finalBytes,
      saved_ratio: result.savedRatio,
      optimization_status: result.status,
      optimization_reason: result.reason,
      optimization_method: result.method,
      source_fingerprint: sourceFingerprint,
    },
  }
}
