import { render, screen, within } from '@testing-library/react'

import type { OwnPriceProposalItem } from '@/types/database'

import { OwnPriceHistoryDrawer, ownPriceChangeFor, sortOwnPriceHistory } from './own-price-history-drawer'

function proposal(id: string, overrides: Partial<OwnPriceProposalItem> = {}): OwnPriceProposalItem {
  return {
    id, catalog_item_id: 'item-1', item_code: 'SRV-001', item_name: 'Servico A',
    sale_price: '100.00', internal_cost: null, status: 'approved', submitted_by: 'user-1',
    submitted_at: '2026-08-20T10:00:00Z', approved_by: 'admin-1', approved_at: '2026-08-21T10:00:00Z',
    decision_notes: null, revision: 1, created_at: '2026-08-20T10:00:00Z', updated_at: '2026-08-21T10:00:00Z',
    ...overrides,
  }
}

function renderDrawer(proposals: OwnPriceProposalItem[], overrides: Partial<Parameters<typeof OwnPriceHistoryDrawer>[0]> = {}) {
  return render(
    <OwnPriceHistoryDrawer
      open
      onOpenChange={vi.fn()}
      itemCode="SRV-001"
      itemName="Servico A"
      proposals={proposals}
      isAdmin={false}
      {...overrides}
    />,
  )
}

describe('sortOwnPriceHistory', () => {
  it('ordena em ordem cronologica decrescente por submissao', () => {
    const older = proposal('p-old', { submitted_at: '2026-08-20T10:00:00Z' })
    const newer = proposal('p-new', { submitted_at: '2026-09-01T10:00:00Z' })
    const result = sortOwnPriceHistory([older, newer])
    expect(result.map((item) => item.id)).toEqual(['p-new', 'p-old'])
  })

  it('usa created_at quando submitted_at esta ausente', () => {
    const older = proposal('p-old', { submitted_at: '', created_at: '2026-08-20T10:00:00Z' })
    const newer = proposal('p-new', { submitted_at: '', created_at: '2026-09-01T10:00:00Z' })
    const result = sortOwnPriceHistory([older, newer])
    expect(result.map((item) => item.id)).toEqual(['p-new', 'p-old'])
  })
})

describe('ownPriceChangeFor', () => {
  it('calcula diferenca e variacao percentual frente ao aprovado anterior', () => {
    const previous = proposal('p-prev', { status: 'approved', sale_price: '100.00', approved_at: '2026-08-21T10:00:00Z' })
    const current = proposal('p-cur', { status: 'approved', sale_price: '110.00', approved_at: '2026-09-01T10:00:00Z' })
    const change = ownPriceChangeFor(current, [previous, current])
    expect(change).toMatchObject({ previousPrice: '100.00', difference: 10, percentage: 10 })
  })

  it('retorna null para proposta inativa', () => {
    const inactive = proposal('p-inactive', { status: 'inactive' })
    expect(ownPriceChangeFor(inactive, [inactive])).toBeNull()
  })

  it('retorna null sem aprovado anterior', () => {
    const pending = proposal('p-pending', { status: 'pending', approved_at: null })
    expect(ownPriceChangeFor(pending, [pending])).toBeNull()
  })

  it('percentual nulo quando o preco anterior e zero', () => {
    const previous = proposal('p-prev', { status: 'approved', sale_price: '0.00', approved_at: '2026-08-21T10:00:00Z' })
    const current = proposal('p-cur', { status: 'approved', sale_price: '110.00', approved_at: '2026-09-01T10:00:00Z' })
    const change = ownPriceChangeFor(current, [previous, current])
    expect(change).toMatchObject({ difference: 110, percentage: null })
  })
})

