import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldError, textareaClassName } from '@/components/shared/operational-ui'
import type { ClientListRow } from '@/types/database'

import { clientFormDefaults, clientSchema, toClientInput, type ClientFormValues, type ClientFormInput } from '@/features/crm/schemas/client-schema'

type ClientFormProps = {
  client?: ClientListRow
  pending?: boolean
  onCancel: () => void
  onSubmit: (input: ClientFormInput) => void | Promise<void>
}

function clientDefaults(client?: ClientListRow): ClientFormValues {
  if (!client) return clientFormDefaults()
  return {
    legal_name: client.legal_name ?? '',
    trade_name: client.trade_name ?? '',
    client_type: client.client_type ?? 'individual',
    tax_id: client.tax_id ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    website: client.website ?? '',
    zip_code: client.zip_code ?? '',
    street: client.street ?? '',
    number: client.number ?? '',
    complement: client.complement ?? '',
    district: client.district ?? '',
    city: client.city ?? '',
    state: client.state ?? '',
    country: client.country ?? 'Brasil',
    notes: client.notes ?? '',
  }
}

export default function ClientForm({ client, pending = false, onCancel, onSubmit }: ClientFormProps) {
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: clientDefaults(client),
  })

  const clientType = watch('client_type')

  const field = (name: string) => ({
    'aria-invalid': Boolean(errors[name as keyof typeof errors]),
    'aria-describedby': errors[name as keyof typeof errors] ? `${name}-error` : undefined,
  })

  return (
    <form className="space-y-5" onSubmit={handleSubmit((values) => onSubmit(toClientInput(values)))} noValidate>
      <div>
        <label className="text-sm font-semibold text-slate-800" htmlFor="legal_name">
          {clientType === 'company' ? 'Razão Social *' : 'Nome completo *'}
        </label>
        <Input id="legal_name" autoFocus {...register('legal_name')} {...field('legal_name')} />
        <FieldError id="legal_name-error">{errors.legal_name?.message}</FieldError>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-800" htmlFor="trade_name">Nome fantasia</label>
          <Input id="trade_name" {...register('trade_name')} {...field('trade_name')} />
          <FieldError id="trade_name-error">{errors.trade_name?.message}</FieldError>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-800" htmlFor="client_type">Tipo de cliente</label>
          <select id="client_type" className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" {...register('client_type')} {...field('client_type')}>
            <option value="individual">Pessoa Física</option>
            <option value="company">Pessoa Jurídica</option>
          </select>
          <FieldError id="client_type-error">{errors.client_type?.message}</FieldError>
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-800" htmlFor="tax_id">
          {clientType === 'company' ? 'CNPJ *' : 'CPF *'}
        </label>
        <Input id="tax_id" placeholder={clientType === 'company' ? '00.000.000/0000-00' : '000.000.000-00'} {...register('tax_id')} {...field('tax_id')} />
        <FieldError id="tax_id-error">{errors.tax_id?.message}</FieldError>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-800" htmlFor="email">E-mail</label>
          <Input id="email" type="email" {...register('email')} {...field('email')} />
          <FieldError id="email-error">{errors.email?.message}</FieldError>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-800" htmlFor="phone">Telefone / WhatsApp</label>
          <Input id="phone" type="tel" {...register('phone')} {...field('phone')} />
          <FieldError id="phone-error">{errors.phone?.message}</FieldError>
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-800" htmlFor="website">Website</label>
        <Input id="website" type="url" placeholder="https://" {...register('website')} {...field('website')} />
        <FieldError id="website-error">{errors.website?.message}</FieldError>
      </div>

      <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <legend className="px-1 text-sm font-bold text-slate-700">Endereço</legend>
        <div className="space-y-4">
          <div className="grid gap-5 sm:grid-cols-[8rem_1fr]">
            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="zip_code">CEP</label>
              <Input id="zip_code" placeholder="00000-000" {...register('zip_code')} {...field('zip_code')} />
              <FieldError id="zip_code-error">{errors.zip_code?.message}</FieldError>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="street">Logradouro</label>
              <Input id="street" {...register('street')} {...field('street')} />
              <FieldError id="street-error">{errors.street?.message}</FieldError>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-4">
            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="number">Número</label>
              <Input id="number" {...register('number')} {...field('number')} />
              <FieldError id="number-error">{errors.number?.message}</FieldError>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="complement">Complemento</label>
              <Input id="complement" {...register('complement')} {...field('complement')} />
              <FieldError id="complement-error">{errors.complement?.message}</FieldError>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="district">Bairro</label>
              <Input id="district" {...register('district')} {...field('district')} />
              <FieldError id="district-error">{errors.district?.message}</FieldError>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="city">Cidade</label>
              <Input id="city" {...register('city')} {...field('city')} />
              <FieldError id="city-error">{errors.city?.message}</FieldError>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="state">UF</label>
              <Input id="state" maxLength={2} placeholder="SP" {...register('state')} {...field('state')} />
              <FieldError id="state-error">{errors.state?.message}</FieldError>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="country">País</label>
              <Input id="country" {...register('country')} {...field('country')} />
              <FieldError id="country-error">{errors.country?.message}</FieldError>
            </div>
          </div>
        </div>
      </fieldset>

      <div>
        <label className="text-sm font-semibold text-slate-800" htmlFor="notes">Observações</label>
        <textarea id="notes" className={textareaClassName} {...register('notes')} {...field('notes')} />
        <FieldError id="notes-error">{errors.notes?.message}</FieldError>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Salvando...' : client ? 'Salvar alterações' : 'Cadastrar cliente'}</Button>
      </div>
    </form>
  )
}
