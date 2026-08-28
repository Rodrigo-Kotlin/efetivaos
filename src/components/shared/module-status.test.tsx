import { render, screen } from '@testing-library/react'

import { ModuleStatusBadge, getModuleStatusConfig } from './module-status'

describe('ModuleStatusBadge', () => {
  it('renders available status with correct label', () => {
    render(<ModuleStatusBadge status="available" />)
    expect(screen.getByText('Disponível')).toBeInTheDocument()
  })

  it('renders in_progress status with correct label', () => {
    render(<ModuleStatusBadge status="in_progress" />)
    expect(screen.getByText('Em desenvolvimento')).toBeInTheDocument()
  })

  it('renders planned status with correct label', () => {
    render(<ModuleStatusBadge status="planned" />)
    expect(screen.getByText('Planejado')).toBeInTheDocument()
  })

  it('renders disabled status with correct label', () => {
    render(<ModuleStatusBadge status="disabled" />)
    expect(screen.getByText('Indisponível')).toBeInTheDocument()
  })
})

describe('getModuleStatusConfig', () => {
  it('returns correct config for available', () => {
    const config = getModuleStatusConfig('available')
    expect(config.label).toBe('Disponível')
    expect(config.className).toContain('emerald')
  })

  it('returns correct config for in_progress', () => {
    const config = getModuleStatusConfig('in_progress')
    expect(config.label).toBe('Em desenvolvimento')
    expect(config.className).toContain('blue')
  })

  it('returns correct config for planned', () => {
    const config = getModuleStatusConfig('planned')
    expect(config.label).toBe('Planejado')
    expect(config.className).toContain('slate')
  })
})
