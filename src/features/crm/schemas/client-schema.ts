import { z } from 'zod'

export const clientTypeOptions = z.enum(['company', 'individual'])
export const clientStatusOptions = z.enum(['active', 'inactive'])

export const clientSchema = z.object({
  legal_name: z.string().trim().min(1, 'Informe a Razão Social ou Nome completo.').max(200),
  trade_name: z.string().trim().max(200).optional(),
  client_type: clientTypeOptions.default('individual'),
  tax_id: z.string().trim().refine((val) => /^\d{11}$|^\d{14}$/.test(val.replace(/[^\d]/g, '')), {
    message: 'Informe CPF (11 dígitos) ou CNPJ (14 dígitos).',
  }),
  email: z.string().trim().max(254).optional().default('').refine((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: 'E-mail inválido.',
  }),
  phone: z.string().trim().max(32).optional().default('').refine((val) => val === '' || /^[\d\s+-]+$/.test(val), {
    message: 'Telefone inválido.',
  }),
  website: z.string().trim().max(200).optional().default(''),
  zip_code: z.string().trim().max(10).optional().default('').refine((val) => val === '' || /^[\d-]+$/.test(val), {
    message: 'CEP inválido.',
  }),
  street: z.string().trim().max(200).optional(),
  number: z.string().trim().max(20).optional(),
  complement: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(2).optional(),
  country: z.string().trim().max(100).optional().default('Brasil'),
  notes: z.string().trim().max(1000).optional(),
})

export type ClientFormValues = z.infer<typeof clientSchema>

export type ClientFormInput = {
  legal_name: string
  trade_name: string | null
  client_type: 'company' | 'individual'
  tax_id: string
  email: string | null
  phone: string | null
  website: string | null
  zip_code: string | null
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  country: string
  notes: string | null
}

export function clientFormDefaults(): ClientFormValues {
  return {
    legal_name: '',
    trade_name: '',
    client_type: 'individual',
    tax_id: '',
    email: '',
    phone: '',
    website: '',
    zip_code: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: '',
    country: 'Brasil',
    notes: '',
  }
}

export function toClientInput(values: ClientFormValues): ClientFormInput {
  return {
    legal_name: values.legal_name.trim(),
    trade_name: values.trade_name === '' ? null : values.trade_name || null,
    client_type: values.client_type,
    tax_id: values.tax_id.replace(/[^\d]/g, ''),
    email: values.email === '' ? null : values.email || null,
    phone: values.phone === '' ? null : values.phone || null,
    website: values.website === '' ? null : values.website || null,
    zip_code: values.zip_code === '' ? null : (values.zip_code || '').replace(/[^\d-]/g, '') || null,
    street: values.street === '' ? null : values.street || null,
    number: values.number === '' ? null : values.number || null,
    complement: values.complement === '' ? null : values.complement || null,
    district: values.district === '' ? null : values.district || null,
    city: values.city === '' ? null : values.city || null,
    state: values.state || null,
    country: values.country || 'Brasil',
    notes: values.notes === '' ? null : values.notes || null,
  }
}