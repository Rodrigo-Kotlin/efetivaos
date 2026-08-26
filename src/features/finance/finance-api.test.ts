import { describe, expect, it, vi } from 'vitest'

import {
  fetchChartAccounts,
  createChartAccount,
  updateChartAccount,
  fetchCostCenters,
  createCostCenter,
  updateCostCenter,
  fetchServiceLines,
  createServiceLine,
  updateServiceLine,
  fetchCategories,
  createCategory,
  updateCategory,
  fetchFinancialAccounts,
  createFinancialAccount,
  updateFinancialAccount,
  fetchPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
} from './api/finance-api'

const serviceMocks = vi.hoisted(() => ({
  operations: [] as Array<{ method: string; args: unknown[] }>,
  tableResults: [] as Array<{ data?: unknown; error: null | { code?: string; message?: string } }>,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select(...args: unknown[]) { serviceMocks.operations.push({ method: `${table}.select`, args }); return chain },
        insert(...args: unknown[]) { serviceMocks.operations.push({ method: `${table}.insert`, args }); return chain },
        update(...args: unknown[]) { serviceMocks.operations.push({ method: `${table}.update`, args }); return chain },
        eq(...args: unknown[]) { serviceMocks.operations.push({ method: `${table}.eq`, args }); return chain },
        order(...args: unknown[]) { serviceMocks.operations.push({ method: `${table}.order`, args }); return chain },
        single() { return Promise.resolve(serviceMocks.tableResults.shift()) },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(serviceMocks.tableResults.shift()).then(resolve, reject)
        },
      }
      return chain
    },
  },
}))

describe('Chart Accounts API', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.tableResults.length = 0
  })

  it('fetchChartAccounts consulta a tabela e ordena por code', async () => {
    const row = { id: 'ca-1', code: '1.1.01', name: 'Caixa', presentation_sign: 1 }
    serviceMocks.tableResults.push({ data: [row], error: null })
    const result = await fetchChartAccounts()
    expect(result).toEqual([{ ...row, presentation_sign: 1 }])
    expect(serviceMocks.operations[0]).toEqual({ method: 'financial_chart_accounts.select', args: ['*'] })
    expect(serviceMocks.operations.find(op => op.method === 'financial_chart_accounts.order')).toBeTruthy()
  })

  it('fetchChartAccounts propaga erro do banco', async () => {
    serviceMocks.tableResults.push({ data: null, error: { code: '42501', message: 'forbidden' } })
    await expect(fetchChartAccounts()).rejects.toThrow()
  })

  it('createChartAccount insere e retorna o registro', async () => {
    const row = { id: 'ca-2', code: '2.1.01', name: 'Banco', presentation_sign: -1 }
    serviceMocks.tableResults.push({ data: row, error: null })
    const result = await createChartAccount({ code: '2.1.01', name: 'Banco', class: 'PASSIVO', nature: 'CREDITO', bp_group: '', dre_class: '', dva_class: '' })
    expect(result).toEqual({ ...row, presentation_sign: -1 })
    expect(serviceMocks.operations.find(op => op.method === 'financial_chart_accounts.insert')).toBeTruthy()
  })

  it('createChartAccount propaga erro do banco', async () => {
    serviceMocks.tableResults.push({ data: null, error: { message: 'duplicate key' } })
    await expect(createChartAccount({ code: '2.1.01', name: 'Banco', class: 'PASSIVO', nature: 'CREDITO', bp_group: '', dre_class: '', dva_class: '' })).rejects.toThrow()
  })

  it('updateChartAccount atualiza pelo id', async () => {
    const row = { id: 'ca-1', code: '1.1.01', name: 'Caixa Atualizado', presentation_sign: 1 }
    serviceMocks.tableResults.push({ data: row, error: null })
    await updateChartAccount('ca-1', { name: 'Caixa Atualizado' })
    expect(serviceMocks.operations.find(op => op.method === 'financial_chart_accounts.update')).toBeTruthy()
    expect(serviceMocks.operations.find(op => op.method === 'financial_chart_accounts.eq' && op.args[0] === 'id' && op.args[1] === 'ca-1')).toBeTruthy()
  })
})

