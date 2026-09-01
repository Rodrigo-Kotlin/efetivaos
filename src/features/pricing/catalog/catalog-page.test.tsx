import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'

import CatalogPage from './catalog-page'
import {
  useCatalogCategories,
  useCatalogItems,
  useCreateCatalogCategory,
  useCreateCatalogItem,
  useSetCatalogCategoryStatus,
  useSetCatalogItemStatus,
  useUpdateCatalogCategory,
  useUpdateCatalogItem,
} from './catalog.queries'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('./catalog.queries', () => ({
  useCatalogItems: vi.fn(),
  useCatalogCategories: vi.fn(),
  useCreateCatalogItem: vi.fn(),
  useUpdateCatalogItem: vi.fn(),
  useSetCatalogItemStatus: vi.fn(),
  useCreateCatalogCategory: vi.fn(),
  useUpdateCatalogCategory: vi.fn(),
  useSetCatalogCategoryStatus: vi.fn(),
}))

const items = [
  { id: 'item-active', code: 'EXA-001', name: 'Hemograma', category_id: 'category-active', unit: 'exame', description: null, active: true, updated_at: '2026-08-23', category: { id: 'category-active', name: 'Laboratoriais', active: true } },
  { id: 'item-inactive', code: 'EXA-002', name: 'Glicemia', category_id: 'category-inactive', unit: 'exame', description: null, active: false, updated_at: '2026-08-23', category: { id: 'category-inactive', name: 'Historica', active: false } },
]
const categories = [
  { id: 'category-active', name: 'Laboratoriais', active: true, updated_at: '2026-08-23' },
  { id: 'category-preset', name: 'Exames Laboratoriais', active: true, updated_at: '2026-08-23' },
  { id: 'category-inactive', name: 'Historica', active: false, updated_at: '2026-08-23' },
]

