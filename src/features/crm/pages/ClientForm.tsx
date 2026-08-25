import type { ClientListRow } from '@/types/database'
import type { ClientFormInput } from '@/features/crm/schemas/client-schema'

export default function ClientForm({
  client: _client,
  onCancel: _onCancel,
  onSubmit: _onSubmit,
}: {
  client?: ClientListRow
  onCancel: () => void
  onSubmit: (data: ClientFormInput) => void
}) {
  return null
}