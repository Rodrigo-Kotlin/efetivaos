import { Wallet } from 'lucide-react'

import { MetricCard } from '@/components/shared/metric-card'

function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

type FilteredTotalCardProps = {
  title: string
  total: number | undefined
  isLoading?: boolean
  isError?: boolean
  className?: string
}

export function FilteredTotalCard({ title, total, isLoading, isError, className }: FilteredTotalCardProps) {
  return (
    <MetricCard
      className={className}
      label={title}
      icon={Wallet}
      value={formatBrl(total ?? 0)}
      isLoading={isLoading}
      isError={isError}
      errorText="Não foi possível calcular"
      supportingText={!isLoading && !isError ? 'Conforme filtros aplicados' : undefined}
    />
  )
}
