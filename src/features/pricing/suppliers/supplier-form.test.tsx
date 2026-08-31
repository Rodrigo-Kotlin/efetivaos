import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Supplier } from '@/types/database'

import { SupplierForm } from './supplier-form'

const supplier: Supplier = {
  id: 'supplier-1',
  code: 'FOR-000001',
  name: 'Fornecedor antigo',
  legal_name: 'Fornecedor Antigo Ltda.',
  tax_id: null,
  category: 'Laboratorio',
  contact_name: null,
  email: null,
  phone: null,
  active: true,
  notes: null,
  created_at: '2026-08-23T10:00:00Z',
  created_by: null,
  updated_at: '2026-08-23T10:00:00Z',
  updated_by: null,
}

describe('SupplierForm', () => {
  it('valida nome obrigatorio e e-mail opcional valido', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<SupplierForm onCancel={vi.fn()} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('E-mail'), 'email-invalido')
    await user.click(screen.getByRole('button', { name: 'Cadastrar fornecedor' }))

    expect(await screen.findByText('Informe o nome do fornecedor.')).toBeInTheDocument()
    expect(screen.getByText('Informe um e-mail valido.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('envia criacao com textos aparados e opcionais vazios como null', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<SupplierForm onCancel={vi.fn()} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Nome / Nome fantasia *'), '  Lab Norte  ')
    await user.type(screen.getByLabelText('E-mail'), ' contato@lab.test ')
    await user.click(screen.getByRole('button', { name: 'Cadastrar fornecedor' }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Lab Norte', legal_name: null, tax_id: null, category: null, contact_name: null,
      email: 'contato@lab.test', phone: null, active: true, notes: null,
    })
  })

  it('envia atualizacao com os campos editados', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<SupplierForm supplier={supplier} onCancel={vi.fn()} onSubmit={onSubmit} />)

    await user.clear(screen.getByLabelText('Nome / Nome fantasia *'))
    await user.type(screen.getByLabelText('Nome / Nome fantasia *'), 'Fornecedor atual')
    await user.click(screen.getByLabelText('Fornecedor ativo'))
    await user.click(screen.getByRole('button', { name: 'Salvar alteracoes' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Fornecedor atual', legal_name: 'Fornecedor Antigo Ltda.', category: 'Laboratorio', active: false,
    }))
  })
})