describe('CatalogPage', () => {
  const setItemStatus = vi.fn()
  const setCategoryStatus = vi.fn()
  const createItem = vi.fn()
  const createCategory = vi.fn()
  const refetchItems = vi.fn()
  const refetchCategories = vi.fn()

  beforeEach(() => {
    vi.mocked(useCatalogItems).mockReturnValue({ data: items, isPending: false, isError: false, refetch: refetchItems } as unknown as ReturnType<typeof useCatalogItems>)
    vi.mocked(useCatalogCategories).mockReturnValue({ data: categories, isPending: false, isError: false, refetch: refetchCategories } as unknown as ReturnType<typeof useCatalogCategories>)
    vi.mocked(useCreateCatalogItem).mockReturnValue({ mutateAsync: createItem, isPending: false } as unknown as ReturnType<typeof useCreateCatalogItem>)
    vi.mocked(useUpdateCatalogItem).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useUpdateCatalogItem>)
    vi.mocked(useSetCatalogItemStatus).mockReturnValue({ mutateAsync: setItemStatus, isPending: false } as unknown as ReturnType<typeof useSetCatalogItemStatus>)
    vi.mocked(useCreateCatalogCategory).mockReturnValue({ mutateAsync: createCategory, isPending: false } as unknown as ReturnType<typeof useCreateCatalogCategory>)
    vi.mocked(useUpdateCatalogCategory).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useUpdateCatalogCategory>)
    vi.mocked(useSetCatalogCategoryStatus).mockReturnValue({ mutateAsync: setCategoryStatus, isPending: false } as unknown as ReturnType<typeof useSetCatalogCategoryStatus>)
    setItemStatus.mockReset().mockResolvedValue(undefined)
    setCategoryStatus.mockReset().mockResolvedValue(undefined)
    createItem.mockReset().mockResolvedValue({ ...items[0], code: 'ITEM-000001' })
    createCategory.mockReset().mockResolvedValue(categories[0])
    refetchItems.mockReset()
    refetchCategories.mockReset()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => vi.restoreAllMocks())

  it('inativa com confirmacao e reativa item sem confirmacao', async () => {
    const user = userEvent.setup()
    render(<CatalogPage />)

    await user.click(screen.getByRole('button', { name: 'Inativar item Hemograma' }))
    expect(window.confirm).toHaveBeenCalledOnce()
    expect(setItemStatus).toHaveBeenCalledWith({ id: 'item-active', active: false })

    vi.mocked(window.confirm).mockClear()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar itens por status' }), 'all')
    await user.click(screen.getByRole('button', { name: 'Reativar item Glicemia' }))
    expect(window.confirm).not.toHaveBeenCalled()
    expect(setItemStatus).toHaveBeenCalledWith({ id: 'item-inactive', active: true })
  })

  it('inativa com confirmacao e reativa categoria sem confirmacao', async () => {
    const user = userEvent.setup()
    render(<CatalogPage />)
    await user.click(screen.getByRole('button', { name: 'Categorias' }))

    await user.click(screen.getByRole('button', { name: 'Inativar categoria Laboratoriais' }))
    expect(window.confirm).toHaveBeenCalledOnce()
    expect(setCategoryStatus).toHaveBeenCalledWith({ id: 'category-active', active: false })

    vi.mocked(window.confirm).mockClear()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar categorias por status' }), 'all')
    await user.click(screen.getByRole('button', { name: 'Reativar categoria Historica' }))
    expect(window.confirm).not.toHaveBeenCalled()
    expect(setCategoryStatus).toHaveBeenCalledWith({ id: 'category-inactive', active: true })
  })

  it('exibe skeleton durante o carregamento', () => {
    vi.mocked(useCatalogItems).mockReturnValue({ data: undefined, isPending: true, isError: false, refetch: refetchItems } as unknown as ReturnType<typeof useCatalogItems>)
    render(<CatalogPage />)
    expect(screen.getByRole('status', { name: 'Carregando registros' })).toBeInTheDocument()
  })

  it('exibe estado vazio e abre o drawer do primeiro item', async () => {
    const user = userEvent.setup()
    vi.mocked(useCatalogItems).mockReturnValue({ data: [], isPending: false, isError: false, refetch: refetchItems } as unknown as ReturnType<typeof useCatalogItems>)
    render(<CatalogPage />)

    expect(screen.getByRole('heading', { name: 'Seu catalogo ainda esta vazio' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cadastrar primeiro item' }))
    expect(screen.getByRole('dialog', { name: 'Novo item' })).toBeInTheDocument()
  })

  it('permite tentar novamente apos erro de consulta', async () => {
    const user = userEvent.setup()
    vi.mocked(useCatalogItems).mockReturnValue({ data: undefined, isPending: false, isError: true, refetch: refetchItems } as unknown as ReturnType<typeof useCatalogItems>)
    render(<CatalogPage />)

    expect(screen.getByRole('alert')).toHaveTextContent('Nao foi possivel carregar os dados')
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(refetchItems).toHaveBeenCalledOnce()
    expect(refetchCategories).toHaveBeenCalledOnce()
  })

  it('aplica busca e apresenta estado filtrado vazio', async () => {
    const user = userEvent.setup()
    render(<CatalogPage />)
    await user.type(screen.getByRole('textbox', { name: 'Buscar itens' }), 'inexistente')
    expect(screen.getByRole('heading', { name: 'Nenhum item encontrado' })).toBeInTheDocument()
  })

  it('desabilita alteracao de status enquanto a mutation esta pendente', () => {
    vi.mocked(useSetCatalogItemStatus).mockReturnValue({ mutateAsync: setItemStatus, isPending: true } as unknown as ReturnType<typeof useSetCatalogItemStatus>)
    render(<CatalogPage />)
    expect(screen.getByRole('button', { name: 'Inativar item Hemograma' })).toBeDisabled()
  })

  it('cria item sem enviar code e informa o codigo retornado pelo backend', async () => {
    const user = userEvent.setup()
    render(<CatalogPage />)

    await user.click(screen.getByRole('button', { name: 'Novo item' }))
    await user.type(screen.getByLabelText('Nome *'), 'Hemograma completo')
    await user.selectOptions(screen.getByLabelText('Categoria *'), 'category-active')
    await user.selectOptions(screen.getByLabelText('Unidade *'), 'exame')
    await user.click(screen.getByRole('button', { name: 'Criar item' }))

    expect(createItem).toHaveBeenCalledWith({ name: 'Hemograma completo', category_id: 'category-active', unit: 'exame', description: '' })
    expect(toast.success).toHaveBeenCalledWith('Item ITEM-000001 cadastrado no catalogo.')
  })

  it('impede categoria duplicada antes da mutation com mensagem amigavel', async () => {
    const user = userEvent.setup()
    render(<CatalogPage />)

    await user.click(screen.getByRole('button', { name: 'Nova categoria' }))
    await user.selectOptions(screen.getByLabelText('Nome *'), 'Exames Laboratoriais')
    await user.click(screen.getByRole('button', { name: 'Criar categoria' }))

    expect(createCategory).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe uma categoria com este nome.')
  })
})
