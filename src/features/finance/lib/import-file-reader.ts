import { checkFileSize, IMPORT_LIMITS, type ParsedImportFile } from './import-file-parser'

let reading = false

export async function parseFile(file: File): Promise<ParsedImportFile> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !['csv', 'xls', 'xlsx'].includes(extension)) throw new Error('Unsupported file type. Use CSV, XLS or XLSX.')
  checkFileSize(file.size)
  if (reading) throw new Error('Aguarde a leitura da planilha anterior.')
  if (typeof Worker === 'undefined') throw new Error('Este navegador não oferece leitura segura de planilhas em segundo plano.')
  const fileType = extension === 'csv' ? 'csv' : 'xlsx'
  reading = true
  try {
    return await new Promise<ParsedImportFile>((resolve, reject) => {
      const worker = new Worker(new URL('./import-file.worker.ts', import.meta.url), { type: 'module' })
      const reader = new FileReader()
      let settled = false
      const timer = setTimeout(() => finish(new Error('Tempo limite de leitura da planilha excedido.')), IMPORT_LIMITS.timeoutMs)
      function finish(error?: Error, result?: ParsedImportFile) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        worker.terminate()
        reader.onload = null; reader.onerror = null
        if (reader.readyState === FileReader.LOADING) reader.abort()
        if (error) reject(error)
        else if (result) resolve(result)
        else reject(new Error('Failed to parse file'))
      }
      worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: ParsedImportFile; error?: string }>) => {
        if (event.data.ok) finish(undefined, event.data.result)
        else finish(new Error(event.data.error || 'Failed to parse file'))
      }
      worker.onerror = () => finish(new Error('Failed to parse file'))
      worker.onmessageerror = () => finish(new Error('Failed to parse file'))
      reader.onload = () => {
        try {
          const buffer = reader.result as ArrayBuffer
          checkFileSize(buffer.byteLength)
          worker.postMessage({ buffer, fileType }, [buffer])
        } catch (error) { finish(error instanceof Error ? error : new Error('Failed to parse file')) }
      }
      reader.onerror = () => finish(new Error(fileType === 'csv' ? 'Failed to read CSV file' : 'Failed to read XLSX file'))
      try { reader.readAsArrayBuffer(file) }
      catch (error) { finish(error instanceof Error ? error : new Error('Failed to parse file')) }
    })
  } finally { reading = false }
}
