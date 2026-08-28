import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'csv' | 'xlsx'

export type ExportColumn = {
  key: string
  label: string
  format?: (val: unknown, row: Record<string, unknown>) => string
}

// ---------------------------------------------------------------------------
// Export functions
// ---------------------------------------------------------------------------

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function formatCurrency(v: number | null | undefined): string {
  if (v === null || v === undefined) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

// ---------------------------------------------------------------------------
// Transaction export columns
// ---------------------------------------------------------------------------

export const TRANSACTION_COLUMNS: ExportColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'transaction_date', label: 'Data', format: (_, r) => formatDate(r.transaction_date as string) },
  { key: 'competence_date', label: 'Competência', format: (_, r) => formatDate(r.competence_date as string) },
  { key: 'description', label: 'Descrição' },
  { key: 'movement_type', label: 'Tipo' },
  { key: 'status', label: 'Status' },
  { key: 'party_name', label: 'Pessoa' },
  { key: 'category_name', label: 'Categoria' },
  { key: 'cost_center_name', label: 'Centro de Custo' },
  { key: 'service_line_name', label: 'Linha de Serviço' },
  { key: 'origin_account_name', label: 'Conta Origem' },
  { key: 'destination_account_name', label: 'Conta Destino' },
  { key: 'due_date', label: 'Vencimento', format: (_, r) => formatDate(r.due_date as string) },
  { key: 'amount', label: 'Valor', format: (_, r) => formatCurrency(r.amount as number) },
  { key: 'payment_method_name', label: 'Forma de Pagamento' },
  { key: 'notes', label: 'Observação' },
]

// ---------------------------------------------------------------------------
// AR/AP export columns
// ---------------------------------------------------------------------------

export const RECEIVABLE_COLUMNS: ExportColumn[] = [
  { key: 'transaction_id', label: 'ID' },
  { key: 'description', label: 'Descrição' },
  { key: 'party_name', label: 'Pessoa' },
  { key: 'category_name', label: 'Categoria' },
  { key: 'transaction_date', label: 'Data', format: (_, r) => formatDate(r.transaction_date as string) },
  { key: 'competence_date', label: 'Competência', format: (_, r) => formatDate(r.competence_date as string) },
  { key: 'due_date', label: 'Vencimento', format: (_, r) => formatDate(r.due_date as string) },
  { key: 'original_amount', label: 'Valor Original', format: (_, r) => formatCurrency(r.original_amount as number) },
  { key: 'open_amount', label: 'Saldo Aberto', format: (_, r) => formatCurrency(r.open_amount as number) },
  { key: 'status', label: 'Status' },
  { key: 'days_overdue', label: 'Dias Vencidos' },
]

export const PAYABLE_COLUMNS: ExportColumn[] = RECEIVABLE_COLUMNS

// ---------------------------------------------------------------------------
// Generic export function
// ---------------------------------------------------------------------------

export function exportData(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
  format: ExportFormat,
) {
  const headers = columns.map(c => c.label)
  const rows = data.map(row =>
    columns.map(c => {
      if (c.format) return c.format(row[c.key], row)
      const val = row[c.key]
      if (val === null || val === undefined) return ''
      return String(val)
    })
  )

  if (format === 'csv') {
    const csv = Papa.unparse({ fields: headers, data: rows })
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `${filename}.csv`)
  } else {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    // Auto-width columns
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...rows.map(r => String(r[i]).length))
      return { wch: Math.min(maxLen + 2, 50) }
    })
    ws['!cols'] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, filename.slice(0, 31))
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    downloadBlob(blob, `${filename}.xlsx`)
  }
}

// ---------------------------------------------------------------------------
// Statement export columns (for DRE, BP, etc.)
// ---------------------------------------------------------------------------

export const STATEMENT_COLUMNS: ExportColumn[] = [
  { key: 'label', label: 'Descrição' },
  { key: 'amount', label: 'Valor', format: (_, r) => formatCurrency(r.amount as number) },
]

export function exportStatement(
  data: { label: string; amount: number }[],
  title: string,
  format: ExportFormat,
) {
  exportData(
    data.map(d => ({ label: d.label, amount: d.amount })),
    STATEMENT_COLUMNS,
    title.replace(/\s+/g, '_').toLowerCase(),
    format,
  )
}
