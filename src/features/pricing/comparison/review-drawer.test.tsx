import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { useApprovePrice, useComparisonOffers, useInactivatePrice } from './comparison-queries'
import { ReviewDrawer } from './review-drawer'
import type { ComparisonRow } from './comparison-types'

vi.mock('./comparison-queries', () => ({
  useComparisonOffers: vi.fn(),
  useApprovePrice: vi.fn(),
  useInactivatePrice: vi.fn(),
}))

const row: ComparisonRow = {
  catalog_item_id: 'item-1', catalog_item_active: true, code: 'EXA-001', item_name: 'Hemograma', unit: 'exame', category_id: 'cat-1', category_name: 'Laboratoriais',
  best_quotation_item_id: 'qi-1', best_cost: '10.00', best_supplier_id: 'sup-1', best_supplier_name: 'Lab Norte', best_valid_until: '2026-12-31', best_validity_not_informed: false, eligible_offer_count: 2,
  resolved_margin_rule_id: 'rule-1', resolved_rule_scope: 'global', resolved_adjustment_type: 'percentage', resolved_adjustment_value: '20.00', suggested_price: '12.00',
  price_list_id: null, approved_cost_price: null, approved_final_price: null, approved_adjustment_type: null, approved_adjustment_value: null, manual_source: null, approved_at: null, approved_by: null,
  approved_source_quotation_item_id: null, approved_quotation_id: null, approved_quotation_reference: null, approved_supplier_id: null, approved_supplier_name: null, approved_source_valid_until: null, effective_status: 'suggestion_available', review_reason: null, persisted_status: null,
  approved_margin_rule_id: null, best_quotation_item_id_at_approval: null, best_cost_at_approval: null, decision_token: 'token-1',
}

const offer = (id: string, eligible: boolean) => ({
  quotation_item_id: id, quotation_id: `q-${id}`, catalog_item_id: 'item-1', unit_price: id === 'qi-1' ? '10.00' : '11.00', supplier_description: null, supplier_item_code: null,
  supplier_id: `sup-${id}`, supplier_name: `Fornecedor ${id}`, reference_number: id, received_at: '2026-08-24', valid_until: '2026-12-31', quotation_status: 'active' as const,
  is_expired: !eligible, validity_not_informed: false, is_eligible: eligible,
})

