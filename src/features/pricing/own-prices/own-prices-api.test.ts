const serviceMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  rpcResults: [] as Array<{ data?: unknown; error?: unknown }>,
  tableResults: [] as Array<{ data?: unknown; error?: unknown }>,
  operations: [] as Array<{ table: string; method: string; args: unknown[] }>,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc(name: string, args: unknown) {
      serviceMocks.rpc(name, args)
      return Promise.resolve(serviceMocks.rpcResults.shift())
    },
    from(table: string) {
      const builder = {
        select(...args: unknown[]) { serviceMocks.operations.push({ table, method: 'select', args }); return builder },
        insert(...args: unknown[]) { serviceMocks.operations.push({ table, method: 'insert', args }); return builder },
        eq(...args: unknown[]) { serviceMocks.operations.push({ table, method: 'eq', args }); return builder },
        order(...args: unknown[]) { serviceMocks.operations.push({ table, method: 'order', args }); return builder },
        single() { return Promise.resolve(serviceMocks.tableResults.shift()) },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(serviceMocks.tableResults.shift()).then(resolve, reject)
        },
      }
      return builder
    },
  },
}))

import {
  approveOwnPriceProposal,
  createOwnPriceProposal,
  fetchOwnPriceDecisionToken,
  fetchProfileName,
  inactivateOwnPriceProposal,
  listOwnCatalogItems,
  listOwnPriceProposals,
  normalizeOwnPriceProposalInput,
  translateOwnPriceError,
} from './own-prices-api'

const proposalRow = {
  id: 'p1', catalog_item_id: 'item-1', item_code: 'SRV-001', item_name: 'Servico A',
  sale_price: '15.00', internal_cost: '8.00', status: 'approved', submitted_by: 'user-1',
  submitted_at: '2026-09-01T10:00:00Z', approved_by: 'admin-1', approved_at: '2026-09-02T10:00:00Z',
  decision_notes: 'aprovado', revision: 1, created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-02T10:00:00Z',
}

describe('translateOwnPriceError', () => {
  it.each([
    [{ message: 'Decisao de preco proprio desatualizada: a proposta mudou. Recarregue antes de continuar.' }, 'Atualize os dados'],
    [{ code: '42501', message: 'Apenas Admin pode aprovar ou inativar proposta de preco proprio.' }, 'Apenas Admin pode aprovar ou inativar'],
    [{ code: '42501', message: 'Propostas de preco proprio exigem um usuario autenticado.' }, 'login'],
    [{ code: '42501', message: 'O estado de aprovacao somente muda pela RPC de aprovacao de preco proprio.' }, 'RPC de aprovacao'],
    [{ code: '23505', constraint: 'own_price_proposals_one_pending' }, 'pendente para este item'],
    [{ code: '23503' }, 'nao existe mais'],
    [{ message: 'Somente propostas pendentes ou aprovadas podem ser inativadas.' }, 'pendentes ou aprovadas'],
    [{ message: 'Somente propostas pendentes podem ser aprovadas.' }, 'Somente propostas pendentes'],
    [{ message: 'Item de catalogo inexistente ou inativo nao pode ter preco proprio aprovado.' }, 'nao existe ou esta inativo'],
    [{ message: 'Somente itens de servico proprio recebem proposta de preco proprio; itens terceirizados usam cotacao.' }, 'Apenas itens de servico proprio'],
    [{ message: 'Item de catalogo inexistente ou inativo nao pode receber proposta de preco proprio.' }, 'nao existe ou esta inativo'],
    [{ message: 'A proposta de preco proprio deve ser submetida pelo proprio usuario logado.' }, 'proprio usuario logado'],
    [{ message: 'Proposta de preco proprio inexistente.' }, 'nao existe mais'],
    [{ code: '42501', message: 'permission denied for table own_price_proposals' }, 'permissao'],
    [{ message: 'erro inesperado' }, 'Tente novamente'],
  ])('traduz o erro de banco %#', (source, expected) => {
    expect(translateOwnPriceError(source).message).toContain(expected)
  })
})

