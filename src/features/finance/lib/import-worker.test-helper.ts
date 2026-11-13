import { parseImportBuffer } from './import-file-parser'

/** jsdom has no Web Workers. Browser coverage separately exercises the real worker. */
export class ImportTestWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  terminated = false
  postMessage(data: { buffer: ArrayBuffer; fileType: 'csv' | 'xlsx' }) {
    queueMicrotask(() => {
      try { this.onmessage?.({ data: { ok: true, result: parseImportBuffer(data.buffer, data.fileType) } } as MessageEvent) }
      catch (error) { this.onmessage?.({ data: { ok: false, error: (error as Error).message } } as MessageEvent) }
    })
  }
  terminate() { this.terminated = true }
}
