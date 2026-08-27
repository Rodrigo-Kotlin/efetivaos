import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChartAccounts, useCreateAdjustment } from '../queries/finance-queries'
import type { AdjustmentLine } from '../api/finance-api'

const fmt = (v: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))

export default function AdjustmentsPage() {
  const [showForm, setShowForm] = useState(false)
  const [entryDate, setEntryDate] = useState('')
  const [competenceDate, setCompetenceDate] = useState('')
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [justification, setJustification] = useState('')
  const [lines, setLines] = useState<AdjustmentLine[]>([
    { chart_account_id: '', debit: 0, credit: 0, description: '' },
    { chart_account_id: '', debit: 0, credit: 0, description: '' },
  ])

  const { data: accounts } = useChartAccounts()
  const createAdjustment = useCreateAdjustment()

  const updateLine = (index: number, field: keyof AdjustmentLine, value: string | number) => {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setLines(newLines)
  }

  const addLine = () => {
    setLines([...lines, { chart_account_id: '', debit: 0, credit: 0, description: '' }])
  }

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index))
    }
  }

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0)
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  const handleSubmit = async () => {
    if (!entryDate || !competenceDate || !description || !isBalanced) return

    await createAdjustment.mutateAsync({
      entry_date: entryDate,
      competence_date: competenceDate,
      description,
      reference: reference || null,
      justification: justification || null,
      lines,
    })

    setShowForm(false)
    setEntryDate('')
    setCompetenceDate('')
    setDescription('')
    setReference('')
    setJustification('')
    setLines([
      { chart_account_id: '', debit: 0, credit: 0, description: '' },
      { chart_account_id: '', debit: 0, credit: 0, description: '' },
    ])
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Ajustes Contabeis
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Lancamentos manuais de ajuste com partidas dobradas.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : 'Novo Ajuste'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Data do Lancamento *</label>
              <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Competencia *</label>
              <Input type="date" value={competenceDate} onChange={e => setCompetenceDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Historico *</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descricao do ajuste" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Referencia</label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Numero do documento ou referencia" />
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Linhas Contabeis *</label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                Adicionar Linha
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <select
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                      value={line.chart_account_id}
                      onChange={e => updateLine(i, 'chart_account_id', e.target.value)}
                    >
                      <option value="">Selecione a conta</option>
                      {accounts?.map(a => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Debito"
                      value={line.debit || ''}
                      onChange={e => updateLine(i, 'debit', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Credito"
                      value={line.credit || ''}
                      onChange={e => updateLine(i, 'credit', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="Descricao"
                      value={line.description || ''}
                      onChange={e => updateLine(i, 'description', e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    {lines.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(i)}
                        className="text-red-500"
                      >
                        X
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-3 flex gap-4 text-sm">
              <span>Total Debitos: <strong>{fmt(totalDebit)}</strong></span>
              <span>Total Creditos: <strong>{fmt(totalCredit)}</strong></span>
              <span className={isBalanced ? 'text-green-600' : 'text-red-600'}>
                {isBalanced ? 'Balanceado' : 'Desbalanceado'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Justificativa</label>
            <textarea
              className="h-20 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={justification}
              onChange={e => setJustification(e.target.value)}
              placeholder="Justificativa do ajuste (opcional, sera registrada como nota)"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={!entryDate || !competenceDate || !description || !isBalanced || createAdjustment.isPending}
            >
              {createAdjustment.isPending ? 'Salvando...' : 'Salvar Ajuste'}
            </Button>
          </div>
        </div>
      )}

      {/* Info */}
      {!showForm && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="text-center text-sm text-slate-500">
            <p>Os lancamentos de ajuste criados aparecerao automaticamente em:</p>
            <ul className="mt-2 space-y-1">
              <li>Balanco Patrimonial (BP)</li>
              <li>Demonstracao do Resultado (DRE)</li>
              <li>Fluxo de Caixa (DFC) - se afetar caixa</li>
              <li>DMPL / DLPA - se afetar PL</li>
              <li>DVA - quando conta tiver dva_class</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}