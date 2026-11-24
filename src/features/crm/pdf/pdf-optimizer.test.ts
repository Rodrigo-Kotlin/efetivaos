import { PDFDocument } from 'pdf-lib'
import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

import { optimizePdfBytes } from './pdf-optimizer'

function chunk(type: string, data: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(12 + data.length)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, data.length)
  const typeBytes = new TextEncoder().encode(type)
  bytes.set(typeBytes, 4)
  bytes.set(data, 8)
  const crcInput = new Uint8Array(typeBytes.length + data.length)
  crcInput.set(typeBytes)
  crcInput.set(data, typeBytes.length)
  let crc = 0xffffffff
  for (const byte of crcInput) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0)
  return bytes
}

function noisyPng(width: number, height: number): Uint8Array {
  const raw = new Uint8Array(height * (width * 3 + 1))
  let random = 0x12345678
  for (let row = 0; row < height; row++) {
    raw[row * (width * 3 + 1)] = 0
    for (let column = 0; column < width * 3; column++) {
      random = Math.imul(random ^ (random >>> 13), 0x5bd1e995)
      raw[row * (width * 3 + 1) + column + 1] = random & 0xff
    }
  }
  // PNG's deterministic deflate stream is supplied by the browser-independent
  // fixture through a compact, unfiltered image generated below.
  const compressed = new Uint8Array(deflateSync(raw))
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width); view.setUint32(4, height); ihdr[8] = 8; ihdr[9] = 2
  return new Uint8Array([...signature, ...chunk('IHDR', ihdr), ...chunk('IDAT', compressed), ...chunk('IEND', new Uint8Array())])
}

const tinyJpeg = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AV//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AV//2gAMAwEAAgADAAAAEP/EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEABj8QH//Z'), (character) => character.charCodeAt(0))

describe('PDF optimizer', () => {
  it('preserves textual or already compact PDFs when there is no safe image candidate', async () => {
    const document = await PDFDocument.create()
    document.addPage()
    const validPdf = await document.save()
    const result = await optimizePdfBytes(validPdf)
    expect(result.status).toBe('unchanged')
    expect(result.bytes).toEqual(validPdf)
    expect(result.reason).toContain('imagem')
  })

  it('preserves signed PDFs without invoking processing', async () => {
    const signed = new TextEncoder().encode('%PDF-1.7\n/ByteRange [0 10 20 30]\n%%EOF')
    let called = false
    const result = await optimizePdfBytes(signed, { codec: async () => { called = true; return new Uint8Array() } })
    expect(result.status).toBe('unchanged')
    expect(result.reason).toContain('assinado')
    expect(called).toBe(false)
  })

  it('verifies that a compressed-image candidate keeps page count and only reports savings after verification', async () => {
    const document = await PDFDocument.create()
    const image = await document.embedPng(noisyPng(512, 512))
    const page = document.addPage([500, 500])
    page.drawImage(image, { x: 10, y: 10, width: 480, height: 480 })
    const source = await document.save()
    let codecCalled = false
    const result = await optimizePdfBytes(source, {
      minSavingRatio: 0,
      codec: async () => { codecCalled = true; return tinyJpeg },
    })
    expect(codecCalled).toBe(true)
    expect(result.originalBytes).toBe(source.byteLength)
    expect(result.status).toBe('optimized')
    expect(result.finalBytes).toBeLessThan(result.originalBytes)
    expect(result.imagesRecompressed).toBeGreaterThan(0)
  })
})
