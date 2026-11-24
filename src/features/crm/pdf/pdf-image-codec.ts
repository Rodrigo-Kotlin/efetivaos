export type PdfImageCodecInput = {
  rgba: Uint8ClampedArray
  width: number
  height: number
  targetWidth: number
  targetHeight: number
  quality: number
}

export type PdfImageCodec = (input: PdfImageCodecInput) => Promise<Uint8Array | null>

function ownedArrayBuffer(bytes: ArrayLike<number>): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.length)
  new Uint8Array(copy).set(Array.from(bytes))
  return copy
}

function canvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const element = document.createElement('canvas')
  element.width = Math.max(1, width)
  element.height = Math.max(1, height)
  return element
}

export const browserJpegCodec: PdfImageCodec = async ({ rgba, width, height, targetWidth, targetHeight, quality }) => {
  const source = canvas(width, height)
  const target = canvas(targetWidth, targetHeight)
  if (!source || !target) return null
  const sourceContext = source.getContext('2d')
  const targetContext = target.getContext('2d')
  if (!sourceContext || !targetContext || typeof target.toBlob !== 'function') return null
  sourceContext.putImageData(new ImageData(new Uint8ClampedArray(ownedArrayBuffer(rgba)), width, height), 0, 0)
  targetContext.imageSmoothingEnabled = true
  targetContext.imageSmoothingQuality = 'high'
  targetContext.drawImage(source, 0, 0, targetWidth, targetHeight)
  const blob = await new Promise<Blob | null>((resolve) => target.toBlob(resolve, 'image/jpeg', quality))
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null
}
