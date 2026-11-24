import { Check, FileUp, RotateCcw, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useUploadContractDocument } from '@/features/crm/queries/contract-queries'
import { prepareContractPdf, type PreparedContractPdf } from '@/features/crm/pdf/pdf-upload'

type ContractDocumentUploadProps = {
  contractId: string
  documentType: 'main' | 'addendum' | 'other'
  disabled?: boolean
  onUploaded?: () => void
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function ContractDocumentUpload({ contractId, documentType, disabled = false, onUploaded }: ContractDocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadContractDocument(contractId)
  const [processing, setProcessing] = useState(false)
  const [stage, setStage] = useState('Aguardando seleção')
  const [prepared, setPrepared] = useState<PreparedContractPdf | null>(null)
  const [fileKey, setFileKey] = useState(0)

  async function select(file: File | undefined) {
    if (!file) return
    setPrepared(null)
    setProcessing(true)
    setStage('Validando PDF…')
    try {
      const result = await prepareContractPdf(file, { onProgress: (next) => setStage(next === 'complete' ? 'Pronto para confirmação' : `Processando: ${next}…`) })
      setPrepared(result)
      setStage('Pronto para confirmação')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível processar o PDF.')
      setStage('Falha no processamento')
      setFileKey((key) => key + 1)
    } finally {
      setProcessing(false)
    }
  }

  function cancel() {
    setPrepared(null)
    setStage('Aguardando seleção')
    setFileKey((key) => key + 1)
  }

  async function confirm() {
    if (!prepared) return
    try {
      await upload.mutateAsync({ file: prepared.file, type: documentType, metadata: prepared.metadata })
      toast.success('Documento anexado.')
      cancel()
      onUploaded?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível anexar o documento.')
    }
  }

  const busy = disabled || processing || upload.isPending
  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        key={fileKey}
        className="hidden"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => { void select(event.target.files?.[0]) }}
      />
      {!prepared ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" /> {processing ? stage : 'Anexar PDF do contrato'}
        </Button>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold"><FileUp className="size-4 shrink-0" /> <span className="truncate">{prepared.file.name}</span></p>
              <p className="mt-1 text-xs text-slate-600">Original: {formatBytes(prepared.result.originalBytes)} · Final: {formatBytes(prepared.result.finalBytes)}</p>
              {prepared.result.status === 'optimized'
                ? <p className="mt-1 text-xs font-semibold text-emerald-800">Economia obtida: {percent(prepared.result.savedRatio)}</p>
                : <p className="mt-1 text-xs font-semibold text-amber-800">Original preservado: {prepared.result.reason}</p>}
            </div>
            <button type="button" aria-label="Cancelar documento selecionado" className="rounded p-1 text-slate-500 hover:bg-white" onClick={cancel} disabled={upload.isPending}><X className="size-4" /></button>
          </div>
          <p role="status" className="mt-2 text-xs text-slate-600">{upload.isPending ? 'Enviando após confirmação…' : 'Revise o resultado e confirme o envio.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={upload.isPending} onClick={() => void confirm()}><Check className="size-4" /> Confirmar envio</Button>
            <Button type="button" size="sm" variant="outline" disabled={upload.isPending} onClick={cancel}><RotateCcw className="size-4" /> Escolher outro</Button>
          </div>
        </div>
      )}
      {!prepared && !processing && stage === 'Falha no processamento' ? <p className="text-xs text-red-700" role="alert">O original não foi enviado.</p> : null}
    </div>
  )
}
