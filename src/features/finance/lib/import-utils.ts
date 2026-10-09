import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportFileType = 'csv' | 'xlsx'

export type ColumnMapping = {
  transaction_date?: string
  competence_date?: string
  description?: string
  amount?: string
  movement_type?: string
  category?: string
  origin_account?: string
  destination_account?: string
  party?: string
  cost_center?: string
  service_line?: string
  payment_method?: string
  due_date?: string
  status?: string
  notes?: string
}

export type ParsedRow = Record<string, string | number | null>

/**
 * Structured validation error used by the result UI to present each rejection
 * as Linha / Campo / Valor / Motivo. `errors` keeps the human-readable strings
 * (used for persistence and backward compatibility), while `errorDetails`
 * breaks them down for display.
 */
export type RowErrorDetail = {
  /** Human-readable field label, e.g. "Competência". */
  field: string
  /** Original value found in the file, when applicable. */
  value?: string
  /** Reason without the field/value prefix. */
  reason: string
}

export type ValidatedRow = {
  row_number: number
  raw: ParsedRow
  mapped: Record<string, unknown>
  valid: boolean
  errors: string[]
  errorDetails: RowErrorDetail[]
  warnings: string[]
  idempotency_key: string
}

export type ImportPreview = {
  headers: string[]
  rows: ValidatedRow[]
  total: number
  valid: number
  invalid: number
}

/**
 * Minimal shape of a financial registry entry used to resolve the textual
 * references (category, accounts, party, cost center, service line, payment
 * method) present in the imported file into the UUIDs required by the ledger.
 */
export type ReferenceOption = { id: string; name: string }

export type ReferenceLists = {
  categories?: ReferenceOption[]
  accounts?: ReferenceOption[]
  parties?: ReferenceOption[]
  costCenters?: ReferenceOption[]
  serviceLines?: ReferenceOption[]
  paymentMethods?: ReferenceOption[]
}

// ---------------------------------------------------------------------------
// Required fields for import
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = ['transaction_date', 'description', 'amount', 'movement_type']

const VALID_MOVEMENT_TYPES = [
  'RECEITA', 'DESPESA', 'TRANSFERENCIA', 'EMPRESTIMO_RECEBIDO',
  'EMPRESTIMO_PAGO', 'APORTE', 'RETIRADA', 'IMOBILIZADO', 'SALDO_INICIAL', 'AJUSTE',
]

// Mirrors public.validate_transaction_by_movement_type() in the database so the
// preview and the persistence agree. Keep in sync with that function.
const REQUIRED_REFERENCES: Record<string, string[]> = {
  RECEITA: ['category', 'origin_account'],
  DESPESA: ['category', 'destination_account'],
  TRANSFERENCIA: ['origin_account', 'destination_account'],
  EMPRESTIMO_RECEBIDO: ['origin_account'],
  EMPRESTIMO_PAGO: ['destination_account'],
  APORTE: ['origin_account'],
  RETIRADA: ['origin_account'],
  IMOBILIZADO: ['category'],
  SALDO_INICIAL: ['origin_account'],
}

const REFERENCE_FIELDS: Array<{ field: string; list: keyof ReferenceLists; label: string }> = [
  { field: 'category', list: 'categories', label: 'Categoria' },
  { field: 'origin_account', list: 'accounts', label: 'Conta de origem' },
  { field: 'destination_account', list: 'accounts', label: 'Conta de destino' },
  { field: 'party', list: 'parties', label: 'Pessoa' },
  { field: 'cost_center', list: 'costCenters', label: 'Centro de custo' },
  { field: 'service_line', list: 'serviceLines', label: 'Linha de serviço' },
  { field: 'payment_method', list: 'paymentMethods', label: 'Forma de pagamento' },
]

// ---------------------------------------------------------------------------
// Parse file
// ---------------------------------------------------------------------------

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '')
}

/**
 * Decodes a CSV file honouring the BOM and falling back to Windows-1252 when
 * the bytes are not valid UTF-8. pt-BR spreadsheets are commonly exported in
 * Windows-1252, which would otherwise garble accented headers ("Descrição").
 */
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return stripBom(new TextDecoder('utf-8').decode(bytes.subarray(3)))
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return stripBom(new TextDecoder('utf-16le').decode(bytes.subarray(2)))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return stripBom(new TextDecoder('utf-16be').decode(bytes.subarray(2)))
  }
  try {
    return stripBom(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    return stripBom(new TextDecoder('windows-1252').decode(bytes))
  }
}

