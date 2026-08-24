import { Building2, Globe, Tag } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { MarginScope } from '@/types/database'

import { ruleScopeLabels } from './rules-types'

const icons: Record<MarginScope, typeof Globe> = {
  global: Globe,
  category: Building2,
  item: Tag,
}

export function RuleScopeBadge({ scope }: { scope: MarginScope }) {
  const Icon = icons[scope]
  return (
    <Badge variant="outline" className="border-slate-300 text-slate-700">
      <Icon className="size-3.5" /> {ruleScopeLabels[scope]}
    </Badge>
  )
}
