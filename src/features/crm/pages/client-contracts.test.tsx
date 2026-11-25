import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { PreparedContractPdf } from '@/features/crm/pdf/pdf-upload'

import ClientContracts from './client-contracts'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  upload: vi.fn(),
  prepare: vi.fn(),
}))

vi.mock('@/features/crm/api/contracts-api', () => ({
  getContractDocumentUrl: vi.fn(),
  uploadContractDocument: mocks.upload,
}))

vi.mock('@/features/crm/pdf/pdf-upload', () => ({
  prepareContractPdf: mocks.prepare,
}))

vi.mock('@/features/crm/queries/contract-queries', () => ({
  useClientContracts: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateContract: () => ({ mutateAsync: mocks.create, isPending: false }),
  useUpdateContract: () => ({ mutateAsync: mocks.update, isPending: false }),
  useArchiveContract: () => ({ mutate: mocks.archive, isPending: false }),
  useContractDocuments: () => ({ data: [], isLoading: false }),
  useContractEvents: () => ({ data: [], isLoading: false }),
  useRecordContractEvent: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadContractDocument: () => ({ mutateAsync: mocks.upload, isPending: false }),
  useDiscardContractDocument: () => ({ mutate: vi.fn(), isPending: false }),
}))

const created = {
  id: 'contract-created-1',
  client_id: 'client-1',
  title: 'Contrato sintético',
  contract_number: 'CT-001',
  contract_type: 'SST',
  description: null,
  contracted_services: null,
  commercial_owner: null,
  contracted_value: null,
  modality: 'recurring' as const,
  billing_period: 'monthly',
  payment_terms: null,
  first_billing_date: null,
  signed_at: null,
  starts_at: '2026-11-25',
  ends_at: null,
  auto_renewal: false,
  notice_period_days: null,
  status: 'draft' as const,
  internal_notes: null,
  created_at: '2026-11-25T12:00:00Z',
  created_by: 'user-1',
  updated_at: '2026-11-25T12:00:00Z',
  updated_by: 'user-1',
  archived_at: null,
  archived_by: null,
}

const prepared: PreparedContractPdf = {
  file: new File(['synthetic-pdf'], 'contrato-sintetico.pdf', { type: 'application/pdf' }),
  result: {
    status: 'optimized',
    bytes: new Uint8Array([1]),
    originalBytes: 1000,
    finalBytes: 700,
    savedRatio: 0.3,
    imagesAnalyzed: 1,
    imagesRecompressed: 1,
    method: 'image-recompression',
  },
  sourceFingerprint: 'sha256:test',
  metadata: {
    original_bytes: 1000,
    final_bytes: 700,
    saved_ratio: 0.3,
    optimization_status: 'optimized',
    optimization_method: 'image-recompression',
    source_fingerprint: 'sha256:test',
  },
}

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ClientContracts clientId="client-1" clientName="Cliente sintético" />
    </QueryClientProvider>,
  )
}

describe('ClientContracts PDF on create form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.create.mockResolvedValue(created)
    mocks.upload.mockResolvedValue('contract-created-1/document.pdf')
    mocks.prepare.mockResolvedValue(prepared)
  })

  it('creates a contract without a PDF', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Novo contrato' }))
    await user.type(screen.getByLabelText('Número do contrato'), 'CT-001')
    await user.type(screen.getByLabelText('Título'), 'Contrato sintético')
    await user.type(screen.getByLabelText('Tipo'), 'SST')

    expect(screen.getByRole('button', { name: 'Salvar contrato' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar contrato' }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('prepares the PDF before create and uploads only after receiving the contract id', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Novo contrato' }))
    await user.type(screen.getByLabelText('Número do contrato'), 'CT-001')
    await user.type(screen.getByLabelText('Título'), 'Contrato sintético')
    await user.type(screen.getByLabelText('Tipo'), 'SST')

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File(['source'], 'contrato-sintetico.pdf', { type: 'application/pdf' }))
    expect(await screen.findByText('Economia obtida: 30.0%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar contrato e anexar PDF' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Salvar contrato e anexar PDF' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledWith('contract-created-1', prepared.file, 'main', prepared.metadata))
    expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.upload.mock.invocationCallOrder[0])
  })

  it('does not upload when contract creation fails', async () => {
    const user = userEvent.setup()
    mocks.create.mockRejectedValueOnce(new Error('falha ao cadastrar contrato'))
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Novo contrato' }))
    await user.type(screen.getByLabelText('Número do contrato'), 'CT-001')
    await user.type(screen.getByLabelText('Título'), 'Contrato sintético')
    await user.type(screen.getByLabelText('Tipo'), 'SST')
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, new File(['source'], 'contrato-sintetico.pdf', { type: 'application/pdf' }))
    await user.click(await screen.findByRole('button', { name: 'Salvar contrato e anexar PDF' }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('keeps the created contract and offers retry when PDF upload fails', async () => {
    const user = userEvent.setup()
    mocks.upload.mockRejectedValueOnce(new Error('falha transitória no Storage')).mockResolvedValueOnce('contract-created-1/document.pdf')
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Novo contrato' }))
    await user.type(screen.getByLabelText('Número do contrato'), 'CT-001')
    await user.type(screen.getByLabelText('Título'), 'Contrato sintético')
    await user.type(screen.getByLabelText('Tipo'), 'SST')
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, new File(['source'], 'contrato-sintetico.pdf', { type: 'application/pdf' }))
    await user.click(await screen.findByRole('button', { name: 'Salvar contrato e anexar PDF' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Contrato "Contrato sintético" cadastrado sem o PDF.')
    expect(mocks.create).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Tentar anexar PDF novamente' }))
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(2))
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })

  it('cancels the selected PDF without creating a contract', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Novo contrato' }))
    await user.type(screen.getByLabelText('Número do contrato'), 'CT-001')
    await user.type(screen.getByLabelText('Título'), 'Contrato sintético')
    await user.type(screen.getByLabelText('Tipo'), 'SST')
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, new File(['source'], 'contrato-sintetico.pdf', { type: 'application/pdf' }))
    expect(await screen.findByText('contrato-sintetico.pdf')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(mocks.create).not.toHaveBeenCalled()
    expect(screen.queryByText('contrato-sintetico.pdf')).not.toBeInTheDocument()
  })
})
