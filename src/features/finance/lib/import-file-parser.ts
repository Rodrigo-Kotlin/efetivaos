import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Inflate } from 'fflate'
import type { ParsedRow } from './import-utils'

export const IMPORT_LIMITS = Object.freeze({
  fileBytes: 10 * 1024 * 1024,
  rows: 10_000,
  columns: 100,
  cells: 250_000,
  cellCharacters: 32_767,
  zipEntries: 2048,
  expandedBytes: 64 * 1024 * 1024,
  entryBytes: 16 * 1024 * 1024,
  timeoutMs: 15_000,
})
export type ParsedImport = { headers: string[]; rows: ParsedRow[] }
export type ParsedImportFile = ParsedImport & { fileType: 'csv' | 'xlsx' }
const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor'])
const invalidWorkbook = () => new Error('Arquivo XLS/XLSX inválido ou corrompido.')
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  return value >>> 0
})

function verifyZipEntry(bytes: Uint8Array, expectedSize: number, expectedCRC: number, method: number) {
  let size = 0, crc = 0xffffffff
  function consume(chunk: Uint8Array) {
    size += chunk.length
    if (size > expectedSize || size > IMPORT_LIMITS.entryBytes) throw new Error('Planilha excede o limite de descompressão segura.')
    for (const byte of chunk) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]
  }
  try {
    if (method === 0) consume(bytes)
    else {
      // Bound each compressed push. Do not materialize the full expanded archive.
      const inflater = new Inflate(consume)
      for (let i = 0; i < bytes.length; i += 1024) inflater.push(bytes.subarray(i, i + 1024), i + 1024 >= bytes.length)
      if (!bytes.length) throw invalidWorkbook()
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('limite de descompressão')) throw error
    throw invalidWorkbook()
  }
  if (size !== expectedSize || ((crc ^ 0xffffffff) >>> 0) !== expectedCRC) throw invalidWorkbook()
}
function stripBom(text: string) { return text.replace(/^\uFEFF/, '') }

export function checkFileSize(bytes: number) {
  if (bytes > IMPORT_LIMITS.fileBytes) throw new Error('Arquivo excede o limite de 10 MB.')
}

export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  checkFileSize(buffer.byteLength)
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return stripBom(new TextDecoder('utf-8').decode(bytes.subarray(3)))
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return stripBom(new TextDecoder('utf-16le').decode(bytes.subarray(2)))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return stripBom(new TextDecoder('utf-16be').decode(bytes.subarray(2)))
  try { return stripBom(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  catch { return stripBom(new TextDecoder('windows-1252').decode(bytes)) }
}

function checkHeaders(headers: string[]) {
  if (headers.length > IMPORT_LIMITS.columns) throw new Error('Planilha excede o limite de 100 colunas.')
  for (const header of headers) {
    if (dangerousKeys.has(header.trim().toLowerCase())) throw new Error('Cabeçalho inseguro na planilha.')
    if (header.length > IMPORT_LIMITS.cellCharacters) throw new Error('Célula excede o limite de 32767 caracteres.')
  }
}

function safeRows(headers: string[], rows: ParsedRow[]): ParsedImport {
  checkHeaders(headers)
  if (rows.length > IMPORT_LIMITS.rows) throw new Error('Planilha excede o limite de 10000 linhas de dados.')
  if (rows.length * headers.length > IMPORT_LIMITS.cells) throw new Error('Planilha excede o limite de 250000 células.')
  const safe = rows.map(row => {
    const target: ParsedRow = Object.create(null)
    for (const key of Object.keys(row)) {
      if (dangerousKeys.has(key.trim().toLowerCase())) throw new Error('Cabeçalho inseguro na planilha.')
      const value = row[key]
      if (typeof value === 'string' && value.length > IMPORT_LIMITS.cellCharacters) throw new Error('Célula excede o limite de 32767 caracteres.')
      if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') throw new Error('Tipo de célula inválido na planilha.')
      target[key] = value
    }
    return target
  })
  return { headers, rows: safe }
}

export function parseCSV(rawText: string): ParsedImport {
  checkFileSize(new TextEncoder().encode(rawText).byteLength)
  const text = stripBom(rawText)
  let consumed = 0
  const collected: ParsedRow[] = []
  const result = Papa.parse<ParsedRow>(text, {
    header: true, skipEmptyLines: true, dynamicTyping: false,
    beforeFirstChunk(chunk) {
      const first = Papa.parse<string[]>(chunk, { preview: 1, skipEmptyLines: true }).data[0] ?? []
      checkHeaders(first.map(stripBom))
      return chunk
    },
    step(row, parser) {
      consumed++
      if (consumed > IMPORT_LIMITS.rows) { parser.abort(); throw new Error('Planilha excede o limite de 10000 linhas de dados.') }
      if (consumed * (row.meta.fields?.length ?? 0) > IMPORT_LIMITS.cells) { parser.abort(); throw new Error('Planilha excede o limite de 250000 células.') }
      if (row.errors.some(error => error.type === 'Quotes' || error.type === 'FieldMismatch')) {
        parser.abort(); throw new Error('Arquivo CSV inválido ou corrompido.')
      }
      collected.push(row.data)
    },
  })
  const headers = (result.meta.fields || []).map(stripBom)
  return safeRows(headers, collected)
}

// ZIP metadata is checked before SheetJS expands any OOXML part. A worker deadline
// is also required: metadata alone cannot certify the cost of an arbitrary parser.
export function checkWorkbookContainer(buffer: ArrayBuffer) {
  checkFileSize(buffer.byteLength)
  if (!buffer.byteLength) throw invalidWorkbook()
  const bytes = new Uint8Array(buffer), view = new DataView(buffer)
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    const cfb = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((value, i) => bytes[i] === value)
    const biff = bytes[0] === 0x09 && [0x00, 0x02, 0x04, 0x08].includes(bytes[1])
    if (!cfb && !biff) throw invalidWorkbook()
    return
  }
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break }
  }
  if (end < 0) throw invalidWorkbook()
  const count = view.getUint16(end + 10, true), directorySize = view.getUint32(end + 12, true)
  let position = view.getUint32(end + 16, true), expanded = 0
  const directoryStart = position
  if (count > IMPORT_LIMITS.zipEntries) throw new Error('Planilha excede o limite de entradas ZIP.')
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count || position + directorySize !== end) throw invalidWorkbook()
  const names = new Set<string>()
  for (let i = 0; i < count; i++) {
    if (position + 46 > end || view.getUint32(position, true) !== 0x02014b50) throw invalidWorkbook()
    const flags = view.getUint16(position + 8, true), method = view.getUint16(position + 10, true)
    const compressed = view.getUint32(position + 20, true), size = view.getUint32(position + 24, true)
    const length = view.getUint16(position + 28, true), extra = view.getUint16(position + 30, true), comment = view.getUint16(position + 32, true)
    const local = view.getUint32(position + 42, true), next = position + 46 + length + extra + comment
    if (next > end || flags & 1 || ![0, 8].includes(method) || view.getUint16(position + 34, true)) throw invalidWorkbook()
    expanded += size
    if (size > IMPORT_LIMITS.entryBytes || expanded > IMPORT_LIMITS.expandedBytes) throw new Error('Planilha excede o limite de descompressão segura.')
    if (local + 30 > directoryStart || view.getUint32(local, true) !== 0x04034b50) throw invalidWorkbook()
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    if (start + compressed > directoryStart) throw invalidWorkbook()
    const name = new TextDecoder().decode(bytes.subarray(position + 46, position + 46 + length))
    if (names.has(name) || name.includes('..') || name.includes('\0') || /[\\:]/.test(name)) throw invalidWorkbook()
    if (/vbaproject|macrosheets|externallinks/i.test(name)) throw new Error('Planilha com macros ou vínculos externos não é permitida.')
    const localName = new TextDecoder().decode(bytes.subarray(local + 30, local + 30 + view.getUint16(local + 26, true)))
    if (localName !== name || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method) throw invalidWorkbook()
    if (!(flags & 8) && (view.getUint32(local + 18, true) !== compressed || view.getUint32(local + 22, true) !== size)) throw invalidWorkbook()
    verifyZipEntry(bytes.subarray(start, start + compressed), size, view.getUint32(position + 16, true), method)
    names.add(name); position = next
  }
  if (position !== end || !names.has('[Content_Types].xml') || !names.has('xl/workbook.xml')) throw invalidWorkbook()
}

