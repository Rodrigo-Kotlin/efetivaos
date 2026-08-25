import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { FieldError, selectClassName, textareaClassName } from '@/components/shared/operational-ui'
import type { Supplier } from '@/types/database'

import type { QuotationFormValues } from './quotation.schemas'

type Props = {
  register: UseFormRegister<QuotationFormValues>
  errors: FieldErrors<QuotationFormValues>
  suppliers: Supplier[]
  currentSupplierId?: string
  supplierWarning?: string
}

function errorA11y(hasError: boolean, id: string, extraDescription?: string) {
  const describedBy = [hasError ? id : '', extraDescription ?? ''].filter(Boolean).join(' ') || undefined
  return {
    'aria-invalid': hasError || undefined,
    'aria-describedby': describedBy,
    'aria-errormessage': hasError ? id : undefined,
  }
}

export function QuotationHeaderForm({ register, errors, suppliers, currentSupplierId, supplierWarning }: Props) {
  const available = suppliers.filter((supplier) => supplier.active || supplier.id === currentSupplierId)
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="font-serif text-xl font-semibold">Dados da cotação</h2>
    <div className="mt-5 grid gap-5 sm:grid-cols-2">
      <div><label className="text-sm font-semibold" htmlFor="supplier_id">Fornecedor *</label><select id="supplier_id" className={`${selectClassName} mt-1.5 w-full`} {...errorA11y(Boolean(errors.supplier_id), 'supplier_id-error', supplierWarning ? 'supplier-warning' : undefined)} {...register('supplier_id')}><option value="">Selecione...</option>{available.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{!supplier.active ? ' (inativo - histórico)' : ''}</option>)}</select><FieldError id="supplier_id-error">{errors.supplier_id?.message}</FieldError>{supplierWarning && <p id="supplier-warning" className="mt-1.5 text-sm text-amber-800">{supplierWarning}</p>}</div>
      <div><label className="text-sm font-semibold" htmlFor="reference_number">Número / referência</label><Input id="reference_number" className="mt-1.5" {...errorA11y(Boolean(errors.reference_number), 'reference_number-error')} {...register('reference_number')} /><FieldError id="reference_number-error">{errors.reference_number?.message}</FieldError></div>
      <div><label className="text-sm font-semibold" htmlFor="received_at">Data recebida *</label><Input id="received_at" className="mt-1.5" type="date" {...errorA11y(Boolean(errors.received_at), 'received_at-error')} {...register('received_at')} /><FieldError id="received_at-error">{errors.received_at?.message}</FieldError></div>
      <div><label className="text-sm font-semibold" htmlFor="valid_until">Validade</label><Input id="valid_until" className="mt-1.5" type="date" {...errorA11y(Boolean(errors.valid_until), 'valid_until-error')} {...register('valid_until')} /><FieldError id="valid_until-error">{errors.valid_until?.message}</FieldError></div>
      <div className="sm:col-span-2"><label className="text-sm font-semibold" htmlFor="notes">Observações</label><textarea id="notes" className={`${textareaClassName} mt-1.5`} {...errorA11y(Boolean(errors.notes), 'notes-error')} {...register('notes')} /><FieldError id="notes-error">{errors.notes?.message}</FieldError></div>
    </div>
  </section>
}
