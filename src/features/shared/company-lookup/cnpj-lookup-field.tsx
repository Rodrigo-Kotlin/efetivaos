import { useEffect, useRef, useState, useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

import { useCompanyLookup } from './use-company-lookup'
import { isValidCnpj, normalizeCnpj } from './brasil-api'
import type { CompanyLookupResult } from './types'

type CnpjLookupFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onLookup: (data: CompanyLookupResult) => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
}

export function CnpjLookupField({
  id,
  label,
  value,
  onChange,
  onLookup,
  required = false,
  disabled = false,
  placeholder = '00.000.000/0000-00',
}: CnpjLookupFieldProps) {
  const normalized = normalizeCnpj(value)
  const lookup = useCompanyLookup(normalized)
  const lastFetchedCnpj = useRef<string>('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmData, setConfirmData] = useState<CompanyLookupResult | null>(null)

  const handleLookup = useCallback(() => {
    if (!isValidCnpj(normalized)) return
    lookup.refetch()
  }, [normalized, lookup])

  useEffect(() => {
    if (lookup.status === 'success' && lookup.data && normalized !== lastFetchedCnpj.current) {
      lastFetchedCnpj.current = normalized
      setConfirmData(lookup.data)
      setShowConfirm(true)
    }
  }, [lookup.status, lookup.data, normalized])

  const handleConfirmApply = () => {
    if (confirmData) onLookup(confirmData)
    setShowConfirm(false)
    setConfirmData(null)
  }

  const handleDismiss = () => {
    setShowConfirm(false)
    setConfirmData(null)
  }

  const statusIcon = () => {
    if (lookup.status === 'loading') return <Loader2 className="size-4 animate-spin text-slate-400" />
    if (lookup.status === 'success') return <CheckCircle2 className="size-4 text-emerald-500" />
    if (lookup.status === 'error') return <AlertCircle className="size-4 text-amber-500" />
    return null
  }

  const statusText = () => {
    if (lookup.status === 'loading') return 'Buscando dados da empresa...'
    if (lookup.status === 'error' && lookup.error) return lookup.error.message
    return null
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-sm font-semibold text-slate-800" htmlFor={id}>
            {label}{required && ' *'}
          </label>
          <div className="relative">
            <Input
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              maxLength={18}
              aria-describedby={lookup.status !== 'idle' ? `${id}-lookup-status` : undefined}
            />
            {lookup.status !== 'idle' && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">{statusIcon()}</span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleLookup}
          disabled={disabled || lookup.status === 'loading' || !isValidCnpj(normalized)}
          className="mb-0.5 shrink-0 gap-1.5"
          aria-label="Buscar dados da empresa pelo CNPJ"
        >
          <Search className="size-3.5" />
          <span className="hidden sm:inline">Buscar</span>
        </Button>
      </div>

      {lookup.status !== 'idle' && (
        <p
          id={`${id}-lookup-status`}
          role="status"
          aria-live="polite"
          className={`text-xs ${lookup.status === 'error' ? 'text-amber-600' : lookup.status === 'success' ? 'text-emerald-600' : 'text-slate-500'}`}
        >
          {statusText()}
          {lookup.status === 'success' && ' Dados consultados automaticamente.'}
        </p>
      )}

      {showConfirm && confirmData && (
        <div
          role="alert"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          <p className="font-semibold">Dados encontrados para este CNPJ.</p>
          <p className="mt-1 text-emerald-700">
            {confirmData.legalName}
            {confirmData.tradeName && ` (${confirmData.tradeName})`}
          </p>
          {confirmData.registrationStatus && confirmData.registrationStatus !== 'ATIVA' && (
            <p className="mt-1 text-amber-700">
              A empresa consta com situacao cadastral: {confirmData.registrationStatus}. Verifique antes de prosseguir.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" onClick={handleConfirmApply}>Preencher cadastro</Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleDismiss}>Ignorar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
