import { describe, expect, it, vi } from 'vitest'

import { createRule, listRules, setRuleActive, updateRule } from './rules-api'

const serviceMocks = vi.hoisted(() => ({
  operations: [] as Array<{ method: string; args: unknown[] }>,
  tableResults: [] as Array<{ data?: unknown; error: null | { code?: string; message?: string; details?: string; constraint?: string } }>,
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
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) { return Promise.resolve(serviceMocks.tableResults.shift()).then(resolve, reject) },
      }
      return chain
    },
  },
}))

const baseRule = {
  id: 'rule-1',
  scope_type: 'global' as const,
  category_id: null,
  catalog_item_id: null,
  calculation_type: 'percentage' as const,
  value: '20.0000',
  active: true,
  notes: 'Padrao',
  updated_at: '2026-08-23T00:00:00Z',
  category: null,
  catalog_item: null,
}

describe('listRules', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.tableResults.length = 0
  })

  it('consulta margin_rules e devolve as linhas', async () => {
    serviceMocks.tableResults.push({ data: [baseRule], error: null })
    const result = await listRules()
    expect(result).toEqual([baseRule])
    expect(serviceMocks.operations[0]).toEqual({ method: 'margin_rules.select', args: [expect.any(String)] })
    expect(serviceMocks.operations.find((op) => op.method === 'margin_rules.order')).toBeTruthy()
  })

  it('traduz violacao de permissao para mensagem amigavel', async () => {
    serviceMocks.tableResults.push({ data: null, error: { code: '42501', message: 'forbidden' } })
    await expect(listRules()).rejects.toThrow(/permiss/)
  })
})

describe('createRule', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.tableResults.length = 0
  })

  it('normaliza valor para 4 casas decimais e limpa alvo quando escopo e global', async () => {
    serviceMocks.tableResults.push({ data: baseRule, error: null })
    await createRule({ scope_type: 'global', category_id: 'cat-1', catalog_item_id: 'item-1', calculation_type: 'percentage', value: '30', active: true, notes: ' regra ' })
    const insertCall = serviceMocks.operations.find((op) => op.method === 'margin_rules.insert')
    expect(insertCall).toBeTruthy()
    const [payload] = insertCall!.args as [{ value: string; scope_type: string; category_id: string | null; catalog_item_id: string | null; notes: string | null }]
    expect(payload.value).toBe('30.0000')
    expect(payload.category_id).toBeNull()
    expect(payload.catalog_item_id).toBeNull()
    expect(payload.notes).toBe('regra')
    expect(payload.scope_type).toBe('global')
  })

  it('preserva alvo quando escopo e item ou categoria', async () => {
    serviceMocks.tableResults.push({ data: { ...baseRule, scope_type: 'item', catalog_item_id: 'item-1', category_id: null, calculation_type: 'fixed' }, error: null })
    await createRule({ scope_type: 'item', category_id: null, catalog_item_id: 'item-1', calculation_type: 'fixed', value: '25', active: true, notes: null })
    const insertCall = serviceMocks.operations.find((op) => op.method === 'margin_rules.insert')
    const [payload] = insertCall!.args as [{ category_id: string | null; catalog_item_id: string | null; notes: string | null }]
    expect(payload.catalog_item_id).toBe('item-1')
    expect(payload.category_id).toBeNull()
    expect(payload.notes).toBeNull()
  })
})

describe('updateRule e setRuleActive', () => {
  beforeEach(() => {
    serviceMocks.operations.length = 0
    serviceMocks.tableResults.length = 0
  })

  it('updateRule aplica o id no filtro eq', async () => {
    serviceMocks.tableResults.push({ data: { ...baseRule, value: '25.0000' }, error: null })
    await updateRule('rule-1', { scope_type: 'global', category_id: null, catalog_item_id: null, calculation_type: 'percentage', value: '25', active: true, notes: null })
    expect(serviceMocks.operations.find((op) => op.method === 'margin_rules.update')).toBeTruthy()
    expect(serviceMocks.operations.find((op) => op.method === 'margin_rules.eq')).toBeTruthy()
  })

  it('setRuleActive envia apenas o flag active', async () => {
    serviceMocks.tableResults.push({ data: { ...baseRule, active: false }, error: null })
    await setRuleActive('rule-1', false)
    const updateCall = serviceMocks.operations.find((op) => op.method === 'margin_rules.update')
    const [payload] = updateCall!.args as [{ active: boolean }]
    expect(payload).toEqual({ active: false })
  })
})