describe('normalizeOwnPriceProposalInput', () => {
  it('converte virgula em ponto, limpa notas e normaliza custo opcional', () => {
    expect(normalizeOwnPriceProposalInput({ catalog_item_id: 'item-1', sale_price: '12,50', internal_cost: '', decision_notes: '  contexto  ' })).toEqual({
      catalog_item_id: 'item-1',
      sale_price: '12.50',
      internal_cost: null,
      decision_notes: 'contexto',
    })
  })

  it('preserva custo interno informado', () => {
    expect(normalizeOwnPriceProposalInput({ catalog_item_id: 'item-1', sale_price: '20.00', internal_cost: '10,25' }).internal_cost).toBe('10.25')
  })
})

describe('listOwnPriceProposals', () => {
  beforeEach(() => {
    serviceMocks.rpcResults.length = 0
    serviceMocks.tableResults.length = 0
    serviceMocks.operations.length = 0
    serviceMocks.rpc.mockReset()
  })

  it('chama a RPC de leitura sem filtros e retorna a lista', async () => {
    serviceMocks.rpcResults.push({ data: [proposalRow], error: null })
    await expect(listOwnPriceProposals()).resolves.toEqual([proposalRow])
    expect(serviceMocks.rpc).toHaveBeenCalledWith('get_own_price_proposals', { p_catalog_item_id: null, p_status: null })
  })

  it('encaminha filtros opcionais', async () => {
    serviceMocks.rpcResults.push({ data: [], error: null })
    await listOwnPriceProposals({ catalogItemId: 'item-1', status: 'pending' })
    expect(serviceMocks.rpc).toHaveBeenCalledWith('get_own_price_proposals', { p_catalog_item_id: 'item-1', p_status: 'pending' })
  })

  it('traduz erro de leitura', async () => {
    serviceMocks.rpcResults.push({ data: null, error: { message: 'erro ao ler' } })
    await expect(listOwnPriceProposals()).rejects.toThrow('Tente novamente')
  })
})

describe('listOwnCatalogItems', () => {
  beforeEach(() => {
    serviceMocks.rpcResults.length = 0
    serviceMocks.tableResults.length = 0
    serviceMocks.operations.length = 0
    serviceMocks.rpc.mockReset()
  })

  it('consulta somente itens de origem propria e normaliza a categoria', async () => {
    serviceMocks.tableResults.push({ data: [{ id: 'item-1', code: 'SRV-001', name: 'A', unit: 'servico', category_id: 'cat-1', category: { name: 'Laboratoriais' }, active: true }], error: null })
    await expect(listOwnCatalogItems()).resolves.toEqual([{ id: 'item-1', code: 'SRV-001', name: 'A', unit: 'servico', category_id: 'cat-1', category_name: 'Laboratoriais', active: true }])
    expect(serviceMocks.operations.filter((operation) => operation.method === 'eq')).toEqual([{ table: 'catalog_items', method: 'eq', args: ['sourcing_type', 'own'] }])
    expect(serviceMocks.operations).toContainEqual(expect.objectContaining({ table: 'catalog_items', method: 'order' }))
  })
})