describe('OwnPriceHistoryDrawer', () => {
  it('mostra estado vazio quando nao ha proposta anterior', () => {
    renderDrawer([])
    expect(screen.getByText('Nenhuma proposta anterior')).toBeInTheDocument()
    expect(screen.getByText(/Este servico ainda nao possui historico/)).toBeInTheDocument()
  })

  it('exibe propostas em ordem cronologica decrescente', () => {
    const older = proposal('p-old', { submitted_at: '2026-08-20T10:00:00Z', sale_price: '90.00', revision: 1 })
    const newer = proposal('p-new', { submitted_at: '2026-09-01T10:00:00Z', sale_price: '110.00', revision: 2 })
    renderDrawer([older, newer])

    const history = screen.getByLabelText('Propostas em ordem cronologica decrescente')
    const articles = within(history).getAllByRole('article')
    expect(articles[0]).toHaveTextContent('Revisao 2')
    expect(articles[0]).toHaveTextContent('110,00')
    expect(articles[1]).toHaveTextContent('Revisao 1')
    expect(articles[1]).toHaveTextContent('90,00')
  })

  it('identifica preco proposto, aprovado, datas, responsavel e justificativa', () => {
    renderDrawer([
      proposal('p-1', {
        status: 'approved', sale_price: '150.00', internal_cost: '80.00',
        submitted_by: 'user-1', submitted_at: '2026-08-20T10:00:00Z',
        approved_by: 'admin-1', approved_at: '2026-08-21T10:00:00Z',
        decision_notes: 'Aprovado apos revisao.',
      }),
    ], { isAdmin: true, viewer: { id: 'user-1', fullName: 'Equipe Tecnica' } })

    expect(screen.getByText('Aprovado')).toBeInTheDocument()
    expect(screen.getByText('Preco proposto')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 150,00').length).toBeGreaterThan(0)
    expect(screen.getByText('Preco aprovado')).toBeInTheDocument()
    expect(screen.getByText('Submetida em')).toBeInTheDocument()
    expect(screen.getByText('Equipe Tecnica')).toBeInTheDocument()
    expect(screen.getByText('Aprovada em')).toBeInTheDocument()
    expect(screen.getByText('Responsavel pela decisao')).toBeInTheDocument()
    expect(screen.getByText('admin-1')).toBeInTheDocument()
    expect(screen.getByText('Aprovado apos revisao.')).toBeInTheDocument()
    expect(screen.getByText('Custo interno')).toBeInTheDocument()
    expect(screen.getByText('R$ 80,00')).toBeInTheDocument()
  })

  it('mostra variacao de preco frente ao aprovado anterior', () => {
    renderDrawer([
      proposal('p-old', { status: 'approved', sale_price: '100.00', approved_at: '2026-08-21T10:00:00Z' }),
      proposal('p-new', { status: 'approved', sale_price: '115.00', approved_at: '2026-09-01T10:00:00Z' }),
    ])

    expect(screen.getByText('Comparacao com o preco aprovado anterior')).toBeInTheDocument()
    expect(screen.getByText('Preco anterior')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 100,00').length).toBeGreaterThan(0)
    expect(screen.getByText('Novo preco')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 115,00').length).toBeGreaterThan(0)
    expect(screen.getByText('Diferenca')).toBeInTheDocument()
    expect(screen.getByText('Variacao')).toBeInTheDocument()
    expect(screen.getByText('15,00%')).toBeInTheDocument()
  })

  it('marca preco vigente quando corresponde ao id informado', () => {
    renderDrawer(
      [proposal('p-1', { status: 'approved' })],
      { currentProposalId: 'p-1' },
    )
    expect(screen.getByText('Preco vigente')).toBeInTheDocument()
  })

  it('mostra status pendente sem preco aprovado nem aprovacao', () => {
    renderDrawer([
      proposal('p-1', { status: 'pending', approved_by: null, approved_at: null, sale_price: '120.00' }),
    ])

    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(screen.queryByText('Comparacao com o preco aprovado anterior')).not.toBeInTheDocument()
    expect(screen.queryByText('Aprovada em')).not.toBeInTheDocument()
    expect(screen.queryByText('Aprovado')).not.toBeInTheDocument()
  })

  it('mostra status inativo como decisao sem preco aprovado', () => {
    renderDrawer([
      proposal('p-1', { status: 'inactive', sale_price: '90.00', approved_at: '2026-08-21T10:00:00Z' }),
    ])

    expect(screen.getByText('Inativo')).toBeInTheDocument()
    expect(screen.queryByText('Comparacao com o preco aprovado anterior')).not.toBeInTheDocument()
  })

  it('oculta o custo interno para a equipe', () => {
    renderDrawer([
      proposal('p-1', { status: 'approved', internal_cost: '80.00' }),
    ], { isAdmin: false })

    expect(screen.queryByText('Custo interno')).not.toBeInTheDocument()
    expect(screen.queryByText('R$ 80,00')).not.toBeInTheDocument()
    expect(screen.getAllByText('R$ 100,00').length).toBeGreaterThan(0)
  })

  it('mostra custo interno para o Admin mesmo sem valor informado', () => {
    renderDrawer([
      proposal('p-1', { status: 'approved', internal_cost: null }),
    ], { isAdmin: true })

    expect(screen.getByText('Custo interno')).toBeInTheDocument()
    expect(screen.getByText('Nao informado')).toBeInTheDocument()
  })

  it('resolve responsavel para o proprio espectador e identifica outro usuario', () => {
    renderDrawer([
      proposal('p-1', { submitted_by: 'user-1', approved_by: 'admin-9' }),
    ], { viewer: { id: 'user-1', fullName: 'Equipe Tecnica' } })

    expect(screen.getByText('Equipe Tecnica')).toBeInTheDocument()
    expect(screen.getByText('admin-9')).toBeInTheDocument()
    expect(screen.queryByText('Nao informado')).not.toBeInTheDocument()
  })

  it('exibe Nao informado quando nao ha responsavel e justificativa', () => {
    renderDrawer([
      proposal('p-1', { status: 'pending', submitted_by: '', approved_by: null, decision_notes: null }),
    ])

    expect(screen.getAllByText('Nao informado').length).toBeGreaterThan(0)
    expect(screen.getByText('Nao informada.')).toBeInTheDocument()
  })
})
