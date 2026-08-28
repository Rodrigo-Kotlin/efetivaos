import { describe, it, expect } from 'vitest'
import { parseFile, guessColumnMapping, generatePreview, TEMPLATE_COLUMNS, TEMPLATE_MAPPING } from './import-utils'

describe('import-utils', () => {
  describe('TEMPLATE_COLUMNS', () => {
    it('contains required Portuguese columns', () => {
      expect(TEMPLATE_COLUMNS).toContain('Data')
      expect(TEMPLATE_COLUMNS).toContain('Descrição')
      expect(TEMPLATE_COLUMNS).toContain('Valor')
      expect(TEMPLATE_COLUMNS).toContain('Tipo')
    })
  })

  describe('TEMPLATE_MAPPING', () => {
    it('maps Portuguese columns to English keys', () => {
      expect(TEMPLATE_MAPPING['Data']).toBe('transaction_date')
      expect(TEMPLATE_MAPPING['Descrição']).toBe('description')
      expect(TEMPLATE_MAPPING['Valor']).toBe('amount')
      expect(TEMPLATE_MAPPING['Tipo']).toBe('movement_type')
    })
  })

  describe('guessColumnMapping', () => {
    it('guesses mapping from Portuguese headers', () => {
      const headers = ['Data', 'Descrição', 'Valor', 'Tipo']
      const mapping = guessColumnMapping(headers)
      expect(mapping.transaction_date).toBe('Data')
      expect(mapping.description).toBe('Descrição')
      expect(mapping.amount).toBe('Valor')
      expect(mapping.movement_type).toBe('Tipo')
    })

    it('handles English headers', () => {
      const headers = ['transaction_date', 'description', 'amount', 'movement_type']
      const mapping = guessColumnMapping(headers)
      expect(mapping.transaction_date).toBe('transaction_date')
      expect(mapping.description).toBe('description')
      expect(mapping.amount).toBe('amount')
      expect(mapping.movement_type).toBe('movement_type')
    })

    it('handles unknown columns gracefully', () => {
      const headers = ['unknown_col', 'Descrição']
      const mapping = guessColumnMapping(headers)
      expect(mapping.description).toBe('Descrição')
      expect(mapping.amount).toBeUndefined()
    })

    it('guesses all expected fields', () => {
      const headers = ['data', 'descricao', 'valor', 'tipo', 'pessoa', 'vencimento']
      const mapping = guessColumnMapping(headers)
      expect(mapping.transaction_date).toBe('data')
      expect(mapping.description).toBe('descricao')
      expect(mapping.amount).toBe('valor')
      expect(mapping.movement_type).toBe('tipo')
      expect(mapping.party).toBe('pessoa')
      expect(mapping.due_date).toBe('vencimento')
    })
  })

  describe('parseFile (CSV)', () => {
    it('parses valid CSV file', async () => {
      const csv = 'transaction_date,description,amount,movement_type\n2026-01-15,Receita Teste,1500.00,RECEITA'
      const file = new File([csv], 'test.csv', { type: 'text/csv' })
      const result = await parseFile(file)
      expect(result.fileType).toBe('csv')
      expect(result.headers).toEqual(['transaction_date', 'description', 'amount', 'movement_type'])
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].transaction_date).toBe('2026-01-15')
      expect(result.rows[0].description).toBe('Receita Teste')
    })

    it('handles empty CSV', async () => {
      const csv = 'transaction_date,description,amount,movement_type\n'
      const file = new File([csv], 'empty.csv', { type: 'text/csv' })
      const result = await parseFile(file)
      expect(result.rows).toHaveLength(0)
    })
  })

  describe('generatePreview', () => {
    it('generates preview from valid rows', () => {
      const headers = ['transaction_date', 'description', 'amount', 'movement_type']
      const rows = [
        { transaction_date: '2026-01-15', description: 'Receita Teste', amount: '1500.00', movement_type: 'RECEITA' },
      ]
      const mapping = { transaction_date: 'transaction_date', description: 'description', amount: 'amount', movement_type: 'movement_type' }
      const preview = generatePreview(headers, rows, mapping, 'batch-123')
      expect(preview.total).toBe(1)
      expect(preview.rows).toHaveLength(1)
      expect(preview.rows[0].valid).toBe(true)
      expect(preview.rows[0].errors).toHaveLength(0)
    })

    it('marks rows with missing description as invalid', () => {
      const headers = ['transaction_date', 'description', 'amount', 'movement_type']
      const rows = [
        { transaction_date: '2026-01-15', description: '', amount: '1000', movement_type: 'RECEITA' },
      ]
      const mapping = { transaction_date: 'transaction_date', description: 'description', amount: 'amount', movement_type: 'movement_type' }
      const preview = generatePreview(headers, rows, mapping, 'batch-456')
      expect(preview.total).toBe(1)
      expect(preview.rows[0].valid).toBe(false)
      expect(preview.rows[0].errors.length).toBeGreaterThan(0)
    })

    it('marks rows with missing amount as invalid', () => {
      const headers = ['transaction_date', 'description', 'amount', 'movement_type']
      const rows = [
        { transaction_date: '2026-01-15', description: 'Teste', amount: '', movement_type: 'RECEITA' },
      ]
      const mapping = { transaction_date: 'transaction_date', description: 'description', amount: 'amount', movement_type: 'movement_type' }
      const preview = generatePreview(headers, rows, mapping, 'batch-789')
      expect(preview.rows[0].valid).toBe(false)
    })

    it('counts valid and invalid rows correctly', () => {
      const headers = ['transaction_date', 'description', 'amount', 'movement_type']
      const rows = [
        { transaction_date: '2026-01-15', description: 'Receita', amount: '1000', movement_type: 'RECEITA' },
        { transaction_date: '2026-01-16', description: '', amount: '500', movement_type: 'DESPESA' },
        { transaction_date: '2026-01-17', description: 'OK', amount: '2000', movement_type: 'RECEITA' },
      ]
      const mapping = { transaction_date: 'transaction_date', description: 'description', amount: 'amount', movement_type: 'movement_type' }
      const preview = generatePreview(headers, rows, mapping, 'batch-count')
      expect(preview.total).toBe(3)
      expect(preview.valid).toBe(2)
      expect(preview.invalid).toBe(1)
    })
  })
})