describe('createOwnPriceProposal', () => {
  beforeEach(() => {
    serviceMocks.rpcResults.length = 0
    serviceMocks.tableResults.length = 0
    serviceMocks.operations.length = 0
    serviceMocks.rpc.mockReset()
  })

  it('insere pela tabela autorizada (RLS) sem tocar price_list', async () => {
    serviceMocks.tableResults.push({ data: { ...proposalRow, status: 'pending', approved_by: null, approved_at: null }, error: null })
    await expect(createOwnPriceProposal({ catalog_item_id: 'item-1', sale_price: '18,90', internal_cost: null, decision_notes: null })).resolves.toMatchObject({ catalog_item_id: 'item-1' })
    expect(serviceMocks.operations.filter((operation) => operation.method === 'insert')).toEqual([
      { table: 'own_price_proposals', method: 'insert', args: [{ catalog_item_id: 'item-1', sale_price: '18.90', internal_cost: null, decision_notes: null }] },
    ])
    expect(serviceMocks.operations.some((operation) => operation.table === 'price_list')).toBe(false)
  })

  it('traduz conflito de proposta pendente', async () => {
    serviceMocks.tableResults.push({ data: null, error: { code: '23505', constraint: 'own_price_proposals_one_pending' } })
    await expect(createOwnPriceProposal({ catalog_item_id: 'item-1', sale_price: '18.90' })).rejects.toThrow('Ja existe uma proposta pendente')
  })
})

describe('decision RPCs', () => {
  beforeEach(() => {
    serviceMocks.rpcResults.length = 0
    serviceMocks.tableResults.length = 0
    serviceMocks.operations.length = 0
    serviceMocks.rpc.mockReset()
  })

  it('aprovacao envia apenas id e token', async () => {
    serviceMocks.rpcResults.push({ data: { ...proposalRow, status: 'approved' }, error: null })
    await expect(approveOwnPriceProposal({ proposalId: 'p1', expectedDecisionToken: 'token-1' })).resolves.toMatchObject({ id: 'p1', status: 'approved' })
    expect(serviceMocks.rpc).toHaveBeenCalledWith('approve_own_price_proposal', { p_proposal_id: 'p1', p_expected_decision_token: 'token-1' })
    expect(serviceMocks.operations).toEqual([])
  })

  it('inativacao envia notas opcionais limpas', async () => {
    serviceMocks.rpcResults.push({ data: { ...proposalRow, status: 'inactive' }, error: null })
    await inactivateOwnPriceProposal({ proposalId: 'p1', expectedDecisionToken: 'token-1', decisionNotes: '  nao se aplica  ' })
    expect(serviceMocks.rpc).toHaveBeenCalledWith('inactivate_own_price_proposal', { p_proposal_id: 'p1', p_expected_decision_token: 'token-1', p_decision_notes: 'nao se aplica' })
  })

  it('inativacao envia notas nulas quando ausentes', async () => {
    serviceMocks.rpcResults.push({ data: proposalRow, error: null })
    await inactivateOwnPriceProposal({ proposalId: 'p1', expectedDecisionToken: 'token-1' })
    expect(serviceMocks.rpc).toHaveBeenCalledWith('inactivate_own_price_proposal', { p_proposal_id: 'p1', p_expected_decision_token: 'token-1', p_decision_notes: null })
  })

  it('token de decisao retorna null quando a proposta nao existe', async () => {
    serviceMocks.rpcResults.push({ data: null, error: null })
    await expect(fetchOwnPriceDecisionToken('p1')).resolves.toBeNull()
    expect(serviceMocks.rpc).toHaveBeenCalledWith('own_price_decision_token', { p_proposal_id: 'p1' })
  })

  it('token de decisao retorna o valor recebido', async () => {
    serviceMocks.rpcResults.push({ data: 'token-x', error: null })
    await expect(fetchOwnPriceDecisionToken('p1')).resolves.toBe('token-x')
  })

  it('leitura do nome do responsavel usa profiles', async () => {
    serviceMocks.tableResults.push({ data: { full_name: 'Ana Souza' }, error: null })
    await expect(fetchProfileName('user-1')).resolves.toBe('Ana Souza')
    expect(serviceMocks.operations).toContainEqual(expect.objectContaining({ table: 'profiles', method: 'eq', args: ['id', 'user-1'] }))
  })

  it('perfil inexistente retorna null sem erro', async () => {
    serviceMocks.tableResults.push({ data: null, error: { code: 'PGRST116' } })
    await expect(fetchProfileName('user-1')).resolves.toBeNull()
  })
})