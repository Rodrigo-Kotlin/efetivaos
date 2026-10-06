import { ChevronDown, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FieldArrayWithId, FieldErrors, UseFormRegister } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldError, selectClassName } from '@/components/shared/operational-ui'

import type { CatalogItemRow } from '../catalog/catalog.types'
import type { QuotationFormValues } from './quotation.schemas'

type Props = {
  fields: FieldArrayWithId<QuotationFormValues, 'items'>[]
  register: UseFormRegister<QuotationFormValues>
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

export function QuotationItemsGrid({ fields, register, errors, catalogItems, selectedCatalogIds, activationIssues, onAdd, onRemove }: Props) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const arrayError = typeof errors.items?.message === 'string' ? errors.items.message : activationIssues.items
  const selectedIds = useMemo(() => new Set(selectedCatalogIds.filter(Boolean)), [selectedCatalogIds])
  const availableItems = useMemo(() => {
    const term = search.toLocaleLowerCase('pt-BR').trim()
    return catalogItems.filter((item) => item.active && item.sourcing_type === 'outsourced' && !selectedIds.has(item.id))
      .filter((item) => !term || `${item.code} ${item.name}`.toLocaleLowerCase('pt-BR').includes(term))
  }, [catalogItems, search, selectedIds])

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

  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-describedby={arrayError ? 'items-error' : undefined}>
    <div className="sticky top-20 z-10 -mx-2 rounded-xl bg-white/95 px-2 pb-3 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:pb-0">
      <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h2 className="font-serif text-xl font-semibold">Itens da cotação</h2>
          <p className="mt-1 break-words text-sm text-slate-500">{fields.length} {fields.length === 1 ? 'item adicionado' : 'itens adicionados'}</p>
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
    {fields.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nenhum item adicionado.</p> : <>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 text-sm" role="table" aria-label="Itens da cotação">
        <div className="hidden grid-cols-[minmax(0,1fr)_10rem_3.5rem] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs uppercase tracking-wide text-slate-500 md:grid" role="row"><span role="columnheader">Item</span><span role="columnheader">Preço unitário</span><span role="columnheader" className="text-center">Ação</span></div>
        {fields.map((field, index) => <QuotationItemRow key={field.id} field={field} index={index} register={register} errors={errors} catalogItems={catalogItems} selectedCatalogIds={selectedCatalogIds} activationIssues={activationIssues} onRemove={onRemove} />)}
      </div>
    </>}
    <p id="unit-normalization-warning" className="mt-4 break-words rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">O preço unitário deve representar o custo já normalizado para a unidade canônica do Catálogo Efetiva. Conversões de pacote, lote, frete e impostos não são realizadas.</p>
  </section>
}

type RowProps = Omit<Props, 'fields' | 'onAdd'> & { field: FieldArrayWithId<QuotationFormValues, 'items'>; index: number }

function QuotationItemRow({ field, index, register, errors, catalogItems, selectedCatalogIds, activationIssues, onRemove }: RowProps) {
  return <div className="grid gap-3 border-b border-slate-100 p-3 last:border-0 md:grid-cols-[minmax(0,1fr)_10rem_3.5rem] md:items-center md:gap-4 md:px-4 md:py-2.5" role="row">
    <div className="min-w-0" role="cell">
      <CatalogCell field={field} index={index} register={register} catalogItems={catalogItems} selectedCatalogIds={selectedCatalogIds} errors={errors} activationIssues={activationIssues} />
    </div>
    <div role="cell"><PriceCell index={index} register={register} errors={errors} activationIssues={activationIssues} /></div>
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

function PriceCell({ index, register, errors, activationIssues }: Pick<RowProps, 'index' | 'register' | 'errors' | 'activationIssues'>) {
  const priceError = errors.items?.[index]?.unit_price?.message || activationIssues[`items.${index}.unit_price`]
  return <div><label className="text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`items.${index}.unit_price`}>Preço unitário *</label><Input id={`items.${index}.unit_price`} className="mt-1 h-10 font-medium tabular-nums" inputMode="decimal" placeholder="R$ 0,00" aria-invalid={Boolean(priceError) || undefined} aria-describedby={priceError ? `item-${index}-price-error unit-normalization-warning` : 'unit-normalization-warning'} {...register(`items.${index}.unit_price`)} /><FieldError id={`item-${index}-price-error`}>{priceError}</FieldError></div>
}
