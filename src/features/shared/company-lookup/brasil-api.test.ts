import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { lookupCompanyByCnpj, isValidCnpj, formatCnpj, normalizeCnpj } from './brasil-api'

const VALID_CNPJ = '00000000000191'
const FORMATTED_CNPJ = '00.000.000/0001-91'

const MOCK_RAW_RESPONSE = {
  cnpj: '00000000000191',
  razao_social: 'BANCO DO BRASIL SA',
  nome_fantasia: 'DIRECAO GERAL',
  descricao_situacao_cadastral: 'ATIVA',
  cnae_fiscal: 6422100,
  cnae_fiscal_descricao: 'Bancos multiplos, com carteira comercial',
  logradouro: 'SAUN QUADRA 5 BLOCO B TORRE I',
  numero: 'SN',
  complemento: 'ANDAR T I',
  bairro: 'ASA NORTE',
  cep: '70040912',
  municipio: 'BRASILIA',
  uf: 'DF',
  email: '',
  ddd_telefone_1: '6134939002',
  ddd_telefone_2: '',
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('isValidCnpj', () => {
  it('accepts valid CNPJ', () => {
    expect(isValidCnpj(VALID_CNPJ)).toBe(true)
  })

  it('accepts formatted valid CNPJ', () => {
    expect(isValidCnpj(FORMATTED_CNPJ)).toBe(true)
  })

  it('rejects CPF-length input', () => {
    expect(isValidCnpj('12345678901')).toBe(false)
  })

  it('rejects all-same-digit CNPJ', () => {
    expect(isValidCnpj('11111111111111')).toBe(false)
  })

  it('rejects CNPJ with wrong check digit', () => {
    expect(isValidCnpj('00000000000192')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidCnpj('')).toBe(false)
  })
})

describe('formatCnpj', () => {
  it('formats 14-digit CNPJ', () => {
    expect(formatCnpj('00000000000191')).toBe('00.000.000/0001-91')
  })

  it('returns raw string if not 14 digits', () => {
    expect(formatCnpj('123')).toBe('123')
  })
})

describe('normalizeCnpj', () => {
  it('strips non-digit characters', () => {
    expect(normalizeCnpj('00.000.000/0001-91')).toBe('00000000000191')
  })

  it('keeps digits only', () => {
    expect(normalizeCnpj('00000000000191')).toBe('00000000000191')
  })
})

describe('lookupCompanyByCnpj', () => {
  it('returns normalized data on 200', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RAW_RESPONSE),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await lookupCompanyByCnpj(VALID_CNPJ)

    expect(result.data).not.toBeNull()
    expect(result.data!.cnpj).toBe('00000000000191')
    expect(result.data!.legalName).toBe('BANCO DO BRASIL SA')
    expect(result.data!.tradeName).toBe('DIRECAO GERAL')
    expect(result.data!.registrationStatus).toBe('ATIVA')
    expect(result.data!.mainCnaeCode).toBe(6422100)
    expect(result.data!.mainCnaeDescription).toBe('Bancos multiplos, com carteira comercial')
    expect(result.data!.zipCode).toBe('70040-912')
    expect(result.data!.street).toBe('SAUN QUADRA 5 BLOCO B TORRE I')
    expect(result.data!.number).toBe('SN')
    expect(result.data!.district).toBe('ASA NORTE')
    expect(result.data!.city).toBe('BRASILIA')
    expect(result.data!.state).toBe('DF')
    expect(result.data!.phone).toBe('6134939002')
    expect(result.error).toBeNull()
  })

  it('handles missing optional fields', async () => {
    const sparse = {
      cnpj: '00000000000191',
      razao_social: 'TESTE',
      descricao_situacao_cadastral: 'ATIVA',
      cnae_fiscal: 1234567,
      cnae_fiscal_descricao: 'Teste',
    }
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sparse),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await lookupCompanyByCnpj(VALID_CNPJ)

    expect(result.data).not.toBeNull()
    expect(result.data!.tradeName).toBeNull()
    expect(result.data!.email).toBeNull()
    expect(result.data!.phone).toBeNull()
    expect(result.data!.street).toBeNull()
    expect(result.data!.zipCode).toBeNull()
  })

  it('returns invalid error for short CNPJ', async () => {
    const result = await lookupCompanyByCnpj('123')
    expect(result.error).not.toBeNull()
    expect(result.error!.kind).toBe('invalid')
    expect(result.data).toBeNull()
  })

  it('returns not_found for 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
    vi.stubGlobal('fetch', mockFetch)

    const result = await lookupCompanyByCnpj(VALID_CNPJ)
    expect(result.error).not.toBeNull()
    expect(result.error!.kind).toBe('not_found')
  })

  it('returns rate_limit for 429', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 429 })
    vi.stubGlobal('fetch', mockFetch)

    const result = await lookupCompanyByCnpj(VALID_CNPJ)
    expect(result.error).not.toBeNull()
    expect(result.error!.kind).toBe('rate_limit')
  })

  it('returns network error for 500', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    vi.stubGlobal('fetch', mockFetch)

    const result = await lookupCompanyByCnpj(VALID_CNPJ)
    expect(result.error).not.toBeNull()
    expect(result.error!.kind).toBe('network')
  })

  it('returns network error for timeout', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    const mockFetch = vi.fn().mockRejectedValue(abortError)
    vi.stubGlobal('fetch', mockFetch)

    const result = await lookupCompanyByCnpj(VALID_CNPJ)
    expect(result.error).not.toBeNull()
    expect(result.error!.kind).toBe('network')
    expect(result.error!.message).toContain('tempo limite')
  })

  it('returns network error for fetch failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', mockFetch)

    const result = await lookupCompanyByCnpj(VALID_CNPJ)
    expect(result.error).not.toBeNull()
    expect(result.error!.kind).toBe('network')
  })

  it('formats CEP with dash', async () => {
    const raw = { ...MOCK_RAW_RESPONSE, cep: '01001000' }
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(raw),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await lookupCompanyByCnpj(VALID_CNPJ)
    expect(result.data!.zipCode).toBe('01001-000')
  })

  it('strips non-digit from CNPJ in request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RAW_RESPONSE),
    })
    vi.stubGlobal('fetch', mockFetch)

    await lookupCompanyByCnpj(FORMATTED_CNPJ)

    expect(mockFetch).toHaveBeenCalledWith(
      `https://brasilapi.com.br/api/cnpj/v1/${VALID_CNPJ}`,
      expect.anything(),
    )
  })
})
