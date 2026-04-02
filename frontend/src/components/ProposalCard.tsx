'use client'

import { useState } from 'react'
import type { Proposta } from '@/lib/types'

interface ProposalCardProps {
  proposta: Proposta
  mode: 'manager' | 'cliente'
  progettoId: string
  onToggleSelect: (id: number, selected: boolean) => void
  onUpdate?: (id: number, updates: Partial<Proposta>) => void
  onDelete?: (id: number) => void
}

export default function ProposalCard({ proposta, mode, progettoId, onToggleSelect, onUpdate, onDelete }: ProposalCardProps) {
  const [editing, setEditing] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [emailData, setEmailData] = useState<{ to: string; subject: string; body: string } | null>(null)
  const [editData, setEditData] = useState({
    costo_reale: proposta.costo_reale ?? proposta.prezzo_stimato ?? 0,
    note: proposta.note ?? '',
  })

  const isSelected = mode === 'manager' ? proposta.selezionato_manager : proposta.selezionato_cliente

  const handleSendEmail = async () => {
    setEmailLoading(true)
    try {
      const res = await fetch('/api/invia-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposta_id: proposta.id, progetto_id: progettoId }),
      })
      const data = await res.json()
      if (data.email) {
        setEmailData(data.email)
        setShowEmail(true)
      }
    } catch {
      alert('Errore nella generazione email')
    }
    setEmailLoading(false)
  }

  const openMailto = () => {
    if (!emailData) return
    const mailto = `mailto:${encodeURIComponent(emailData.to)}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`
    window.open(mailto, '_blank')
  }

  const copyEmail = () => {
    if (!emailData) return
    const text = `A: ${emailData.to}\nOggetto: ${emailData.subject}\n\n${emailData.body}`
    navigator.clipboard.writeText(text)
    alert('Email copiata negli appunti!')
  }

  // Usa pro/contro se disponibili, altrimenti fallback a punti_forza
  const pro = proposta.pro?.length > 0 ? proposta.pro : proposta.punti_forza || []
  const contro = proposta.contro || []

  // Estrai email dal contatto
  const emailMatch = proposta.contatto?.match(/[\w.+-]+@[\w.-]+\.\w+/)
  const hasEmail = !!emailMatch

  return (
    <div className={`card-hover relative transition-all ${
      isSelected ? 'ring-2 ring-yeg-500 bg-yeg-50/30' : ''
    }`}>
      {/* Badge fonte */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {proposta.is_yeg_supplier && (
            <span className="badge bg-yeg-500 text-white text-[10px]">YEG</span>
          )}
          <span className={`badge text-[10px] ${
            proposta.fonte === 'ai' ? 'bg-purple-100 text-purple-700' :
            proposta.fonte === 'web' ? 'bg-blue-100 text-blue-700' :
            proposta.fonte === 'manager' ? 'bg-orange-100 text-orange-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {proposta.fonte === 'ai' ? 'AI' : proposta.fonte === 'web' ? 'Web' : proposta.fonte === 'yeg_db' ? 'DB YEG' : 'Manager'}
          </span>
        </div>

        {/* Adeguatezza budget */}
        {proposta.adeguatezza_budget != null && (
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  proposta.adeguatezza_budget >= 70 ? 'bg-green-500' :
                  proposta.adeguatezza_budget >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${proposta.adeguatezza_budget}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{proposta.adeguatezza_budget}%</span>
          </div>
        )}
      </div>

      {/* Info */}
      <h3 className="font-semibold text-gray-900 mb-1">{proposta.nome}</h3>
      {proposta.indirizzo && <p className="text-xs text-gray-500 mb-2">{proposta.indirizzo}</p>}
      {proposta.descrizione && <p className="text-sm text-gray-600 mb-3 line-clamp-3">{proposta.descrizione}</p>}

      {/* Motivo match */}
      {proposta.motivo_match && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
          <p className="text-xs text-blue-800">{proposta.motivo_match}</p>
        </div>
      )}

      {/* PRO */}
      {pro.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-1">Pro</p>
          <ul className="space-y-0.5">
            {pro.map((p, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-green-800">
                <span className="text-green-500 mt-0.5 flex-shrink-0">+</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CONTRO */}
      {contro.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1">Contro</p>
          <ul className="space-y-0.5">
            {contro.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-red-800">
                <span className="text-red-500 mt-0.5 flex-shrink-0">-</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prezzo */}
      <div className="flex items-center justify-between border-t pt-3 mt-3">
        <div>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input w-28 text-sm py-1"
                value={editData.costo_reale}
                onChange={e => setEditData(d => ({ ...d, costo_reale: parseFloat(e.target.value) || 0 }))}
              />
              <span className="text-xs text-gray-500">EUR</span>
            </div>
          ) : (
            <div>
              {proposta.costo_reale ? (
                <div>
                  <span className="font-semibold text-gray-900">{proposta.costo_reale.toLocaleString('it-IT')} EUR</span>
                  {proposta.prezzo_stimato && proposta.costo_reale !== proposta.prezzo_stimato && (
                    <span className="text-xs text-gray-400 line-through ml-2">{proposta.prezzo_stimato.toLocaleString('it-IT')}</span>
                  )}
                </div>
              ) : proposta.prezzo_stimato ? (
                <span className="text-gray-600">{proposta.prezzo_stimato.toLocaleString('it-IT')} EUR <span className="text-xs text-gray-400">(stima AI)</span></span>
              ) : (
                <span className="text-gray-400 text-sm">Prezzo da definire</span>
              )}
            </div>
          )}
          {proposta.capacita && <p className="text-xs text-gray-500 mt-0.5">Capacita: {proposta.capacita}</p>}
        </div>

        <div className="flex items-center gap-2">
          {proposta.sito_web && (
            <a href={proposta.sito_web} target="_blank" rel="noopener noreferrer" className="text-xs text-yeg-500 hover:underline">
              Sito
            </a>
          )}
        </div>
      </div>

      {/* Contatto */}
      {proposta.contatto && (
        <p className="text-xs text-gray-500 mt-1 truncate" title={proposta.contatto}>{proposta.contatto}</p>
      )}

      {/* Note editing */}
      {editing && (
        <div className="mt-3">
          <textarea
            className="input text-sm"
            placeholder="Note..."
            value={editData.note}
            onChange={e => setEditData(d => ({ ...d, note: e.target.value }))}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t">
        {mode === 'manager' ? (
          <>
            <div className="flex gap-2 flex-wrap">
              {editing ? (
                <>
                  <button onClick={() => { onUpdate?.(proposta.id, editData); setEditing(false) }} className="text-xs btn-primary py-1 px-3">Salva</button>
                  <button onClick={() => setEditing(false)} className="text-xs btn-ghost py-1">Annulla</button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(true)} className="text-xs btn-ghost py-1">Modifica</button>
                  <button onClick={() => onDelete?.(proposta.id)} className="text-xs text-red-500 hover:text-red-700 py-1 px-2">Rimuovi</button>
                  <button
                    onClick={handleSendEmail}
                    disabled={emailLoading}
                    className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 py-1 px-3 rounded-lg transition-colors font-medium"
                  >
                    {emailLoading ? 'Genero...' : 'Contatta'}
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => onToggleSelect(proposta.id, !isSelected)}
              className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
                isSelected ? 'bg-yeg-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isSelected ? 'Inclusa' : 'Includi'}
            </button>
          </>
        ) : (
          <button
            onClick={() => onToggleSelect(proposta.id, !isSelected)}
            className={`w-full text-sm font-medium py-2.5 rounded-lg transition-colors ${
              isSelected ? 'bg-yeg-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isSelected ? 'Selezionato' : 'Seleziona questa proposta'}
          </button>
        )}
      </div>

      {/* Email Modal */}
      {showEmail && emailData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEmail(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Email per {proposta.nome}</h3>
                <button onClick={() => setShowEmail(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-500 uppercase">Destinatario</label>
                <p className="text-sm text-gray-900 mt-0.5">{emailData.to || 'Non disponibile — inserisci manualmente'}</p>
              </div>
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-500 uppercase">Oggetto</label>
                <p className="text-sm text-gray-900 mt-0.5">{emailData.subject}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Corpo</label>
                <pre className="text-sm text-gray-700 mt-1 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border">{emailData.body}</pre>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end">
              <button onClick={copyEmail} className="btn-secondary text-sm">
                Copia testo
              </button>
              {hasEmail && (
                <button onClick={openMailto} className="btn-primary text-sm">
                  Apri in Mail
                </button>
              )}
              <button onClick={() => setShowEmail(false)} className="btn-ghost text-sm">
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