export function parseCSV(rawText: string): { headers: string[]; rows: ParsedRow[] } {
  const text = stripBom(rawText)
  const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false })
  const headers = (result.meta.fields || []).map(h => stripBom(h))
  return { headers, rows: result.data as ParsedRow[] }
}

export function parseXLSX(buffer: ArrayBuffer): { headers: string[]; rows: ParsedRow[] } {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName =
    wb.SheetNames.find(name => Boolean((wb.Sheets[name] as { '!ref'?: string } | undefined)?.['!ref'])) ??
    wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  // raw:true keeps date cells as Excel serial numbers and numbers as numbers,
  // which the normalisation helpers can handle deterministically.
  const data = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: null, raw: true })
  const headers = data.length > 0 ? Object.keys(data[0]) : []
  return { headers, rows: data }
}

export function parseFile(file: File): Promise<{ headers: string[]; rows: ParsedRow[]; fileType: ImportFileType }> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer
        const { headers, rows } = parseCSV(decodeCsvBuffer(buffer))
        resolve({ headers, rows, fileType: 'csv' })
      }
      reader.onerror = () => reject(new Error('Failed to read CSV file'))
      reader.readAsArrayBuffer(file)
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer
        const { headers, rows } = parseXLSX(buffer)
        resolve({ headers, rows, fileType: 'xlsx' })
      }
      reader.onerror = () => reject(new Error('Failed to read XLSX file'))
      reader.readAsArrayBuffer(file)
    } else {
      reject(new Error('Unsupported file type. Use CSV, XLS or XLSX.'))
    }
  })
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

const DEFAULT_COLUMN_MAP: Record<string, string[]> = {
  transaction_date: ['data', 'data transacao', 'data_transacao', 'transaction_date', 'date', 'data pagamento', 'data_lancamento'],
  competence_date: ['competencia', 'competência', 'competence_date', 'periodo'],
  description: ['descricao', 'descrição', 'description', 'historico', 'histórico', 'desc'],
  amount: ['valor', 'amount', 'valor_total', 'price'],
  movement_type: ['tipo', 'type', 'tipo_movimento', 'movement_type', 'natureza'],
  category: ['categoria', 'category', 'cat'],
  origin_account: ['conta origem', 'conta_origem', 'origin_account', 'conta'],
  destination_account: ['conta destino', 'conta_destino', 'destination_account'],
  party: ['pessoa', 'party', 'cliente', 'fornecedor', 'client', 'supplier', 'razao_social'],
  cost_center: ['centro de custo', 'centro_de_custo', 'cost_center', 'cc'],
  service_line: ['linha de servico', 'linha_de_serviço', 'service_line', 'linha'],
  payment_method: ['forma pagamento', 'forma_de_pagamento', 'payment_method', 'pagamento'],
  due_date: ['vencimento', 'due_date', 'data_vencimento'],
  notes: ['observacao', 'observação', 'notes', 'obs', 'complemento'],
}

export function guessColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const lower = headers.map(h => normalizeKey(h))

  for (const [field, aliases] of Object.entries(DEFAULT_COLUMN_MAP)) {
    const normalizedAliases = aliases.map(alias => normalizeKey(alias))
    for (let i = 0; i < lower.length; i++) {
      if (normalizedAliases.includes(lower[i])) {
        ;(mapping as Record<string, string>)[field] = headers[i]
        break
      }
    }
  }

  return mapping
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Lower-cased, accent-free, single-spaced key used for name matching. */
function normalizeKey(value: string): string {
  return stripDiacritics(String(value)).toLowerCase().trim().replace(/\s+/g, ' ')
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0 || serial > 2958465) return null
  return new Date(EXCEL_EPOCH_MS + Math.round(serial * 86400000))
}

function formatDateUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function formatDateLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return formatDateUTC(date)
}

