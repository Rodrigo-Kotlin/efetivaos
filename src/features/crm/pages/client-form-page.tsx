import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ErrorState, PageHeader, TableSkeleton } from '@/components/shared/operational-ui'
import { useOnlineStatus } from '@/hooks/use-online-status'
import ClientForm from '@/features/crm/pages/ClientForm'
import { useClientDetail, useCreateClientMutation, useUpdateClientMutation } from '@/features/crm/queries/client-queries'

export default function ClientFormPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const isEdit = Boolean(clientId)
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const createMutation = useCreateClientMutation()
  const updateMutation = useUpdateClientMutation()
  const clientQuery = useClientDetail(isEdit ? clientId : undefined)

  const pending = createMutation.isPending || updateMutation.isPending

  async function handleSubmit(input: Parameters<typeof createMutation.mutateAsync>[0]) {
    if (!online) {
      toast.error('Sem conexão. Reconecte para salvar o cliente.')
      return
    }
    try {
      if (isEdit && clientId) {
        await updateMutation.mutateAsync({ id: clientId, input })
        toast.success('Cliente atualizado com sucesso.')
      } else {
        await createMutation.mutateAsync(input)
        toast.success('Cliente cadastrado com sucesso.')
      }
      navigate('/crm/clients')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o cliente.')
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader
        eyebrow="CRM"
        title={isEdit ? 'Editar cliente' : 'Novo cliente'}
        description={isEdit ? 'Atualize os dados cadastrais do cliente.' : 'Preencha os dados para cadastrar um novo cliente.'}
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="size-4" /> Voltar</Button>}
      />

      {isEdit && clientQuery.isLoading ? (
        <TableSkeleton columns={4} />
      ) : isEdit && clientQuery.isError ? (
        <ErrorState onRetry={() => void clientQuery.refetch()} />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ClientForm
            key={clientId ?? 'new'}
            client={clientQuery.data}
            pending={pending}
            onCancel={() => navigate(-1)}
            onSubmit={handleSubmit}
          />
        </div>
      )}
    </div>
  )
}
