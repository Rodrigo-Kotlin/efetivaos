import { PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef } from 'pdf-lib'

import { inspectPdfProtection } from './pdf-signature'
import { validatePdfBytes } from './pdf-validation'
import { browserJpegCodec, type PdfImageCodec } from './pdf-image-codec'

export type PdfOptimizationStatus = 'optimized' | 'unchanged'

export type PdfOptimizationStage = 'validating' | 'inspecting' | 'processing' | 'verifying' | 'complete'

export type PdfOptimizationResult = {
  status: PdfOptimizationStatus
  bytes: Uint8Array
  originalBytes: number
  finalBytes: number
  savedRatio: number
  imagesAnalyzed: number
  imagesRecompressed: number
  method?: 'image-recompression'
  reason?: string
}

export type OptimizePdfOptions = {
  codec?: PdfImageCodec
  targetDpi?: number
  jpegQuality?: number
  minSavingRatio?: number
  maxDurationMs?: number
  onProgress?: (stage: PdfOptimizationStage) => void
}

const DEFAULTS = {
  targetDpi: 200,
  jpegQuality: 0.82,
  minSavingRatio: 0.15,
  maxDurationMs: 15_000,
  maxImagePixels: 40_000_000,
  maxImageDimension: 12_000,
  minImagePixels: 150_000,
  minEncodedBytes: 16 * 1024,
  maxTotalPixels: 150_000_000,
}

function unchanged(bytes: Uint8Array, originalBytes: number, reason: string, imagesAnalyzed = 0): PdfOptimizationResult {
  return { status: 'unchanged', bytes, originalBytes, finalBytes: bytes.byteLength, savedRatio: 0, imagesAnalyzed, imagesRecompressed: 0, reason }
}

function objectName(object: unknown): string {
  return object && typeof object === 'object' && 'toString' in object ? String(object) : ''
}

function decodeParams(stream: PDFRawStream): PDFDict | undefined {
  const value = stream.dict.get(PDFName.of('DecodeParms'))
  return value instanceof PDFDict ? value : undefined
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined' || typeof ReadableStream === 'undefined') return null
  for (const format of ['deflate', 'deflate-raw'] as const) {
    try {
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes)
          controller.close()
        },
      })
      const decompressed = source.pipeThrough(new DecompressionStream(format) as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
      return new Uint8Array(await new Response(decompressed).arrayBuffer())
    } catch {
      // Tenta o formato seguinte.
    }
  }
  return null
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

function undoPredictor(encoded: Uint8Array, width: number, height: number, components: number, predictor: number): Uint8Array | null {
  const rowLength = width * components
  if (predictor <= 1) return encoded.length >= rowLength * height ? encoded.subarray(0, rowLength * height) : null
  const output = new Uint8Array(rowLength * height)
  let sourceOffset = 0
  for (let row = 0; row < height; row++) {
    const filter = predictor >= 10 ? encoded[sourceOffset++] : 1
    if (sourceOffset + rowLength > encoded.length || filter > 4) return null
    const rowStart = row * rowLength
    const previousStart = rowStart - rowLength
    for (let column = 0; column < rowLength; column++) {
      const raw = encoded[sourceOffset++]
      const left = column >= components ? output[rowStart + column - components] : 0
      const up = row > 0 ? output[previousStart + column] : 0
      const upperLeft = row > 0 && column >= components ? output[previousStart + column - components] : 0
      output[rowStart + column] = (raw + (filter === 1 ? 0 : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upperLeft))) & 0xff
    }
  }
  return output
}

function rgbPixels(raw: Uint8Array, width: number, height: number, components: number): Uint8ClampedArray | null {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < width * height; index++) {
    const source = index * components
    const target = index * 4
    if (components === 1) pixels[target] = pixels[target + 1] = pixels[target + 2] = raw[source]
    else if (components >= 3) {
      pixels[target] = raw[source]
      pixels[target + 1] = raw[source + 1]
      pixels[target + 2] = raw[source + 2]
    } else return null
    pixels[target + 3] = 255
  }
  return pixels
}

function imageComponents(stream: PDFRawStream): number {
  const colorSpace = objectName(stream.dict.get(PDFName.of('ColorSpace')))
  return colorSpace.includes('DeviceGray') ? 1 : colorSpace.includes('DeviceRGB') || colorSpace.includes('CalRGB') ? 3 : 0
}

function imageIsSupported(stream: PDFRawStream): boolean {
  const subtype = objectName(stream.dict.get(PDFName.of('Subtype')))
  const filter = objectName(stream.dict.get(PDFName.of('Filter')))
  return subtype === '/Image' && filter === '/FlateDecode' && !stream.dict.get(PDFName.of('SMask')) && !stream.dict.get(PDFName.of('Mask'))
}

