const serviceMocks = vi.hoisted(() => ({
  rpcResults: [] as Array<{ data?: unknown; error: null | { code?: string; message?: string } }>,
  tableResults: [] as Array<{ data?: unknown; error: null | { code?: string; message?: string } }>,
  uploads: [] as Array<{ error: null | { message?: string } }>,
  rpc: vi.fn(),
  operations: [] as Array<{ table: string; method: string; args: unknown[] }>,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc(name: string, args: unknown) {
      serviceMocks.rpc(name, args)
      return Promise.resolve(serviceMocks.rpcResults.shift())
    },
    from(table: string) {
      const chain = {
        update(...args: unknown[]) { serviceMocks.operations.push({ table, method: 'update', args }); return chain },
        eq(...args: unknown[]) { serviceMocks.operations.push({ table, method: 'eq', args }); return chain },
        in(...args: unknown[]) { serviceMocks.operations.push({ table, method: 'in', args }); return chain },
        select(...args: unknown[]) { serviceMocks.operations.push({ table, method: 'select', args }); return chain },
        single() { return Promise.resolve(serviceMocks.tableResults.shift()) },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) { return Promise.resolve(serviceMocks.tableResults.shift()).then(resolve, reject) },
      }
      return chain
    },
    storage: { from: () => ({ upload: (...args: unknown[]) => { serviceMocks.operations.push({ table: 'storage', method: 'upload', args }); return Promise.resolve(serviceMocks.uploads.shift()) } }) },
  },
}))

import { activateQuotation, cancelQuotation, discardPendingQuotationAttachment, saveQuotationDraft, translateQuotationError } from './quotation.service'
import type { QuotationDraftInput } from './quotation.types'

const quotation = { id: 'q1', supplier_id: 's1', reference_number: null, received_at: '2026-08-23', valid_until: null, status: 'draft' as const, source_file_path: null, source_file_pending: false, revision: 4, notes: null, created_at: '2026-08-23T00:00:00Z', created_by: null, updated_at: '2026-08-23T00:00:00Z', updated_by: null }

function input(overrides: Partial<QuotationDraftInput> = {}): QuotationDraftInput {
  return { id: 'q1', expectedUpdatedAt: quotation.updated_at, expectedRevision: quotation.revision, supplier_id: 's1', reference_number: null, received_at: '2026-08-23', valid_until: null, notes: null, items: [], ...overrides }
}

describe('translateQuotationError', () => {
  it.each([
    [{ code: '42501' }, 'permissao'],
    [{ code: '23505', constraint: 'uq_quotation_item_catalog_once' }, 'duas vezes'],
    [{ message: 'Fornecedor inativo: ative-o' }, 'fornecedor precisa estar ativo'],
    [{ message: 'Cotacao em rascunho nao encontrada ou sem permissao' }, 'rascunho nao encontrada'],
    [{ message: 'Cotacao desatualizada: outra alteracao foi salva' }, 'outro usuario'],
    [{ message: 'A cotacao nao possui anexo pendente' }, 'nao possui um envio'],
    [{ message: 'O anexo informado ainda nao foi armazenado. Aguarde o envio antes de ativar ou cancelar a cotacao.' }, 'conclua ou descarte'],
    [{ message: 'O anexo da cotacao esta sendo enviado. Aguarde o envio terminar antes de salvar novamente.' }, 'conclua ou descarte'],
    [{ message: 'Um item informado nao pertence a esta cotacao' }, 'nao pertence'],
    [{ message: 'O mesmo item de cotacao foi informado mais de uma vez' }, 'mais de uma vez'],
    [{ message: 'Os itens da cotacao devem ser informados como um array JSON' }, 'formato invalido'],
  ])('traduz erros de negocio %#', (source, expected) => expect(translateQuotationError(source).message).toContain(expected))
})

describe('discardPendingQuotationAttachment RPC', () => {
  beforeEach(() => {
    serviceMocks.rpcResults.length = 0
    serviceMocks.operations.length = 0
    serviceMocks.rpc.mockReset()
  })

  it('envia a cotacao e revisao esperada e retorna a linha final sem escrita direta', async () => {
    const recovered = { ...quotation, source_file_pending: false, revision: 5 }
    serviceMocks.rpcResults.push({ data: recovered, error: null })

    await expect(discardPendingQuotationAttachment({ id: 'q1', expectedRevision: 4 })).resolves.toEqual(recovered)
    expect(serviceMocks.rpc).toHaveBeenCalledWith('discard_pending_quotation_attachment', {
      p_quotation_id: 'q1',
      p_expected_revision: 4,
    })
    expect(serviceMocks.operations).toEqual([])
  })

  it('traduz conflito de revisao retornado pela RPC', async () => {
    serviceMocks.rpcResults.push({ data: null, error: { message: 'Cotacao desatualizada: outra alteracao foi salva' } })
    await expect(discardPendingQuotationAttachment({ id: 'q1', expectedRevision: 3 })).rejects.toThrow('outro usuario')
  })

  it('explica quando o envio ja nao esta pendente', async () => {
    serviceMocks.rpcResults.push({ data: null, error: { message: 'A cotacao nao possui anexo pendente' } })
    await expect(discardPendingQuotationAttachment({ id: 'q1', expectedRevision: 4 })).rejects.toThrow('nao possui um envio de anexo pendente')
  })
})

