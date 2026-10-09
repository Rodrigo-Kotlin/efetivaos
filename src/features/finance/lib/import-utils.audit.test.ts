import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  parseCSV,
  parseXLSX,
  guessColumnMapping,
  generatePreview,
  toDate,
  type ColumnMapping,
  type ReferenceLists,
} from './import-utils'

// ---------------------------------------------------------------------------
// Reproduction suite — AUDITORIA DO IMPORTADOR (XLS/XLSX/CSV)
// Each test asserts the behaviour the importer MUST have. Before the fix they
// fail, reproducing the real defect; after the fix they are the regression
// guard.
// ---------------------------------------------------------------------------

const PT_MAP: ColumnMapping = {
  transaction_date: 'Data',
  competence_date: 'Competência',
  description: 'Descrição',
  amount: 'Valor',
  movement_type: 'Tipo',
  category: 'Categoria',
  origin_account: 'Conta Origem',
  destination_account: 'Conta Destino',
}

const REFS: ReferenceLists = {
  categories: [{ id: 'cat-material', name: 'Material' }],
  accounts: [{ id: 'acc-x', name: 'Banco X' }],
}

function previewCsv(csv: string, mapping: ColumnMapping = PT_MAP, refs?: ReferenceLists) {
  const { headers, rows } = parseCSV(csv)
  return generatePreview(headers, rows, mapping, 'batch-test', refs)
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

describe('auditoria — CSV', () => {
  it('CSV pt-BR com ";" e BOM: separa colunas e não polui o primeiro header', () => {
    const csv = '\ufeffData;Descrição;Valor;Tipo\r\n01/08/2026;Pagamento;1.234,56;Despesa\r\n'
    const { headers, rows } = parseCSV(csv)
    expect(headers).toEqual(['Data', 'Descrição', 'Valor', 'Tipo'])
    expect(rows).toHaveLength(1)
    expect(rows[0].Descrição).toBe('Pagamento')
  })

  it('CSV com "," continua funcionando', () => {
    const csv = 'Data,Descrição,Valor,Tipo\n01/08/2026,Pagamento,"1.234,56",Despesa\n'
    const { headers, rows } = parseCSV(csv)
    expect(headers).toEqual(['Data', 'Descrição', 'Valor', 'Tipo'])
    expect(rows[0].Valor).toBe('1.234,56')
  })

  it('CSV vazio não gera linhas', () => {
    const { rows } = parseCSV('Data;Descrição;Valor;Tipo\r\n')
    expect(rows).toHaveLength(0)
  })

  it('CSV pt-BR completo: datas, competência MM/AAAA, valor pt-BR e referências resolvidas', () => {
    const csv =
      '\ufeffData;Competência;Descrição;Valor;Tipo;Categoria;Conta Destino\r\n' +
      '01/08/2026;2026-08;Pagamento ABC;1.234,56;Despesa;Material;Banco X\r\n'
    const p = previewCsv(csv, PT_MAP, REFS)
    const row = p.rows[0]
    expect(row.valid).toBe(true)
    expect(row.mapped.transaction_date).toBe('2026-08-01')
    expect(row.mapped.competence_date).toBe('2026-08-01')
    expect(row.mapped.amount).toBe(1234.56)
    expect(row.mapped.movement_type).toBe('DESPESA')
    expect(row.mapped.category_id).toBe('cat-material')
    expect(row.mapped.destination_account_id).toBe('acc-x')
  })
})

// ---------------------------------------------------------------------------
// XLSX / XLS
// ---------------------------------------------------------------------------

describe('auditoria — XLSX/XLS', () => {
  it('Date object (célula de data real) normaliza para YYYY-MM-DD', () => {
    expect(toDate(new Date(2026, 0, 15))).toBe('2026-01-15')
  })

  it('XLSX com número serial do Excel: normaliza para YYYY-MM-DD', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Data', 'Descrição', 'Valor', 'Tipo'],
      [46023, 'Receita', 100, 'Receita'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer

    const { headers, rows } = parseXLSX(buf)
    const p = generatePreview(headers, rows, guessColumnMapping(headers), 'xlsx-serial')
    expect(p.rows[0].mapped.transaction_date).toBe('2026-01-01')
  })

  it('XLS (BIFF) é lido pelo pipeline, se suportado pela biblioteca', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Data', 'Descrição', 'Valor', 'Tipo'],
      [46023, 'Receita', 100, 'Receita'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo')
    const buf = XLSX.write(wb, { bookType: 'biff8', type: 'array' }) as ArrayBuffer

    const { headers, rows } = parseXLSX(buf)
    expect(headers).toEqual(['Data', 'Descrição', 'Valor', 'Tipo'])
    const p = generatePreview(headers, rows, guessColumnMapping(headers), 'xls-batch')
    expect(p.rows[0].mapped.transaction_date).toBe('2026-01-01')
  })
})

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

describe('auditoria — datas', () => {
  it('DD/MM/YYYY', () => {
    const p = generatePreview(
      ['transaction_date', 'description', 'amount', 'movement_type'],
      [{ transaction_date: '01/01/2026', description: 'X', amount: 10, movement_type: 'AJUSTE' }],
      { transaction_date: 'transaction_date', description: 'description', amount: 'amount', movement_type: 'movement_type' },
      'd1',
    )
    expect(p.rows[0].mapped.transaction_date).toBe('2026-01-01')
  })

  it('YYYY-MM-DD', () => {
    const p = generatePreview(
      ['transaction_date', 'description', 'amount', 'movement_type'],
      [{ transaction_date: '2026-01-01', description: 'X', amount: 10, movement_type: 'AJUSTE' }],
      { transaction_date: 'transaction_date', description: 'description', amount: 'amount', movement_type: 'movement_type' },
      'd2',
    )
    expect(p.rows[0].mapped.transaction_date).toBe('2026-01-01')
  })

  it('Excel serial number 46023', () => {
    const p = generatePreview(
      ['transaction_date', 'description', 'amount', 'movement_type'],
      [{ transaction_date: 46023, description: 'X', amount: 10, movement_type: 'AJUSTE' }],
      { transaction_date: 'transaction_date', description: 'description', amount: 'amount', movement_type: 'movement_type' },
      'd3',
    )
    expect(p.rows[0].mapped.transaction_date).toBe('2026-01-01')
  })

  it('data inválida gera erro por linha', () => {
    const p = generatePreview(
      ['transaction_date', 'description', 'amount', 'movement_type'],
      [{ transaction_date: 'ontem', description: 'X', amount: 10, movement_type: 'AJUSTE' }],
      { transaction_date: 'transaction_date', description: 'description', amount: 'amount', movement_type: 'movement_type' },
      'd4',
    )
    expect(p.rows[0].valid).toBe(false)
    expect(p.rows[0].errors.join(' ')).toMatch(/data/i)
  })
})

// ---------------------------------------------------------------------------
// Competência
// ---------------------------------------------------------------------------

describe('auditoria — competência', () => {
  function comp(value: unknown) {
    const p = generatePreview(
      ['transaction_date', 'competence_date', 'description', 'amount', 'movement_type'],
      [{ transaction_date: '2026-03-15', competence_date: value as string, description: 'X', amount: 10, movement_type: 'AJUSTE' }],
      {
        transaction_date: 'transaction_date',
        competence_date: 'competence_date',
        description: 'description',
        amount: 'amount',
        movement_type: 'movement_type',
      },
      'c',
    )
    return p.rows[0]
  }

  it('MM/AAAA (01/2026) vira YYYY-MM-01', () => {
    expect(comp('01/2026').mapped.competence_date).toBe('2026-01-01')
  })

  it('AAAA-MM (2026-01) vira YYYY-MM-01', () => {
    expect(comp('2026-01').mapped.competence_date).toBe('2026-01-01')
  })

  it('data completa continua aceita', () => {
    expect(comp('15/03/2026').mapped.competence_date).toBe('2026-03-15')
  })

  it('competência inválida avisa e usa a data do lançamento (não é silencioso)', () => {
    const row = comp('quando der')
    expect(row.warnings.join(' ')).toMatch(/compet/i)
    expect(row.mapped.competence_date).toBe('2026-03-15')
  })
})

// ---------------------------------------------------------------------------
// Valores monetários
// ---------------------------------------------------------------------------

describe('auditoria — valores monetários', () => {
  function amount(value: unknown) {
    const p = generatePreview(
      ['transaction_date', 'description', 'amount', 'movement_type'],
      [{ transaction_date: '2026-01-01', description: 'X', amount: value as string, movement_type: 'AJUSTE' }],
      { transaction_date: 'transaction_date', description: 'description', amount: 'amount', movement_type: 'movement_type' },
      'v',
    )
    return p.rows[0]
  }

  it.each([
    ['1.234,56', 1234.56],
    ['1234,56', 1234.56],
    ['1234.56', 1234.56],
    ['R$ 1.234,56', 1234.56],
    ['1,234.56', 1234.56],
  ])('normaliza %s para %s', (input, expected) => {
    const row = amount(input)
    expect(row.valid).toBe(true)
    expect(row.mapped.amount).toBe(expected)
  })

  it('valor negativo é rejeitado com mensagem clara', () => {
    const row = amount('-250,00')
    expect(row.valid).toBe(false)
    expect(row.errors.join(' ')).toMatch(/positiv/i)
  })
})

// ---------------------------------------------------------------------------
// Tipo de lançamento
// ---------------------------------------------------------------------------

describe('auditoria — tipo do lançamento', () => {
  function movement(value: string) {
    const p = generatePreview(
      ['transaction_date', 'description', 'amount', 'movement_type'],
      [{ transaction_date: '2026-01-01', description: 'X', amount: 10, movement_type: value }],
      { transaction_date: 'transaction_date', description: 'description', amount: 'amount', movement_type: 'movement_type' },
      't',
    )
    return p.rows[0]
  }

  it.each([
    ['Receita', 'RECEITA'],
    ['Despesa', 'DESPESA'],
    ['Transferência', 'TRANSFERENCIA'],
    ['Transferencia', 'TRANSFERENCIA'],
    ['Imobilizado', 'IMOBILIZADO'],
    ['Saldo Inicial', 'SALDO_INICIAL'],
    ['Empréstimo Recebido', 'EMPRESTIMO_RECEBIDO'],
  ])('mapeia %s para %s', (input, expected) => {
    const row = movement(input)
    expect(row.valid).toBe(true)
    expect(row.mapped.movement_type).toBe(expected)
  })

  it.each(['Pago', 'Recebido', 'Pendente', 'Entrada', 'Saída'])(
    'não inventa conversão silenciosa para "%s" (erro por linha)',
    input => {
      const row = movement(input)
      expect(row.valid).toBe(false)
      expect(row.errors.join(' ')).toMatch(/tipo/i)
    },
  )
})

// ---------------------------------------------------------------------------
// Referências (categoria / contas) e preview == persistência
// ---------------------------------------------------------------------------

describe('auditoria — referências', () => {
  it('resolve nomes de categoria e conta para IDs', () => {
    const csv =
      '\ufeffData;Descrição;Valor;Tipo;Categoria;Conta Destino\r\n' +
      '01/08/2026;Pagamento;100,00;Despesa;Material;Banco X\r\n'
    const p = previewCsv(csv, PT_MAP, REFS)
    expect(p.rows[0].mapped.category_id).toBe('cat-material')
    expect(p.rows[0].mapped.destination_account_id).toBe('acc-x')
  })

  it('referência não encontrada vira erro de linha (não passa no preview)', () => {
    const csv =
      '\ufeffData;Descrição;Valor;Tipo;Categoria;Conta Destino\r\n' +
      '01/08/2026;Pagamento;100,00;Despesa;Inexistente;Banco X\r\n'
    const p = previewCsv(csv, PT_MAP, REFS)
    expect(p.rows[0].valid).toBe(false)
    expect(p.rows[0].errors.join(' ')).toMatch(/não encontrad/i)
  })

  it('DESPESA sem categoria/conta de destino não passa no preview (não falha só na persistência)', () => {
    const csv = '\ufeffData;Descrição;Valor;Tipo\r\n01/08/2026;Pagamento;100,00;Despesa\r\n'
    const p = previewCsv(csv, PT_MAP, REFS)
    expect(p.rows[0].valid).toBe(false)
    expect(p.rows[0].errors.join(' ')).toMatch(/categoria/i)
  })

  it('AJUSTE não exige referências', () => {
    const csv = '\ufeffData;Descrição;Valor;Tipo\r\n01/08/2026;Ajuste;100,00;Ajuste\r\n'
    const p = previewCsv(csv, PT_MAP, REFS)
    expect(p.rows[0].valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Vazio / zero importados
// ---------------------------------------------------------------------------

describe('auditoria — zero importados', () => {
  it('arquivo com todas as linhas inválidas sinaliza invalid = total', () => {
    const headers = ['transaction_date', 'description', 'amount', 'movement_type']
    const rows = [
      { transaction_date: 'x', description: '', amount: '', movement_type: 'nada' },
      { transaction_date: 'y', description: '', amount: '', movement_type: 'nada' },
    ]
    const mapping: ColumnMapping = {
      transaction_date: 'transaction_date',
      description: 'description',
      amount: 'amount',
      movement_type: 'movement_type',
    }
    const p = generatePreview(headers, rows, mapping, 'zero')
    expect(p.valid).toBe(0)
    expect(p.invalid).toBe(2)
  })
})
