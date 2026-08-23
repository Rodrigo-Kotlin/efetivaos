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

    await user.type(screen.getByLabelText('Codigo *'), '  exa-001  ')
    await user.type(screen.getByLabelText('Nome *'), '  Hemograma  ')
    await user.selectOptions(screen.getByLabelText('Categoria *'), 'category-1')
    await user.selectOptions(screen.getByLabelText('Unidade *'), 'exame')
    await user.click(screen.getByRole('button', { name: 'Criar item' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ code: 'exa-001', name: 'Hemograma', category_id: 'category-1', unit: 'exame', description: '' }))
    expect(screen.queryByRole('option', { name: 'Historica' })).not.toBeInTheDocument()
  })

  it('envia o payload editado e aceita uma unidade personalizada', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <CatalogItemForm
        categories={categories}
        defaultValues={{ code: 'EXA-001', name: 'Hemograma', category_id: 'category-1', unit: 'exame', description: '' }}
        submitLabel="Salvar alteracoes"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    await user.clear(screen.getByLabelText('Nome *'))
    await user.type(screen.getByLabelText('Nome *'), 'Hemograma completo')
    await user.selectOptions(screen.getByLabelText('Unidade *'), '__custom__')
    await user.type(screen.getByLabelText('Unidade personalizada'), 'caixa')
    await user.click(screen.getByRole('button', { name: 'Salvar alteracoes' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ code: 'EXA-001', name: 'Hemograma completo', category_id: 'category-1', unit: 'caixa', description: '' }))
  })

  it('envia payloads de criacao e edicao da categoria com status', async () => {
    const user = userEvent.setup()
    const create = vi.fn()
    const { unmount } = render(<CatalogCategoryForm submitLabel="Criar categoria" onSubmit={create} onCancel={vi.fn()} />)
    await user.type(screen.getByLabelText('Nome *'), '  Treinamentos  ')
    await user.selectOptions(screen.getByLabelText('Status'), 'inactive')
    await user.click(screen.getByRole('button', { name: 'Criar categoria' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Treinamentos', active: false }))

    unmount()
    const edit = vi.fn()
    render(<CatalogCategoryForm defaultValues={{ name: 'Treinamentos', active: false }} submitLabel="Salvar alteracoes" onSubmit={edit} onCancel={vi.fn()} />)
    await user.clear(screen.getByLabelText('Nome *'))
    await user.type(screen.getByLabelText('Nome *'), 'Cursos e treinamentos')
    await user.selectOptions(screen.getByLabelText('Status'), 'active')
    await user.click(screen.getByRole('button', { name: 'Salvar alteracoes' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith({ name: 'Cursos e treinamentos', active: true }))
  })
})
