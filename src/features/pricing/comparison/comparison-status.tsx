import { AlertTriangle, BadgeCheck, FileQuestion, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import type { ComparisonStatus } from './comparison-types'

export function ComparisonStatusBadge({ status }: { status: ComparisonStatus }) {
  if (status === 'no_offer') return <Badge variant="secondary"><XCircle className="size-3.5" /> Sem oferta vigente</Badge>
  if (status === 'validity_not_informed') return <Badge variant="warning"><FileQuestion className="size-3.5" /> Validade não informada</Badge>
  return <Badge><BadgeCheck className="size-3.5" /> Oferta vigente</Badge>
}

export function ComparisonValidityNote({ validUntil, validityNotInformed }: { validUntil: string | null; validityNotInformed: boolean | null }) {
  if (validityNotInformed || validUntil === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
        <AlertTriangle className="size-3.5" /> Validade não informada
      </span>
    )
  }
  return <span className="text-xs text-slate-500">{validUntil}</span>
}
