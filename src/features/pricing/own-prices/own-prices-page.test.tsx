import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import type { OwnPriceProposalItem } from '@/types/database'

const hooks = vi.hoisted(() => ({
  useOwnPriceCatalogItems: vi.fn(),
  useOwnPriceProposals: vi.fn(),
  useCreateOwnPriceProposal: vi.fn(),
  useApproveOwnPriceProposal: vi.fn(),
  useInactivateOwnPriceProposal: vi.fn(),
  useOwnPriceDecisionToken: vi.fn(),
  useUserDisplayName: vi.fn(),
  useAuth: vi.fn(),
  useOnlineStatus: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/auth/auth-context', () => ({ useAuth: hooks.useAuth }))
vi.mock('@/hooks/use-online-status', () => ({ useOnlineStatus: hooks.useOnlineStatus }))
vi.mock('sonner', () => ({ toast: hooks.toast }))
vi.mock('./own-prices-queries', () => ({
  useOwnPriceCatalogItems: hooks.useOwnPriceCatalogItems,
  useOwnPriceProposals: hooks.useOwnPriceProposals,
  useCreateOwnPriceProposal: hooks.useCreateOwnPriceProposal,
  useApproveOwnPriceProposal: hooks.useApproveOwnPriceProposal,
  useInactivateOwnPriceProposal: hooks.useInactivateOwnPriceProposal,
  useOwnPriceDecisionToken: hooks.useOwnPriceDecisionToken,
  useUserDisplayName: hooks.useUserDisplayName,
}))

import OwnPricesPage from './own-prices-page'

function ownItem(id: string, overrides: Record<string, unknown> = {}) {
  return { id, code: `SRV-${id}`, name: `Servico ${id}`, unit: 'servico', category_id: 'cat-1', category_name: 'Laboratoriais', active: true, ...overrides }
}

function proposalItem(id: string, overrides: Partial<OwnPriceProposalItem> = {}): OwnPriceProposalItem {
  return {
    id: `p-${id}`, catalog_item_id: id, item_code: `SRV-${id}`, item_name: `Servico ${id}`,
    sale_price: '15.00', internal_cost: null, status: 'pending', submitted_by: 'user-1',
    submitted_at: '2026-09-01T10:00:00Z', approved_by: null, approved_at: null,
    decision_notes: null, revision: 1, created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z',
    ...overrides,
  }
}

function defaults() {
  hooks.useAuth.mockReturnValue({ profile: { id: 'user-1', role: 'admin', full_name: 'Admin' } })
  hooks.useOnlineStatus.mockReturnValue(true)
  hooks.useOwnPriceCatalogItems.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() })
  hooks.useOwnPriceProposals.mockReturnValue({ data: [proposalItem('B', { status: 'pending' }), proposalItem('C', { status: 'approved', approved_by: 'admin-1', approved_at: '2026-09-02T10:00:00Z' }), proposalItem('D', { status: 'inactive' })], isLoading: false, isError: false, refetch: vi.fn() })
  hooks.useCreateOwnPriceProposal.mockReturnValue({ isPending: false, mutateAsync: vi.fn().mockResolvedValue(null) })
  hooks.useApproveOwnPriceProposal.mockReturnValue({ isPending: false, mutateAsync: vi.fn().mockResolvedValue(null) })
  hooks.useInactivateOwnPriceProposal.mockReturnValue({ isPending: false, mutateAsync: vi.fn().mockResolvedValue(null) })
  hooks.useOwnPriceDecisionToken.mockReturnValue({ data: 'token-1', refetch: vi.fn() })
  hooks.useUserDisplayName.mockReturnValue({ data: 'Equipe Tecnica' })
}

function renderPage() {
  return render(<MemoryRouter><OwnPricesPage /></MemoryRouter>)
}

function table() {
  return within(screen.getByRole('table', { name: 'Precos Proprios' }))
}

async function openDrawer(buttonName: string, dialogName: string) {
  const buttons = screen.getAllByRole('button', { name: buttonName })
  await userEvent.click(buttons[0])
  return screen.getByRole('dialog', { name: dialogName })
}

describe('OwnPricesPage', () => {
  beforeEach(() => {
    defaults()
    hooks.toast.success.mockClear()
    hooks.toast.error.mockClear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('mostra o estado derivado de cada servico proprio na tabela', async () => {
    hooks.useOwnPriceCatalogItems.mockReturnValue({ data: [ownItem('A'), ownItem('B'), ownItem('C'), ownItem('D')], isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()

    const rows = table().getAllByRole('row')
    const rowOf = (name: string) => rows.find((row) => within(row).queryByText(name))!

    expect(within(rowOf('Servico A')).getByText('Sem preco')).toBeInTheDocument()
    expect(within(rowOf('Servico B')).getByText('Proposta pendente')).toBeInTheDocument()
    expect(within(rowOf('Servico C')).getByText('Preco aprovado')).toBeInTheDocument()
    expect(within(rowOf('Servico D')).getByText('Preco inativo')).toBeInTheDocument()
    expect(within(rowOf('Servico C')).getByText('R$ 15,00')).toBeInTheDocument()
  })

  it('equipe pode enviar uma proposta de preco proprio', async () => {
    hooks.useAuth.mockReturnValue({ profile: { id: 'user-1', role: 'equipe', full_name: 'Equipe' } })
    hooks.useOwnPriceCatalogItems.mockReturnValue({ data: [ownItem('A')], isLoading: false, isError: false, refetch: vi.fn() })
    hooks.useOwnPriceProposals.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() })
    const createMutation = { isPending: false, mutateAsync: vi.fn().mockResolvedValue(null) }
    hooks.useCreateOwnPriceProposal.mockReturnValue(createMutation)
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'Definir preco proprio' }))
    const dialog = screen.getByRole('dialog', { name: 'Definir preco proprio' })
    await userEvent.selectOptions(within(dialog).getByLabelText(/Servico/), 'A')
    await userEvent.type(within(dialog).getByLabelText('Preco de venda *'), '12,50')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar proposta' }))

    await waitFor(() => {
      expect(createMutation.mutateAsync).toHaveBeenCalledWith({ catalog_item_id: 'A', sale_price: '12,50', internal_cost: null, decision_notes: null })
      expect(hooks.toast.success).toHaveBeenCalledWith('Proposta enviada para aprovacao.')
    })
  })

  it('equipe nunca ve acoes de decisao na linha pendente', async () => {
    hooks.useAuth.mockReturnValue({ profile: { id: 'user-1', role: 'equipe', full_name: 'Equipe' } })
    hooks.useOwnPriceCatalogItems.mockReturnValue({ data: [ownItem('B')], isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()

    expect(screen.queryAllByRole('button', { name: 'Aprovar / Recusar' })).toHaveLength(0)
    expect(table().getByText('Aguardando decisao do Admin')).toBeInTheDocument()
  })

  it('admin aprova a proposta pendente usando o token de decisao', async () => {
    hooks.useOwnPriceCatalogItems.mockReturnValue({ data: [ownItem('B')], isLoading: false, isError: false, refetch: vi.fn() })
    const approveMutation = { isPending: false, mutateAsync: vi.fn().mockResolvedValue(null) }
    hooks.useApproveOwnPriceProposal.mockReturnValue(approveMutation)
    renderPage()

    const dialog = await openDrawer('Decidir proposta de Servico B', 'Decidir proposta de preco proprio')
    expect(within(dialog).getByText(/Equipe Tecnica/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aprovar preco' }))

    await waitFor(() => {
      expect(approveMutation.mutateAsync).toHaveBeenCalledWith({ proposalId: 'p-B', expectedDecisionToken: 'token-1' })
      expect(hooks.toast.success).toHaveBeenCalledWith('Preco proprio aprovado.')
    })
  })

  it('admin recusa a proposta com observacao opcional', async () => {
    hooks.useOwnPriceCatalogItems.mockReturnValue({ data: [ownItem('B')], isLoading: false, isError: false, refetch: vi.fn() })
    const inactivateMutation = { isPending: false, mutateAsync: vi.fn().mockResolvedValue(null) }
    hooks.useInactivateOwnPriceProposal.mockReturnValue(inactivateMutation)
    renderPage()

    const dialog = await openDrawer('Decidir proposta de Servico B', 'Decidir proposta de preco proprio')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Recusar proposta' }))
    await userEvent.type(within(dialog).getByLabelText(/Observacao da recusa/), 'Preco acima do mercado')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recusa' }))

    await waitFor(() => {
      expect(inactivateMutation.mutateAsync).toHaveBeenCalledWith({ proposalId: 'p-B', expectedDecisionToken: 'token-1', decisionNotes: 'Preco acima do mercado' })
      expect(hooks.toast.success).toHaveBeenCalledWith('Proposta recusada.')
    })
  })

  it('admin recebe a mensagem de token desatualizado como interacao com o usuario', async () => {
    hooks.useOwnPriceCatalogItems.mockReturnValue({ data: [ownItem('B')], isLoading: false, isError: false, refetch: vi.fn() })
    hooks.useApproveOwnPriceProposal.mockReturnValue({ isPending: false, mutateAsync: vi.fn().mockRejectedValue(new Error('A proposta foi alterada desde que você abriu esta tela. Atualize os dados antes de continuar.')) })
    renderPage()

    const dialog = await openDrawer('Decidir proposta de Servico B', 'Decidir proposta de preco proprio')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aprovar preco' }))

    await waitFor(() => {
      expect(hooks.toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Atualize os dados antes de continuar'),
      )
    })
    expect(screen.getByRole('dialog', { name: 'Decidir proposta de preco proprio' })).toBeInTheDocument()
  })

  it('reajuste exige justificativa e submete com a nota', async () => {
    hooks.useOwnPriceCatalogItems.mockReturnValue({ data: [ownItem('C')], isLoading: false, isError: false, refetch: vi.fn() })
    const createMutation = { isPending: false, mutateAsync: vi.fn().mockResolvedValue(null) }
    hooks.useCreateOwnPriceProposal.mockReturnValue(createMutation)
    renderPage()

    const dialog = await openDrawer('Propor reajuste para Servico C', 'Propor reajuste do preco proprio')
    await userEvent.type(within(dialog).getByLabelText('Novo preco de venda *'), '20,00')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar reajuste' }))

    expect(within(dialog).getByText('Informe a justificativa do reajuste.')).toBeInTheDocument()
    expect(createMutation.mutateAsync).not.toHaveBeenCalled()

    await userEvent.type(within(dialog).getByLabelText(/Justificativa do reajuste/), 'Reformulacao do escopo do servico')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar reajuste' }))

    await waitFor(() => {
      expect(createMutation.mutateAsync).toHaveBeenCalledWith({ catalog_item_id: 'C', sale_price: '20,00', internal_cost: null, decision_notes: 'Reformulacao do escopo do servico' })
      expect(hooks.toast.success).toHaveBeenCalledWith('Reajuste enviado para aprovacao.')
    })
  })

  it('admin inativa um preco proprio aprovado', async () => {
    hooks.useOwnPriceCatalogItems.mockReturnValue({ data: [ownItem('C')], isLoading: false, isError: false, refetch: vi.fn() })
    const inactivateMutation = { isPending: false, mutateAsync: vi.fn().mockResolvedValue(null) }
    hooks.useInactivateOwnPriceProposal.mockReturnValue(inactivateMutation)
    renderPage()

    const dialog = await openDrawer('Inativar preco de Servico C', 'Inativar preco proprio')
    expect(within(dialog).getByText('R$ 15,00')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Inativar preco' }))

    await waitFor(() => {
      expect(inactivateMutation.mutateAsync).toHaveBeenCalledWith({ proposalId: 'p-C', expectedDecisionToken: 'token-1', decisionNotes: null })
      expect(hooks.toast.success).toHaveBeenCalledWith('Preco proprio inativado.')
    })
  })

  it('sem conexao bloqueia o envio de proposta', async () => {
    hooks.useOnlineStatus.mockReturnValue(false)
    hooks.useAuth.mockReturnValue({ profile: { id: 'user-1', role: 'equipe', full_name: 'Equipe' } })
    hooks.useOwnPriceCatalogItems.mockReturnValue({ data: [ownItem('A')], isLoading: false, isError: false, refetch: vi.fn() })
    hooks.useOwnPriceProposals.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()

    expect(screen.getByRole('button', { name: 'Definir preco proprio' })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Definir preco proprio para Servico A' })[0]).toBeDisabled()
    await userEvent.click(screen.getAllByRole('button', { name: 'Definir preco proprio para Servico A' })[0])
    expect(screen.queryByRole('dialog', { name: 'Definir preco proprio' })).not.toBeInTheDocument()
  })

  it('filtros por status e busca vazia', async () => {
    hooks.useOwnPriceCatalogItems.mockReturnValue({ data: [ownItem('A'), ownItem('B')], isLoading: false, isError: false, refetch: vi.fn() })
    hooks.useOwnPriceProposals.mockReturnValue({ data: [proposalItem('B', { status: 'pending' })], isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()

    await userEvent.type(screen.getByPlaceholderText('Buscar servico, codigo ou categoria...'), 'nao-existe')
    expect(screen.getByText('Nenhum preco proprio encontrado')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0])
    expect(screen.getByRole('table', { name: 'Precos Proprios' })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Filtrar precos proprios por status'), 'approved')
    expect(screen.getByText('Nenhum preco proprio encontrado')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Filtrar precos proprios por status'), 'pending')
    expect(screen.getByRole('table', { name: 'Precos Proprios' })).toBeInTheDocument()
  })

  it('mostra placeholder quando nao ha servicos proprios no catalogo', async () => {
    hooks.useOwnPriceProposals.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()

    expect(screen.getByText('Nenhum servico proprio cadastrado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir catalogo' })).toBeInTheDocument()
  })

  it('mostra esqueleto enquanto carrega e permite nova tentativa em erro', async () => {
    hooks.useOwnPriceCatalogItems.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() })
    const proposalsRefetch = hooks.useOwnPriceProposals.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() })

    const { rerender } = renderPage()
    expect(screen.getByText('Carregando...')).toBeInTheDocument()

    hooks.useOwnPriceCatalogItems.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() })
    hooks.useOwnPriceProposals.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: proposalsRefetch })
    rerender(<MemoryRouter><OwnPricesPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(hooks.useOwnPriceCatalogItems).toHaveBeenLastCalledWith()
    expect(proposalsRefetch).toHaveBeenCalled()
  })

  it('bloqueia acoes quando o item esta inativo no catalogo', async () => {
    hooks.useOwnPriceCatalogItems.mockReturnValue({ data: [ownItem('A', { active: false })], isLoading: false, isError: false, refetch: vi.fn() })
    hooks.useOwnPriceProposals.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()

    expect(screen.getAllByRole('button', { name: 'Definir preco proprio para Servico A' })[0]).toBeDisabled()
  })
})