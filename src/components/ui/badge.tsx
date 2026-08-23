import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-emerald-100 text-emerald-900',
        secondary: 'bg-slate-100 text-slate-700',
        warning: 'bg-amber-100 text-amber-900',
        outline: 'border border-slate-200 text-slate-700',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
