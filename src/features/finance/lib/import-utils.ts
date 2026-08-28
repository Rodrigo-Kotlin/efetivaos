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

export type ValidatedRow = {
  row_number: number
  raw: ParsedRow
  mapped: Record<string, unknown>
  valid: boolean
  errors: string[]
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

// ---------------------------------------------------------------------------
// Required fields for import
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = ['transaction_date', 'description', 'amount', 'movement_type']

const VALID_MOVEMENT_TYPES = [
  'RECEITA', 'DESPESA', 'TRANSFERENCIA', 'EMPRESTIMO_RECEBIDO',
  'EMPRESTIMO_PAGO', 'APORTE', 'RETIRADA', 'IMOBILIZADO', 'SALDO_INICIAL', 'AJUSTE',
]

// ---------------------------------------------------------------------------
// Parse file
// ---------------------------------------------------------------------------

export function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true })
  const headers = result.meta.fields || []
  return { headers, rows: result.data as ParsedRow[] }
}

export function parseXLSX(buffer: ArrayBuffer): { headers: string[]; rows: ParsedRow[] } {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: null })
  const headers = data.length > 0 ? Object.keys(data[0]) : []
  return { headers, rows: data }
}

export function parseFile(file: File): Promise<{ headers: string[]; rows: ParsedRow[]; fileType: ImportFileType }> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const { headers, rows } = parseCSV(text)
        resolve({ headers, rows, fileType: 'csv' })
      }
      reader.onerror = () => reject(new Error('Failed to read CSV file'))
      reader.readAsText(file)
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
      reject(new Error('Unsupported file type. Use CSV or XLSX.'))
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
  const lower = headers.map(h => h.toLowerCase().trim())

  for (const [field, aliases] of Object.entries(DEFAULT_COLUMN_MAP)) {
    for (let i = 0; i < lower.length; i++) {
      if (aliases.includes(lower[i])) {
        ;(mapping as Record<string, string>)[field] = headers[i]
        break
      }
    }
  }

  return mapping
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

function toDate(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  const s = String(val).trim()
  // Try DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return val
  const s = String(val).trim()
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function normalizeMovementType(val: unknown): string | null {
  if (!val) return null
  const s = String(val).trim().toUpperCase()
    .replace(/[^A-Z]/g, '')
  // Common variations
  const map: Record<string, string> = {
    RECEITA: 'RECEITA', RECEITAS: 'RECEITA', RECE: 'RECEITA',
    DESPESA: 'DESPESA', DESPESAS: 'DESPESA', DESP: 'DESPESA',
    TRANSF: 'TRANSFERENCIA', TRANSFERENCIA: 'TRANSFERENCIA', TRANSFERÊNCIA: 'TRANSFERENCIA',
    EMPRESTIMO: 'EMPRESTIMO_RECEBIDO', EMP: 'EMPRESTIMO_RECEBIDO',
    EMPRESTIMOPAGO: 'EMPRESTIMO_PAGO', EMPAGO: 'EMPRESTIMO_PAGO',
    APORTE: 'APORTE',
    RETIRADA: 'RETIRADA',
    IMOBILIZADO: 'IMOBILIZADO', IMOB: 'IMOBILIZADO',
    SALDO: 'SALDO_INICIAL', SALDOINICIAL: 'SALDO_INICIAL',
    AJUSTE: 'AJUSTE',
  }
  return map[s] || (VALID_MOVEMENT_TYPES.includes(s) ? s : null)
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
// Row validation
// ---------------------------------------------------------------------------

function validateRow(row: ParsedRow, mapping: ColumnMapping, rowNumber: number): { valid: boolean; errors: string[]; warnings: string[]; mapped: Record<string, unknown> } {
  const errors: string[] = []
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
      errors.push(`Field '${req}' is required`)
    }
  }

  // Validate transaction_date
  if (mapped.transaction_date) {
    const d = toDate(mapped.transaction_date)
    if (!d) errors.push(`Invalid date: ${mapped.transaction_date}`)
    else mapped.transaction_date = d
  }

  // Validate competence_date
  if (mapped.competence_date) {
    const d = toDate(mapped.competence_date)
    if (!d) warnings.push(`Invalid competence date: ${mapped.competence_date}, using transaction_date`)
    else mapped.competence_date = d
  }

  // Validate amount
  if (mapped.amount !== undefined && mapped.amount !== null) {
    const n = toNumber(mapped.amount)
    if (n === null) errors.push(`Invalid amount: ${mapped.amount}`)
    else if (n <= 0) errors.push(`Amount must be positive: ${n}`)
    else mapped.amount = n
  }

  // Validate movement_type
  if (mapped.movement_type) {
    const t = normalizeMovementType(mapped.movement_type)
    if (!t) errors.push(`Invalid movement type: ${mapped.movement_type}`)
    else mapped.movement_type = t
  }

  // Normalize dates
  if (mapped.due_date) {
    const d = toDate(mapped.due_date)
    if (d) mapped.due_date = d
  }

  // competence_date fallback
  if (!mapped.competence_date && mapped.transaction_date) {
    mapped.competence_date = mapped.transaction_date
  }

  // Generate idempotency key
  const idempotency_key = generateIdempotencyKey(rowNumber, row, 'batch')

  return { valid: errors.length === 0, errors, warnings, mapped }
}

// ---------------------------------------------------------------------------
// Preview generation
// ---------------------------------------------------------------------------

export function generatePreview(
  headers: string[],
  rows: ParsedRow[],
  mapping: ColumnMapping,
  batchId: string,
): ImportPreview {
  const validated: ValidatedRow[] = rows.map((row, i) => {
    const { valid, errors, warnings, mapped } = validateRow(row, mapping, i + 1)
    return {
      row_number: i + 1,
      raw: row,
      mapped,
      valid,
      errors,
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
    ['2026-08-01', '2026-08-01', 'Pagamento fornecedor ABC', '1500.00', 'DESPESA', 'Material', '', '', 'Fornecedor ABC', '', '', 'PIX', '2026-08-10', ''],
    ['2026-08-02', '2026-08-02', 'Receita cliente XYZ', '3200.00', 'RECEITA', 'Assessoria', '', '', 'Cliente XYZ', '', '', 'Boleto', '2026-08-15', ''],
    ['2026-08-03', '2026-08-03', 'Transferência entre contas', '5000.00', 'TRANSFERENCIA', '', 'Banco Itaú', 'Banco Bradesco', '', '', '', '', '', ''],
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
