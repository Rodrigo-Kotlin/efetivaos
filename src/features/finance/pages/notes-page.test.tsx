import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { FinancialNote } from '@/types/database'

import NotesPage from './notes-page'
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '../queries/finance-queries'

vi.mock('../queries/finance-queries', () => ({
  useNotes: vi.fn(),
  useCreateNote: vi.fn(),
  useUpdateNote: vi.fn(),
  useDeleteNote: vi.fn(),
}))

const mockNotes: FinancialNote[] = [
  {
    id: '1',
    note_type: 'DRE',
    title: 'Receita recorrente cresceu 15%',
    body: 'Nota sobre crescimento da receita recorrente no Q1.',
    reference_date: '2026-03-31',
    period_start: null,
    period_end: null,
    chart_account_id: null,
    transaction_id: null,
    journal_entry_id: null,
    asset_id: null,
    report_type: 'DRE',
    active: true,
    created_by: null,
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
  },
  {
    id: '2',
    note_type: 'GERAL',
    title: 'Observacoes gerais',
    body: null,
    reference_date: null,
    period_start: null,
    period_end: null,
    chart_account_id: null,
    transaction_id: null,
    journal_entry_id: null,
    asset_id: null,
    report_type: '',
    active: true,
    created_by: null,
    created_at: '2026-04-02T10:00:00Z',
    updated_at: '2026-04-02T10:00:00Z',
  },
]

describe('NotesPage', () => {
  beforeEach(() => {
    vi.mocked(useNotes).mockReturnValue({ data: mockNotes, isLoading: false } as unknown as ReturnType<typeof useNotes>)
    vi.mocked(useCreateNote).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCreateNote>)
    vi.mocked(useUpdateNote).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useUpdateNote>)
    vi.mocked(useDeleteNote).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useDeleteNote>)
  })

  it('renders notes title', () => {
    render(<NotesPage />)
    expect(screen.getByText('Notas Gerenciais')).toBeInTheDocument()
  })

  it('renders existing notes', () => {
    render(<NotesPage />)
    expect(screen.getByText('Receita recorrente cresceu 15%')).toBeInTheDocument()
    expect(screen.getByText('Observacoes gerais')).toBeInTheDocument()
  })

  it('shows note type badges', () => {
    render(<NotesPage />)
    const badges = screen.getAllByText('DRE')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows body text when present', () => {
    render(<NotesPage />)
    expect(screen.getByText('Nota sobre crescimento da receita recorrente no Q1.')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    vi.mocked(useNotes).mockReturnValue({ data: undefined, isLoading: true } as unknown as ReturnType<typeof useNotes>)
    render(<NotesPage />)
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('shows empty state when no notes', () => {
    vi.mocked(useNotes).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useNotes>)
    render(<NotesPage />)
    expect(screen.getByText('Nenhuma nota encontrada.')).toBeInTheDocument()
  })

  it('shows form when Nova Nota button clicked', async () => {
    const user = userEvent.setup()
    render(<NotesPage />)
    await user.click(screen.getByText('Nova Nota'))
    expect(screen.getByText('Tipo da Nota *')).toBeInTheDocument()
    expect(screen.getByText('Titulo *')).toBeInTheDocument()
    expect(screen.getByText('Conteudo')).toBeInTheDocument()
  })

  it('save button is disabled without title', async () => {
    const user = userEvent.setup()
    render(<NotesPage />)
    await user.click(screen.getByText('Nova Nota'))
    const saveBtn = screen.getByText('Salvar')
    expect(saveBtn).toBeDisabled()
  })

  it('has edit and inactivate buttons per note', () => {
    render(<NotesPage />)
    const editButtons = screen.getAllByText('Editar')
    const inactivateButtons = screen.getAllByText('Inativar')
    expect(editButtons.length).toBe(2)
    expect(inactivateButtons.length).toBe(2)
  })
})
