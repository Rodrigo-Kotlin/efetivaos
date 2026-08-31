import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'

import type { Supplier } from '@/types/database'

import QuotationEditorPage from './quotation-editor-page'
import { useActivateQuotation, useArchiveQuotation, useCancelQuotation, useDiscardPendingQuotationAttachment, useQuotation, useSaveQuotationDraft, useUnarchiveQuotation } from './quotation.queries'
import type { QuotationDetail } from './quotation.types'
import { useCatalogItems } from '../catalog/catalog.queries'
import { useSuppliers } from '../suppliers/supplier-queries'
import { useOnlineStatus } from '@/hooks/use-online-status'

const routerMocks = vi.hoisted(() => ({ navigate: vi.fn() }))
const toastMocks = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }))

vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => routerMocks.navigate,
}))
vi.mock('./quotation.queries', () => ({ useQuotation: vi.fn(), useSaveQuotationDraft: vi.fn(), useActivateQuotation: vi.fn(), useCancelQuotation: vi.fn(), useDiscardPendingQuotationAttachment: vi.fn(), useArchiveQuotation: vi.fn(), useUnarchiveQuotation: vi.fn() }))
vi.mock('../catalog/catalog.queries', () => ({ useCatalogItems: vi.fn() }))
vi.mock('../suppliers/supplier-queries', () => ({ useSuppliers: vi.fn() }))
vi.mock('@/hooks/use-online-status', () => ({ useOnlineStatus: vi.fn() }))
vi.mock('sonner', () => ({ toast: toastMocks }))

const supplier = { id: 'supplier-1', code: 'FOR-000001', name: 'Lab Norte', active: true, legal_name: null, tax_id: null, category: null, contact_name: null, email: null, phone: null, notes: null, created_at: '2026-08-20T00:00:00Z', created_by: null, updated_at: '2026-08-20T00:00:00Z', updated_by: null } satisfies Supplier
const catalogItem = { id: 'catalog-1', code: 'EXA-1', name: 'Hemograma', category_id: 'category-1', unit: 'exame', description: null, active: true, updated_at: '2026-08-20T00:00:00Z', category: { id: 'category-1', name: 'Exames', active: true } }
const saved = { id: 'quotation-1', supplier_id: supplier.id, reference_number: null, received_at: '2026-08-23', valid_until: null, status: 'draft' as const, source_file_path: null, source_file_pending: false, revision: 7, notes: null, archived_at: null, archived_by: null, created_at: '2026-08-23T00:00:00Z', created_by: null, updated_at: '2026-08-23T00:00:00Z', updated_by: null }
const detail: QuotationDetail = { ...saved, supplier: { id: supplier.id, name: supplier.name, active: true }, quotation_items: [{ id: 'line-1', quotation_id: saved.id, catalog_item_id: catalogItem.id, supplier_description: 'Hemograma', supplier_item_code: 'H-1', unit_price: '20.00', notes: null, created_at: saved.created_at, created_by: 'user-1', updated_at: saved.updated_at, updated_by: 'user-1', catalog_item: { ...catalogItem, category: { id: 'category-1', name: 'Exames' } } }] }

function renderEditor(path = '/pricing/quotations/new') {
  const router = createMemoryRouter([{ path: '/pricing/quotations/new', element: <QuotationEditorPage /> }, { path: '/pricing/quotations/:quotationId', element: <QuotationEditorPage /> }, { path: '/pricing/quotations', element: <div>Lista</div> }], { initialEntries: [path] })
  return { ...render(<RouterProvider router={router} />), router }
}

