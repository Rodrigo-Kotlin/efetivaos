import { parseImportBuffer } from './import-file-parser'
import * as XLSX from 'xlsx'
import * as codepage from 'xlsx/dist/cpexcel.full.mjs'

// The official ESM build requires explicit legacy codepage support (e.g. BIFF5).
XLSX.set_cptable(codepage)

// The worker receives only file bytes and type, never Auth/session/financial IDs.
self.onmessage = (event: MessageEvent<{ buffer: ArrayBuffer; fileType: 'csv' | 'xlsx' }>) => {
  try { self.postMessage({ ok: true, result: parseImportBuffer(event.data.buffer, event.data.fileType) }) }
  catch (error) { self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Failed to parse file' }) }
}
