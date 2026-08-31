import { AlertTriangle, Archive, Ban, CheckCircle2, Clock3, FileQuestion } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { QuotationStatus } from '@/types/database'

import { isExpired, quotationStatusLabels } from './quotation.helpers'

export function QuotationStatusBadge({ status, archived }: { status: QuotationStatus; archived?: boolean }) {
  return <span className="inline-flex flex-wrap gap-1">
    {status === 'active' && <Badge><CheckCircle2 className="size-3.5" /> {quotationStatusLabels[status]}</Badge>}
    {status === 'cancelled' && <Badge variant="warning"><Ban className="size-3.5" /> {quotationStatusLabels[status]}</Badge>}
    {status === 'draft' && <Badge variant="secondary"><Clock3 className="size-3.5" /> {quotationStatusLabels[status]}</Badge>}
    {archived && <Badge variant="outline"><Archive className="size-3.5" /> Arquivada</Badge>}
  </span>
}

export function QuotationValidityBadge({ validUntil }: { validUntil: string | null }) {
  if (!validUntil) return <Badge variant="outline"><FileQuestion className="size-3.5" /> Validade não informada</Badge>
  if (isExpired(validUntil)) return <Badge variant="warning"><AlertTriangle className="size-3.5" /> Vencida · histórica</Badge>
  return null
}
