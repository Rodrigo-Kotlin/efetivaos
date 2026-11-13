import { supabase } from '@/lib/supabase'
import type { ClientContract, ClientContractDocument, ClientContractEvent, ContractEventType } from '@/types/database'

export type ContractInput = Omit<ClientContract, 'id' | 'client_id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by' | 'archived_at' | 'archived_by'>

export async function listClientContracts(clientId: string) {
  const { data, error } = await supabase.from('client_contracts').select('*').eq('client_id', clientId).order('starts_at', { ascending: false })
  if (error) throw new Error(error.code === '42501' ? 'Você não tem permissão para consultar contratos.' : 'Não foi possível carregar os contratos.')
  return data as ClientContract[]
}

export async function listContractDocuments(contractId: string) {
  const { data, error } = await supabase.from('client_contract_documents').select('*').eq('contract_id', contractId).order('created_at', { ascending: false })
  if (error) throw new Error('Não foi possível carregar os documentos do contrato.')
  return data as ClientContractDocument[]
}

export async function listContractEvents(contractId: string) {
  const { data, error } = await supabase.from('client_contract_events').select('*').eq('contract_id', contractId).order('created_at', { ascending: false })
  if (error) throw new Error('Não foi possível carregar o histórico do contrato.')
  return data as ClientContractEvent[]
}

export async function createClientContract(clientId: string, input: ContractInput) {
  const { data, error } = await supabase.from('client_contracts').insert({ client_id: clientId, ...input }).select().single()
  if (error) throw new Error(error.code === '23514' ? 'Revise as datas e os campos obrigatórios do contrato.' : 'Não foi possível cadastrar o contrato.')
  return data as ClientContract
}

export async function updateClientContract(id: string, input: Partial<ContractInput>) {
  const { data, error } = await supabase.from('client_contracts').update(input).eq('id', id).select().single()
  if (error) throw new Error(error.code === '42501' ? 'Você não tem permissão para editar este contrato.' : 'Não foi possível atualizar o contrato.')
  return data as ClientContract
}

export async function archiveClientContract(id: string) {
  const { data, error } = await supabase.rpc('archive_client_contract', { p_contract_id: id })
  if (error) throw new Error(error.code === '42501' ? 'Você não tem permissão para arquivar este contrato.' : 'Não foi possível arquivar o contrato.')
  return data as ClientContract
}

export async function recordContractEvent(contractId: string, eventType: ContractEventType, summary: string, details: Record<string, unknown> = {}) {
  const { data, error } = await supabase.rpc('record_client_contract_event', { p_contract_id: contractId, p_event_type: eventType, p_summary: summary, p_details: details })
  if (error) throw new Error(error.code === '42501' ? 'Você não tem permissão para registrar este evento.' : 'Não foi possível registrar o evento.')
  return data as ClientContractEvent
}

export async function discardContractDocument(contractId: string, documentId: string) {
  const { data, error } = await supabase.functions.invoke('discard-client-contract-document', {
    body: { contract_id: contractId, document_id: documentId },
  })
  if (error || data?.status !== 'discarded' || data?.document_id !== documentId || data?.confirmation !== 'storage_api_absent') {
    throw new Error('O descarte não pôde ser confirmado. O registro foi preservado para reconciliação; tente retomar o descarte.')
  }
  return data as { status: 'discarded'; document_id: string; confirmation: 'storage_api_absent'; physical_erasure_verified: false }
}

async function compensateIncompleteDocument(contractId: string, documentId: string) {
  try { await discardContractDocument(contractId, documentId) } catch {
    // No direct DELETE and no assumption that Storage.remove(error=null) removed bytes.
    // If reservation already started, this RPC refuses to change its frozen state.
    await supabase.rpc('mark_client_contract_document_failed', { p_document_id: documentId, p_reason: 'Upload interrompido; descarte pendente de reconciliação.' })
    throw new Error('O upload falhou e o descarte não foi confirmado. Retome o descarte do documento incompleto; não exclua anexos finalizados.')
  }
}

export async function uploadContractDocument(contractId: string, file: File, documentType: 'main' | 'addendum' | 'other') {
  if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) throw new Error('Envie apenas PDF de até 10 MB.')
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('É necessário estar autenticado para anexar um documento.')
  const id = crypto.randomUUID()
  const path = `${contractId}/${id}.pdf`
  const { error: rowError } = await supabase.from('client_contract_documents').insert({ id, contract_id: contractId, document_type: documentType, name: file.name, storage_bucket: 'client-contracts', storage_path: path, mime_type: file.type, size_bytes: file.size, created_by: userData.user.id, upload_status: 'pending' })
  if (rowError) throw new Error('Não foi possível registrar o documento.')
  const { error: uploadError } = await supabase.storage.from('client-contracts').upload(path, file, { contentType: 'application/pdf', upsert: false })
  if (uploadError) {
    await compensateIncompleteDocument(contractId, id)
    throw new Error('O upload não foi concluído. Nenhum documento foi anexado.')
  }
  const { data: finalized, error: finalizeError } = await supabase.rpc('finalize_client_contract_document', { p_document_id: id })
  if (finalizeError || !finalized) {
    if (finalizeError?.code === 'P0002') {
      await compensateIncompleteDocument(contractId, id)
      throw new Error('O objeto enviado não foi confirmado no Storage. Nenhum documento foi anexado.')
    }
    throw new Error('O upload foi enviado, mas a finalização não pôde ser confirmada. O documento ficou pendente de reconciliação; não repita a operação sem verificar o histórico.')
  }
  return finalized.storage_path
}

export async function getContractDocumentUrl(path: string, download = false) {
  const { data, error } = await supabase.storage.from('client-contracts').createSignedUrl(path, 60, { download })
  if (error) throw new Error('Não foi possível gerar o acesso temporário ao documento.')
  return data.signedUrl
}