export function parseXLSX(buffer: ArrayBuffer): ParsedImport {
  checkWorkbookContainer(buffer)
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'array', sheetRows: IMPORT_LIMITS.rows + 2, bookVBA: true, cellHTML: false, cellNF: false, cellStyles: false })
  } catch { throw invalidWorkbook() }
  if (wb.vbaraw) throw new Error('Planilha com macros ou vínculos externos não é permitida.')
  if (!wb.SheetNames.length) throw invalidWorkbook()
  // BIFF readers can assign !ref=A1 even to a sheet with no actual cells.
  const sheetName = wb.SheetNames.find(name => Object.keys(wb.Sheets[name] ?? {}).some(key => !key.startsWith('!') && wb.Sheets[name][key]?.t !== 'z')) ?? wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  if (!sheet) throw invalidWorkbook()
  const ref = sheet['!fullref'] ?? sheet['!ref']
  if (ref) {
    const range = XLSX.utils.decode_range(ref)
    if (range.e.r - range.s.r > IMPORT_LIMITS.rows || range.e.r >= IMPORT_LIMITS.rows + 2) throw new Error('Planilha excede o limite de 10000 linhas de dados.')
    if (range.e.c - range.s.c + 1 > IMPORT_LIMITS.columns) throw new Error('Planilha excede o limite de 100 colunas.')
    if ((range.e.r - range.s.r) * (range.e.c - range.s.c + 1) > IMPORT_LIMITS.cells) throw new Error('Planilha excede o limite de 250000 células.')
    const header = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, range: { s: range.s, e: { r: range.s.r, c: range.e.c } }, raw: true })[0] ?? []
    checkHeaders(header.map(value => String(value ?? '')))
  }
  // No formula evaluator, HTML renderer, macro execution or link fetch is used.
  const data = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: null, raw: true })
  const headers = data.length ? Object.keys(data[0]) : []
  return safeRows(headers, data)
}

export function parseImportBuffer(buffer: ArrayBuffer, fileType: 'csv' | 'xlsx'): ParsedImportFile {
  const parsed = fileType === 'csv' ? parseCSV(decodeCsvBuffer(buffer)) : parseXLSX(buffer)
  return { ...parsed, fileType }
}
