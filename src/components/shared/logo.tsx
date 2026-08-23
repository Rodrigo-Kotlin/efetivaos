import fullLogo from '../../../assets/logo/full/logo-full-transparent.png'
import symbolLogo from '../../../assets/logo/symbol/logo-symbol-transparent.png'

import { cn } from '@/lib/utils'

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center', className)} aria-label="Efetiva OS">
      <img
        src={compact ? symbolLogo : fullLogo}
        alt={compact ? 'Símbolo da Efetiva' : 'Efetiva'}
        className={cn('shrink-0 object-contain', compact ? 'size-11' : 'h-auto w-[120px]')}
      />
    </div>
  )
}
