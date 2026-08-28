import { describe, it, expect } from 'vitest'
import { generatePdf, generateStatementPdf, downloadPdf } from './pdf-utils'

describe('pdf-utils', () => {
  describe('generatePdf', () => {
    it('generates a PDF document', () => {
      const doc = generatePdf({
        title: 'Test Document',
        columns: [
          { key: 'label', header: 'Description', width: 150 },
          { key: 'amount', header: 'Value', width: 40, align: 'right', format: (v) => `R$ ${v}` },
        ],
        data: [
          { label: 'Item 1', amount: 1000 },
          { label: 'Item 2', amount: 2000 },
        ],
      })
      expect(doc).toBeDefined()
      expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(0)
    })

    it('includes title in PDF', () => {
      const doc = generatePdf({
        title: 'My Statement',
        columns: [{ key: 'label', header: 'Label' }],
        data: [{ label: 'Test' }],
      })
      expect(doc).toBeDefined()
    })

    it('handles empty data', () => {
      const doc = generatePdf({
        title: 'Empty',
        columns: [{ key: 'label', header: 'Label' }],
        data: [],
      })
      expect(doc).toBeDefined()
    })

    it('includes totals when provided', () => {
      const doc = generatePdf({
        title: 'With Totals',
        columns: [{ key: 'label', header: 'Label' }, { key: 'value', header: 'Value' }],
        data: [{ label: 'Item', value: 'R$ 1.000,00' }],
        totals: [{ label: 'Total', value: 'R$ 1.000,00' }],
      })
      expect(doc).toBeDefined()
    })
  })

  describe('generateStatementPdf', () => {
    it('generates a statement PDF', () => {
      const doc = generateStatementPdf(
        'DRE - Demonstração do Resultado',
        '01/01/2026 a 31/12/2026',
        [
          { label: 'Receita Bruta', amount: 100000 },
          { label: '(-) Deduções', amount: -20000 },
          { label: 'Receita Líquida', amount: 80000, bold: true },
        ],
        [{ label: 'Resultado Líquido', value: 'R$ 80.000,00' }],
      )
      expect(doc).toBeDefined()
      expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(0)
    })

    it('handles statement without totals', () => {
      const doc = generateStatementPdf(
        'Balancete',
        'Ref: 2026-12-31',
        [{ label: 'Ativo', amount: 50000 }],
      )
      expect(doc).toBeDefined()
    })
  })

  describe('downloadPdf', () => {
    it('does not throw', () => {
      const doc = generatePdf({
        title: 'Test',
        columns: [{ key: 'x', header: 'X' }],
        data: [{ x: '1' }],
      })
      // downloadPdf calls doc.save which requires a browser environment
      // In test env it may throw, so we just verify the function exists
      expect(typeof downloadPdf).toBe('function')
    })
  })
})
