import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '../queries/finance-queries'
import type { FinancialNote, NoteFormValues } from '../api/finance-api'

const NOTE_TYPES = [
  { value: 'GERAL', label: 'Geral' },
  { value: 'DRE', label: 'DRE' },
  { value: 'BP', label: 'Balanço Patrimonial' },
  { value: 'DFC', label: 'Fluxo de Caixa' },
  { value: 'DMPL', label: 'DMPL' },
  { value: 'DLPA', label: 'DLPA' },
  { value: 'DVA', label: 'DVA' },
  { value: 'AJUSTE', label: 'Ajuste Contábil' },
  { value: 'CONTA', label: 'Conta Contábil' },
  { value: 'ATIVO', label: 'Ativo/Bem' },
]

const REPORT_TYPES = ['', 'DRE', 'BP', 'DFC', 'DMPL', 'DLPA', 'DVA', 'AJUSTE']

export default function NotesPage() {
  const [filterType, setFilterType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingNote, setEditingNote] = useState<FinancialNote | null>(null)
  const [formValues, setFormValues] = useState<NoteFormValues>({
    note_type: 'GERAL',
    title: '',
    body: '',
    reference_date: '',
    report_type: '',
  })

  const { data: notes, isLoading } = useNotes(filterType || null)
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()

  const handleCreate = async () => {
    if (!formValues.title) return
    await createNote.mutateAsync(formValues)
    setShowForm(false)
    resetForm()
  }

  const handleUpdate = async () => {
    if (!editingNote || !formValues.title) return
    await updateNote.mutateAsync({ id: editingNote.id, values: formValues })
    setEditingNote(null)
    setShowForm(false)
    resetForm()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja inativar esta nota?')) return
    await deleteNote.mutateAsync(id)
  }

  const resetForm = () => {
    setFormValues({
      note_type: 'GERAL',
      title: '',
      body: '',
      reference_date: '',
      report_type: '',
    })
  }

  const startEdit = (note: FinancialNote) => {
    setEditingNote(note)
    setFormValues({
      note_type: note.note_type,
      title: note.title,
      body: note.body ?? '',
      reference_date: note.reference_date ?? '',
      report_type: note.report_type,
    })
    setShowForm(true)
  }

  const cancelForm = () => {
    setEditingNote(null)
    setShowForm(false)
    resetForm()
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Notas Gerenciais
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Notas explicativas vinculadas a demonstracoes e ajustes.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setEditingNote(null); setShowForm(!showForm) }}>
          {showForm ? 'Cancelar' : 'Nova Nota'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Filtrar por Relatorio</label>
          <select
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="">Todos</option>
            {REPORT_TYPES.filter(Boolean).map(rt => (
              <option key={rt} value={rt}>{rt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Tipo da Nota *</label>
              <select
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                value={formValues.note_type}
                onChange={e => setFormValues({ ...formValues, note_type: e.target.value })}
              >
                {NOTE_TYPES.map(nt => (
                  <option key={nt.value} value={nt.value}>{nt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Relatorio</label>
              <select
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                value={formValues.report_type}
                onChange={e => setFormValues({ ...formValues, report_type: e.target.value })}
              >
                <option value="">Nenhum</option>
                {REPORT_TYPES.filter(Boolean).map(rt => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Titulo *</label>
            <Input
              value={formValues.title}
              onChange={e => setFormValues({ ...formValues, title: e.target.value })}
              placeholder="Titulo da nota"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Conteudo</label>
            <textarea
              className="h-32 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={formValues.body ?? ''}
              onChange={e => setFormValues({ ...formValues, body: e.target.value })}
              placeholder="Conteudo da nota"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Data de Referencia</label>
            <Input
              type="date"
              value={formValues.reference_date ?? ''}
              onChange={e => setFormValues({ ...formValues, reference_date: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancelForm}>Cancelar</Button>
            <Button
              onClick={editingNote ? handleUpdate : handleCreate}
              disabled={!formValues.title || createNote.isPending || updateNote.isPending}
            >
              {createNote.isPending || updateNote.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-slate-400">Carregando...</div>
        </div>
      )}

      {/* Notes list */}
      {!isLoading && notes && (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {note.note_type}
                    </span>
                    {note.report_type && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {note.report_type}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-medium text-slate-900">{note.title}</h3>
                  {note.body && (
                    <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{note.body}</p>
                  )}
                  <div className="mt-2 flex gap-4 text-xs text-slate-400">
                    <span>Criado: {new Date(note.created_at).toLocaleDateString('pt-BR')}</span>
                    {note.reference_date && (
                      <span>Referencia: {new Date(note.reference_date).toLocaleDateString('pt-BR')}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(note)}>
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(note.id)} className="text-red-500">
                    Inativar
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {notes.length === 0 && (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200">
              <p className="text-sm text-slate-500">Nenhuma nota encontrada.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}