describe('QuotationEditorPage', () => {
  const save = vi.fn()
  const activate = vi.fn()
  const cancel = vi.fn()
  const discardPendingAttachment = vi.fn()

  beforeEach(() => {
    routerMocks.navigate.mockReset()
    Object.values(toastMocks).forEach((mock) => mock.mockReset())
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    vi.mocked(useQuotation).mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useQuotation>)
    vi.mocked(useSuppliers).mockReturnValue({ data: [supplier], isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useSuppliers>)
    vi.mocked(useCatalogItems).mockReturnValue({ data: [catalogItem], isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useCatalogItems>)
    vi.mocked(useSaveQuotationDraft).mockReturnValue({ mutateAsync: save, isPending: false } as unknown as ReturnType<typeof useSaveQuotationDraft>)
    vi.mocked(useActivateQuotation).mockReturnValue({ mutateAsync: activate, isPending: false } as unknown as ReturnType<typeof useActivateQuotation>)
    vi.mocked(useCancelQuotation).mockReturnValue({ mutateAsync: cancel, isPending: false } as unknown as ReturnType<typeof useCancelQuotation>)
    vi.mocked(useDiscardPendingQuotationAttachment).mockReturnValue({ mutateAsync: discardPendingAttachment, isPending: false } as unknown as ReturnType<typeof useDiscardPendingQuotationAttachment>)
    vi.mocked(useArchiveQuotation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useArchiveQuotation>)
    vi.mocked(useUnarchiveQuotation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useUnarchiveQuotation>)
    save.mockReset().mockResolvedValue({ quotation: saved })
    activate.mockReset().mockResolvedValue({ ...saved, status: 'active' })
    cancel.mockReset().mockResolvedValue({ ...saved, status: 'cancelled' })
    discardPendingAttachment.mockReset().mockResolvedValue({ ...saved, source_file_pending: false, revision: saved.revision + 1 })
  })

  async function fillHeader(user: ReturnType<typeof userEvent.setup>) {
    await user.selectOptions(screen.getByLabelText('Fornecedor *'), supplier.id)
    await user.type(screen.getByLabelText('Data recebida *'), '2026-08-23')
  }

  it('valida fornecedor e data obrigatórios e adiciona/remove item com foco e ARIA', async () => {
    const user = userEvent.setup()
    renderEditor()
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByText('Selecione o fornecedor.')).toBeInTheDocument()
    expect(screen.getAllByText('Informe a data de recebimento.').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Adicionar item' }))
    const catalog = screen.getByLabelText('Item do Catálogo Efetiva 1')
    expect(catalog).toHaveFocus()
    expect(catalog).toHaveAttribute('aria-describedby', 'item-0-catalog-error')
    expect(screen.getByLabelText('Preço unitário *')).toHaveAttribute('aria-describedby', expect.stringContaining('unit-normalization-warning'))
    await user.click(screen.getByRole('button', { name: 'Remover item 1' }))
    expect(screen.getByText('Nenhum item adicionado.')).toBeInTheDocument()
  })

  it('salva rascunho com item sem catalogo e preco BRL positivo', async () => {
    const user = userEvent.setup()
    renderEditor()
    await fillHeader(user)
    await user.click(screen.getByRole('button', { name: 'Adicionar item' }))
    await user.type(screen.getByLabelText('Preço unitário *'), '25,90')
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ supplier_id: supplier.id, items: [expect.objectContaining({ catalog_item_id: null, unit_price: '25.90' })] })))
  })

  it('navega para o primeiro rascunho e avisa quando o upload falha', async () => {
    const user = userEvent.setup()
    save.mockResolvedValue({ quotation: saved, attachmentWarning: 'Cotação salva, mas o anexo falhou. Selecione o arquivo novamente.' })
    renderEditor()
    await fillHeader(user)
    const fileInput = screen.getByLabelText('Arquivo original (opcional)') as HTMLInputElement
    await user.upload(fileInput, new File(['pdf'], 'quote.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    await waitFor(() => expect(routerMocks.navigate).toHaveBeenCalledWith(`/pricing/quotations/${saved.id}`, { replace: true }))
    expect(save).toHaveBeenCalledOnce()
    expect(toastMocks.warning).toHaveBeenCalledWith(expect.stringContaining('anexo falhou'))
    expect(toastMocks.success).not.toHaveBeenCalled()
    expect(fileInput.files).toHaveLength(0)
  })

  it('mantém checklist visível e ativação desabilitada até todos os requisitos', async () => {
    const user = userEvent.setup()
    renderEditor()
    await fillHeader(user)
    await user.click(screen.getByRole('button', { name: 'Adicionar item' }))
    await user.type(screen.getByLabelText('Preço unitário *'), '0')
    expect(screen.getByRole('button', { name: 'Ativar' })).toBeDisabled()
    expect(screen.getByText('Mapeamento pendente nas linhas 1.')).toBeInTheDocument()
    expect(screen.getByText('Valor inválido nas linhas 1.')).toBeInTheDocument()
    expect(screen.getByLabelText('Preço unitário *')).toHaveAttribute('aria-errormessage', 'item-0-price-error')
    await user.click(screen.getByRole('button', { name: 'Revisar pendências' }))
    expect(screen.getByLabelText('Item do Catálogo Efetiva 1')).toHaveFocus()
    expect(save).not.toHaveBeenCalled()
    await user.clear(screen.getByLabelText('Preço unitário *'))
    await user.type(screen.getByLabelText('Preço unitário *'), '10')
    await user.selectOptions(screen.getByLabelText('Item do Catálogo Efetiva 1'), catalogItem.id)
    expect(screen.getByRole('button', { name: 'Ativar' })).toBeEnabled()
  })

  it('foca Adicionar item quando a cotação ainda não possui linhas', async () => {
    const user = userEvent.setup()
    renderEditor()
    await fillHeader(user)
    const addItem = screen.getByRole('button', { name: 'Adicionar item' })
    expect(addItem).toHaveAttribute('id', 'add-quotation-item')
    await user.click(screen.getByRole('button', { name: 'Revisar pendências' }))
    expect(addItem).toHaveFocus()
    expect(addItem).toHaveAttribute('aria-describedby', 'items-error')
  })

  it('salva e ativa uma cotacao valida', async () => {
    const user = userEvent.setup()
    renderEditor()
    await fillHeader(user)
    await user.click(screen.getByRole('button', { name: 'Adicionar item' }))
    await user.selectOptions(screen.getByLabelText('Item do Catálogo Efetiva 1'), catalogItem.id)
    await user.type(screen.getByLabelText('Preço unitário *'), '100,50')
    await user.click(screen.getByRole('button', { name: 'Ativar' }))
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(activate).toHaveBeenCalledWith({ id: saved.id, expectedRevision: saved.revision })
  })

  it('interrompe a ativacao e preserva o novo rascunho quando ha aviso de anexo', async () => {
    const user = userEvent.setup()
    save.mockResolvedValue({ quotation: saved, attachmentWarning: 'Envio pendente. Recarregue e recupere o anexo.' })
    renderEditor()
    await fillHeader(user)
    await user.click(screen.getByRole('button', { name: 'Adicionar item' }))
    await user.selectOptions(screen.getByLabelText('Item do Catálogo Efetiva 1'), catalogItem.id)
    await user.type(screen.getByLabelText('Preço unitário *'), '10')
    await user.click(screen.getByRole('button', { name: 'Ativar' }))

    await waitFor(() => expect(routerMocks.navigate).toHaveBeenCalledWith(`/pricing/quotations/${saved.id}`, { replace: true }))
    expect(activate).not.toHaveBeenCalled()
    expect(toastMocks.warning).toHaveBeenCalledWith(expect.stringContaining('Envio pendente'))
  })

  it('mostra e associa erro de descricao do fornecedor acima do limite', async () => {
    const user = userEvent.setup()
    renderEditor()
    await fillHeader(user)
    await user.click(screen.getByRole('button', { name: 'Adicionar item' }))
    const description = screen.getByLabelText('Descrição do fornecedor')
    fireEvent.change(description, { target: { value: 'a'.repeat(501) } })
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    expect(await screen.findByText('Use no maximo 500 caracteres.')).toHaveAttribute('id', 'item-0-description-error')
    expect(description).toHaveAttribute('aria-invalid', 'true')
    expect(description).toHaveAttribute('aria-describedby', 'item-0-description-error')
    expect(description).toHaveAttribute('aria-errormessage', 'item-0-description-error')
    expect(save).not.toHaveBeenCalled()
  })

  it('mostra detalhe cancelado sem depender das consultas mestres', () => {
    vi.mocked(useQuotation).mockReturnValue({ data: { ...detail, status: 'cancelled', valid_until: null }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useQuotation>)
    vi.mocked(useSuppliers).mockReturnValue({ isLoading: false, isError: true, refetch: vi.fn() } as unknown as ReturnType<typeof useSuppliers>)
    vi.mocked(useCatalogItems).mockReturnValue({ isLoading: false, isError: true, refetch: vi.fn() } as unknown as ReturnType<typeof useCatalogItems>)
    renderEditor(`/pricing/quotations/${saved.id}`)
    expect(screen.getByText('Cancelada')).toBeInTheDocument()
    expect(screen.getByText('Validade não informada')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Itens da cotação' })).toBeInTheDocument()
    expect(screen.getAllByText('EXA-1 - Hemograma').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Auditoria' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Fornecedor *')).not.toBeInTheDocument()
  })

  it('mostra estado explícito para detalhe cancelado sem itens', () => {
    vi.mocked(useQuotation).mockReturnValue({ data: { ...detail, status: 'cancelled', quotation_items: [] }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useQuotation>)
    renderEditor(`/pricing/quotations/${saved.id}`)
    expect(screen.getByText('Nenhum item registrado.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('explica detalhe vencido e confirma cancelamento de cotação ativa', async () => {
    vi.mocked(useQuotation).mockReturnValue({ data: { ...detail, status: 'active', valid_until: '2020-01-01' }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useQuotation>)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderEditor(`/pricing/quotations/${saved.id}`)
    expect(screen.getByText('Vencida · histórica')).toBeInTheDocument()
    expect(screen.getByText(/não será elegível para comparação futura/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar cotação' }))
    expect(window.confirm).toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledWith({ id: saved.id, expectedRevision: saved.revision })
  })

  it('limpa o arquivo local depois de cancelar um rascunho', async () => {
    const user = userEvent.setup()
    vi.mocked(useQuotation).mockReturnValue({ data: detail, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useQuotation>)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderEditor(`/pricing/quotations/${saved.id}`)
    const fileInput = screen.getByLabelText('Arquivo original (opcional)') as HTMLInputElement
    await user.upload(fileInput, new File(['pdf'], 'quote.pdf', { type: 'application/pdf' }))
    expect(fileInput.files).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Cancelar cotação' }))

    await waitFor(() => expect(cancel).toHaveBeenCalledWith({ id: saved.id, expectedRevision: saved.revision }))
    expect(fileInput.files).toHaveLength(0)
  })

  it('bloqueia todas as gravacoes quando offline', () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    renderEditor()
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ativar' })).toBeDisabled()
  })

  it('mostra recuperacao explicita e bloqueia transicoes comuns para anexo pendente', async () => {
    vi.mocked(useQuotation).mockReturnValue({ data: { ...detail, source_file_path: `${saved.id}/original`, source_file_pending: true }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useQuotation>)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderEditor(`/pricing/quotations/${saved.id}`)

    expect(screen.getByRole('alert')).toHaveTextContent('Um envio anterior foi interrompido ou ainda está em andamento.')
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ativar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar cotação' })).toBeDisabled()
    expect(screen.getByLabelText('Arquivo original (opcional)')).toBeDisabled()
    const recovery = screen.getByRole('button', { name: 'Descartar envio pendente' })
    expect(recovery).toBeEnabled()

    await userEvent.click(recovery)
    expect(window.confirm).toHaveBeenCalledWith('Descartar o envio pendente? O anexo incompleto será removido da cotação.')
    expect(discardPendingAttachment).toHaveBeenCalledWith({ id: saved.id, expectedRevision: saved.revision })
  })

  it('bloqueia nova cotação sem cadastros ativos e oferece links acionáveis', () => {
    vi.mocked(useSuppliers).mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useSuppliers>)
    vi.mocked(useCatalogItems).mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useCatalogItems>)
    renderEditor()
    expect(screen.getByText('Você precisa cadastrar um fornecedor ativo antes de criar uma cotação.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para Fornecedores' })).toHaveAttribute('href', '/pricing/suppliers')
    expect(screen.getByText('Você precisa cadastrar itens no Catálogo Efetiva antes de adicionar produtos ou serviços à cotação.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para o Catálogo Efetiva' })).toHaveAttribute('href', '/pricing/catalog')
  })

  it('preserva seleção histórica inativa no rascunho e mostra orientação', () => {
    const inactiveDetail = { ...detail, supplier: { ...detail.supplier, active: false }, quotation_items: detail.quotation_items.map((line) => ({ ...line, catalog_item: line.catalog_item ? { ...line.catalog_item, active: false } : null })) }
    vi.mocked(useQuotation).mockReturnValue({ data: inactiveDetail, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useQuotation>)
    vi.mocked(useSuppliers).mockReturnValue({ data: [], isLoading: false, isError: true, refetch: vi.fn() } as unknown as ReturnType<typeof useSuppliers>)
    vi.mocked(useCatalogItems).mockReturnValue({ data: [], isLoading: false, isError: true, refetch: vi.fn() } as unknown as ReturnType<typeof useCatalogItems>)
    renderEditor(`/pricing/quotations/${saved.id}`)
    expect(screen.getByLabelText('Fornecedor *')).toHaveValue(supplier.id)
    expect(screen.getByLabelText('Item do Catálogo Efetiva 1')).toHaveValue(catalogItem.id)
    expect(screen.getByText(/vínculos históricos desta cotação foram preservados/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ativar' })).toBeDisabled()
  })

  it('não descarta formulário nem arquivo selecionado em refetch da mesma cotação', async () => {
    vi.mocked(useQuotation).mockReturnValue({ data: detail, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useQuotation>)
    const view = renderEditor(`/pricing/quotations/${saved.id}`)
    const reference = screen.getByLabelText('Número / referência')
    await userEvent.type(reference, 'LOCAL')
    const file = new File(['pdf'], 'quote.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Arquivo original (opcional)'), { target: { files: [file] } })
    vi.mocked(useQuotation).mockReturnValue({ data: { ...detail, reference_number: 'SERVER', updated_at: '2026-08-24T00:00:00Z' }, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useQuotation>)
    view.rerender(<RouterProvider router={view.router} />)
    expect(reference).toHaveValue('LOCAL')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ file })))
  })

  it('limpa arquivo anterior quando a nova escolha é inválida', async () => {
    const user = userEvent.setup()
    renderEditor()
    await fillHeader(user)
    const input = screen.getByLabelText('Arquivo original (opcional)')
    fireEvent.change(input, { target: { files: [new File(['pdf'], 'ok.pdf', { type: 'application/pdf' })] } })
    fireEvent.change(input, { target: { files: [new File(['bad'], 'bad.txt', { type: 'text/plain' })] } })
    expect(screen.getByText('Use PDF, JPEG, PNG ou WEBP.')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-errormessage', 'source-file-error')
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ file: null })))
  })
})
