import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/operational-ui'
import type { ClientListRow } from '@/types/database'

type ClientDetailsProps = {
  client: ClientListRow
  onEdit: () => void
}

export default function ClientDetails({ client, onEdit }: ClientDetailsProps) {
  const details: Array<[string, string | null]> = [
    ['Razão Social / Nome', client.legal_name],
    ['Nome fantasia', client.trade_name],
    ['Tipo', client.client_type === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física'],
    ['CPF/CNPJ', client.tax_id || 'Não informado'],
    ['E-mail', client.email],
    ['Telefone', client.phone],
    ['Website', client.website],
    ['CEP', client.zip_code],
    ['Logradouro', client.street],
    ['Número', client.number],
    ['Complemento', client.complement],
    ['Bairro', client.district],
    ['Cidade', client.city],
    ['UF', client.state],
    ['País', client.country],
    ['Observações', client.notes],
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
        <StatusBadge active={client.status === 'active'} />
        <Button size="sm" variant="outline" onClick={onEdit}>Editar</Button>
      </div>
      <dl className="divide-y divide-slate-100">
        {details.map(([label, value]) => (
          <div className="py-4" key={label}>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">{value || 'Não informado'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