export async function optimizePdfBytes(input: Uint8Array, options: OptimizePdfOptions = {}): Promise<PdfOptimizationResult> {
  const original = input.slice()
  const originalBytes = original.byteLength
  const validation = validatePdfBytes(original)
  options.onProgress?.('validating')
  if (!validation.valid) return unchanged(original, originalBytes, validation.reason)
  const protection = inspectPdfProtection(original)
  if (protection.signed || protection.encrypted) return unchanged(original, originalBytes, protection.reason ?? 'O PDF protegido foi preservado.')
  if (typeof PDFDocument.load !== 'function') return unchanged(original, originalBytes, 'O otimizador PDF não está disponível neste navegador.')

  options.onProgress?.('inspecting')
  const codec = options.codec ?? browserJpegCodec
  const targetDpi = options.targetDpi ?? DEFAULTS.targetDpi
  const quality = options.jpegQuality ?? DEFAULTS.jpegQuality
  const minSavingRatio = options.minSavingRatio ?? DEFAULTS.minSavingRatio
  const deadline = Date.now() + (options.maxDurationMs ?? DEFAULTS.maxDurationMs)
  let document: PDFDocument
  try {
    document = await PDFDocument.load(original, { ignoreEncryption: true, updateMetadata: false })
  } catch {
    return unchanged(original, originalBytes, 'O PDF está corrompido ou possui estrutura incompatível; o original foi preservado.')
  }

  const replacements: Array<{ resources: PDFDict; name: PDFName; bytes: Uint8Array; ref: PDFRef }> = []
  let imagesAnalyzed = 0
  let imagesRecompressed = 0
  let processedPixels = 0

  for (const page of document.getPages()) {
    if (Date.now() > deadline) break
    const resources = page.node.Resources()
    if (!resources) continue
    const xObjectsValue = resources.get(PDFName.of('XObject'))
    const xObjects = document.context.lookup(xObjectsValue)
    if (!(xObjects instanceof PDFDict)) continue
    for (const [name, reference] of xObjects.entries()) {
      if (Date.now() > deadline) break
      const object = document.context.lookup(reference)
      if (!(object instanceof PDFRawStream) || !imageIsSupported(object)) continue
      imagesAnalyzed++
      const width = Number(object.dict.get(PDFName.of('Width'))?.toString())
      const height = Number(object.dict.get(PDFName.of('Height'))?.toString())
      const components = imageComponents(object)
      if (!width || !height || !components || width > DEFAULTS.maxImageDimension || height > DEFAULTS.maxImageDimension || width * height > DEFAULTS.maxImagePixels || width * height < DEFAULTS.minImagePixels || object.contents.length < DEFAULTS.minEncodedBytes) continue
      if (processedPixels + width * height > DEFAULTS.maxTotalPixels) break
      const inflated = await inflate(object.contents)
      if (!inflated) continue
      const params = decodeParams(object)
      const predictor = Number(params?.get(PDFName.of('Predictor'))?.toString() ?? 1)
      const raw = undoPredictor(inflated, width, height, components, predictor)
      const rgba = raw && rgbPixels(raw, width, height, components)
      if (!rgba) continue
      const pageWidth = page.getWidth()
      const targetWidth = Math.max(1, Math.min(width, Math.floor((pageWidth * targetDpi) / 72)))
      const ratio = targetWidth / width
      const targetHeight = Math.max(1, Math.round(height * ratio))
      const encoded = await codec({ rgba, width, height, targetWidth, targetHeight, quality })
      if (!encoded || encoded.byteLength >= object.contents.length * (1 - minSavingRatio)) continue
      if (!(reference instanceof PDFRef)) continue
      replacements.push({ resources: xObjects, name, bytes: encoded, ref: reference })
      imagesRecompressed++
      processedPixels += width * height
    }
  }
  if (replacements.length === 0) return unchanged(original, originalBytes, Date.now() > deadline ? 'O tempo de processamento foi excedido; o original foi preservado.' : 'Nenhuma imagem obteve economia segura; o original foi preservado.', imagesAnalyzed)

  options.onProgress?.('processing')
  for (const replacement of replacements) {
    const image = await document.embedJpg(replacement.bytes)
    replacement.resources.set(replacement.name, image.ref)
    document.context.delete(replacement.ref)
  }
  let output: Uint8Array
  try {
    output = await document.save({ useObjectStreams: false, updateFieldAppearances: false })
  } catch {
    return unchanged(original, originalBytes, 'A otimização falhou ao gerar um PDF completo; o original foi preservado.', imagesAnalyzed)
  }
  options.onProgress?.('verifying')
  if (output.byteLength >= originalBytes) return unchanged(original, originalBytes, 'A versão otimizada ficou maior ou não trouxe economia suficiente; o original foi preservado.', imagesAnalyzed)
  try {
    const verified = await PDFDocument.load(output, { ignoreEncryption: true, updateMetadata: false })
    if (verified.getPageCount() !== document.getPageCount()) return unchanged(original, originalBytes, 'A verificação detectou alteração na quantidade de páginas; o original foi preservado.', imagesAnalyzed)
  } catch {
    return unchanged(original, originalBytes, 'A verificação do resultado falhou; o original foi preservado.', imagesAnalyzed)
  }
  options.onProgress?.('complete')
  return { status: 'optimized', bytes: output, originalBytes, finalBytes: output.byteLength, savedRatio: 1 - output.byteLength / originalBytes, imagesAnalyzed, imagesRecompressed, method: 'image-recompression' }
}
