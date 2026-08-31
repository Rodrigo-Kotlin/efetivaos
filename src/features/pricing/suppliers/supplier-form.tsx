import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldError, textareaClassName } from '@/components/shared/operational-ui'
import type { Supplier } from '@/types/database'

import { supplierFormDefaults, type SupplierFormValues, type SupplierInput, supplierSchema, toSupplierInput } from './supplier-schema'

type SupplierFormProps = {
  supplier?: Supplier
  pending?: boolean
  onCancel: () => void
  onSubmit: (input: SupplierInput) => void | Promise<void>
}

export function SupplierForm({ supplier, pending = false, onCancel, onSubmit }: SupplierFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: supplierFormDefaults(supplier),
  })

  const field = (name: keyof SupplierFormValues) => ({
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  })

  return (
    <form className="space-y-5" onSubmit={handleSubmit((values) => onSubmit(toSupplierInput(values)))} noValidate>
      {supplier?.code && <div><label className="text-sm font-semibold text-slate-800" htmlFor="code">Código</label><Input id="code" value={supplier.code} readOnly disabled className="mt-1 font-mono text-sm" /></div>}
      <div>
        <label className="text-sm font-semibold text-slate-800" htmlFor="name">Nome / Nome fantasia *</label>
        <Input id="name" {...register('name')} {...field('name')} />
        <FieldError id="name-error">{errors.name?.message}</FieldError>
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-800" htmlFor="legal_name">Razao social</label>
        <Input id="legal_name" {...register('legal_name')} {...field('legal_name')} />
        <FieldError id="legal_name-error">{errors.legal_name?.message}</FieldError>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-800" htmlFor="tax_id">CPF/CNPJ</label>
          <Input id="tax_id" {...register('tax_id')} {...field('tax_id')} />
          <FieldError id="tax_id-error">{errors.tax_id?.message}</FieldError>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-800" htmlFor="category">Segmento</label>
          <Input id="category" {...register('category')} {...field('category')} />
          <FieldError id="category-error">{errors.category?.message}</FieldError>
        </div>
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-800" htmlFor="contact_name">Nome do contato</label>
        <Input id="contact_name" {...register('contact_name')} {...field('contact_name')} />
        <FieldError id="contact_name-error">{errors.contact_name?.message}</FieldError>
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
        <label className="text-sm font-semibold text-slate-800" htmlFor="notes">Observacoes</label>
        <textarea id="notes" className={textareaClassName} {...register('notes')} {...field('notes')} />
        <FieldError id="notes-error">{errors.notes?.message}</FieldError>
      </div>
      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800">
        <input className="size-4 accent-emerald-700" type="checkbox" {...register('active')} />
        Fornecedor ativo
      </label>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Salvando...' : supplier ? 'Salvar alteracoes' : 'Cadastrar fornecedor'}</Button>
      </div>
    </form>
  )
}
