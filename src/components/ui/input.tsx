import type { InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
