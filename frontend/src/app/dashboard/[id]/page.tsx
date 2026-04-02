'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { Progetto, Proposta, CategoriaServizio } from '@/lib/types'
import { STATI_LABELS, STATI_COLORS, CATEGORIE_LABELS } from '@/lib/types'
import BriefSummary from '@/components/BriefSummary'
import CategorySection from '@/components/CategorySection'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [progetto, setProgetto] = useState<Progetto | null>(null)
  const [proposte, setProposte] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tab, setTab] = useState<'proposte' | 'brief'>('proposte')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/progetti/${id}`)
      const data = await res.json()
      setProgetto(data.progetto)
      setProposte(data.proposte || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Auto-poll se il progetto è "nuovo" (AI sta generando)
  useEffect(() => {
    if (progetto?.stato !== 'nuovo') return
    const interval = setInterval(() => { load() }, 15000)
    return () => clearInterval(interval)
  }, [progetto?.stato, load])

  const toggleSelect = async (propostaId: number, selected: boolean) => {
    setProposte(prev => prev.map(p =>
      p.id === propostaId ? { ...p, selezionato_manager: selected } : p
    ))
    await fetch(`/api/progetti/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione: 'toggle_proposta', proposta_id: propostaId, selezionato_manager: selected })
    })
  }

  const updateProposta = async (propostaId: number, updates: Partial<Proposta>) => {
    setProposte(prev => prev.map(p =>
      p.id === propostaId ? { ...p, ...updates } : p
    ))
    await fetch(`/api/progetti/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione: 'update_proposta', proposta_id: propostaId, ...updates })
    })
  }

  const deleteProposta = async (propostaId: number) => {
    if (!confirm('Rimuovere questa proposta?')) return
    setProposte(prev => prev.filter(p => p.id !== propostaId))
    await fetch(`/api/progetti/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione: 'delete_proposta', proposta_id: propostaId })
    })
  }

  const addManual = async (categoria: CategoriaServizio) => {
    const nome = prompt('Nome fornitore/proposta:')
    if (!nome) return
    const res = await fetch(`/api/progetti/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        azione: 'add_proposta',
        proposta: { categoria, nome, fonte: 'manager', selezionato_manager: true }
      })
    })
    const data = await res.json()
    if (data.proposta) setProposte(prev => [...prev, data.proposta])
  }

  const rigeneraProposte = async () => {
    if (!confirm('Vuoi rigenerare le proposte AI? Le proposte AI esistenti verranno sostituite.')) return
    setGenerating(true)

    // Fire & forget — la generazione AI impiega 2-3 minuti
    fetch('/api/genera-proposte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progetto_id: id }),
    }).catch(() => {})

    // Poll ogni 10 secondi per vedere se le proposte sono arrivate
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/progetti/${id}`)
        const data = await res.json()
        if (data.proposte && data.proposte.length > 0) {
          const hasAI = data.proposte.some((p: Proposta) => p.fonte === 'ai' || p.fonte === 'yeg_db')
          if (hasAI) {
            setProgetto(data.progetto)
            setProposte(data.proposte)
            setGenerating(false)
            clearInterval(poll)
          }
        }
      } catch { /* ignore */ }
    }, 10000)

    // Timeout dopo 5 minuti
    setTimeout(() => {
      clearInterval(poll)
      setGenerating(false)
      load() // ricarica comunque
    }, 300000)
  }

  const inviaAlCliente = async () => {
    const selezionate = proposte.filter(p => p.selezionato_manager)
    if (selezionate.length === 0) {
      alert('Seleziona almeno una proposta da inviare al cliente.')
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/api/progetti/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ azione: 'invia_al_cliente' })
      })
      const data = await res.json()
      if (data.success) {
        setProgetto(prev => prev ? { ...prev, stato: 'inviato' } : null)
        const link = `${window.location.origin}/proposta/${progetto?.token_cliente}`
        await navigator.clipboard.writeText(link).catch(() => {})
        alert(`Proposta inviata! Link copiato:\n${link}`)
      }
    } catch { /* ignore */ }
    setSending(false)
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Caricamento...</div>
  if (!progetto) return <div className="text-center py-16 text-red-500">Progetto non trovato</div>

  // Raggruppa proposte per categoria
  const categorie = [...new Set(proposte.map(p => p.categoria))] as CategoriaServizio[]
  const selectedCount = proposte.filter(p => p.selezionato_manager).length
  const totaleBudget = proposte.filter(p => p.selezionato_manager).reduce((s, p) => s + (p.costo_reale || p.prezzo_stimato || 0), 0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{progetto.nome_evento}</h1>
            <span className={`badge ${STATI_COLORS[progetto.stato]}`}>{STATI_LABELS[progetto.stato]}</span>
          </div>
          <p className="text-gray-600">
            {progetto.azienda} - {progetto.citta} - {progetto.numero_partecipanti} partecipanti
            {progetto.budget_totale > 0 && ` - Budget: ${progetto.budget_totale.toLocaleString('it-IT')} EUR`}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={rigeneraProposte} disabled={generating} className="btn-secondary">
            {generating ? 'Generazione AI in corso...' : 'Rigenera Proposte AI'}
          </button>
          {progetto.stato !== 'inviato' && progetto.stato !== 'confermato' && (
            <button onClick={inviaAlCliente} disabled={sending || selectedCount === 0} className="btn-primary">
              {sending ? 'Invio...' : `Invia al Cliente (${selectedCount} proposte)`}
            </button>
          )}
          {progetto.token_cliente && progetto.stato === 'inviato' && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/proposta/${progetto.token_cliente}`)
                alert('Link copiato!')
              }}
              className="btn-secondary"
            >
              Copia Link Proposta
            </button>
          )}
        </div>
      </div>

      {/* Budget bar */}
      {progetto.budget_totale > 0 && (
        <div className="card mb-6 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600">Budget:</span>
          <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${totaleBudget <= progetto.budget_totale ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, (totaleBudget / progetto.budget_totale) * 100)}%` }}
            />
          </div>
          <span className={`text-sm font-semibold ${totaleBudget <= progetto.budget_totale ? 'text-green-600' : 'text-red-600'}`}>
            {totaleBudget.toLocaleString('it-IT')} / {progetto.budget_totale.toLocaleString('it-IT')} EUR
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('proposte')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'proposte' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
          Proposte ({proposte.length})
        </button>
        <button onClick={() => setTab('brief')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'brief' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
          Brief
        </button>
      </div>

      {/* Content */}
      {tab === 'brief' ? (
        <div className="max-w-2xl">
          <BriefSummary progetto={progetto} showRaw />
        </div>
      ) : (
        <div>
          {categorie.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              {progetto.stato === 'nuovo' || generating ? (
                <>
                  <div className="animate-pulse mb-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6 text-purple-500 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    </div>
                  </div>
                  <p className="mb-1 text-gray-600 font-medium">AI sta generando le proposte...</p>
                  <p className="text-sm mb-4">Qwen sta analizzando il brief e cercando fornitori. Ci vogliono 2-3 minuti.</p>
                  <button onClick={load} className="btn-secondary text-sm">Ricarica</button>
                </>
              ) : (
                <>
                  <p className="mb-2">Nessuna proposta ancora.</p>
                  <button onClick={rigeneraProposte} className="btn-primary text-sm">Genera Proposte AI</button>
                </>
              )}
            </div>
          ) : (
            categorie.map(cat => (
              <CategorySection
                key={cat}
                categoria={cat}
                proposte={proposte.filter(p => p.categoria === cat)}
                mode="manager"
                progettoId={progetto.id}
                onToggleSelect={toggleSelect}
                onUpdate={updateProposta}
                onDelete={deleteProposta}
                onAddManual={addManual}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
