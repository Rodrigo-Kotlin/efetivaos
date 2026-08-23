import { WifiOff } from 'lucide-react'

import { useOnlineStatus } from '@/hooks/use-online-status'

export function OfflineBanner() {
  const online = useOnlineStatus()

  if (online) return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-950 px-4 py-2 text-center text-sm font-medium text-white" role="status">
      <WifiOff className="size-4" />
      Sem conexao. Os dados nao podem ser atualizados no momento.
    </div>
  )
}