describe('saveQuotationDraft RPC', () => {
  beforeEach(() => {
    serviceMocks.rpcResults.length = 0
    serviceMocks.tableResults.length = 0
    serviceMocks.uploads.length = 0
    serviceMocks.operations.length = 0
    serviceMocks.rpc.mockReset()
  })

  it('envia cabecalho e itens em uma unica chamada RPC sem escritas diretas', async () => {
    const items = [{ id: 'line-1', catalog_item_id: 'catalog-1', supplier_description: 'Exame', supplier_item_code: 'EX', unit_price: '10.00', notes: null }]
    serviceMocks.rpcResults.push({ data: quotation, error: null })

    await expect(saveQuotationDraft(input({ items }))).resolves.toEqual({ quotation })

    expect(serviceMocks.rpc).toHaveBeenCalledOnce()
    expect(serviceMocks.rpc).toHaveBeenCalledWith('save_quotation_draft', {
      p_quotation_id: 'q1',
      p_expected_updated_at: quotation.updated_at,
      p_expected_revision: quotation.revision,
      p_supplier_id: 's1',
      p_reference_number: null,
      p_received_at: '2026-08-23',
      p_valid_until: null,
      p_notes: null,
      p_items: items,
    })
    expect(serviceMocks.operations).toEqual([])
  })

  it('envia null como ID para criar um novo rascunho', async () => {
    serviceMocks.rpcResults.push({ data: quotation, error: null })
    await saveQuotationDraft(input({ id: undefined, expectedUpdatedAt: null, expectedRevision: null }))
    expect(serviceMocks.rpc.mock.calls[0][1]).toEqual(expect.objectContaining({ p_quotation_id: null, p_expected_updated_at: null, p_expected_revision: null }))
  })

  it('marca o anexo pendente, envia e retorna a cotacao atualizada', async () => {
    const file = new File(['pdf'], 'quote.pdf', { type: 'application/pdf' })
    const pending = { ...quotation, source_file_path: 'q1/original', source_file_pending: true, revision: 5, updated_at: '2026-08-23T00:01:00Z' }
    const completed = { ...pending, source_file_pending: false, revision: 6, updated_at: '2026-08-23T00:02:00Z' }
    serviceMocks.rpcResults.push({ data: quotation, error: null })
    serviceMocks.tableResults.push({ data: pending, error: null }, { data: completed, error: null })
    serviceMocks.uploads.push({ error: null })

    const result = await saveQuotationDraft(input({ file }))

    expect(serviceMocks.rpc).toHaveBeenCalledOnce()
    const updates = serviceMocks.operations.filter((operation) => operation.method === 'update')
    expect(updates.map((operation) => operation.args[0])).toEqual([
      { source_file_path: 'q1/original', source_file_pending: true },
      { source_file_pending: false },
    ])
    expect(serviceMocks.operations).toContainEqual(expect.objectContaining({ table: 'storage', method: 'upload' }))
    expect(serviceMocks.operations.filter((operation) => operation.method === 'select')).toHaveLength(2)
    expect(serviceMocks.operations.filter((operation) => operation.method === 'eq').map((operation) => operation.args)).toEqual([
      ['id', 'q1'], ['revision', 4], ['status', 'draft'], ['source_file_pending', false],
      ['id', 'q1'], ['revision', 5], ['status', 'draft'], ['source_file_pending', true],
    ])
    expect(result).toEqual({ quotation: completed })
  })

  it('preserva o primeiro rascunho e restaura o caminho anterior quando o upload falha', async () => {
    const file = new File(['pdf'], 'quote.pdf', { type: 'application/pdf' })
    serviceMocks.rpcResults.push({ data: quotation, error: null })
    serviceMocks.tableResults.push(
      { data: { ...quotation, source_file_path: 'q1/original', source_file_pending: true, revision: 5 }, error: null },
      { data: { ...quotation, source_file_pending: false, revision: 6 }, error: null },
    )
    serviceMocks.uploads.push({ error: { message: 'upload failed' } })

    await expect(saveQuotationDraft(input({ id: undefined, expectedUpdatedAt: null, expectedRevision: null, file }))).resolves.toEqual({
      quotation: { ...quotation, source_file_pending: false, revision: 6 },
      attachmentWarning: expect.stringContaining('nao foi possivel enviar o anexo'),
    })

    const updates = serviceMocks.operations.filter((operation) => operation.method === 'update')
    expect(updates.map((operation) => operation.args[0])).toEqual([
      { source_file_path: 'q1/original', source_file_pending: true },
      { source_file_path: null, source_file_pending: false },
    ])
    expect(serviceMocks.operations.filter((operation) => operation.method === 'eq').map((operation) => operation.args)).toEqual([
      ['id', 'q1'], ['revision', 4], ['status', 'draft'], ['source_file_pending', false],
      ['id', 'q1'], ['revision', 5], ['status', 'draft'], ['source_file_pending', true],
    ])
    expect(serviceMocks.operations.filter((operation) => operation.method === 'select')).toHaveLength(2)
  })

  it('nao inicia upload quando a revisao salva ja ficou obsoleta', async () => {
    const file = new File(['pdf'], 'quote.pdf', { type: 'application/pdf' })
    serviceMocks.rpcResults.push({ data: quotation, error: null })
    serviceMocks.tableResults.push({ data: null, error: { code: 'PGRST116' } })

    await expect(saveQuotationDraft(input({ file }))).resolves.toEqual({
      quotation,
      attachmentWarning: expect.stringContaining('nao foi iniciado'),
    })
    expect(serviceMocks.operations).not.toContainEqual(expect.objectContaining({ table: 'storage', method: 'upload' }))
  })

  it('informa claramente quando a compensacao do upload nao e confirmada', async () => {
    const file = new File(['pdf'], 'quote.pdf', { type: 'application/pdf' })
    serviceMocks.rpcResults.push({ data: quotation, error: null })
    serviceMocks.tableResults.push(
      { data: { ...quotation, source_file_path: 'q1/original', source_file_pending: true, revision: 5 }, error: null },
      { data: null, error: null },
    )
    serviceMocks.uploads.push({ error: { message: 'upload failed' } })

    await expect(saveQuotationDraft(input({ file }))).resolves.toEqual({
      quotation: { ...quotation, source_file_path: 'q1/original', source_file_pending: true, revision: 5 },
      attachmentWarning: expect.stringContaining('precisa de recuperacao'),
    })
  })

  it('retorna a ultima cotacao pendente quando a confirmacao final falha', async () => {
    const file = new File(['pdf'], 'quote.pdf', { type: 'application/pdf' })
    const pending = { ...quotation, source_file_path: 'q1/original', source_file_pending: true, revision: 5 }
    serviceMocks.rpcResults.push({ data: quotation, error: null })
    serviceMocks.tableResults.push({ data: pending, error: null }, { data: null, error: { code: 'PGRST116' } })
    serviceMocks.uploads.push({ error: null })

    await expect(saveQuotationDraft(input({ file }))).resolves.toEqual({
      quotation: pending,
      attachmentWarning: expect.stringContaining('confirmacao ficou pendente'),
    })
  })
})

describe('quotation lifecycle revisions', () => {
  beforeEach(() => {
    serviceMocks.tableResults.length = 0
    serviceMocks.operations.length = 0
  })

  it('filtra ativacao e cancelamento pela revisao esperada e status permitido', async () => {
    serviceMocks.tableResults.push({ data: { ...quotation, status: 'active' }, error: null }, { data: { ...quotation, status: 'cancelled' }, error: null })
    await activateQuotation({ id: 'q1', expectedRevision: 4 })
    await cancelQuotation({ id: 'q1', expectedRevision: 5 })
    expect(serviceMocks.operations.filter((operation) => operation.method === 'eq').map((operation) => operation.args)).toEqual([
      ['id', 'q1'], ['revision', 4], ['status', 'draft'], ['id', 'q1'], ['revision', 5],
    ])
    expect(serviceMocks.operations).toContainEqual({ table: 'quotations', method: 'in', args: ['status', ['draft', 'active']] })
  })

  it('traduz zero linhas de ciclo de vida como conflito de revisao', async () => {
    serviceMocks.tableResults.push({ data: null, error: { code: 'PGRST116' } })
    await expect(activateQuotation({ id: 'q1', expectedRevision: 3 })).rejects.toThrow('Recarregue a pagina')
  })
})
