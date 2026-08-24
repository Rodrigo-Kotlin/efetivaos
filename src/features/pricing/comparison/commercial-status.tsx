import { AlertTriangle, BadgeCheck, CircleOff, FileQuestion, Scale } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import type { PriceEffectiveStatus } from './comparison-types'

export function CommercialStatusBadge({ status }: { status: PriceEffectiveStatus }) {
  if (status === 'approved') return <Badge><BadgeCheck className="size-3.5" /> Aprovado</Badge>
  if (status === 'review_required') return <Badge variant="warning"><AlertTriangle className="size-3.5" /> Revisao necessaria</Badge>
  if (status === 'inactive') return <Badge variant="secondary"><CircleOff className="size-3.5" /> Inativo</Badge>
  if (status === 'no_cost') return <Badge variant="secondary"><FileQuestion className="size-3.5" /> Sem custo vigente</Badge>
  if (status === 'no_rule') return <Badge variant="warning"><Scale className="size-3.5" /> Sem regra</Badge>
  return <Badge variant="outline"><Scale className="size-3.5" /> Sugestao disponivel</Badge>
}
