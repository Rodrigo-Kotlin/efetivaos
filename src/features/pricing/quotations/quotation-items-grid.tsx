import { ChevronDown, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useController, useWatch, type Control, type FieldArrayWithId, type FieldErrors, type UseFormRegister } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldError, selectClassName } from '@/components/shared/operational-ui'

import type { CatalogItemRow } from '../catalog/catalog.types'
import type { QuotationFormValues } from './quotation.schemas'
import { maskBrlInput } from './quotation.helpers'
import { parseBrlDecimal } from './quotation.schemas'

type Props = {
  fields: FieldArrayWithId<QuotationFormValues, 'items'>[]
  register: UseFormRegister<QuotationFormValues>
  control: Control<QuotationFormValues>
  errors: FieldErrors<QuotationFormValues>
  catalogItems: CatalogItemRow[]
  selectedCatalogIds: string[]
  activationIssues: Record<string, string>
  onAdd: (item: CatalogItemRow) => void
  onRemove: (index: number) => void
}

function itemLabel(item: CatalogItemRow) {
  return `${item.code} · ${item.name}`
}

function historicalLabel(item: CatalogItemRow) {
  if (!item.active) return ' (inativo - histórico)'
  if (item.sourcing_type !== 'outsourced') return ' (serviço próprio)'
  return ''
}

export function QuotationItemsGrid({ fields, register, control, errors, catalogItems, selectedCatalogIds, activationIssues, onAdd, onRemove }: Props) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const knownFieldIds = useRef(new Set<string>())
  const initialClassificationDone = useRef(false)
  const [completedOrder, setCompletedOrder] = useState<string[]>(() => fields
    .filter((field) => Boolean(parseBrlDecimal(field.unit_price)))
    .map((field) => field.id))
  const watchedItems = useWatch({ control, name: 'items' })
  const arrayError = typeof errors.items?.message === 'string' ? errors.items.message : activationIssues.items
  const selectedIds = useMemo(() => new Set(selectedCatalogIds.filter(Boolean)), [selectedCatalogIds])
  const availableItems = useMemo(() => {
    const term = search.toLocaleLowerCase('pt-BR').trim()
    return catalogItems.filter((item) => item.active && item.sourcing_type === 'outsourced' && !selectedIds.has(item.id))
      .filter((item) => !term || `${item.code} ${item.name}`.toLocaleLowerCase('pt-BR').includes(term))
  }, [catalogItems, search, selectedIds])

  useEffect(() => {
    const previousFieldIds = knownFieldIds.current
    const fieldIds = new Set(fields.map((field) => field.id))
    const newPendingIndex = fields.findIndex((field) => !previousFieldIds.has(field.id) && !parseBrlDecimal(field.unit_price))
    knownFieldIds.current = fieldIds
    const initialOrder = fields
      .filter((field, index) => Boolean(parseBrlDecimal(watchedItems[index]?.unit_price ?? field.unit_price)))
      .map((field) => field.id)
    const classifyInitialValues = !initialClassificationDone.current && fields.length > 0
    if (classifyInitialValues) initialClassificationDone.current = true
    setCompletedOrder((current) => {
      const next = current.filter((id) => fieldIds.has(id))
      const result = classifyInitialValues ? initialOrder : [...new Set(next)]
      return result.length === current.length && result.every((id, index) => id === current[index]) ? current : result
    })
    if (newPendingIndex >= 0) window.setTimeout(() => document.getElementById(`items.${newPendingIndex}.unit_price`)?.focus(), 0)
  }, [fields, watchedItems])

  function selectItem(item: CatalogItemRow) {
    if (selectedIds.has(item.id)) {
      setSearch('Este item já está incluído na cotação.')
      setOpen(true)
      return
    }
    onAdd(item)
    setSearch('')
    setOpen(false)
  }

  function completePrice(fieldId: string) {
    setCompletedOrder((current) => current.includes(fieldId) ? current : [...current, fieldId])
    searchRef.current?.focus()
  }

  function invalidatePrice(fieldId: string) {
    setCompletedOrder((current) => current.filter((id) => id !== fieldId))
  }

  const pendingFields = fields.filter((field) => !completedOrder.includes(field.id))
  const quotedFields = completedOrder.flatMap((id) => {
    const field = fields.find((candidate) => candidate.id === id)
    return field ? [field] : []
  })
  const pendingCount = pendingFields.length
  const quotedCount = quotedFields.length

  function renderRow(field: RowProps['field'], index: number, isPending: boolean) {
    return <QuotationItemRow key={field.id} field={field} index={index} register={register} control={control} errors={errors} catalogItems={catalogItems} selectedCatalogIds={selectedCatalogIds} activationIssues={activationIssues} onRemove={onRemove} isPending={isPending} onPriceComplete={completePrice} onPriceChange={invalidatePrice} />
  }

  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-describedby={arrayError ? 'items-error' : undefined}>
    <div className="sticky top-20 z-10 -mx-2 rounded-xl bg-white/95 px-2 pb-3 backdrop-blur md:mx-0 md:bg-white/95 md:px-2 md:pt-2">
      <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h2 className="font-serif text-xl font-semibold">Itens da cotação</h2>
          <p className="mt-1 break-words text-sm text-slate-500">{fields.length} {fields.length === 1 ? 'item' : 'itens'} · {pendingCount} {pendingCount === 1 ? 'aguardando preço' : 'aguardando preços'} · {quotedCount} cotados</p>
        </div>
        <div className="relative min-w-0 flex-1 sm:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="quotation-item-search"
            className="pr-10 pl-9"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="quotation-item-options"
            aria-expanded={open}
            placeholder="Buscar item por código ou nome..."
             ref={searchRef}
             value={search}
            onFocus={() => setOpen(true)}
            onChange={(event) => { setSearch(event.target.value); setOpen(true) }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
              if (event.key === 'Enter' && availableItems[0]) { event.preventDefault(); selectItem(availableItems[0]) }
            }}
          />
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          {open && <div id="quotation-item-options" role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
            {availableItems.length ? availableItems.map((item) => <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none" key={item.id} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => selectItem(item)}>
              <span className="block font-semibold text-slate-900">{itemLabel(item)}</span>
              <span className="block text-xs text-slate-500">{item.category.name} · {item.unit}</span>
            </button>) : <p className="px-3 py-3 text-sm text-slate-500">{search === 'Este item já está incluído na cotação.' ? search : 'Nenhum item elegível encontrado.'}</p>}
          </div>}
        </div>
      </div>
    </div>
    <FieldError id="items-error">{arrayError}</FieldError>
    {fields.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nenhum item adicionado.</p> : <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 text-sm" role="table" aria-label="Itens da cotação">
      {pendingCount > 0 && <section aria-labelledby="quotation-pending-title">
        <div className="border-b border-slate-200 bg-amber-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-amber-900" id="quotation-pending-title">Aguardando preço · {pendingCount}</div>
        {pendingFields.map((field) => renderRow(field, fields.indexOf(field), true))}
      </section>}
      <section aria-labelledby="quotation-quoted-title">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500" id="quotation-quoted-title">Itens cotados · {quotedCount}</div>
        {quotedFields.length ? quotedFields.map((field) => renderRow(field, fields.indexOf(field), false)) : <p className="px-4 py-4 text-sm text-slate-500">Nenhum item cotado ainda.</p>}
      </section>
    </div>}
    <p id="unit-normalization-warning" className="mt-4 break-words rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">O preço unitário deve representar o custo já normalizado para a unidade canônica do Catálogo Efetiva. Conversões de pacote, lote, frete e impostos não são realizadas.</p>
  </section>
}

