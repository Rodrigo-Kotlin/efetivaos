import { describe, it, expect } from 'vitest'
import { parseFile, guessColumnMapping, generatePreview, buildPendingReview, TEMPLATE_COLUMNS, TEMPLATE_MAPPING, type ColumnMapping, type ReferenceLists } from './import-utils'

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

  describe('buildPendingReview', () => {
    const REFS: ReferenceLists = {
      categories: [{ id: 'cat-material', name: 'Material', active: true, movement_type: 'DESPESA' }],
      accounts: [{ id: 'acc-x', name: 'Banco X', active: true }],
      parties: [],
      costCenters: [],
      serviceLines: [],
      paymentMethods: [],
    }

    const headers = ['Data', 'Descrição', 'Valor', 'Tipo', 'Categoria', 'Conta Origem', 'Conta Destino', 'Pessoa']
    const mapping: ColumnMapping = {
      transaction_date: 'Data',
      description: 'Descrição',
      amount: 'Valor',
      movement_type: 'Tipo',
      category: 'Categoria',
      origin_account: 'Conta Origem',
      destination_account: 'Conta Destino',
      party: 'Pessoa',
    }

    const rows = [
      { Data: '01/08/2026', Descrição: 'Receita comum', Valor: '100,00', Tipo: 'Despesa', Categoria: 'Material', 'Conta Origem': '', 'Conta Destino': 'Banco X', Pessoa: '' },
      { Data: '01/08/2026', Descrição: '', Valor: '100,00', Tipo: 'Despesa', Categoria: 'Material', 'Conta Origem': '', 'Conta Destino': 'Banco X', Pessoa: '' },
      { Data: '01/08/2026', Descrição: 'Audiometrias', Valor: '100,00', Tipo: 'Despesa', Categoria: 'Exames e serviços técnicos', 'Conta Origem': '', 'Conta Destino': 'Banco X', Pessoa: '' },
      { Data: '01/08/2026', Descrição: 'Salário Luciana', Valor: '100,00', Tipo: 'Despesa', Categoria: 'Pessoal e adiantamentos', 'Conta Origem': '', 'Conta Destino': 'Banco X', Pessoa: '' },
      { Data: '01/08/2026', Descrição: 'Vale Janderson', Valor: '100,00', Tipo: 'Despesa', Categoria: 'Pessoal e adiantamentos', 'Conta Origem': '', 'Conta Destino': 'Banco X', Pessoa: '' },
      { Data: '01/08/2026', Descrição: 'Boleto Criffer Dezembro', Valor: '100,00', Tipo: 'Despesa', Categoria: 'Pagamentos financeiros e parcelamentos', 'Conta Origem': '', 'Conta Destino': 'Banco X', Pessoa: '' },
      { Data: '01/08/2026', Descrição: 'Empréstimo (S)', Valor: '100,00', Tipo: 'Despesa', Categoria: 'Saída financeira - empréstimo', 'Conta Origem': '', 'Conta Destino': 'Banco X', Pessoa: '' },
      { Data: '01/08/2026', Descrição: 'Transferência interna', Valor: '100,00', Tipo: 'Transferência', Categoria: '', 'Conta Origem': 'Banco X', 'Conta Destino': 'Banco Inexistente', Pessoa: '' },
      { Data: '01/08/2026', Descrição: 'Ajuste avulso', Valor: '100,00', Tipo: 'Ajuste', Categoria: '', 'Conta Origem': '', 'Conta Destino': '', Pessoa: 'Pessoa Nova' },
    ]

    const preview = generatePreview(headers, rows, mapping, 'pending-review', REFS)
    const review = buildPendingReview(preview.rows, REFS)

    it('keeps the Total = Valid + Pending + Invalid invariant', () => {
      expect(preview.total).toBe(9)
      expect(preview.pending).toBe(6)
      expect(preview.invalid).toBe(1)
      expect(preview.valid).toBe(2)
      expect(preview.valid + preview.pending + preview.invalid).toBe(preview.total)
    })

    it('lists every pending line exactly once, including the ones outside manual review', () => {
      expect(review.total).toBe(6)
      const numbers = review.groups.flatMap(group => group.rows.map(row => row.row_number))
      expect(numbers).toHaveLength(6)
      expect(new Set(numbers).size).toBe(6)
      const manual = review.groups.flatMap(group => group.rows).filter(row => row.is_manual_classification)
      expect(manual.map(row => row.row_number)).toEqual([3])
    })

    it('groups the pending lines by motive without hardcoding counts', () => {
      const byGroup = Object.fromEntries(review.groups.map(group => [group.group, group.rows.length]))
      expect(byGroup.Categoria).toBe(3)
      expect(byGroup['Parcelamentos/pagamentos']).toBe(1)
      expect(byGroup['Empréstimos']).toBe(1)
      expect(byGroup['Transferências']).toBe(1)
    })

    it('classifies each motive with mechanical rules', () => {
      const motive = (rowNumber: number) => review.groups.flatMap(group => group.rows).find(row => row.row_number === rowNumber)!.motives[0]
      expect(motive(4).kind).toBe('SYSTEM_RESOLUTION_GAP')
      expect(motive(5).kind).toBe('ACCOUNTING_DECISION_REQUIRED')
      expect(motive(6).kind).toBe('ACCOUNTING_DECISION_REQUIRED')
      expect(motive(7).kind).toBe('SOURCE_DATA_REQUIRED')
      expect(motive(7).group).toBe('Empréstimos')
      expect(motive(8).kind).toBe('REVIEWABLE')
    })

    it('excludes informative (non-required) references from the pending review', () => {
      const informational = preview.referenceIssues.filter(issue => !issue.required)
      expect(informational.some(issue => issue.field === 'party')).toBe(true)
      expect(review.groups.flatMap(group => group.rows).some(row => row.row_number === 9)).toBe(false)
    })
  })
})
