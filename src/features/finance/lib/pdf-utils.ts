import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PdfColumn = {
  key: string
  header: string
  width?: number
  align?: 'left' | 'center' | 'right'
  format?: (val: unknown) => string
}

export type PdfOptions = {
  title: string
  subtitle?: string
  period?: string
  columns: PdfColumn[]
  data: Record<string, unknown>[]
  totals?: { label: string; value: string }[]
  footer?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function addHeader(doc: jsPDF, options: PdfOptions, pageWidth: number) {
  // Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(options.title, 14, 20)

  // Subtitle
  let y = 28
  if (options.subtitle) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(options.subtitle, 14, y)
    y += 6
  }

  // Period
  if (options.period) {
    doc.setFontSize(9)
    doc.text(`Período: ${options.period}`, 14, y)
    y += 5
  }

  // Date
  doc.setFontSize(8)
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth - 14, 20, { align: 'right' })

  return y + 4
}

function addFooter(doc: jsPDF, docHeight: number, pageCount: number) {
  const y = docHeight - 10
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.text('Relatório gerencial — não substitui escrituração contábil oficial.', 14, y)
  doc.text(`Página ${pageCount}`, doc.internal.pageSize.getWidth() - 14, y, { align: 'right' })
}

// ---------------------------------------------------------------------------
// Main PDF generation
// ---------------------------------------------------------------------------

export function generatePdf(options: PdfOptions): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  let startY = addHeader(doc, options, pageWidth)

  // Table data
  const head = [options.columns.map(c => c.header)]
  const body = options.data.map(row =>
    options.columns.map(col => {
      const val = row[col.key]
      if (col.format) return col.format(val)
      if (val === null || val === undefined) return ''
      return String(val)
    })
  )

  // Column styles
  const columnStyles: Record<string, { halign?: 'left' | 'center' | 'right'; cellWidth?: number }> = {}
  options.columns.forEach((col, i) => {
    const style: { halign?: 'left' | 'center' | 'right'; cellWidth?: number } = {}
    if (col.align) style.halign = col.align
    if (col.width) style.cellWidth = col.width
    columnStyles[i] = style
  })

  autoTable(doc, {
    startY,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      addFooter(doc, pageHeight, doc.getNumberOfPages())
    },
  })

  // Totals
  if (options.totals && options.totals.length > 0) {
    let y = (doc as any).lastAutoTable?.finalY || startY + 10
    y += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    for (const total of options.totals) {
      doc.text(total.label, 14, y)
      doc.text(total.value, pageWidth - 14, y, { align: 'right' })
      y += 5
    }
  }

  // Final footer on last page
  addFooter(doc, pageHeight, doc.getNumberOfPages())

  return doc
}

// ---------------------------------------------------------------------------
// Convenience: download PDF
// ---------------------------------------------------------------------------

export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(`${filename}.pdf`)
}

// ---------------------------------------------------------------------------
// Statement PDF (for DRE, BP, etc.)
// ---------------------------------------------------------------------------

export function generateStatementPdf(
  title: string,
  period: string,
  rows: { label: string; amount: number; bold?: boolean }[],
  totals?: { label: string; value: string }[],
): jsPDF {
  const columns: PdfColumn[] = [
    { key: 'label', header: 'Descrição', width: 150, align: 'left' },
    { key: 'amount', header: 'Valor (R$)', width: 40, align: 'right', format: (v) => fmt(v as number) },
  ]

  return generatePdf({
    title,
    period,
    columns,
    data: rows,
    totals,
  })
}
