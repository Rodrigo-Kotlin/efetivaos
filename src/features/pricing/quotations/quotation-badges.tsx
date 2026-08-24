import { AlertTriangle, Ban, CheckCircle2, Clock3, FileQuestion } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { QuotationStatus } from '@/types/database'

import { isExpired, quotationStatusLabels } from './quotation.helpers'

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  if (status === 'active') return <Badge><CheckCircle2 className="size-3.5" /> {quotationStatusLabels[status]}</Badge>
  if (status === 'cancelled') return <Badge variant="warning"><Ban className="size-3.5" /> {quotationStatusLabels[status]}</Badge>
  return <Badge variant="secondary"><Clock3 className="size-3.5" /> {quotationStatusLabels[status]}</Badge>
}

export function QuotationValidityBadge({ validUntil }: { validUntil: string | null }) {
  if (!validUntil) return <Badge variant="outline"><FileQuestion className="size-3.5" /> Validade não informada</Badge>
  if (isExpired(validUntil)) return <Badge variant="warning"><AlertTriangle className="size-3.5" /> Vencida · histórica</Badge>
  return null
}