/** Normalises a full date (DD/MM/YYYY, YYYY-MM-DD, Excel serial, Date) to YYYY-MM-DD. */
export function toDate(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : formatDateLocal(val)
  if (typeof val === 'number') {
    const date = excelSerialToDate(val)
    return date ? formatDateUTC(date) : null
  }

  const s = String(val).trim()
  if (s === '') return null

  if (/^\d+(\.\d+)?$/.test(s)) {
    const date = excelSerialToDate(parseFloat(s))
    return date ? formatDateUTC(date) : null
  }

  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    let year = parseInt(m[3], 10)
    if (year < 100) year += year < 50 ? 2000 : 1900
    return buildDate(year, parseInt(m[2], 10), parseInt(m[1], 10))
  }

  m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/)
  if (m) return buildDate(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10))

  return null
}

/** Normalises a competence (MM/YYYY, YYYY-MM or full date) to YYYY-MM-01. */
export function toCompetenceDate(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : formatDateLocal(val)
  if (typeof val === 'number') {
    const date = excelSerialToDate(val)
    return date ? formatDateUTC(date) : null
  }

  const s = String(val).trim()
  if (s === '') return null

  let m = s.match(/^(\d{1,2})[/\-.](\d{4})$/)
  if (m) {
    const month = parseInt(m[1], 10)
    if (month < 1 || month > 12) return null
    return `${m[2]}-${String(month).padStart(2, '0')}-01`
  }

  m = s.match(/^(\d{4})[/\-.](\d{1,2})$/)
  if (m) {
    const month = parseInt(m[2], 10)
    if (month < 1 || month > 12) return null
    return `${m[1]}-${String(month).padStart(2, '0')}-01`
  }

  return toDate(s)
}

/**
 * Normalises pt-BR ("1.234,56"), en-US ("1,234.56") and plain ("1234,56" /
 * "1234.56") monetary strings — including currency symbols — to a number.
 */
export function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return Number.isFinite(val) ? val : null

  let s = String(val).trim()
  if (s === '') return null

  s = s.replace(/[^\d.,-]/g, '').replace(/(?!^)-/g, '')
  if (s === '' || s === '-') return null

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.') // 1.234,56 (pt-BR)
    } else {
      s = s.replace(/,/g, '') // 1,234.56 (en-US)
    }
  } else if (hasComma) {
    s = s.replace(',', '.')
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '') // 1.234 / 1.234.567 (pt-BR grouping)
  }

  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

export function normalizeMovementType(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null
  const key = stripDiacritics(String(val)).toUpperCase().replace(/[^A-Z0-9]/g, '')

  const map: Record<string, string> = {
    RECEITA: 'RECEITA', RECEITAS: 'RECEITA', RECE: 'RECEITA',
    DESPESA: 'DESPESA', DESPESAS: 'DESPESA', DESP: 'DESPESA',
    TRANSFERENCIA: 'TRANSFERENCIA', TRANSF: 'TRANSFERENCIA',
    EMPRESTIMORECEBIDO: 'EMPRESTIMO_RECEBIDO', EMPRESTIMOREC: 'EMPRESTIMO_RECEBIDO',
    EMPRESTIMOPAGO: 'EMPRESTIMO_PAGO', EMPRESTIMOPG: 'EMPRESTIMO_PAGO',
    APORTE: 'APORTE',
    RETIRADA: 'RETIRADA',
    IMOBILIZADO: 'IMOBILIZADO', IMOB: 'IMOBILIZADO',
    SALDOINICIAL: 'SALDO_INICIAL', SALDO: 'SALDO_INICIAL',
    AJUSTE: 'AJUSTE',
  }

  return map[key] || (VALID_MOVEMENT_TYPES.includes(key) ? key : null)
}

