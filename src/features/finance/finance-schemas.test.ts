import { describe, expect, it } from 'vitest'

import {
  chartAccountSchema,
  costCenterSchema,
  serviceLineSchema,
  categorySchema,
  financialAccountSchema,
  paymentMethodSchema,
} from './schemas/finance-schemas'

describe('chartAccountSchema', () => {
  const valid = {
    code: '1.1.01.01',
    name: 'Caixa Geral',
    class: 'ATIVO',
    nature: 'DEBITO',
  }

  it('aceita dados validos com defaults', () => {
    const result = chartAccountSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.posting).toBe(true)
      expect(result.data.active).toBe(true)
      expect(result.data.current_class).toBeNull()
      expect(result.data.presentation_sign).toBe(1)
      expect(result.data.dfc_default).toBe('OPERACIONAL')
    }
  })

  it('rejeita codigo ausente', () => {
    const { code, ...withoutCode } = valid
    const result = chartAccountSchema.safeParse(withoutCode)
    expect(result.success).toBe(false)
  })

  it('rejeita nome muito curto', () => {
    const result = chartAccountSchema.safeParse({ ...valid, name: 'X' })
    expect(result.success).toBe(false)
  })

  it('rejeita codigo excedendo o limite de caracteres', () => {
    const result = chartAccountSchema.safeParse({ ...valid, code: 'A'.repeat(21) })
    expect(result.success).toBe(false)
  })

  it('rejeita class fora do enum', () => {
    const result = chartAccountSchema.safeParse({ ...valid, class: 'INVALIDO' })
    expect(result.success).toBe(false)
  })

  it('rejeita nature fora do enum', () => {
    const result = chartAccountSchema.safeParse({ ...valid, nature: 'OUTRO' })
    expect(result.success).toBe(false)
  })
})

describe('costCenterSchema', () => {
  const valid = { name: 'Administracao' }

  it('aceita dados validos com defaults', () => {
    const result = costCenterSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.code).toBeNull()
      expect(result.data.active).toBe(true)
      expect(result.data.description).toBeNull()
    }
  })

  it('rejeita nome ausente', () => {
    const result = costCenterSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejeita nome muito curto', () => {
    const result = costCenterSchema.safeParse({ name: 'A' })
    expect(result.success).toBe(false)
  })
})

describe('serviceLineSchema', () => {
  const valid = { name: 'Consultoria' }

  it('aceita dados validos com defaults', () => {
    const result = serviceLineSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.active).toBe(true)
      expect(result.data.description).toBeNull()
    }
  })

  it('rejeita nome ausente', () => {
    const result = serviceLineSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejeita nome muito curto', () => {
    const result = serviceLineSchema.safeParse({ name: 'A' })
    expect(result.success).toBe(false)
  })
})

describe('categorySchema', () => {
  const valid = {
    name: 'Material de Escritorio',
    movement_type: 'DESPESA',
  }

  it('aceita dados validos com defaults', () => {
    const result = categorySchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.counter_account_id).toBeNull()
      expect(result.data.cost_center_id).toBeNull()
      expect(result.data.service_line_id).toBeNull()
      expect(result.data.cash_flow_class).toBe('OPERACIONAL')
      expect(result.data.active).toBe(true)
    }
  })

  it('rejeita nome ausente', () => {
    const { name, ...withoutName } = valid
    const result = categorySchema.safeParse(withoutName)
    expect(result.success).toBe(false)
  })

  it('rejeita movement_type ausente', () => {
    const { movement_type, ...withoutType } = valid
    const result = categorySchema.safeParse(withoutType)
    expect(result.success).toBe(false)
  })

  it('rejeita movement_type fora do enum', () => {
    const result = categorySchema.safeParse({ ...valid, movement_type: 'INVALIDO' })
    expect(result.success).toBe(false)
  })
})

describe('financialAccountSchema', () => {
  const valid = {
    name: 'Conta Corrente Banco do Brasil',
    chart_account_id: 'ca-001',
  }

  it('aceita dados validos com defaults', () => {
    const result = financialAccountSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.institution).toBeNull()
      expect(result.data.account_type).toBe('CONTA_CORRENTE')
      expect(result.data.active).toBe(true)
      expect(result.data.opening_date).toBeNull()
      expect(result.data.notes).toBeNull()
    }
  })

  it('rejeita chart_account_id ausente', () => {
    const { chart_account_id, ...withoutId } = valid
    const result = financialAccountSchema.safeParse(withoutId)
    expect(result.success).toBe(false)
  })

  it('rejeita nome muito curto', () => {
    const result = financialAccountSchema.safeParse({ ...valid, name: 'A' })
    expect(result.success).toBe(false)
  })

  it('rejeita chart_account_id vazio', () => {
    const result = financialAccountSchema.safeParse({ ...valid, chart_account_id: '' })
    expect(result.success).toBe(false)
  })
})

describe('paymentMethodSchema', () => {
  const valid = { name: 'Pix' }

  it('aceita dados validos com defaults', () => {
    const result = paymentMethodSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.active).toBe(true)
    }
  })

  it('rejeita nome ausente', () => {
    const result = paymentMethodSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejeita nome muito curto', () => {
    const result = paymentMethodSchema.safeParse({ name: 'A' })
    expect(result.success).toBe(false)
  })
})
