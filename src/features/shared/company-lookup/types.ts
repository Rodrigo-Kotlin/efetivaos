export type CompanyLookupResult = {
  cnpj: string
  legalName: string
  tradeName: string | null
  registrationStatus: string
  mainCnaeCode: number | null
  mainCnaeDescription: string | null
  email: string | null
  phone: string | null
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  zipCode: string | null
  city: string | null
  state: string | null
}

export type CompanyLookupError = {
  kind: 'not_found' | 'invalid' | 'rate_limit' | 'network' | 'unknown'
  message: string
}

export type CompanyLookupStatus = 'idle' | 'loading' | 'success' | 'error'
