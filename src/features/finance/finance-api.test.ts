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
  fetchParties,
  fetchTransactions,
  fetchJournalEntriesByTransaction,
  fetchJournalLinesByEntry,
  createTransaction,
  settleTransaction,
  cancelTransaction,
} from './api/finance-api'

const serviceMocks = vi.hoisted(() => ({
  operations: [] as Array<{ method: string; args: unknown[] }>,
  tableResults: [] as Array<{ data?: unknown; error: null | { code?: string; message?: string } }>,
  rpcResults: [] as Array<{ data?: unknown; error: null | { code?: string; message?: string } }>,
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
    rpc(_fn: string, _params?: Record<string, unknown>) {
      serviceMocks.operations.push({ method: `rpc:${_fn}`, args: _params ? [_params] : [] })
      return {
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(serviceMocks.rpcResults.shift()).then(resolve, reject)
        },
      }
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

describe('Parties API', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.tableResults.length = 0
  })

  it('fetchParties consulta a tabela e ordena por name', async () => {
    const row = { id: 'pa-1', name: 'Fulano', party_type: 'individual', document: null, email: null, phone: null, client_id: null, supplier_id: null, active: true, notes: null }
    serviceMocks.tableResults.push({ data: [row], error: null })
    const result = await fetchParties()
    expect(result).toEqual([row])
    expect(serviceMocks.operations.find(op => op.method === 'financial_parties.order')).toBeTruthy()
  })
})

describe('Transactions API', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.tableResults.length = 0
    serviceMocks.rpcResults.length = 0
  })

  it('fetchTransactions consulta a view', async () => {
    const row = { id: 'tx-1', description: 'Teste', transaction_date: '2026-01-01', competence_date: '2026-01-01', movement_type: 'RECEITA', amount: '100', status: 'pending', category_id: null, origin_account_id: null, destination_account_id: null, party_id: null, cost_center_id: null, service_line_id: null, payment_method_id: null, due_date: null, payment_date: null, notes: null, review_required: false, version: 1, created_at: '', created_by: null, updated_at: '', updated_by: null, category_name: null, origin_account_name: null, destination_account_name: null, party_name: null, cost_center_name: null, service_line_name: null, payment_method_name: null, journal_entry_count: 1, total_debit: '100', total_credit: '100' }
    serviceMocks.tableResults.push({ data: [row], error: null })
    const result = await fetchTransactions()
    expect(result).toEqual([row])
    expect(serviceMocks.operations.find(op => op.method === 'financial_transactions_list_v.select')).toBeTruthy()
  })

  it('fetchTransactions propaga erro do banco', async () => {
    serviceMocks.tableResults.push({ data: null, error: { message: 'db error' } })
    await expect(fetchTransactions()).rejects.toThrow()
  })

  it('fetchJournalEntriesByTransaction consulta entries por transaction_id', async () => {
    const row = { id: 'je-1', transaction_id: 'tx-1', entry_type: 'competencia', entry_date: '2026-01-01', competence_date: '2026-01-01', description: 'Teste', status: 'pending', review_required: false, created_at: '', total_debit: '100', total_credit: '100' }
    serviceMocks.tableResults.push({ data: [row], error: null })
    const result = await fetchJournalEntriesByTransaction('tx-1')
    expect(result).toEqual([row])
    expect(serviceMocks.operations.find(op => op.method === 'financial_journal_entries_list_v.eq' && op.args[0] === 'transaction_id' && op.args[1] === 'tx-1')).toBeTruthy()
  })

  it('fetchJournalLinesByEntry consulta lines por entry_id', async () => {
    const row = { id: 'jl-1', entry_id: 'je-1', chart_account_id: 'ca-1', debit: '100', credit: '0', description: 'Teste', created_at: '', chart_account_code: '1.1.01.001', chart_account_name: 'Caixa', chart_account_class: 'ATIVO' }
    serviceMocks.tableResults.push({ data: [row], error: null })
    const result = await fetchJournalLinesByEntry('je-1')
    expect(result).toEqual([row])
    expect(serviceMocks.operations.find(op => op.method === 'financial_journal_lines_list_v.eq' && op.args[0] === 'entry_id' && op.args[1] === 'je-1')).toBeTruthy()
  })

  it('createTransaction chama RPC com idempotency_key', async () => {
    serviceMocks.rpcResults.push({ data: 'tx-new', error: null })
    const result = await createTransaction({
      description: 'Teste',
      transactionDate: '2026-01-01',
      competenceDate: '2026-01-01',
      movementType: 'RECEITA',
      amount: 100,
      categoryId: null,
      originAccountId: 'acct-1',
      idempotencyKey: 'idem-123',
    })
    expect(result).toBe('tx-new')
    const rpcOp = serviceMocks.operations.find(op => op.method === 'rpc:create_financial_transaction')
    expect(rpcOp).toBeTruthy()
    expect(rpcOp!.args[0]).toMatchObject({ p_idempotency_key: 'idem-123', p_description: 'Teste' })
  })

  it('createTransaction propaga erro do RPC', async () => {
    serviceMocks.rpcResults.push({ data: null, error: { message: 'Admin only' } })
    await expect(createTransaction({
      description: 'Teste',
      transactionDate: '2026-01-01',
      competenceDate: '2026-01-01',
      movementType: 'RECEITA',
      amount: 100,
    })).rejects.toThrow()
  })

  it('settleTransaction chama RPC com parametros corretos', async () => {
    serviceMocks.rpcResults.push({ data: null, error: null })
    await settleTransaction('tx-1', '2026-01-20', 'pm-1')
    const rpcOp = serviceMocks.operations.find(op => op.method === 'rpc:settle_financial_transaction')
    expect(rpcOp).toBeTruthy()
    expect(rpcOp!.args[0]).toMatchObject({ p_transaction_id: 'tx-1', p_payment_date: '2026-01-20', p_payment_method_id: 'pm-1' })
  })

  it('settleTransaction propaga erro do RPC', async () => {
    serviceMocks.rpcResults.push({ data: null, error: { message: 'Cannot settle' } })
    await expect(settleTransaction('tx-1', '2026-01-20')).rejects.toThrow()
  })

  it('cancelTransaction chama RPC com reason', async () => {
    serviceMocks.rpcResults.push({ data: null, error: null })
    await cancelTransaction('tx-2', 'Motivo teste')
    const rpcOp = serviceMocks.operations.find(op => op.method === 'rpc:cancel_financial_transaction')
    expect(rpcOp).toBeTruthy()
    expect(rpcOp!.args[0]).toMatchObject({ p_transaction_id: 'tx-2', p_reason: 'Motivo teste' })
  })

  it('cancelTransaction propaga erro do RPC', async () => {
    serviceMocks.rpcResults.push({ data: null, error: { message: 'Already cancelled' } })
    await expect(cancelTransaction('tx-2')).rejects.toThrow()
  })
})
