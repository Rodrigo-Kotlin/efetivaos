import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { MetricCard } from './metric-card'

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="Cotacoes" value={5} />)
    expect(screen.getByText('Cotacoes')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders supporting text', () => {
    render(<MetricCard label="Clientes" value={10} supportingText="ativos" />)
    expect(screen.getByText('ativos')).toBeInTheDocument()
  })

  it('shows skeleton when loading', () => {
    const { container } = render(<MetricCard label="Teste" value="--" isLoading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders with icon', () => {
    const DummyIcon = () => <svg data-testid="icon" />
    render(<MetricCard label="Teste" value={1} icon={DummyIcon as never} />)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})
