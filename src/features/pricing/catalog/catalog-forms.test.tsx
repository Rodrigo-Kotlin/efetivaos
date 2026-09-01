import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CatalogCategoryForm } from './catalog-category-form'
import { CatalogItemForm } from './catalog-item-form'
import type { CatalogCategoryRow } from './catalog.types'

const categories: CatalogCategoryRow[] = [
  { id: 'category-1', name: 'Laboratoriais', active: true, updated_at: '2026-08-23T00:00:00Z' },
  { id: 'category-2', name: 'Historica', active: false, updated_at: '2026-08-23T00:00:00Z' },
]

describe('catalog forms', () => {
  it('envia o payload de criacao do item com campos obrigatorios', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<CatalogItemForm categories={categories} submitLabel="Criar item" onSubmit={onSubmit} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Código')).toHaveValue('Código gerado automaticamente')
    expect(screen.getByLabelText('Código')).toHaveAttribute('readonly')
    await user.type(screen.getByLabelText('Nome *'), '  Hemograma  ')
    await user.selectOptions(screen.getByLabelText('Categoria *'), 'category-1')
    await user.selectOptions(screen.getByLabelText('Unidade *'), 'exame')
    await user.click(screen.getByRole('button', { name: 'Criar item' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Hemograma', category_id: 'category-1', unit: 'exame', description: '' }))
    expect(screen.queryByRole('option', { name: 'Historica' })).not.toBeInTheDocument()
  })

  it('envia o payload editado e aceita uma unidade personalizada', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <CatalogItemForm
        categories={categories}
        code="ITEM-000001"
        defaultValues={{ name: 'Hemograma', category_id: 'category-1', unit: 'exame', description: '' }}
        submitLabel="Salvar alteracoes"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Código')).toHaveValue('ITEM-000001')
    expect(screen.getByLabelText('Código')).toHaveAttribute('readonly')
    await user.clear(screen.getByLabelText('Nome *'))
    await user.type(screen.getByLabelText('Nome *'), 'Hemograma completo')
    await user.selectOptions(screen.getByLabelText('Unidade *'), '__custom__')
    await user.type(screen.getByLabelText('Unidade personalizada'), 'caixa')
    await user.click(screen.getByRole('button', { name: 'Salvar alteracoes' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Hemograma completo', category_id: 'category-1', unit: 'caixa', description: '' }))
  })

  it('cria uma categoria a partir dos presets e trata Outros como categoria real', async () => {
    const user = userEvent.setup()
    const create = vi.fn()
    const { unmount } = render(<CatalogCategoryForm submitLabel="Criar categoria" onSubmit={create} onCancel={vi.fn()} />)
    await user.selectOptions(screen.getByLabelText('Nome *'), 'Exames Laboratoriais')
    await user.click(screen.getByRole('button', { name: 'Criar categoria' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Exames Laboratoriais', active: true }))

    unmount()
    const createOther = vi.fn()
    render(<CatalogCategoryForm submitLabel="Criar categoria" onSubmit={createOther} onCancel={vi.fn()} />)
    await user.selectOptions(screen.getByLabelText('Nome *'), 'Outros')
    expect(screen.queryByLabelText('Nome da nova categoria')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Criar categoria' }))
    await waitFor(() => expect(createOther).toHaveBeenCalledWith({ name: 'Outros', active: true }))
  })

  it('cria e edita categorias personalizadas', async () => {
    const user = userEvent.setup()
    const create = vi.fn()
    const { unmount } = render(<CatalogCategoryForm submitLabel="Criar categoria" onSubmit={create} onCancel={vi.fn()} />)
    await user.selectOptions(screen.getByLabelText('Nome *'), '__custom__')
    await user.type(screen.getByLabelText('Nome da nova categoria'), '  Exames Toxicológicos  ')
    await user.click(screen.getByRole('button', { name: 'Criar categoria' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Exames Toxicológicos', active: true }))

    unmount()
    const edit = vi.fn()
    render(<CatalogCategoryForm defaultValues={{ name: 'Cursos personalizados', active: false }} submitLabel="Salvar alteracoes" onSubmit={edit} onCancel={vi.fn()} />)
    expect(screen.getByLabelText('Nome da nova categoria')).toHaveValue('Cursos personalizados')
    await user.clear(screen.getByLabelText('Nome da nova categoria'))
    await user.type(screen.getByLabelText('Nome da nova categoria'), 'Cursos e treinamentos')
    await user.selectOptions(screen.getByLabelText('Status'), 'active')
    await user.click(screen.getByRole('button', { name: 'Salvar alteracoes' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith({ name: 'Cursos e treinamentos', active: true }))
  })
})
