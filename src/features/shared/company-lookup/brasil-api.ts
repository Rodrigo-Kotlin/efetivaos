import type { CompanyLookupResult, CompanyLookupError } from './types'

type BrasilApiRawResponse = {
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  descricao_situacao_cadastral: string
  cnae_fiscal: number
  cnae_fiscal_descricao: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cep?: string
  municipio?: string
  uf?: string
  email?: string
  ddd_telefone_1?: string
  ddd_telefone_2?: string
}

const TIMEOUT_MS = 8000

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return null
  return digits
}

function normalizeZipCode(raw: string | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 8) return null
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function normalize(raw: BrasilApiRawResponse): CompanyLookupResult {
  return {
    cnpj: raw.cnpj.replace(/\D/g, ''),
    legalName: raw.razao_social || '',
    tradeName: raw.nome_fantasia || null,
    registrationStatus: raw.descricao_situacao_cadastral || '',
    mainCnaeCode: raw.cnae_fiscal ?? null,
    mainCnaeDescription: raw.cnae_fiscal_descricao || null,
    email: raw.email || null,
    phone: normalizePhone(raw.ddd_telefone_1),
    street: raw.logradouro || null,
    number: raw.numero || null,
    complement: raw.complemento || null,
    district: raw.bairro || null,
    zipCode: normalizeZipCode(raw.cep),
    city: raw.municipio || null,
    state: raw.uf || null,
  }
}

function handleError(status: number): CompanyLookupError {
  switch (status) {
    case 400:
      return { kind: 'invalid', message: 'Nao foi possivel consultar este CNPJ. Verifique o numero informado.' }
    case 404:
      return { kind: 'not_found', message: 'CNPJ nao encontrado na consulta automatica. Voce pode continuar preenchendo os dados manualmente.' }
    case 429:
      return { kind: 'rate_limit', message: 'Limite temporario de consultas atingido. Tente novamente em alguns instantes ou preencha manualmente.' }
    default:
      return { kind: 'network', message: 'O servico de consulta de CNPJ esta temporariamente indisponivel. O cadastro pode continuar manualmente.' }
  }
}

export async function lookupCompanyByCnpj(cnpj: string): Promise<{ data: CompanyLookupResult | null; error: CompanyLookupError | null }> {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) {
    return { data: null, error: { kind: 'invalid', message: 'CNPJ invalido.' } }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      signal: controller.signal,
    })

    if (!res.ok) {
      return { data: null, error: handleError(res.status) }
    }

    const json: BrasilApiRawResponse = await res.json()
    return { data: normalize(json), error: null }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { data: null, error: { kind: 'network', message: 'Consulta excedeu o tempo limite. O cadastro pode continuar manualmente.' } }
    }
    return { data: null, error: { kind: 'network', message: 'O servico de consulta de CNPJ esta temporariamente indisponivel. O cadastro pode continuar manualmente.' } }
  } finally {
    clearTimeout(timer)
  }
}

export function isValidCnpj(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digits)) return false

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  let sum = 0
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i]
  let remainder = sum % 11
  const d1 = remainder < 2 ? 0 : 11 - remainder
  if (parseInt(digits[12]) !== d1) return false

  sum = 0
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i]
  remainder = sum % 11
  const d2 = remainder < 2 ? 0 : 11 - remainder
  return parseInt(digits[13]) === d2
}

export function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 14) return raw
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function normalizeCnpj(raw: string): string {
  return raw.replace(/\D/g, '')
}