type RowProps = Omit<Props, 'fields' | 'onAdd'> & { field: FieldArrayWithId<QuotationFormValues, 'items'>; index: number; isPending: boolean; onPriceComplete: (fieldId: string) => void; onPriceChange: (fieldId: string) => void }

function QuotationItemRow({ field, index, register, control, errors, catalogItems, selectedCatalogIds, activationIssues, onRemove, isPending, onPriceComplete, onPriceChange }: RowProps) {
  return <div className="grid gap-3 border-b border-slate-100 p-3 last:border-0 md:grid-cols-[minmax(0,1fr)_10rem_3.5rem] md:items-center md:gap-4 md:px-4 md:py-2.5" role="row">
    <div className="min-w-0" role="cell">
      <CatalogCell field={field} index={index} register={register} catalogItems={catalogItems} selectedCatalogIds={selectedCatalogIds} errors={errors} activationIssues={activationIssues} />
    </div>
    <div role="cell"><PriceCell fieldId={field.id} index={index} control={control} errors={errors} activationIssues={activationIssues} isPending={isPending} onPriceComplete={onPriceComplete} onPriceChange={onPriceChange} /></div>
    <div role="cell" className="flex justify-end md:justify-center"><Button className="size-10 shrink-0 p-0 text-slate-500 hover:text-red-700" type="button" variant="ghost" title="Remover item" aria-label={`Remover item ${index + 1}`} onClick={() => onRemove(index)}><Trash2 className="size-4" /></Button></div>
  </div>
}

