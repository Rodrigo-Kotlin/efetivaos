import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TRANSACTION_COLUMNS, RECEIVABLE_COLUMNS, PAYABLE_COLUMNS } from './export-utils'

// Mock URL.createObjectURL and document.createElement for export tests
let createObjectURLSpy: ReturnType<typeof vi.spyOn>
let clickSpy: ReturnType<typeof vi.spyOn>
let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  clickSpy = vi.fn()
  revokeObjectURLSpy = vi.fn()
  createObjectURLSpy = vi.fn().mockReturnValue('blob:test')

  vi.stubGlobal('URL', {
    createObjectURL: createObjectURLSpy,
    revokeObjectURL: revokeObjectURLSpy,
  })

  vi.stubGlobal('document', {
    createElement: vi.fn().mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    }),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('export-utils', () => {
  describe('TRANSACTION_COLUMNS', () => {
    it('contains all required columns', () => {
      expect(TRANSACTION_COLUMNS.length).toBeGreaterThanOrEqual(10)
      expect(TRANSACTION_COLUMNS.some(c => c.key === 'transaction_date')).toBe(true)
      expect(TRANSACTION_COLUMNS.some(c => c.key === 'description')).toBe(true)
      expect(TRANSACTION_COLUMNS.some(c => c.key === 'amount')).toBe(true)
      expect(TRANSACTION_COLUMNS.some(c => c.key === 'movement_type')).toBe(true)
    })
  })

  describe('RECEIVABLE_COLUMNS', () => {
    it('contains AR-specific columns', () => {
      expect(RECEIVABLE_COLUMNS.some(c => c.key === 'open_amount')).toBe(true)
      expect(RECEIVABLE_COLUMNS.some(c => c.key === 'days_overdue')).toBe(true)
    })
  })

  describe('PAYABLE_COLUMNS', () => {
    it('contains AP-specific columns', () => {
      expect(PAYABLE_COLUMNS.some(c => c.key === 'open_amount')).toBe(true)
      expect(PAYABLE_COLUMNS.some(c => c.key === 'days_overdue')).toBe(true)
    })
  })

  describe('columns have correct structure', () => {
    it('each column has key and label', () => {
      for (const col of TRANSACTION_COLUMNS) {
        expect(col.key).toBeTruthy()
        expect(col.label).toBeTruthy()
      }
    })

    it('amount column has format function that returns formatted string', () => {
      const amountCol = TRANSACTION_COLUMNS.find(c => c.key === 'amount')
      expect(amountCol?.format).toBeDefined()
      // The format function ignores the first arg and uses row.amount
      const formatted = amountCol!.format!(0, { amount: 1500 })
      // Should return a formatted currency string (R$ 1.500,00)
      expect(typeof formatted).toBe('string')
      expect(formatted.length).toBeGreaterThan(0)
      expect(formatted).toContain('1.500')
    })

    it('amount format handles null in row', () => {
      const amountCol = TRANSACTION_COLUMNS.find(c => c.key === 'amount')
      expect(amountCol?.format).toBeDefined()
      const formatted = amountCol!.format!(0, { amount: null })
      expect(formatted).toBe('')
    })
  })
})
