import type { ClientListRow } from '@/types/database'

export default function ClientDetails({
  client: _client,
  onEdit: _onEdit,
}: {
  client?: ClientListRow
  onEdit: () => void
}) {
  return null
}