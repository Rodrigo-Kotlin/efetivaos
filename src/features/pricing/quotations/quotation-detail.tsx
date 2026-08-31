import { ExternalLink, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { formatCurrency, formatDate, formatDateTime, isExpired } from './quotation.helpers'
import { QuotationStatusBadge, QuotationValidityBadge } from './quotation-badges'
import type { QuotationDetail as QuotationDetailType } from './quotation.types'

export function QuotationDetail({ quotation, onOpenAttachment, onEdit }: { quotation: QuotationDetailType; onOpenAttachment: () => void; onEdit?: () => void }) {
  const details = [
    ['Fornecedor', quotation.supplier.name],
    ['Referência', quotation.reference_number || 'Não informada'],
    ['Recebida em', formatDate(quotation.received_at)],
    ['Validade', formatDate(quotation.valid_until)],
  ]

  return <div className="space-y-5">
    {isExpired(quotation.valid_until) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="note"><strong>Cotação histórica:</strong> a validade expirou. O registro permanece disponível para auditoria, mas não será elegível para comparação futura.</div>}
    {!quotation.valid_until && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700" role="note">A validade não foi informada. O registro mantém esse alerta permanente no histórico.</div>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2"><QuotationStatusBadge status={quotation.status} /><QuotationValidityBadge validUntil={quotation.valid_until} />{quotation.status === 'draft' && onEdit && <Button type="button" variant="outline" size="sm" onClick={onEdit} className="ml-auto"><Pencil className="size-4" /> Editar cotação</Button>}</div>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{details.map(([label, value]) => <div key={label}><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-950">{value}</dd></div>)}</dl>
      {quotation.notes && <div className="mt-5 border-t border-slate-100 pt-5"><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Observações</h2><p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{quotation.notes}</p></div>}
      {quotation.source_file_path && <Button className="mt-5" type="button" variant="outline" onClick={onOpenAttachment}><ExternalLink className="size-4" /> Abrir ou baixar anexo privado</Button>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-xl font-semibold">Itens da cotação</h2>
      {quotation.quotation_items.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">Nenhum item registrado.</p> : <>
        <div className="mt-4 space-y-3 md:hidden">{quotation.quotation_items.map((item, index) => <article className="rounded-xl border border-slate-200 p-4" key={item.id}><p className="font-semibold">{item.catalog_item ? `${item.catalog_item.code} - ${item.catalog_item.name}` : `Linha ${index + 1} sem mapeamento`}</p><p className="mt-1 text-sm text-slate-600">{item.catalog_item ? `${item.catalog_item.category.name} · ${item.catalog_item.unit}` : 'Catálogo não informado'}</p><p className="mt-3 text-lg font-bold text-emerald-900">{formatCurrency(item.unit_price)}</p><p className="mt-2 text-sm">{item.supplier_description || 'Descrição do fornecedor não informada'}{item.supplier_item_code ? ` · ${item.supplier_item_code}` : ''}</p>{item.notes && <p className="mt-2 text-sm text-slate-600">{item.notes}</p>}</article>)}</div>
        <div className="mt-4 hidden overflow-x-auto md:block"><table className="w-full min-w-[800px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Código / item</th><th className="px-3 py-2">Categoria</th><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Descrição original</th><th className="px-3 py-2">Código fornecedor</th><th className="px-3 py-2">Valor</th><th className="px-3 py-2">Observação</th></tr></thead><tbody className="divide-y divide-slate-100">{quotation.quotation_items.map((item) => <tr key={item.id}><td className="px-3 py-3">{item.catalog_item ? `${item.catalog_item.code} - ${item.catalog_item.name}` : 'Sem mapeamento'}</td><td className="px-3 py-3">{item.catalog_item?.category.name || 'Não informada'}</td><td className="px-3 py-3">{item.catalog_item?.unit || 'Não informada'}</td><td className="px-3 py-3">{item.supplier_description || 'Não informada'}</td><td className="px-3 py-3">{item.supplier_item_code || 'Não informado'}</td><td className="px-3 py-3 font-semibold">{formatCurrency(item.unit_price)}</td><td className="px-3 py-3">{item.notes || '—'}</td></tr>)}</tbody></table></div>
      </>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-serif text-xl font-semibold">Auditoria</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-slate-500">Criada em</dt><dd>{formatDateTime(quotation.created_at)}</dd><dd className="break-all text-xs text-slate-500">{quotation.created_by || 'Usuário não informado'}</dd></div><div><dt className="font-semibold text-slate-500">Atualizada em</dt><dd>{formatDateTime(quotation.updated_at)}</dd><dd className="break-all text-xs text-slate-500">{quotation.updated_by || 'Usuário não informado'}</dd></div></dl></section>
  </div>
}
