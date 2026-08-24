import { supabase } from '@/lib/supabase'
import type { Quotation } from '@/types/database'

import type { QuotationAttachmentRecoveryInput, QuotationDetail, QuotationDraftInput, QuotationDraftSaveResult, QuotationLifecycleInput, QuotationListRow } from './quotation.types'

type ServiceError = { code?: string; message?: string; details?: string; constraint?: string }

const listSelect = 'id, reference_number, received_at, valid_until, status, updated_at, supplier:suppliers!quotations_supplier_id_fkey(id, name), quotation_items(id)'
const detailSelect = 'id, supplier_id, reference_number, received_at, valid_until, status, source_file_path, source_file_pending, revision, notes, created_at, created_by, updated_at, updated_by, supplier:suppliers!quotations_supplier_id_fkey(id, name, active), quotation_items(id, quotation_id, catalog_item_id, supplier_description, supplier_item_code, unit_price, notes, created_at, created_by, updated_at, updated_by, catalog_item:catalog_items(id, code, name, unit, category_id, active, category:catalog_categories(id, name)))'

export function translateQuotationError(error: ServiceError): Error {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.constraint ?? ''}`.toLowerCase()
  if (error.code === '42501') return new Error('Voce nao tem permissao para realizar esta operacao.')
  if (error.code === '23505' || text.includes('uq_quotation_item')) return new Error('O mesmo item do catalogo nao pode aparecer duas vezes na cotacao.')
  if (text.includes('fornecedor') && text.includes('inativ')) return new Error('O fornecedor precisa estar ativo para criar ou ativar a cotacao.')
  if (text.includes('item') && text.includes('inativ')) return new Error('Um item selecionado esta inativo no Catalogo Efetiva.')
  if (text.includes('ao menos um item')) return new Error('Adicione ao menos um item antes de ativar a cotacao.')
  if (text.includes('mape') || text.includes('catalogo efetiva')) return new Error('Vincule todos os itens ao Catalogo Efetiva antes de ativar.')
  const pendingAttachmentMissing = (text.includes('anexo pendente') || text.includes('envio pendente') || text.includes('source_file_pending')) && (text.includes('not pending') || text.includes('nao possui') || text.includes('não possui') || text.includes('nao esta') || text.includes('não está') || text.includes('nao encontrado') || text.includes('não encontrado'))
  if (pendingAttachmentMissing) return new Error('Esta cotacao nao possui um envio de anexo pendente. Recarregue a pagina para obter o estado atual.')
  if ((text.includes('anexo') && text.includes('ainda nao foi armazenado')) || (text.includes('anexo') && text.includes('ainda não foi armazenado')) || (text.includes('anexo') && text.includes('sendo enviado'))) return new Error('O anexo ainda nao foi concluido. Recarregue a pagina e conclua ou descarte o envio pendente antes de ativar ou cancelar a cotacao.')
  if (text.includes('cancelada') || text.includes('ativa') || text.includes('imut')) return new Error('Cotações ativas ou canceladas nao podem ser editadas; uma cotacao ativa apenas pode ser cancelada.')
  if (error.code === '23514' && text.includes('valid')) return new Error('A validade deve ser igual ou posterior ao recebimento.')
  if (error.code === '23514' && text.includes('price')) return new Error('Todos os precos devem ser maiores que zero.')
  if (error.code === 'PGRST116') return new Error('Cotacao nao encontrada.')
  if (text.includes('rascunho nao encontrada') || text.includes('rascunho não encontrada')) return new Error('Cotacao em rascunho nao encontrada ou sem permissao de acesso.')
  if (text.includes('cotacao desatualizada') || text.includes('cotação desatualizada') || text.includes('conflito de revisao') || text.includes('conflito de revisão') || text.includes('revisao esperada') || text.includes('revisão esperada')) return new Error('Esta cotacao foi alterada por outro usuario. Recarregue a pagina antes de salvar novamente.')
  if (text.includes('nao pertence a esta cotacao') || text.includes('não pertence a esta cotação')) return new Error('Um item informado nao pertence a esta cotacao. Recarregue a pagina e tente novamente.')
  if (text.includes('item de cotacao foi informado mais de uma vez')) return new Error('O mesmo item da cotacao foi informado mais de uma vez.')
  if (text.includes('array json') || text.includes('objeto json')) return new Error('Os itens da cotacao possuem um formato invalido.')
  return new Error('Nao foi possivel concluir a operacao com a cotacao. Tente novamente.')
}

function assertNoError(error: ServiceError | null) {
  if (error) throw translateQuotationError(error)
}

function staleQuotationError() {
  return new Error('Esta cotacao foi alterada por outro usuario. Recarregue a pagina antes de continuar.')
}

function mutationRow<T>(data: T | null, error: ServiceError | null): T {
  if (error?.code === 'PGRST116' || (!data && !error)) throw staleQuotationError()
  assertNoError(error)
  if (!data) throw staleQuotationError()
  return data
}

export async function listQuotations(): Promise<QuotationListRow[]> {
  const { data, error } = await supabase.from('quotations').select(listSelect).order('received_at', { ascending: false })
  assertNoError(error)
  return (data ?? []) as unknown as QuotationListRow[]
}

export async function getQuotation(id: string): Promise<QuotationDetail> {
  const { data, error } = await supabase.from('quotations').select(detailSelect).eq('id', id).single()
  assertNoError(error)
  return data as unknown as QuotationDetail
}

export async function saveQuotationDraft(input: QuotationDraftInput): Promise<QuotationDraftSaveResult> {
  const { data, error } = await supabase.rpc('save_quotation_draft', {
    p_quotation_id: input.id ?? null,
    p_expected_updated_at: input.expectedUpdatedAt ?? null,
    p_expected_revision: input.expectedRevision,
    p_supplier_id: input.supplier_id,
    p_reference_number: input.reference_number,
    p_received_at: input.received_at,
    p_valid_until: input.valid_until,
    p_notes: input.notes,
    p_items: input.items,
  })
  assertNoError(error)
  if (!data) throw new Error('Nao foi possivel salvar a cotacao.')
  let quotation = data

  if (input.file) {
    const path = `${quotation.id}/original`
    const previousSourceFilePath = quotation.source_file_path
    let pendingResult
    try {
      pendingResult = await supabase.from('quotations').update({ source_file_path: path, source_file_pending: true }).eq('id', quotation.id).eq('revision', quotation.revision).eq('status', 'draft').eq('source_file_pending', false).select().single()
      quotation = mutationRow(pendingResult.data, pendingResult.error)
    } catch {
      return { quotation, attachmentWarning: 'A cotacao foi salva, mas o envio do anexo nao foi iniciado porque o rascunho mudou. Recarregue a pagina e selecione o arquivo novamente.' }
    }
    const pendingRevision = quotation.revision
    let uploadFailed = false
    try {
      const upload = await supabase.storage.from('supplier-quotes').upload(path, input.file, { upsert: true, contentType: input.file.type })
      uploadFailed = Boolean(upload.error)
    } catch {
      uploadFailed = true
    }
    if (uploadFailed) {
      try {
        const compensation = await supabase.from('quotations').update({ source_file_path: previousSourceFilePath, source_file_pending: false }).eq('id', quotation.id).eq('revision', pendingRevision).eq('status', 'draft').eq('source_file_pending', true).select().single()
        if (compensation.error || !compensation.data) throw new Error('Compensation was not confirmed.')
        return { quotation: compensation.data, attachmentWarning: 'A cotacao foi salva, mas nao foi possivel enviar o anexo. Selecione o arquivo e tente novamente.' }
      } catch {
        return { quotation, attachmentWarning: 'A cotacao foi salva, mas o envio do anexo ficou pendente e precisa de recuperacao. Recarregue a pagina e use "Descartar envio pendente" antes de tentar novamente.' }
      }
    }
    try {
      const completed = await supabase.from('quotations').update({ source_file_pending: false }).eq('id', quotation.id).eq('revision', pendingRevision).eq('status', 'draft').eq('source_file_pending', true).select().single()
      quotation = mutationRow(completed.data, completed.error)
    } catch {
      return { quotation, attachmentWarning: 'A cotacao e o anexo foram salvos, mas a confirmacao ficou pendente e precisa de recuperacao. Recarregue a pagina e use "Descartar envio pendente" se o aviso continuar.' }
    }
  }
  return { quotation }
}

export async function activateQuotation({ id, expectedRevision }: QuotationLifecycleInput) {
  const { data, error } = await supabase.from('quotations').update({ status: 'active' }).eq('id', id).eq('revision', expectedRevision).eq('status', 'draft').select().single()
  return mutationRow(data, error)
}

export async function cancelQuotation({ id, expectedRevision }: QuotationLifecycleInput) {
  const { data, error } = await supabase.from('quotations').update({ status: 'cancelled' }).eq('id', id).eq('revision', expectedRevision).in('status', ['draft', 'active']).select().single()
  return mutationRow(data, error)
}

export async function discardPendingQuotationAttachment({ id, expectedRevision }: QuotationAttachmentRecoveryInput): Promise<Quotation> {
  const { data, error } = await supabase.rpc('discard_pending_quotation_attachment', {
    p_quotation_id: id,
    p_expected_revision: expectedRevision,
  })
  return mutationRow(data, error)
}

export async function getQuotationAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage.from('supplier-quotes').createSignedUrl(path, 60)
  if (error) throw translateQuotationError(error)
  return data.signedUrl
}
