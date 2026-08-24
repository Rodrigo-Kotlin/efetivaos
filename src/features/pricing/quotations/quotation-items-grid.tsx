import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { FieldArrayWithId, FieldErrors, UseFormRegister } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldError, selectClassName, textareaClassName } from '@/features/pricing/components/operational-ui'

import type { CatalogItemRow } from '../catalog/catalog.types'
import type { QuotationFormValues } from './quotation.schemas'

type Props = {
  fields: FieldArrayWithId<QuotationFormValues, 'items'>[]
  register: UseFormRegister<QuotationFormValues>
  errors: FieldErrors<QuotationFormValues>
  catalogItems: CatalogItemRow[]
  selectedCatalogIds: string[]
  activationIssues: Record<string, string>
  onAdd: () => void
  onRemove: (index: number) => void
}

export function QuotationItemsGrid({ fields, register, errors, catalogItems, selectedCatalogIds, activationIssues, onAdd, onRemove }: Props) {
  const [catalogSearch, setCatalogSearch] = useState<Record<string, string>>({})
  const arrayError = typeof errors.items?.message === 'string' ? errors.items.message : activationIssues.items
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-describedby={arrayError ? 'items-error' : undefined}>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-serif text-xl font-semibold">Itens</h2><p className="mt-1 text-sm text-slate-500">Mapeie por código e nome no Catálogo Efetiva.</p></div><Button id="add-quotation-item" type="button" variant="outline" aria-describedby={arrayError ? 'items-error' : undefined} onClick={onAdd}><Plus className="size-4" /> Adicionar item</Button></div>
    <FieldError id="items-error">{arrayError}</FieldError>
    {fields.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nenhum item adicionado.</p> : <div className="mt-5 space-y-4">{fields.map((field, index) => {
      const catalogError = errors.items?.[index]?.catalog_item_id?.message || activationIssues[`items.${index}.catalog_item_id`]
      const descriptionError = errors.items?.[index]?.supplier_description?.message
      const codeError = errors.items?.[index]?.supplier_item_code?.message
      const priceError = errors.items?.[index]?.unit_price?.message || activationIssues[`items.${index}.unit_price`]
      const notesError = errors.items?.[index]?.notes?.message
      const selectedId = selectedCatalogIds[index] || field.catalog_item_id
      return <article className="rounded-xl border border-slate-200 bg-slate-50/60 p-4" key={field.id}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.5fr)_1fr_1fr_10rem_auto]">
          <div><label className="text-xs font-bold uppercase tracking-wide" htmlFor={`items.${index}.catalog_search`}>Item do Catálogo Efetiva</label><Input id={`items.${index}.catalog_search`} className="mt-1" type="search" placeholder="Buscar por código ou nome..." aria-label={`Buscar catálogo do item ${index + 1}`} value={catalogSearch[field.id] ?? ''} onChange={(event) => setCatalogSearch((current) => ({ ...current, [field.id]: event.target.value }))} /><select id={`items.${index}.catalog_item_id`} aria-label={`Item do Catálogo Efetiva ${index + 1}`} className={`${selectClassName} mt-1 w-full`} aria-invalid={Boolean(catalogError) || undefined} aria-describedby={catalogError ? `item-${index}-catalog-error` : undefined} aria-errormessage={catalogError ? `item-${index}-catalog-error` : undefined} {...register(`items.${index}.catalog_item_id`)}><option value="">Mapear depois (rascunho)</option>{catalogItems.filter((item) => { const term = (catalogSearch[field.id] ?? '').toLocaleLowerCase('pt-BR').trim(); return (item.active || item.id === selectedId) && (item.id === selectedId || !term || `${item.code} ${item.name}`.toLocaleLowerCase('pt-BR').includes(term)) }).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name} | {item.category.name} | {item.unit}{!item.active ? ' (inativo - histórico)' : ''}</option>)}</select><FieldError id={`item-${index}-catalog-error`}>{catalogError}</FieldError></div>
          <div><label className="text-xs font-bold uppercase tracking-wide" htmlFor={`items.${index}.supplier_description`}>Descrição do fornecedor</label><Input id={`items.${index}.supplier_description`} className="mt-1" aria-invalid={Boolean(descriptionError) || undefined} aria-describedby={descriptionError ? `item-${index}-description-error` : undefined} aria-errormessage={descriptionError ? `item-${index}-description-error` : undefined} {...register(`items.${index}.supplier_description`)} /><FieldError id={`item-${index}-description-error`}>{descriptionError}</FieldError></div>
          <div><label className="text-xs font-bold uppercase tracking-wide" htmlFor={`items.${index}.supplier_item_code`}>Código do fornecedor</label><Input id={`items.${index}.supplier_item_code`} className="mt-1" aria-invalid={Boolean(codeError) || undefined} aria-describedby={codeError ? `item-${index}-code-error` : undefined} aria-errormessage={codeError ? `item-${index}-code-error` : undefined} {...register(`items.${index}.supplier_item_code`)} /><FieldError id={`item-${index}-code-error`}>{codeError}</FieldError></div>
          <div><label className="text-xs font-bold uppercase tracking-wide" htmlFor={`items.${index}.unit_price`}>Preço unitário *</label><Input id={`items.${index}.unit_price`} className="mt-1" inputMode="decimal" placeholder="0,00" aria-invalid={Boolean(priceError) || undefined} aria-describedby={priceError ? `item-${index}-price-error unit-normalization-warning` : 'unit-normalization-warning'} aria-errormessage={priceError ? `item-${index}-price-error` : undefined} {...register(`items.${index}.unit_price`)} /><FieldError id={`item-${index}-price-error`}>{priceError}</FieldError></div>
          <Button className="self-end" type="button" size="icon" variant="ghost" aria-label={`Remover item ${index + 1}`} onClick={() => onRemove(index)}><Trash2 className="size-4" /></Button>
        </div>
        <div className="mt-4"><label className="text-xs font-bold uppercase tracking-wide" htmlFor={`items.${index}.notes`}>Observação da linha</label><textarea id={`items.${index}.notes`} className={`${textareaClassName} mt-1 min-h-16`} aria-invalid={Boolean(notesError) || undefined} aria-describedby={notesError ? `item-${index}-notes-error` : undefined} aria-errormessage={notesError ? `item-${index}-notes-error` : undefined} {...register(`items.${index}.notes`)} /><FieldError id={`item-${index}-notes-error`}>{notesError}</FieldError></div>
      </article>
    })}</div>}
    <p id="unit-normalization-warning" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">O preço unitário deve representar o custo já normalizado para a unidade canônica do Catálogo Efetiva. Conversões de pacote, lote, frete e impostos não são realizadas.</p>
  </section>
}