describe('Cost Centers API', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.tableResults.length = 0
  })

  it('fetchCostCenters consulta a tabela e ordena por name', async () => {
    const row = { id: 'cc-1', code: null, name: 'Administracao', active: true, description: null }
    serviceMocks.tableResults.push({ data: [row], error: null })
    const result = await fetchCostCenters()
    expect(result).toEqual([row])
    expect(serviceMocks.operations.find(op => op.method === 'financial_cost_centers.order')).toBeTruthy()
  })

  it('fetchCostCenters propaga erro do banco', async () => {
    serviceMocks.tableResults.push({ data: null, error: { message: 'db error' } })
    await expect(fetchCostCenters()).rejects.toThrow()
  })

  it('createCostCenter insere e retorna o registro', async () => {
    const row = { id: 'cc-2', code: null, name: 'TI', active: true, description: null }
    serviceMocks.tableResults.push({ data: row, error: null })
    const result = await createCostCenter({ name: 'TI' })
    expect(result).toEqual(row)
    expect(serviceMocks.operations.find(op => op.method === 'financial_cost_centers.insert')).toBeTruthy()
  })

  it('updateCostCenter atualiza pelo id', async () => {
    const row = { id: 'cc-1', code: null, name: 'TI Atualizado', active: true, description: null }
    serviceMocks.tableResults.push({ data: row, error: null })
    await updateCostCenter('cc-1', { name: 'TI Atualizado' })
    expect(serviceMocks.operations.find(op => op.method === 'financial_cost_centers.update')).toBeTruthy()
    expect(serviceMocks.operations.find(op => op.method === 'financial_cost_centers.eq' && op.args[0] === 'id' && op.args[1] === 'cc-1')).toBeTruthy()
  })
})

describe('Service Lines API', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.tableResults.length = 0
  })

  it('fetchServiceLines consulta a tabela e ordena por name', async () => {
    const row = { id: 'sl-1', name: 'Consultoria', active: true, description: null }
    serviceMocks.tableResults.push({ data: [row], error: null })
    const result = await fetchServiceLines()
    expect(result).toEqual([row])
    expect(serviceMocks.operations.find(op => op.method === 'financial_service_lines.order')).toBeTruthy()
  })

  it('fetchServiceLines propaga erro do banco', async () => {
    serviceMocks.tableResults.push({ data: null, error: { message: 'db error' } })
    await expect(fetchServiceLines()).rejects.toThrow()
  })

  it('createServiceLine insere e retorna o registro', async () => {
    const row = { id: 'sl-2', name: 'Auditoria', active: true, description: null }
    serviceMocks.tableResults.push({ data: row, error: null })
    const result = await createServiceLine({ name: 'Auditoria' })
    expect(result).toEqual(row)
    expect(serviceMocks.operations.find(op => op.method === 'financial_service_lines.insert')).toBeTruthy()
  })

  it('updateServiceLine atualiza pelo id', async () => {
    const row = { id: 'sl-1', name: 'Auditoria Atualizada', active: true, description: null }
    serviceMocks.tableResults.push({ data: row, error: null })
    await updateServiceLine('sl-1', { name: 'Auditoria Atualizada' })
    expect(serviceMocks.operations.find(op => op.method === 'financial_service_lines.update')).toBeTruthy()
    expect(serviceMocks.operations.find(op => op.method === 'financial_service_lines.eq' && op.args[0] === 'id' && op.args[1] === 'sl-1')).toBeTruthy()
  })
})

describe('Categories API', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.tableResults.length = 0
  })

  it('fetchCategories consulta a view e ordena por name', async () => {
    const row = { id: 'cat-1', name: 'Material', movement_type: 'DESPESA' }
    serviceMocks.tableResults.push({ data: [row], error: null })
    const result = await fetchCategories()
    expect(result).toEqual([row])
    expect(serviceMocks.operations.find(op => op.method === 'financial_categories_list_v.order')).toBeTruthy()
  })

  it('fetchCategories propaga erro do banco', async () => {
    serviceMocks.tableResults.push({ data: null, error: { message: 'db error' } })
    await expect(fetchCategories()).rejects.toThrow()
  })

  it('createCategory insere e retorna o registro', async () => {
    const row = { id: 'cat-2', name: 'Frete', movement_type: 'DESPESA', counter_account_id: null, cost_center_id: null, service_line_id: null }
    serviceMocks.tableResults.push({ data: row, error: null })
    const result = await createCategory({ name: 'Frete', movement_type: 'DESPESA' })
    expect(result).toEqual(row)
    expect(serviceMocks.operations.find(op => op.method === 'financial_categories.insert')).toBeTruthy()
  })

  it('updateCategory atualiza pelo id', async () => {
    const row = { id: 'cat-1', name: 'Material Atualizado', movement_type: 'RECEITA', counter_account_id: null, cost_center_id: null, service_line_id: null }
    serviceMocks.tableResults.push({ data: row, error: null })
    await updateCategory('cat-1', { name: 'Material Atualizado', movement_type: 'RECEITA' })
    expect(serviceMocks.operations.find(op => op.method === 'financial_categories.update')).toBeTruthy()
    expect(serviceMocks.operations.find(op => op.method === 'financial_categories.eq' && op.args[0] === 'id' && op.args[1] === 'cat-1')).toBeTruthy()
  })
})

