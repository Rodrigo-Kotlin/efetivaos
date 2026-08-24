import { describe, expect, it, vi } from 'vitest'

import { approvePrice, inactivatePrice, listComparison, listOffersForItem, translateError, translatePriceDecisionError } from './comparison-api'

const serviceMocks = vi.hoisted(() => ({
  operations: [] as Array<{ method: string; args: unknown[] }>,
  responses: [] as Array<{ data?: unknown; error: null | { code?: string; message?: string; details?: string; constraint?: string } }>,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc(name: string, args: unknown) {
      serviceMocks.operations.push({ method: `rpc.${name}`, args: [args] })
      return Promise.resolve(serviceMocks.responses.shift())
    },
    from(table: string) {
      const chain: Record<string, unknown> = {
        select(...args: unknown[]) { serviceMocks.operations.push({ method: `${table}.select`, args }); return chain },
        eq(...args: unknown[]) { serviceMocks.operations.push({ method: `${table}.eq`, args }); return chain },
        order(...args: unknown[]) { serviceMocks.operations.push({ method: `${table}.order`, args }); return chain },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(serviceMocks.responses.shift()).then(resolve, reject)
        },
      }
      return chain
    },
  },
}))

const comparisonRow = {
  catalog_item_id: 'item-1',
  code: 'EXA-001',
  item_name: 'Hemograma',
  unit: 'exame',
  category_id: 'cat-1',
  category_name: 'Laboratoriais',
  best_quotation_item_id: 'qi-1',
  best_cost: '15.50',
  best_supplier_id: 'sup-1',
  best_supplier_name: 'Lab Norte',
  best_valid_until: '2026-12-31',
  best_validity_not_informed: false,
  eligible_offer_count: 2,
  resolved_margin_rule_id: 'rule-1',
  resolved_rule_scope: 'global',
  resolved_adjustment_type: 'percentage',
  resolved_adjustment_value: '20.00',
  suggested_price: '18.60',
  effective_status: 'suggestion_available',
}

describe('translateError', () => {
  it.each([
    [{ code: '42501' }, 'permiss'],
    [{ code: 'PGRST116' }, 'indispon'],
    [{ message: 'permission denied for view comparison_current_v' }, 'permiss'],
  ])('traduz erros de banco %#', (source, expected) => expect(translateError(source).message).toContain(expected))

  it('cai no generico para erros nao mapeados', () => {
    expect(translateError({ message: 'algo inesperado' }).message).toMatch(/comparacao de custos/)
  })
})

describe('translatePriceDecisionError', () => {
  it('traduz conflito de tela obsoleta para recarga obrigatoria', () => {
    expect(translatePriceDecisionError({ message: 'Decisao de preco desatualizada: ofertas mudaram.' }).message).toMatch(/desatualizada.*recarregados/i)
  })

  it('traduz restricao de Admin', () => {
    expect(translatePriceDecisionError({ message: 'Apenas Admin pode aprovar' }).message).toContain('Apenas Admin')
  })
})

describe('listComparison', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.responses.length = 0
  })

  it('consulta a view pricing_comparison_v e devolve as linhas', async () => {
    serviceMocks.responses.push({ data: [comparisonRow], error: null })
    const result = await listComparison()
    expect(result).toEqual([comparisonRow])
    expect(serviceMocks.operations[0]).toEqual({ method: 'pricing_comparison_v.select', args: [expect.any(String)] })
    expect(serviceMocks.operations[0]?.args[0]).toEqual(expect.stringContaining('catalog_item_active'))
    expect(serviceMocks.operations[0]?.args[0]).toEqual(expect.stringContaining('approved_quotation_reference'))
    expect(serviceMocks.operations[1]).toEqual({ method: 'pricing_comparison_v.order', args: ['code', { ascending: true }] })
  })

  it('lança erro traduzido quando o backend recusa', async () => {
    serviceMocks.responses.push({ data: null, error: { code: '42501', message: 'forbidden' } })
    await expect(listComparison()).rejects.toThrow('permiss')
  })
})

describe('listOffersForItem', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.responses.length = 0
  })

  it('filtra por catalog_item_id e ordena do menor para o maior', async () => {
    serviceMocks.responses.push({ data: [{ quotation_item_id: 'qi-1' }], error: null })
    await expect(listOffersForItem('item-1')).resolves.toEqual([{ quotation_item_id: 'qi-1' }])
    expect(serviceMocks.operations[0]).toEqual({ method: 'quotation_item_candidates_v.select', args: [expect.any(String)] })
    expect(serviceMocks.operations[1]).toEqual({ method: 'quotation_item_candidates_v.eq', args: ['catalog_item_id', 'item-1'] })
    expect(serviceMocks.operations.find((op) => op.method === 'quotation_item_candidates_v.order')).toBeTruthy()
  })

  it('lança erro traduzido em falha de RLS', async () => {
    serviceMocks.responses.push({ data: null, error: { message: 'permission denied' } })
    await expect(listOffersForItem('item-1')).rejects.toThrow('permiss')
  })
})

describe('price decisions', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.responses.length = 0
  })

  it('aprova pela RPC com token e fonte opcional', async () => {
    serviceMocks.responses.push({ data: { id: 'price-1', final_price: '18.60' }, error: null })
    await approvePrice({ catalogItemId: 'item-1', decisionToken: 'token-1', sourceQuotationItemId: 'qi-2' })
    expect(serviceMocks.operations[0]).toEqual({ method: 'rpc.approve_price', args: [{ p_catalog_item_id: 'item-1', p_expected_decision_token: 'token-1', p_source_quotation_item_id: 'qi-2' }] })
  })

  it('inativa pela RPC com token de decisao', async () => {
    serviceMocks.responses.push({ data: { id: 'price-1', status: 'inactive' }, error: null })
    await inactivatePrice({ catalogItemId: 'item-1', decisionToken: 'token-2' })
    expect(serviceMocks.operations[0]).toEqual({ method: 'rpc.inactivate_price', args: [{ p_catalog_item_id: 'item-1', p_expected_decision_token: 'token-2' }] })
  })
})
