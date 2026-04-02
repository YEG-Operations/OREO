'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { Progetto, Proposta, CategoriaServizio } from '@/lib/types'
import { CATEGORIE_LABELS } from '@/lib/types'
import CategorySection from '@/components/CategorySection'

export default function PropostaClientePage() {
  const { id: token } = useParams<{ id: string }>()
  const [progetto, setProgetto] = useState<Progetto | null>(null)
  const [proposte, setProposte] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/proposta/${token}`)
      const data = await res.json()
      setProgetto(data.progetto)
      setProposte(data.proposte || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  const toggleSelect = async (propostaId: number, selected: boolean) => {
    setProposte(prev => prev.map(p =>
      p.id === propostaId ? { ...p, selezionato_cliente: selected } : p
    ))
  }

  const conferma = async () => {
    const selezionate = proposte.filter(p => p.selezionato_cliente)
    if (selezionate.length === 0) {
      alert('Seleziona almeno una proposta per categoria.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/proposta/${token}/conferma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selezioni: selezionate.map(p => p.id) })
      })
      const data = await res.json()
      if (data.success) setConfirmed(true)
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Caricamento proposta...</div>
  if (!progetto) return <div className="min-h-screen flex items-center justify-center text-red-500">Proposta non trovata o scaduta.</div>

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Preferenze Inviate!</h1>
          <p className="text-gray-600">Grazie per aver indicato le tue preferenze. Il team YEG ti contattera a breve per finalizzare i dettagli.</p>
        </div>
      </div>
    )
  }

  const categorie = [...new Set(proposte.map(p => p.categoria))] as CategoriaServizio[]
  const selectedCount = proposte.filter(p => p.selezionato_cliente).length

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-yeg-500 rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold">Y</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Proposta per {progetto.nome_evento}</h1>
        <p className="text-gray-600">
          {progetto.citta} - {progetto.data_inizio} / {progetto.data_fine} - {progetto.numero_partecipanti} partecipanti
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Seleziona la proposta preferita per ogni categoria (puoi selezionarne anche piu di una).
        </p>
      </div>

      {/* Categorie */}
      {categorie.map(cat => (
        <CategorySection
          key={cat}
          categoria={cat}
          proposte={proposte.filter(p => p.categoria === cat)}
          mode="cliente"
          progettoId={progetto.id}
          onToggleSelect={toggleSelect}
        />
      ))}

      {/* Conferma */}
      <div className="sticky bottom-0 bg-white border-t shadow-lg p-4 mt-8 -mx-4 flex items-center justify-between">
        <span className="text-sm text-gray-600">
          {selectedCount} {selectedCount === 1 ? 'proposta selezionata' : 'proposte selezionate'}
        </span>
        <button onClick={conferma} disabled={submitting || selectedCount === 0} className="btn-primary">
          {submitting ? 'Invio...' : 'Conferma Preferenze'}
        </button>
      </div>
    </div>
  )
}