describe('Financial Accounts API', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.tableResults.length = 0
  })

  it('fetchFinancialAccounts consulta a view e ordena por name', async () => {
    const row = { id: 'fa-1', name: 'Conta BB', chart_account_id: 'ca-1', chart_account_name: 'Banco', institution: 'BB', account_type: 'CONTA_CORRENTE', active: true }
    serviceMocks.tableResults.push({ data: [row], error: null })
    const result = await fetchFinancialAccounts()
    expect(result).toEqual([row])
    expect(serviceMocks.operations.find(op => op.method === 'financial_accounts_list_v.order')).toBeTruthy()
  })

  it('fetchFinancialAccounts propaga erro do banco', async () => {
    serviceMocks.tableResults.push({ data: null, error: { message: 'db error' } })
    await expect(fetchFinancialAccounts()).rejects.toThrow()
  })

  it('createFinancialAccount insere e retorna o registro', async () => {
    const row = { id: 'fa-2', name: 'Conta Itau', chart_account_id: 'ca-2', institution: 'Itau', account_type: 'POUPANCA', active: true, opening_date: null, notes: null }
    serviceMocks.tableResults.push({ data: row, error: null })
    const result = await createFinancialAccount({ name: 'Conta Itau', chart_account_id: 'ca-2' })
    expect(result).toEqual(row)
    expect(serviceMocks.operations.find(op => op.method === 'financial_accounts.insert')).toBeTruthy()
  })

  it('updateFinancialAccount atualiza pelo id', async () => {
    const row = { id: 'fa-1', name: 'Conta Atualizada', chart_account_id: 'ca-1', institution: 'BB', account_type: 'CONTA_CORRENTE', active: false, opening_date: null, notes: null }
    serviceMocks.tableResults.push({ data: row, error: null })
    await updateFinancialAccount('fa-1', { name: 'Conta Atualizada', active: false })
    expect(serviceMocks.operations.find(op => op.method === 'financial_accounts.update')).toBeTruthy()
    expect(serviceMocks.operations.find(op => op.method === 'financial_accounts.eq' && op.args[0] === 'id' && op.args[1] === 'fa-1')).toBeTruthy()
  })
})

describe('Payment Methods API', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.tableResults.length = 0
  })

  it('fetchPaymentMethods consulta a tabela e ordena por name', async () => {
    const row = { id: 'pm-1', name: 'Pix', active: true }
    serviceMocks.tableResults.push({ data: [row], error: null })
    const result = await fetchPaymentMethods()
    expect(result).toEqual([row])
    expect(serviceMocks.operations.find(op => op.method === 'financial_payment_methods.order')).toBeTruthy()
  })

  it('fetchPaymentMethods propaga erro do banco', async () => {
    serviceMocks.tableResults.push({ data: null, error: { message: 'db error' } })
    await expect(fetchPaymentMethods()).rejects.toThrow()
  })

  it('createPaymentMethod insere e retorna o registro', async () => {
    const row = { id: 'pm-2', name: 'Boleto', active: true }
    serviceMocks.tableResults.push({ data: row, error: null })
    const result = await createPaymentMethod({ name: 'Boleto' })
    expect(result).toEqual(row)
    expect(serviceMocks.operations.find(op => op.method === 'financial_payment_methods.insert')).toBeTruthy()
  })

  it('updatePaymentMethod atualiza pelo id', async () => {
    const row = { id: 'pm-1', name: 'PIX Atualizado', active: true }
    serviceMocks.tableResults.push({ data: row, error: null })
    await updatePaymentMethod('pm-1', { name: 'PIX Atualizado' })
    expect(serviceMocks.operations.find(op => op.method === 'financial_payment_methods.update')).toBeTruthy()
    expect(serviceMocks.operations.find(op => op.method === 'financial_payment_methods.eq' && op.args[0] === 'id' && op.args[1] === 'pm-1')).toBeTruthy()
  })
})
