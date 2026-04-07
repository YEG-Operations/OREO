'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { Progetto, Proposta, CategoriaServizio } from '@/lib/types'
import { STATI_LABELS, STATI_COLORS, CATEGORIE_LABELS, MARKUP_STANDARD } from '@/lib/types'
import BriefSummary from '@/components/BriefSummary'
import CategorySection from '@/components/CategorySection'

// Modal per aggiunta proposta manuale con ricerca AI opzionale
function AddPropostaModal({
  categoria,
  progettoId,
  onClose,
  onAdded,
}: {
  categoria: CategoriaServizio
  progettoId: string
  onClose: () => void
  onAdded: (proposte: Proposta[]) => void
}) {
  const [nome, setNome] = useState('')
  const [parametri, setParametri] = useState('')
  const [cercando, setCercando] = useState(false)
  const [aggiungo, setAggiungo] = useState(false)

  const cercaConAI = async () => {
    setCercando(true)
    try {
      const res = await fetch('/api/cerca-proposta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progetto_id: progettoId, categoria, parametri_extra: parametri }),
      })
      const data = await res.json()
      if (data.proposte?.length > 0) {
        onAdded(data.proposte)
        onClose()
      } else {
        alert('Nessuna proposta trovata. Prova a modificare i parametri.')
      }
    } catch {
      alert('Errore nella ricerca AI')
    }
    setCercando(false)
  }

  const aggiungiManuale = async () => {
    if (!nome.trim()) return
    setAggiungo(true)
    try {
      const res = await fetch(`/api/progetti/${progettoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azione: 'add_proposta',
          proposta: { categoria, nome: nome.trim(), fonte: 'manager', selezionato_manager: true },
        }),
      })
      const data = await res.json()
      if (data.proposta) {
        onAdded([data.proposta])
        onClose()
      }
    } catch {
      alert('Errore nell\'aggiunta')
    }
    setAggiungo(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Aggiungi proposta — {CATEGORIE_LABELS[categoria]}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Ricerca AI */}
          <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
            <h4 className="font-medium text-purple-900 mb-1">Ricerca AI</h4>
            <p className="text-xs text-purple-700 mb-3">Descrivi requisiti specifici e l&apos;AI cercherà 3 fornitori pertinenti</p>
            <textarea
              className="w-full text-sm border border-purple-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              rows={3}
              placeholder="Es: hotel 5 stelle con spa, vista lago, almeno 150 camere..."
              value={parametri}
              onChange={e => setParametri(e.target.value)}
            />
            <button
              onClick={cercaConAI}
              disabled={cercando}
              className="mt-2 w-full text-sm bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
            >
              {cercando ? 'Ricerca AI in corso... (attendere)' : 'Cerca con AI (3 proposte)'}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">oppure</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Aggiunta manuale */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Aggiungi manuale</h4>
            <input
              type="text"
              className="input w-full"
              placeholder="Nome fornitore o proposta..."
              value={nome}
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && aggiungiManuale()}
            />
            <button
              onClick={aggiungiManuale}
              disabled={!nome.trim() || aggiungo}
              className="mt-2 w-full text-sm btn-secondary disabled:opacity-50"
            >
              {aggiungo ? 'Aggiunta...' : 'Aggiungi scheda vuota'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Pannello impostazioni costi
function CostSettingsPanel({
  progetto,
  onSave,
}: {
  progetto: Progetto
  onSave: (updates: Partial<Progetto>) => void
}) {
  const [markup, setMarkup] = useState(progetto.markup_percentuale ?? 0)
  const [iva, setIva] = useState(progetto.iva_percentuale ?? 22)
  const [fee, setFee] = useState(progetto.fee_agenzia_percentuale ?? 0)
  const [frasi, setFrasi] = useState(progetto.frasi_standard_costi ?? '')
  const [nascondi, setNascondi] = useState(progetto.nascondi_fornitori ?? true)
  const [emailOp, setEmailOp] = useState(progetto.email_operatore ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const updates = {
      markup_percentuale: markup,
      iva_percentuale: iva,
      fee_agenzia_percentuale: fee,
      frasi_standard_costi: frasi,
      nascondi_fornitori: nascondi,
      email_operatore: emailOp,
    }
    await fetch(`/api/progetti/${progetto.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione: 'update_settings', ...updates }),
    })
    onSave(updates)
    setSaving(false)
  }

  return (
    <div className="card mb-6 space-y-5">
      <h3 className="font-semibold text-gray-900 text-base">Impostazioni Costi & Output</h3>

      {/* Operatore */}
      <div>
        <label className="label text-xs">Email Operatore YEG</label>
        <input type="email" className="input" value={emailOp} onChange={e => setEmailOp(e.target.value)}
          placeholder="operatore@yegevents.it" />
        <p className="text-xs text-gray-400 mt-1">Usato come mittente nelle richieste ai fornitori</p>
      </div>

      {/* Markup */}
      <div>
        <label className="label text-xs">Markup sul costo interno (%)</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {MARKUP_STANDARD.map(m => (
            <button key={m} onClick={() => setMarkup(m)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                markup === m ? 'bg-yeg-500 text-white border-yeg-500' : 'border-gray-300 hover:border-yeg-300'
              }`}>
              {m}%
            </button>
          ))}
          <span className="text-xs text-gray-400 self-center">o custom:</span>
          <input type="number" className="input w-24 text-sm py-1" value={markup} min={0} max={100} step={0.5}
            onChange={e => setMarkup(parseFloat(e.target.value) || 0)} />
        </div>
        <p className="text-xs text-gray-400">Prezzo cliente = costo interno × (1 + {markup}%)</p>
      </div>

      {/* IVA */}
      <div>
        <label className="label text-xs">IVA (%)</label>
        <div className="flex items-center gap-3">
          {[0, 10, 22].map(v => (
            <button key={v} onClick={() => setIva(v)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                iva === v ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-300 hover:border-gray-400'
              }`}>
              {v === 0 ? 'Esente' : `${v}%`}
            </button>
          ))}
          <input type="number" className="input w-20 text-sm py-1" value={iva} min={0} max={100}
            onChange={e => setIva(parseFloat(e.target.value) || 0)} />
        </div>
      </div>

      {/* Fee agenzia */}
      <div>
        <label className="label text-xs">Fee agenzia sul totale (%)</label>
        <div className="flex items-center gap-2">
          <input type="number" className="input w-28" value={fee} min={0} max={100} step={0.5}
            onChange={e => setFee(parseFloat(e.target.value) || 0)} />
          <span className="text-sm text-gray-500">% applicata al totale progetto</span>
        </div>
      </div>

      {/* Nascondi fornitori */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={nascondi} onChange={e => setNascondi(e.target.checked)}
            className="w-4 h-4 rounded text-yeg-500" />
          <div>
            <div className="text-sm font-medium text-gray-900">Nascondi nomi fornitori nella proposta al cliente</div>
            <div className="text-xs text-gray-500">Appariranno come &quot;Fornitore A&quot;, ecc. Hotel e Location mostrano sempre il nome reale.</div>
          </div>
        </label>
      </div>

      {/* Frasi standard costi */}
      <div>
        <label className="label text-xs">Frasi standard sezione costi</label>
        <textarea className="input min-h-[80px] text-sm" value={frasi} onChange={e => setFrasi(e.target.value)}
          placeholder="Es: La presente quotazione è valida per le numeriche indicate. I costi sono da intendersi al netto di IVA. Validità offerta: 30 giorni." />
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
          {saving ? 'Salvataggio...' : 'Salva Impostazioni'}
        </button>
      </div>
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [progetto, setProgetto] = useState<Progetto | null>(null)
  const [proposte, setProposte] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tab, setTab] = useState<'proposte' | 'brief' | 'costi'>('proposte')
  const [showCostSettings, setShowCostSettings] = useState(false)
  const [addModal, setAddModal] = useState<CategoriaServizio | null>(null)

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

  const addManual = (categoria: CategoriaServizio) => {
    setAddModal(categoria)
  }

  const onProposteAdded = (nuove: Proposta[]) => {
    setProposte(prev => [...prev, ...nuove])
  }

  const rigeneraProposte = async () => {
    if (!confirm('Vuoi rigenerare le proposte AI? Le proposte AI esistenti verranno sostituite.')) return
    setGenerating(true)

    fetch('/api/genera-proposte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progetto_id: id }),
    }).catch(() => {})

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

    setTimeout(() => {
      clearInterval(poll)
      setGenerating(false)
      load()
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

  const markup = progetto.markup_percentuale ?? 0
  const iva = progetto.iva_percentuale ?? 22

  // Raggruppa proposte per categoria
  const categorie = [...new Set(proposte.map(p => p.categoria))] as CategoriaServizio[]
  const selectedCount = proposte.filter(p => p.selezionato_manager).length

  // Calcola totale con markup e IVA
  const totaleCostoInterno = proposte
    .filter(p => p.selezionato_manager)
    .reduce((s, p) => s + (p.costo_reale || p.prezzo_stimato || 0), 0)
  const totalePrezzoCliente = totaleCostoInterno * (1 + markup / 100)
  const totalePrezzoConIva = totalePrezzoCliente * (1 + iva / 100)

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
            {progetto.azienda} · {progetto.citta} · {progetto.numero_partecipanti} partecipanti
            {progetto.budget_totale > 0 && ` · Budget: ${progetto.budget_totale.toLocaleString('it-IT')} EUR`}
          </p>
          {progetto.email_operatore && (
            <p className="text-xs text-gray-400 mt-0.5">Operatore: {progetto.email_operatore}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={() => setShowCostSettings(s => !s)} className="btn-ghost text-sm">
            Impostazioni Costi
          </button>
          <button onClick={rigeneraProposte} disabled={generating} className="btn-secondary text-sm">
            {generating ? 'Generazione AI...' : 'Rigenera Proposte AI'}
          </button>
          {progetto.stato !== 'inviato' && progetto.stato !== 'confermato' && (
            <button onClick={inviaAlCliente} disabled={sending || selectedCount === 0} className="btn-primary text-sm">
              {sending ? 'Invio...' : `Invia al Cliente (${selectedCount})`}
            </button>
          )}
          {progetto.token_cliente && progetto.stato === 'inviato' && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/proposta/${progetto.token_cliente}`)
                alert('Link copiato!')
              }}
              className="btn-secondary text-sm"
            >
              Copia Link Proposta
            </button>
          )}
        </div>
      </div>

      {/* Pannello impostazioni costi (collassabile) */}
      {showCostSettings && progetto && (
        <CostSettingsPanel
          progetto={progetto}
          onSave={updates => setProgetto(prev => prev ? { ...prev, ...updates } : null)}
        />
      )}

      {/* Budget bar / Riepilogo costi */}
      {totaleCostoInterno > 0 && (
        <div className="card mb-6">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-sm font-medium text-gray-600 w-32">Costo interno:</span>
            <span className="text-sm font-semibold text-gray-900">
              {totaleCostoInterno.toLocaleString('it-IT')} EUR
            </span>
          </div>
          {markup > 0 && (
            <div className="flex items-center gap-4 mb-3">
              <span className="text-sm font-medium text-gray-600 w-32">Prezzo cliente ({markup}%):</span>
              <span className="text-sm font-semibold text-blue-700">
                {totalePrezzoCliente.toLocaleString('it-IT')} EUR
              </span>
            </div>
          )}
          {iva > 0 && (
            <div className="flex items-center gap-4 mb-3">
              <span className="text-sm font-medium text-gray-600 w-32">Con IVA ({iva}%):</span>
              <span className="text-sm font-semibold text-gray-700">
                {totalePrezzoConIva.toLocaleString('it-IT')} EUR
              </span>
            </div>
          )}
          {progetto.budget_totale > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-600 w-32">Budget cliente:</span>
              <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${totalePrezzoCliente <= progetto.budget_totale ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, (totalePrezzoCliente / progetto.budget_totale) * 100)}%` }}
                />
              </div>
              <span className={`text-sm font-semibold ${totalePrezzoCliente <= progetto.budget_totale ? 'text-green-600' : 'text-red-600'}`}>
                {totalePrezzoCliente.toLocaleString('it-IT')} / {progetto.budget_totale.toLocaleString('it-IT')} EUR
              </span>
            </div>
          )}
          {progetto.frasi_standard_costi && (
            <div className="mt-3 pt-3 border-t text-xs text-gray-500 italic">
              {progetto.frasi_standard_costi}
            </div>
          )}
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
                markup={markup}
                iva={iva}
                onToggleSelect={toggleSelect}
                onUpdate={updateProposta}
                onDelete={deleteProposta}
                onAddManual={addManual}
              />
            ))
          )}
        </div>
      )}

      {/* Modal aggiunta proposta */}
      {addModal && (
        <AddPropostaModal
          categoria={addModal}
          progettoId={progetto.id}
          onClose={() => setAddModal(null)}
          onAdded={onProposteAdded}
        />
      )}
    </div>
  )
}
