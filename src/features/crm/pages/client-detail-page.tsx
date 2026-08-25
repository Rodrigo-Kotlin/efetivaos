import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ErrorState, PageHeader, TableSkeleton } from '@/components/shared/operational-ui'
import ClientDetails from '@/features/crm/pages/ClientDetails'
import { useClientDetail } from '@/features/crm/queries/client-queries'

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  const clientQuery = useClientDetail(clientId)

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader
        eyebrow="CRM"
        title={clientQuery.data?.legal_name ?? 'Detalhes do cliente'}
        description="Visualize os dados completos do cliente."
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="size-4" /> Voltar</Button>}
      />

      {clientQuery.isLoading ? (
        <TableSkeleton columns={4} />
      ) : clientQuery.isError ? (
        <ErrorState onRetry={() => void clientQuery.refetch()} />
      ) : clientQuery.data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ClientDetails
            client={clientQuery.data}
            onEdit={() => navigate(`/crm/clients/${clientId}/edit`)}
          />
        </div>
      ) : null}
    </div>
  )
}