function CatalogCell({ field, index, register, catalogItems, selectedCatalogIds, errors, activationIssues }: Pick<RowProps, 'field' | 'index' | 'register' | 'catalogItems' | 'selectedCatalogIds' | 'errors' | 'activationIssues'>) {
  const selectedId = selectedCatalogIds[index] || field.catalog_item_id
  const selectedItem = catalogItems.find((item) => item.id === selectedId)
  const catalogError = errors.items?.[index]?.catalog_item_id?.message || activationIssues[`items.${index}.catalog_item_id`]
  const options = catalogItems.filter((item) => item.active && item.sourcing_type === 'outsourced' && (!selectedCatalogIds.includes(item.id) || item.id === selectedId))
  return <div className="min-w-0">
    {selectedItem ? <><input type="hidden" defaultValue={selectedItem.id} {...register(`items.${index}.catalog_item_id`)} /><p className="break-words font-semibold leading-5 text-slate-900">{itemLabel(selectedItem)}<span className="block text-xs font-normal leading-4 text-slate-500">{selectedItem.category.name} · {selectedItem.unit}{historicalLabel(selectedItem)}</span></p></> : <select aria-label={`Item do Catálogo Efetiva ${index + 1}`} className={`${selectClassName} w-full`} aria-invalid={Boolean(catalogError) || undefined} {...register(`items.${index}.catalog_item_id`)}><option value="">Mapear item do catálogo...</option>{options.map((item) => <option key={item.id} value={item.id}>{itemLabel(item)}</option>)}</select>}
    <FieldError id={`item-${index}-catalog-error`}>{catalogError}</FieldError>
  </div>
}

function PriceCell({ fieldId, index, control, errors, activationIssues, isPending, onPriceComplete, onPriceChange }: { fieldId: string; index: number; control: Control<QuotationFormValues>; errors: FieldErrors<QuotationFormValues>; activationIssues: Record<string, string>; isPending: boolean; onPriceComplete: (fieldId: string) => void; onPriceChange: (fieldId: string) => void }) {
  const { field: priceField } = useController({ control, name: `items.${index}.unit_price` })
  const rawDigits = useRef((priceField.value || '').replace(/\D/g, ''))
  const priceError = errors.items?.[index]?.unit_price?.message || activationIssues[`items.${index}.unit_price`]
  function finishPrice() {
    if (parseBrlDecimal(priceField.value)) onPriceComplete(fieldId)
  }

  function changePrice(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    const inputEvent = event.nativeEvent as InputEvent
    const typedDigits = inputEvent.data?.replace(/\D/g, '') ?? ''
    if (!value.replace(/\D/g, '')) rawDigits.current = ''
    else if (inputEvent.inputType === 'deleteContentBackward') rawDigits.current = rawDigits.current.slice(0, -1)
    else if (inputEvent.inputType === 'insertText' && typedDigits) rawDigits.current += typedDigits
    else rawDigits.current = value.replace(/\D/g, '')
    const masked = maskBrlInput(rawDigits.current)
    priceField.onChange(masked)
    if (!parseBrlDecimal(masked)) onPriceChange(fieldId)
  }

  function commitDigits(digits: string) {
    rawDigits.current = digits
    const masked = maskBrlInput(digits)
    priceField.onChange(masked)
    if (!parseBrlDecimal(masked)) onPriceChange(fieldId)
  }

  function handlePriceKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      finishPrice()
    } else if (/^\d$/.test(event.key)) {
      event.preventDefault()
      commitDigits(`${rawDigits.current}${event.key}`)
    } else if (event.key === 'Backspace') {
      event.preventDefault()
      commitDigits(rawDigits.current.slice(0, -1))
    } else if (event.key === ',' || event.key === '.') {
      event.preventDefault()
    }
  }

  function handlePricePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    commitDigits(event.clipboardData.getData('text').replace(/\D/g, ''))
  }

  return <div><label className={isPending ? 'text-xs font-bold uppercase tracking-wide text-slate-500' : 'sr-only'} htmlFor={`items.${index}.unit_price`}>Preço unitário *</label><Input id={`items.${index}.unit_price`} className="mt-1 h-10 font-medium tabular-nums" inputMode="decimal" value={priceField.value || ''} placeholder="R$ 0,00" onFocus={(event) => { if (isPending && !parseBrlDecimal(priceField.value)) event.currentTarget.select() }} onChange={changePrice} onPaste={handlePricePaste} onBlur={() => { priceField.onBlur(); finishPrice() }} onKeyDown={handlePriceKeyDown} name={priceField.name} ref={priceField.ref} aria-invalid={Boolean(priceError) || undefined} aria-describedby={priceError ? `item-${index}-price-error unit-normalization-warning` : 'unit-normalization-warning'} /><FieldError id={`item-${index}-price-error`}>{priceError}</FieldError></div>
}
