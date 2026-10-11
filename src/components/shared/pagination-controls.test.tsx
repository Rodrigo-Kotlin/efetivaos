import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PaginationControls } from './pagination-controls'

describe('PaginationControls', () => {
  it('exibe o intervalo inicial e avanca para a proxima pagina', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<PaginationControls page={1} pageSize={25} total={91} onPageChange={onPageChange} onPageSizeChange={vi.fn()} />)

    expect(screen.getByText('1–25 de 91 resultados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('permite escolher 50/100 registros por pagina', async () => {
    const user = userEvent.setup()
    const onPageSizeChange = vi.fn()
    render(<PaginationControls page={2} pageSize={25} total={101} onPageChange={vi.fn()} onPageSizeChange={onPageSizeChange} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Registros por página' }), '100')
    expect(onPageSizeChange).toHaveBeenCalledWith(100)
  })

  it('desabilita proxima na ultima pagina e mostra reticencias quando necessario', () => {
    render(<PaginationControls page={4} pageSize={25} total={250} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />)

    expect(screen.getByText('76–100 de 250 resultados')).toBeInTheDocument()
    expect(screen.getByText('…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima página' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Página 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Página 10' })).toBeInTheDocument()
  })

  it('desabilita anterior na primeira e próxima na última página', () => {
    render(<PaginationControls page={10} pageSize={25} total={250} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Página anterior' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Página 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Página 10' })).toHaveAttribute('aria-current', 'page')
  })
})