function generateIdempotencyKey(rowNumber: number, data: ParsedRow, batchId: string): string {
  const parts = [
    batchId,
    String(rowNumber),
    String(data.transaction_date || ''),
    String(data.description || ''),
    String(data.amount || ''),
  ].join('|')
  // Simple hash
  let hash = 0
  for (let i = 0; i < parts.length; i++) {
    const chr = parts.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return `import_${batchId.slice(0, 8)}_${rowNumber}_${Math.abs(hash).toString(36)}`
}

// ---------------------------------------------------------------------------
// Reference resolution (names in the file -> UUIDs in the ledger)
// ---------------------------------------------------------------------------

type ReferenceIndex = Partial<Record<keyof ReferenceLists, Map<string, string>>>

function buildReferenceIndex(references: ReferenceLists): ReferenceIndex {
  const index: ReferenceIndex = {}
  for (const { list } of REFERENCE_FIELDS) {
    if (index[list]) continue
    const map = new Map<string, string>()
    for (const option of references[list] ?? []) {
      const key = normalizeKey(option.name)
      if (key && !map.has(key)) map.set(key, option.id)
    }
    index[list] = map
  }
  return index
}

function validateReferences(
  mapped: Record<string, unknown>,
  movementType: string | undefined,
  references: ReferenceLists,
  errors: string[],
  errorDetails: RowErrorDetail[],
): void {
  const index = buildReferenceIndex(references)

  for (const { field, list, label } of REFERENCE_FIELDS) {
    const raw = mapped[field]
    if (raw === undefined || raw === null || raw === '') continue
    const id = index[list]?.get(normalizeKey(String(raw)))
    if (id) {
      mapped[`${field}_id`] = id
    } else {
      errors.push(`${label} "${String(raw)}" não encontrada nos cadastros financeiros`)
      errorDetails.push({ field: label, value: String(raw), reason: 'Não encontrada nos cadastros financeiros' })
    }
  }

  for (const field of REQUIRED_REFERENCES[movementType ?? ''] ?? []) {
    const meta = REFERENCE_FIELDS.find(item => item.field === field)!
    if (!mapped[`${field}_id`]) {
      errors.push(`${meta.label} é obrigatória para ${movementType}`)
      errorDetails.push({ field: meta.label, reason: `Obrigatória para ${movementType}` })
    }
  }

  if (
    movementType === 'TRANSFERENCIA' &&
    mapped.origin_account_id &&
    mapped.origin_account_id === mapped.destination_account_id
  ) {
    errors.push('Conta de origem e conta de destino devem ser diferentes')
    errorDetails.push({ field: 'Conta de destino', reason: 'Deve ser diferente da conta de origem' })
  }
}

// ---------------------------------------------------------------------------
// Row validation
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  transaction_date: 'Data',
  competence_date: 'Competência',
  description: 'Descrição',
  amount: 'Valor',
  movement_type: 'Tipo',
}

function validateRow(
  row: ParsedRow,
  mapping: ColumnMapping,
  references?: ReferenceLists,
): { valid: boolean; errors: string[]; errorDetails: RowErrorDetail[]; warnings: string[]; mapped: Record<string, unknown> } {
  const errors: string[] = []
  const errorDetails: RowErrorDetail[] = []
  const warnings: string[] = []
  const mapped: Record<string, unknown> = {}

  // Map fields
  for (const [field, csvCol] of Object.entries(mapping)) {
    if (csvCol && row[csvCol] !== undefined && row[csvCol] !== null && row[csvCol] !== '') {
      mapped[field] = row[csvCol]
    }
  }

  // Validate required fields
  for (const req of REQUIRED_FIELDS) {
    if (!mapped[req] && mapped[req] !== 0) {
      errors.push(`Campo obrigatório ausente: ${req}`)
      errorDetails.push({ field: FIELD_LABELS[req] ?? req, reason: 'Campo obrigatório ausente' })
    }
  }

  // Validate transaction_date
  if (mapped.transaction_date) {
    const rawDate = mapped.transaction_date
    const d = toDate(rawDate)
    if (!d) {
      errors.push(`Data inválida: ${rawDate}`)
      errorDetails.push({ field: 'Data', value: String(rawDate), reason: 'Data inválida' })
    } else {
      mapped.transaction_date = d
    }
  }

  // Validate competence_date.
  // A competence explicitly informed but invalid is a row error: it must never
  // silently fall back to the transaction date. The fallback is only allowed
  // when the competence is ABSENT (see below), preserving the existing contract.
  let competencePresent = false
  if (mapped.competence_date) {
    competencePresent = true
    const rawCompetence = mapped.competence_date
    const d = toCompetenceDate(rawCompetence)
    if (!d) {
      errors.push(`Competência inválida: ${rawCompetence}. Use MM/AAAA.`)
      errorDetails.push({ field: 'Competência', value: String(rawCompetence), reason: 'Mês inválido. Use MM/AAAA.' })
      delete mapped.competence_date
    } else {
      mapped.competence_date = d
    }
  }

  // Validate amount
  if (mapped.amount !== undefined && mapped.amount !== null) {
    const rawAmount = mapped.amount
    const n = toNumber(rawAmount)
    if (n === null) {
      errors.push(`Valor inválido: ${rawAmount}`)
      errorDetails.push({ field: 'Valor', value: String(rawAmount), reason: 'Valor inválido' })
    } else if (n <= 0) {
      errors.push(`Valor deve ser positivo: ${n}`)
      errorDetails.push({ field: 'Valor', value: String(rawAmount), reason: 'Valor deve ser positivo' })
    } else {
      mapped.amount = n
    }
  }

  // Validate movement_type
  if (mapped.movement_type) {
    const rawType = mapped.movement_type
    const t = normalizeMovementType(rawType)
    if (!t) {
      errors.push(`Tipo de lançamento inválido: ${rawType}`)
      errorDetails.push({ field: 'Tipo', value: String(rawType), reason: 'Tipo de lançamento inválido' })
    } else {
      mapped.movement_type = t
    }
  }

  // Normalize dates
  if (mapped.due_date) {
    const d = toDate(mapped.due_date)
    if (d) mapped.due_date = d
  }

  // competence_date fallback — only when the competence was absent in the file.
  // A present-and-invalid competence already produced a row error and must not
  // be replaced by the transaction date.
  if (!competencePresent && !mapped.competence_date && mapped.transaction_date) {
    mapped.competence_date = mapped.transaction_date
  }

  // Resolve textual references to UUIDs and enforce the same minimum
  // requirements the ledger enforces (preview == persistence).
  if (references) {
    validateReferences(mapped, mapped.movement_type as string | undefined, references, errors, errorDetails)
  }

  return { valid: errors.length === 0, errors, errorDetails, warnings, mapped }
}