describe('ReviewDrawer', () => {
  const mutateApprove = vi.fn().mockResolvedValue({ final_price: '12.00' })
  const mutateInactivate = vi.fn().mockResolvedValue({ status: 'inactive' })

  const renderDrawer = (sourceRow: ComparisonRow = row, onOpenChange = vi.fn()) => render(
    <MemoryRouter><ReviewDrawer row={sourceRow} isAdmin online onOpenChange={onOpenChange} onConfigureRule={vi.fn()} /></MemoryRouter>,
  )

  beforeEach(() => {
    mutateApprove.mockReset().mockResolvedValue({ final_price: '12.00' })
    mutateInactivate.mockReset().mockResolvedValue({ status: 'inactive' })
    vi.mocked(useComparisonOffers).mockReturnValue({ data: [offer('qi-1', true), offer('qi-2', true), offer('qi-old', false)], isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useComparisonOffers>)
    vi.mocked(useApprovePrice).mockReturnValue({ mutateAsync: mutateApprove, isPending: false } as unknown as ReturnType<typeof useApprovePrice>)
    vi.mocked(useInactivatePrice).mockReturnValue({ mutateAsync: mutateInactivate, isPending: false } as unknown as ReturnType<typeof useInactivatePrice>)
  })

  afterEach(() => vi.restoreAllMocks())

  it('mantem Equipe somente leitura e nao expoe fonte inelegivel', () => {
    render(<ReviewDrawer row={row} isAdmin={false} online onOpenChange={vi.fn()} onConfigureRule={vi.fn()} />)
    expect(screen.getByText('Somente leitura')).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryByText('Fornecedor qi-old')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar preco' })).not.toBeInTheDocument()
  })

  it('permite ao Admin aprovar a fonte automatica com o token atual', async () => {
    const onOpenChange = vi.fn()
    renderDrawer(row, onOpenChange)
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Aprovar preco' }))
    expect(mutateApprove).toHaveBeenCalledWith({ catalogItemId: 'item-1', decisionToken: 'token-1', sourceQuotationItemId: null })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('seleciona o melhor custo atual quando a aprovacao automatica antiga deixou de ser a melhor', async () => {
    const changedBestRow = { ...row, price_list_id: 'price-1', manual_source: false, approved_source_quotation_item_id: 'qi-2' }
    renderDrawer(changedBestRow)
    expect(screen.getByRole('radio', { name: /Fornecedor qi-1/i })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Aprovar atualizacao' }))
    expect(mutateApprove).toHaveBeenCalledWith({ catalogItemId: 'item-1', decisionToken: 'token-1', sourceQuotationItemId: null })
  })

  it('descarta uma selecao manual quando o drawer e fechado sem aprovar', async () => {
    renderDrawer()
    await userEvent.click(screen.getByRole('radio', { name: /Fornecedor qi-2/i }))
    expect(screen.getByRole('radio', { name: /Fornecedor qi-2/i })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    expect(screen.getByRole('radio', { name: /Fornecedor qi-1/i })).toBeChecked()
  })

  it('exibe a referencia e o link da cotacao aprovada na rastreabilidade', () => {
    renderDrawer({ ...row, price_list_id: 'price-1', approved_final_price: '12.00', approved_quotation_id: 'quotation-1', approved_quotation_reference: 'COT-2026-15' })
    expect(screen.getByRole('link', { name: /Cotacao COT-2026-15/i })).toHaveAttribute('href', '/pricing/quotations/quotation-1')
  })

  it('preserva a inativacao comercial sem permitir reaprovacao de item de catalogo inativo', () => {
    renderDrawer({ ...row, catalog_item_active: false, price_list_id: 'price-1', approved_final_price: '12.00' })
    expect(screen.getByRole('button', { name: 'Inativar preco' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar atualizacao' })).not.toBeInTheDocument()
  })

  it('cancela a inativacao quando a confirmacao e recusada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderDrawer({ ...row, price_list_id: 'price-1', approved_final_price: '12.00' })
    await userEvent.click(screen.getByRole('button', { name: 'Inativar preco' }))
    expect(mutateInactivate).not.toHaveBeenCalled()
  })

  it('inativa o registro quando a confirmacao e aceita', async () => {
    const onOpenChange = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderDrawer({ ...row, price_list_id: 'price-1', approved_final_price: '12.00' }, onOpenChange)
    await userEvent.click(screen.getByRole('button', { name: 'Inativar preco' }))
    expect(window.confirm).toHaveBeenCalledWith('Inativar o preco comercial de Hemograma? O registro permanecera na Tabela de Precos.')
    expect(mutateInactivate).toHaveBeenCalledWith({ catalogItemId: 'item-1', decisionToken: 'token-1' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('exibe rastreabilidade propria sem decisoes de cotacao', () => {
    const ownRow = { ...row, price_origin: 'own' as const, own_price_proposal_id: 'opp-1', price_list_id: 'price-1', approved_final_price: '120.00', approved_at: '2026-08-24T12:00:00Z', approved_by: 'user-1' }
    const ownProposal = {
      id: 'opp-1', catalog_item_id: 'item-1', item_code: 'EXA-001', item_name: 'Hemograma', sale_price: '120.00',
      internal_cost: '60.00', status: 'approved' as const, submitted_by: 'user-1', submitted_at: '2026-08-20T10:00:00Z',
      approved_by: 'user-1', approved_at: '2026-08-24T12:00:00Z', decision_notes: 'Custo interno validado.', revision: 1,
      created_at: '2026-08-20T10:00:00Z', updated_at: '2026-08-24T12:00:00Z',
    }
    render(
      <MemoryRouter>
        <ReviewDrawer row={ownRow} isAdmin online onOpenChange={vi.fn()} onConfigureRule={vi.fn()} ownProposal={ownProposal} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Rastreabilidade do preco proprio')).toBeInTheDocument()
    expect(screen.getByText('Proprio — Efetiva')).toBeInTheDocument()
    expect(screen.getByText('Custo interno validado.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Gerenciar em Precos Proprios/i })).toHaveAttribute('href', '/pricing/own-prices')
    expect(screen.getByRole('link', { name: /Abrir Precos Proprios/i })).toHaveAttribute('href', '/pricing/own-prices')
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByText('Fonte para a decisao')).not.toBeInTheDocument()
    expect(screen.queryByText('Previa da decisao')).not.toBeInTheDocument()
    expect(screen.queryByText('Cotacao sem referencia disponivel')).not.toBeInTheDocument()
  })

  it('restringe o custo interno do preco proprio para equipe', () => {
    const ownRow = { ...row, price_origin: 'own' as const, own_price_proposal_id: 'opp-1', price_list_id: 'price-1', approved_final_price: '120.00' }
    const ownProposal = {
      id: 'opp-1', catalog_item_id: 'item-1', item_code: 'EXA-001', item_name: 'Hemograma', sale_price: '120.00',
      internal_cost: '60.00', status: 'approved' as const, submitted_by: 'user-1', submitted_at: '2026-08-20T10:00:00Z',
      approved_by: 'user-1', approved_at: '2026-08-24T12:00:00Z', decision_notes: null, revision: 1,
      created_at: '2026-08-20T10:00:00Z', updated_at: '2026-08-24T12:00:00Z',
    }
    render(
      <MemoryRouter>
        <ReviewDrawer row={ownRow} isAdmin={false} online onOpenChange={vi.fn()} onConfigureRule={vi.fn()} ownProposal={ownProposal} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Restrito a Admin')).toBeInTheDocument()
  })

  it('oferece "Ver historico" quando a origem e propria e substitui o link de precos proprios', async () => {
    const ownRow = { ...row, price_origin: 'own' as const, own_price_proposal_id: 'opp-1', price_list_id: 'price-1', approved_final_price: '120.00' }
    const onViewOwnHistory = vi.fn()
    render(
      <MemoryRouter>
        <ReviewDrawer row={ownRow} isAdmin online onOpenChange={vi.fn()} onConfigureRule={vi.fn()} onViewOwnHistory={onViewOwnHistory} />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Ver historico' }))
    expect(onViewOwnHistory).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('link', { name: /Abrir Precos Proprios/i })).not.toBeInTheDocument()
  })
})
