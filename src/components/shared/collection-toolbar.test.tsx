import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  ClearFiltersButton,
  CollectionActions,
  CollectionFilters,
  CollectionResultsCount,
  CollectionSearch,
  CollectionSort,
  CollectionToolbar,
  FilterChip,
} from './collection-toolbar'

describe('CollectionToolbar', () => {
  it('renderiza busca, filtros, contador, ordenação e ações com labels acessíveis', () => {
    render(
      <CollectionToolbar actions={<CollectionActions><button type="button">Novo registro</button></CollectionActions>}>
        <CollectionSearch value="" onChange={vi.fn()} placeholder="Buscar clientes..." label="Buscar clientes" />
        <CollectionFilters><select aria-label="Status"><option>Ativos</option></select></CollectionFilters>
        <CollectionResultsCount page={2} pageSize={25} total={84} />
        <CollectionSort value="name" onChange={vi.fn()} options={[{ value: 'name', label: 'Nome' }]} />
      </CollectionToolbar>,
    )

    expect(screen.getByRole('searchbox', { name: 'Buscar clientes' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByText('26–50 de 84 resultados')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo registro' })).toBeInTheDocument()
  })

  it('permite limpar a busca, remover um filtro e limpar todos', async () => {
    const user = userEvent.setup()
    const onSearchChange = vi.fn()
    const onRemove = vi.fn()
    const onClear = vi.fn()
    render(
      <CollectionToolbar>
        <CollectionSearch value="abc" onChange={onSearchChange} placeholder="Buscar..." />
        <FilterChip label="Status: Ativo" onRemove={onRemove} />
        <ClearFiltersButton onClick={onClear} />
      </CollectionToolbar>,
    )

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar' }))
    await user.click(screen.getByRole('button', { name: 'Remover filtro Status: Ativo' }))
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))

    expect(onSearchChange).toHaveBeenCalledWith('')
    expect(onRemove).toHaveBeenCalledOnce()
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('mantém o contador legível em coleção vazia', () => {
    render(<CollectionResultsCount page={1} pageSize={25} total={0} />)
    expect(screen.getByText('0–0 de 0 resultados')).toBeInTheDocument()
  })
})
