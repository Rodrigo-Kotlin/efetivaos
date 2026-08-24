import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import QuotationsPage from './quotations-page'
import { useQuotations } from './quotation.queries'
import type { QuotationListRow } from './quotation.types'

vi.mock('./quotation.queries', () => ({ useQuotations: vi.fn() }))

const rows: QuotationListRow[] = [
  { id: 'q1', reference_number: 'LAB-001', received_at: '2026-08-20', valid_until: '2020-01-01', status: 'active', updated_at: '2026-08-21T10:00:00Z', supplier: { id: 's1', name: 'Lab Norte' }, quotation_items: [{ id: 'i1' }] },
  { id: 'q2', reference_number: null, received_at: '2026-08-21', valid_until: null, status: 'cancelled', updated_at: '2026-08-22T10:00:00Z', supplier: { id: 's2', name: 'Clinica Sul' }, quotation_items: [] },
  { id: 'q3', reference_number: 'RASC-1', received_at: '2026-08-22', valid_until: '2099-01-01', status: 'draft', updated_at: '2026-08-23T10:00:00Z', supplier: { id: 's1', name: 'Lab Norte' }, quotation_items: [] },
]

function renderPage() { return render(<MemoryRouter><QuotationsPage /></MemoryRouter>) }

describe('QuotationsPage', () => {
  const refetch = vi.fn()
  beforeEach(() => vi.mocked(useQuotations).mockReturnValue({ data: rows, isLoading: false, isError: false, refetch } as unknown as ReturnType<typeof useQuotations>))

  it('exibe loading, vazio e erro com retry', async () => {
    vi.mocked(useQuotations).mockReturnValueOnce({ isLoading: true } as ReturnType<typeof useQuotations>)
    const loading = renderPage()
    expect(screen.getByRole('status', { name: 'Carregando registros' })).toBeInTheDocument()
    loading.unmount()
    vi.mocked(useQuotations).mockReturnValueOnce({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useQuotations>)
    const empty = renderPage()
    expect(screen.getByRole('heading', { name: 'Nenhuma cotação cadastrada' })).toBeInTheDocument()
    expect(screen.getByText('Registre a primeira cotação de fornecedor para começar a formar a base de preços.')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Nova cotação' }).length).toBeGreaterThan(0)
    empty.unmount()
    vi.mocked(useQuotations).mockReturnValueOnce({ isLoading: false, isError: true, refetch } as unknown as ReturnType<typeof useQuotations>)
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('busca e filtra por fornecedor, status e validade', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText('Buscar referência ou fornecedor...'), 'LAB-001')
    const table = within(screen.getByRole('table'))
    expect(table.getByText('LAB-001')).toBeInTheDocument()
    expect(table.queryByText('Clinica Sul')).not.toBeInTheDocument()
    await user.clear(screen.getByPlaceholderText('Buscar referência ou fornecedor...'))
    await user.selectOptions(screen.getByLabelText('Filtrar por fornecedor'), 's2')
    expect(within(screen.getByRole('table')).getByText('Clinica Sul')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Filtrar por fornecedor'), 'all')
    await user.selectOptions(screen.getByLabelText('Filtrar por status'), 'draft')
    expect(within(screen.getByRole('table')).getByText('RASC-1')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Filtrar por status'), 'all')
    await user.selectOptions(screen.getByLabelText('Filtrar por validade'), 'no-validity')
    expect(within(screen.getByRole('table')).getByText('Clinica Sul')).toBeInTheDocument()
  })

  it('exibe badges textuais de status e validade', () => {
    renderPage()
    const table = within(screen.getByRole('table'))
    expect(table.getByText('Ativa')).toBeInTheDocument()
    expect(table.getByText('Cancelada')).toBeInTheDocument()
    expect(table.getByText('Rascunho')).toBeInTheDocument()
    expect(table.getByText('Vencida · histórica')).toBeInTheDocument()
    expect(table.getByText('Validade não informada')).toBeInTheDocument()
  })

  it('exibe vazio filtrado e limpa os filtros', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText('Buscar referência ou fornecedor...'), 'inexistente')
    expect(screen.getByRole('heading', { name: 'Nenhuma cotação encontrada' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('ordena a tabela e mantém o conteúdo operacional nos cartões móveis', async () => {
    const user = userEvent.setup()
    renderPage()
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('RASC-1')
    await user.click(within(table).getByRole('button', { name: /Recebida/ }))
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('LAB-001')
    const cards = screen.getByLabelText('Cotações em cartões')
    expect(within(cards).getByText('LAB-001')).toBeInTheDocument()
    expect(within(cards).getAllByText('Lab Norte').length).toBeGreaterThan(0)
    expect(within(cards).getAllByRole('link', { name: 'Ver detalhes' }).length).toBe(2)
    expect(within(cards).getByRole('link', { name: 'Editar cotação' })).toBeInTheDocument()
  })

  it('permite ordenar os cartões pelo controle móvel', async () => {
    const user = userEvent.setup()
    renderPage()
    const cards = screen.getByLabelText('Cotações em cartões')
    const mobileSort = screen.getByLabelText('Ordenar cotações no celular')
    await user.selectOptions(mobileSort, 'supplier:asc')
    expect(within(cards).getAllByRole('article')[0]).toHaveTextContent('Clinica Sul')
    await user.selectOptions(mobileSort, 'updated_at:asc')
    expect(within(cards).getAllByRole('article')[0]).toHaveTextContent('LAB-001')
  })
})