// ---------------------------------------------------------------------------
// Preview generation
// ---------------------------------------------------------------------------

export function generatePreview(
  headers: string[],
  rows: ParsedRow[],
  mapping: ColumnMapping,
  batchId: string,
  references?: ReferenceLists,
): ImportPreview {
  const validated: ValidatedRow[] = rows.map((row, i) => {
    const { valid, errors, errorDetails, warnings, mapped } = validateRow(row, mapping, references)
    return {
      row_number: i + 1,
      raw: row,
      mapped,
      valid,
      errors,
      errorDetails,
      warnings,
      idempotency_key: generateIdempotencyKey(i + 1, row, batchId),
    }
  })

  return {
    headers,
    rows: validated,
    total: validated.length,
    valid: validated.filter(r => r.valid).length,
    invalid: validated.filter(r => !r.valid).length,
  }
}

// ---------------------------------------------------------------------------
// Template generation
// ---------------------------------------------------------------------------

export const TEMPLATE_COLUMNS = [
  'Data', 'Competência', 'Descrição', 'Valor', 'Tipo',
  'Categoria', 'Conta Origem', 'Conta Destino', 'Pessoa',
  'Centro de Custo', 'Linha de Serviço', 'Forma de Pagamento',
  'Vencimento', 'Observação',
]

export const TEMPLATE_MAPPING: Record<string, string> = {
  Data: 'transaction_date',
  Competência: 'competence_date',
  Descrição: 'description',
  Valor: 'amount',
  Tipo: 'movement_type',
  Categoria: 'category',
  'Conta Origem': 'origin_account',
  'Conta Destino': 'destination_account',
  Pessoa: 'party',
  'Centro de Custo': 'cost_center',
  'Linha de Serviço': 'service_line',
  'Forma de Pagamento': 'payment_method',
  Vencimento: 'due_date',
  Observação: 'notes',
}

export function downloadTemplate(format: 'csv' | 'xlsx') {
  const rows = [
    ['01/08/2026', '08/2026', 'Pagamento fornecedor ABC', '1500,00', 'DESPESA', 'Material', '', 'Conta Principal', 'Fornecedor ABC', '', '', 'PIX', '10/08/2026', ''],
    ['02/08/2026', '08/2026', 'Receita cliente XYZ', '3200,00', 'RECEITA', 'Assessoria', 'Conta Principal', '', 'Cliente XYZ', '', '', 'Boleto', '15/08/2026', ''],
    ['03/08/2026', '08/2026', 'Transferência entre contas', '5000,00', 'TRANSFERENCIA', '', 'Conta Principal', 'Conta Secundária', '', '', '', '', '', ''],
  ]

  if (format === 'csv') {
    const csv = Papa.unparse({ fields: TEMPLATE_COLUMNS, data: rows })
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, 'modelo_importacao_financeira.csv')
  } else {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    downloadBlob(blob, 'modelo_importacao_financeira.xlsx')
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
