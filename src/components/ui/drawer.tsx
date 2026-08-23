import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type DrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function Drawer({ open, onOpenChange, title, description, children, footer, className }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl outline-none',
            className,
          )}
        >
          <header className="flex items-start gap-4 border-b border-slate-200 px-5 py-5 sm:px-7">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-serif text-2xl font-semibold text-slate-950">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-sm leading-6 text-slate-600">{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700" aria-label="Fechar painel">
              <X className="size-5" />
            </Dialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">{children}</div>
          {footer && <footer className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-7">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
