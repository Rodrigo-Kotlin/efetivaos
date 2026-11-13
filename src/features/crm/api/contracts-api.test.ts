import { beforeEach, describe, expect, it, vi } from 'vitest'

import { discardContractDocument, uploadContractDocument } from './contracts-api'

const mocks = vi.hoisted(() => ({
  rowInsert: { error: null as null | Error },
  storageUpload: { error: null as null | Error },
  discard: { error: null as null | Error, confirmed: true },
  finalize: { data: { storage_path: 'contract-1/document.pdf' }, error: null as null | Error & { code?: string } },
  operations: [] as string[],
}))

vi.mock('@/lib/supabase', () => ({
    supabase: {
    auth: {
      getUser() { mocks.operations.push('auth.getUser'); return Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }) },
    },
    from(table: string) {
      return {
        insert(payload: unknown) { mocks.operations.push(`${table}.insert`); void payload; return Promise.resolve(mocks.rowInsert) },
        delete() { throw new Error('Direct metadata DELETE must never be called') },
      }
    },
      storage: {
      from(bucket: string) {
        return {
          upload() { mocks.operations.push(`${bucket}.upload`); return Promise.resolve(mocks.storageUpload) },
          remove() { throw new Error('Client Storage DELETE must never be called') },
        }
      },
    },
    rpc(name: string) { mocks.operations.push(name); return Promise.resolve(name === 'mark_client_contract_document_failed' ? { data: null, error: null } : mocks.finalize) },
    functions: {
      invoke(name: string, options: { body: { contract_id: string; document_id: string } }) {
        mocks.operations.push(name)
        return Promise.resolve({ error: mocks.discard.error, data: mocks.discard.confirmed ? { status: 'discarded', document_id: options.body.document_id, confirmation: 'storage_api_absent', physical_erasure_verified: false } : {} })
      },
    },
  },
}))

const pdf = () => new File(['%PDF-1.4'], 'contrato.pdf', { type: 'application/pdf' })

describe('uploadContractDocument', () => {
  beforeEach(() => {
    mocks.rowInsert = { error: null }
    mocks.storageUpload = { error: null }
    mocks.discard = { error: null, confirmed: true }
    mocks.finalize = { data: { storage_path: 'contract-1/document.pdf' }, error: null }
    mocks.operations.length = 0
  })

  it('valida o arquivo antes de criar o registro', async () => {
    await expect(uploadContractDocument('contract-1', new File(['MZ'], 'arquivo.exe', { type: 'application/octet-stream' }), 'main')).rejects.toThrow('apenas PDF')
    expect(mocks.operations).toEqual([])
  })

  it('só conclui o documento depois da confirmação do Storage', async () => {
    await expect(uploadContractDocument('contract-1', pdf(), 'main')).resolves.toBe('contract-1/document.pdf')
    expect(mocks.operations).toEqual(['auth.getUser', 'client_contract_documents.insert', 'client-contracts.upload', 'finalize_client_contract_document'])
  })

  it('compensa registro quando o upload falha', async () => {
    mocks.storageUpload = { error: new Error('upload falhou') }
    await expect(uploadContractDocument('contract-1', pdf(), 'main')).rejects.toThrow('Nenhum documento foi anexado')
    expect(mocks.operations).toEqual(['auth.getUser', 'client_contract_documents.insert', 'client-contracts.upload', 'discard-client-contract-document'])
  })

  it('informa quando a compensação não pode ser concluída', async () => {
    mocks.storageUpload = { error: new Error('upload falhou') }
    mocks.discard.error = new Error('backend indisponivel')
    await expect(uploadContractDocument('contract-1', pdf(), 'main')).rejects.toThrow('descarte não foi confirmado')
    expect(mocks.operations).toContain('mark_client_contract_document_failed')
  })

  it('HTTP sem confirmacao de ausencia nao conclui descarte', async () => {
    mocks.discard.confirmed = false
    await expect(discardContractDocument('contract-1', 'doc-1')).rejects.toThrow('não pôde ser confirmado')
  })

  it('retoma descarte pelo backend sem DELETE direto', async () => {
    await expect(discardContractDocument('contract-1', 'doc-1')).resolves.toMatchObject({ confirmation: 'storage_api_absent', physical_erasure_verified: false })
    expect(mocks.operations).toEqual(['discard-client-contract-document'])
  })

  it('falha no INSERT nao descarta um documento que nao foi criado', async () => {
    mocks.rowInsert.error = new Error('denied')
    await expect(uploadContractDocument('contract-1', pdf(), 'main')).rejects.toThrow('registrar o documento')
    expect(mocks.operations).toEqual(['auth.getUser', 'client_contract_documents.insert'])
  })

  it('falha de finalizacao P0002 compensa por backend', async () => {
    mocks.finalize.error = Object.assign(new Error('missing'), { code: 'P0002' })
    await expect(uploadContractDocument('contract-1', pdf(), 'main')).rejects.toThrow('Nenhum documento foi anexado')
    expect(mocks.operations).toContain('discard-client-contract-document')
  })

  it('finalizacao incerta preserva documento sem tentar remover um possivel ready', async () => {
    mocks.finalize.error = new Error('network')
    await expect(uploadContractDocument('contract-1', pdf(), 'main')).rejects.toThrow('pendente de reconciliação')
    expect(mocks.operations).not.toContain('discard-client-contract-document')
  })

  it('rejeita PDF acima do limite antes de criar metadados', async () => {
    await expect(uploadContractDocument('contract-1', new File([new Uint8Array(10485761)], 'large.pdf', { type: 'application/pdf' }), 'main')).rejects.toThrow('apenas PDF')
    expect(mocks.operations).toEqual([])
  })
})
