import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Supplier } from '@/types/database'

import SuppliersPage from './suppliers-page'
import { useCreateSupplier, useSetSupplierStatus, useSuppliers, useUpdateSupplier } from './supplier-queries'

vi.mock('./supplier-queries', () => ({
  useSuppliers: vi.fn(),
  useCreateSupplier: vi.fn(),
  useUpdateSupplier: vi.fn(),
  useSetSupplierStatus: vi.fn(),
}))

const activeSupplier: Supplier = {
  id: 'active-1', name: 'Lab Norte', legal_name: null, tax_id: null, category: 'Laboratorio',
  contact_name: 'Marina', email: null, phone: '(93) 99999-0001', active: true, notes: null,
  created_at: '2026-08-23T10:00:00Z', created_by: null, updated_at: '2026-08-23T10:00:00Z', updated_by: null,
}
const inactiveSupplier: Supplier = { ...activeSupplier, id: 'inactive-1', name: 'Antigo Lab', active: false }

describe('SuppliersPage status actions', () => {
  const mutateStatus = vi.fn()
  const refetch = vi.fn()

  beforeEach(() => {
    vi.mocked(useSuppliers).mockReturnValue({ data: [activeSupplier, inactiveSupplier], isLoading: false, isError: false, refetch } as unknown as ReturnType<typeof useSuppliers>)
    vi.mocked(useCreateSupplier).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useCreateSupplier>)
    vi.mocked(useUpdateSupplier).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useUpdateSupplier>)
    vi.mocked(useSetSupplierStatus).mockReturnValue({ mutateAsync: mutateStatus, isPending: false } as unknown as ReturnType<typeof useSetSupplierStatus>)
    mutateStatus.mockReset().mockResolvedValue(activeSupplier)
    refetch.mockReset()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => vi.restoreAllMocks())

  it('confirma e inativa um fornecedor ativo', async () => {
    const user = userEvent.setup()
    render(<SuppliersPage />)

    await user.click(screen.getByRole('button', { name: 'Inativar Lab Norte' }))

    expect(window.confirm).toHaveBeenCalledWith('Inativar o fornecedor Lab Norte? O historico sera preservado.')
    expect(mutateStatus).toHaveBeenCalledWith({ id: 'active-1', active: false })
  })

  it('reativa sem pedir confirmacao', async () => {
    const user = userEvent.setup()
    render(<SuppliersPage />)

    await user.click(screen.getByRole('button', { name: 'Reativar Antigo Lab' }))

    expect(window.confirm).not.toHaveBeenCalled()
    expect(mutateStatus).toHaveBeenCalledWith({ id: 'inactive-1', active: true })
  })

  it('exibe skeleton durante o carregamento', () => {
    vi.mocked(useSuppliers).mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch } as unknown as ReturnType<typeof useSuppliers>)
    render(<SuppliersPage />)
    expect(screen.getByRole('status', { name: 'Carregando registros' })).toBeInTheDocument()
  })

  it('exibe estado vazio e abre o drawer de cadastro', async () => {
    const user = userEvent.setup()
    vi.mocked(useSuppliers).mockReturnValue({ data: [], isLoading: false, isError: false, refetch } as unknown as ReturnType<typeof useSuppliers>)
    render(<SuppliersPage />)

    expect(screen.getByRole('heading', { name: 'Nenhum fornecedor cadastrado' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cadastrar fornecedor' }))
    expect(screen.getByRole('dialog', { name: 'Novo fornecedor' })).toBeInTheDocument()
  })

  it('permite tentar novamente apos erro de consulta', async () => {
    const user = userEvent.setup()
    vi.mocked(useSuppliers).mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } as unknown as ReturnType<typeof useSuppliers>)
    render(<SuppliersPage />)

    expect(screen.getByRole('alert')).toHaveTextContent('Nao foi possivel carregar os dados')
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('aplica busca e apresenta estado filtrado vazio', async () => {
    const user = userEvent.setup()
    render(<SuppliersPage />)
    await user.type(screen.getByPlaceholderText('Buscar fornecedor...'), 'inexistente')
    expect(screen.getByRole('heading', { name: 'Nenhum fornecedor encontrado' })).toBeInTheDocument()
  })
})
