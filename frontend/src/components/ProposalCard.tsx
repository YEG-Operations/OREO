'use client'

import { useState } from 'react'
import type { Proposta } from '@/lib/types'
import EmailSendModal from './EmailSendModal'

interface ProposalCardProps {
  proposta: Proposta
  mode: 'manager' | 'cliente'
  progettoId: string
  markup?: number              // % markup sul costo interno
  iva?: number                 // % IVA
  nascondiFornitore?: boolean  // true = mostra nome generico in cliente mode
  displayIndex?: number        // indice per nome generico (A, B, C...)
  onToggleSelect: (id: number, selected: boolean) => void
  onUpdate?: (id: number, updates: Partial<Proposta>) => void
  onDelete?: (id: number) => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

// Categorie "struttura": mostrano sempre il nome reale (hotel/location sono identificabili)
const CATEGORIE_STRUTTURA = new Set(['hotel', 'location'])

// Campo di testo inline editabile
function EditableText({
  value, onChange, placeholder, multiline = false, className = ''
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  className?: string
}) {
  if (multiline) {
    return (
      <textarea
        className={`w-full text-sm border border-blue-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-blue-50/40 ${className}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
    )
  }
  return (
    <input
      type="text"
      className={`w-full text-sm border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50/40 ${className}`}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

// Lista editabile (pro / contro)
function EditableList({
  items, onChange, addLabel, itemClass
}: {
  items: string[]
  onChange: (items: string[]) => void
  addLabel: string
  itemClass: string
}) {
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            type="text"
            className={`flex-1 text-xs border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50/40 ${itemClass}`}
            value={item}
            onChange={e => {
              const next = [...items]
              next[i] = e.target.value
              onChange(next)
            }}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-red-400 hover:text-red-600 text-sm px-1 flex-shrink-0"
          >×</button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ''])}
        className="text-xs text-blue-500 hover:underline"
      >
        + {addLabel}
      </button>
    </div>
  )
}

export default function ProposalCard({
  proposta, mode, progettoId, markup = 0, iva = 0,
  nascondiFornitore = false, displayIndex = 0,
  onToggleSelect, onUpdate, onDelete
}: ProposalCardProps) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)

  const [editData, setEditData] = useState({
    nome: proposta.nome ?? '',
    descrizione: proposta.descrizione ?? '',
    motivo_match: proposta.motivo_match ?? '',
    pro: proposta.pro?.length > 0 ? [...proposta.pro] : [...(proposta.punti_forza || [])],
    contro: proposta.contro ? [...proposta.contro] : [],
    prezzo_stimato: proposta.prezzo_stimato ?? null as number | null,
    costo_reale: proposta.costo_reale ?? null as number | null,
    capacita: proposta.capacita ?? '',
    indirizzo: proposta.indirizzo ?? '',
    contatto: proposta.contatto ?? '',
    sito_web: proposta.sito_web ?? '',
    note: proposta.note ?? '',
    da_verificare: proposta.da_verificare ?? false,
    markup_percentuale: proposta.markup_percentuale ?? null as number | null,
    iva_percentuale: proposta.iva_percentuale ?? 22,
  })

  const isSelected = mode === 'manager' ? proposta.selezionato_manager : proposta.selezionato_cliente

  // Hotel e location sono "strutture": mostrano sempre il nome reale
  const isStruttura = CATEGORIE_STRUTTURA.has(proposta.categoria)
  // Nome visualizzato in cliente mode
  const nomeDisplay = (mode === 'cliente' && nascondiFornitore && !isStruttura)
    ? `Fornitore ${LETTERS[displayIndex % LETTERS.length]}`
    : proposta.nome

  // Markup e IVA effettivi: usa il valore della card se impostato, altrimenti il default progetto
  const markupEffettivo = editData.markup_percentuale ?? markup
  const ivaEffettiva = editData.iva_percentuale ?? iva

  // Calcola prezzi
  const costoInterno = proposta.costo_reale || proposta.prezzo_stimato || null
  const prezzoCliente = costoInterno != null ? costoInterno * (1 + markupEffettivo / 100) : null
  const prezzoConIva = prezzoCliente != null ? prezzoCliente * (1 + ivaEffettiva / 100) : null

  const handleSave = () => {
    const updates = {
      ...editData,
      punti_forza: editData.pro,
    }
    onUpdate?.(proposta.id, updates)
    setEditing(false)
    setExpanded(false)
  }

  const handleCancel = () => {
    setEditData({
      nome: proposta.nome ?? '',
      descrizione: proposta.descrizione ?? '',
      motivo_match: proposta.motivo_match ?? '',
      pro: proposta.pro?.length > 0 ? [...proposta.pro] : [...(proposta.punti_forza || [])],
      contro: proposta.contro ? [...proposta.contro] : [],
      prezzo_stimato: proposta.prezzo_stimato ?? null,
      costo_reale: proposta.costo_reale ?? null,
      capacita: proposta.capacita ?? '',
      indirizzo: proposta.indirizzo ?? '',
      contatto: proposta.contatto ?? '',
      sito_web: proposta.sito_web ?? '',
      note: proposta.note ?? '',
      da_verificare: proposta.da_verificare ?? false,
      markup_percentuale: proposta.markup_percentuale ?? null,
      iva_percentuale: proposta.iva_percentuale ?? 22,
    })
    setEditing(false)
  }

  const pro = proposta.pro?.length > 0 ? proposta.pro : proposta.punti_forza || []
  const contro = proposta.contro || []
  const hasEmail = !!proposta.contatto?.match(/[\w.+-]+@[\w.-]+\.\w+/)

  // Immagini per hotel e location
  const isStrutturaCategory = proposta.categoria === 'hotel' || proposta.categoria === 'location'
  const immagini = (proposta.immagini && proposta.immagini.length > 0)
    ? proposta.immagini
    : isStrutturaCategory && proposta.immagine_url
      ? [proposta.immagine_url]
      : []
  const [imgIndex, setImgIndex] = useState(0)

  return (
    <div className={`card-hover relative transition-all ${editing ? 'ring-2 ring-blue-400' : ''} ${isSelected ? 'ring-2 ring-yeg-500 bg-yeg-50/30' : ''}`}>

      {/* Banner AI da verificare — solo manager */}
      {mode === 'manager' && proposta.da_verificare && (
        <div className="-mx-4 -mt-4 mb-3 px-4 py-2 bg-amber-100 border-b border-amber-200 rounded-t-xl">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800">
            <span aria-hidden>⚠</span>
            Contatti da verificare (AI-generated)
          </span>
        </div>
      )}

      {/* Galleria immagini per hotel e location */}
      {isStrutturaCategory && immagini.length > 0 && !editing && (
        <div className="relative mb-3 -mx-4 -mt-4 rounded-t-xl overflow-hidden h-48 bg-gray-100">
          <img
            src={immagini[imgIndex]}
            alt={`${proposta.nome} - foto ${imgIndex + 1}`}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          {immagini.length > 1 && (
            <>
              <button
                onClick={() => setImgIndex((imgIndex - 1 + immagini.length) % immagini.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow hover:bg-white text-gray-700"
              >‹</button>
              <button
                onClick={() => setImgIndex((imgIndex + 1) % immagini.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow hover:bg-white text-gray-700"
              >›</button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {immagini.map((_, i) => (
                  <button key={i} onClick={() => setImgIndex(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === imgIndex ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Badge fonte + budget + da_verificare */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {proposta.is_yeg_supplier && <span className="badge bg-yeg-500 text-white text-[10px]">YEG</span>}
          <span className={`badge text-[10px] ${
            proposta.fonte === 'ai' ? 'bg-purple-100 text-purple-700' :
            proposta.fonte === 'web' ? 'bg-blue-100 text-blue-700' :
            proposta.fonte === 'manager' ? 'bg-orange-100 text-orange-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {proposta.fonte === 'ai' ? 'AI' : proposta.fonte === 'web' ? 'Web' : proposta.fonte === 'yeg_db' ? 'DB YEG' : 'Manager'}
          </span>
          {(proposta.da_verificare || editData.da_verificare) && (
            <span className="badge bg-yellow-100 text-yellow-700 text-[10px]">Da verificare</span>
          )}
        </div>
        {proposta.adeguatezza_budget != null && (
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${proposta.adeguatezza_budget >= 70 ? 'bg-green-500' : proposta.adeguatezza_budget >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${proposta.adeguatezza_budget}%` }} />
            </div>
            <span className="text-xs text-gray-500">{proposta.adeguatezza_budget}%</span>
          </div>
        )}
      </div>

      {/* Nome */}
      {editing ? (
        <EditableText value={editData.nome} onChange={v => setEditData(d => ({ ...d, nome: v }))} placeholder="Nome fornitore" className="font-semibold text-gray-900 mb-2" />
      ) : (
        <h3 className="font-semibold text-gray-900 mb-1">{nomeDisplay}</h3>
      )}

      {/* Indirizzo */}
      {editing ? (
        <div className="mb-2">
          <label className="text-[10px] text-gray-400 uppercase font-medium">Indirizzo</label>
          <EditableText value={editData.indirizzo} onChange={v => setEditData(d => ({ ...d, indirizzo: v }))} placeholder="Indirizzo o zona" />
        </div>
      ) : (
        proposta.indirizzo && <p className="text-xs text-gray-500 mb-2">{proposta.indirizzo}</p>
      )}

      {/* Descrizione */}
      {editing ? (
        <div className="mb-3">
          <label className="text-[10px] text-gray-400 uppercase font-medium">Descrizione</label>
          <EditableText value={editData.descrizione} onChange={v => setEditData(d => ({ ...d, descrizione: v }))} placeholder="Descrizione del servizio" multiline />
        </div>
      ) : proposta.descrizione ? (
        <div className="mb-3">
          <p className={`text-sm text-gray-600 ${expanded ? '' : 'line-clamp-3'}`}>{proposta.descrizione}</p>
          {proposta.descrizione.length > 120 && (
            <button onClick={() => setExpanded(e => !e)} className="text-xs text-yeg-500 hover:underline mt-1">
              {expanded ? 'Mostra meno' : 'Leggi tutto'}
            </button>
          )}
        </div>
      ) : null}

      {/* Motivo match */}
      {editing ? (
        <div className="mb-3">
          <label className="text-[10px] text-gray-400 uppercase font-medium">Motivo match</label>
          <EditableText value={editData.motivo_match} onChange={v => setEditData(d => ({ ...d, motivo_match: v }))} placeholder="Perché è adatto al brief" multiline />
        </div>
      ) : proposta.motivo_match ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
          <p className="text-xs text-blue-800">{proposta.motivo_match}</p>
        </div>
      ) : null}

      {/* PRO */}
      <div className="mb-2">
        <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-1">Pro</p>
        {editing ? (
          <EditableList
            items={editData.pro}
            onChange={v => setEditData(d => ({ ...d, pro: v }))}
            addLabel="Aggiungi pro"
            itemClass="text-green-800"
          />
        ) : pro.length > 0 ? (
          <ul className="space-y-0.5">
            {pro.map((p, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-green-800">
                <span className="text-green-500 mt-0.5 flex-shrink-0">+</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-gray-400 italic">Nessun pro</p>}
      </div>

      {/* CONTRO */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1">Contro</p>
        {editing ? (
          <EditableList
            items={editData.contro}
            onChange={v => setEditData(d => ({ ...d, contro: v }))}
            addLabel="Aggiungi contro"
            itemClass="text-red-800"
          />
        ) : contro.length > 0 ? (
          <ul className="space-y-0.5">
            {contro.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-red-800">
                <span className="text-red-500 mt-0.5 flex-shrink-0">-</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-gray-400 italic">Nessun contro</p>}
      </div>

      {/* Prezzi */}
      <div className="flex items-start justify-between border-t pt-3 mt-3 gap-3">
        <div className="flex-1">
          {editing ? (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-medium">Costo interno (€)</label>
                <input type="number" className="input w-full text-sm py-1 mt-0.5" value={editData.costo_reale ?? ''}
                  placeholder="0"
                  onChange={e => setEditData(d => ({ ...d, costo_reale: parseFloat(e.target.value) || null }))} />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-medium">Prezzo stimato AI (€)</label>
                <input type="number" className="input w-full text-sm py-1 mt-0.5" value={editData.prezzo_stimato ?? ''}
                  placeholder="0"
                  onChange={e => setEditData(d => ({ ...d, prezzo_stimato: parseFloat(e.target.value) || null }))} />
              </div>
              {/* Markup per singola card */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-medium">
                    Markup % <span className="normal-case text-gray-300">(vuoto = default progetto)</span>
                  </label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <input type="number" className="input flex-1 text-sm py-1" value={editData.markup_percentuale ?? ''}
                      placeholder={`${markup} (default)`} min={0} max={100} step={0.5}
                      onChange={e => setEditData(d => ({ ...d, markup_percentuale: e.target.value !== '' ? parseFloat(e.target.value) : null }))} />
                    {editData.markup_percentuale != null && (
                      <button onClick={() => setEditData(d => ({ ...d, markup_percentuale: null }))}
                        className="text-xs text-gray-400 hover:text-gray-600 px-1">×</button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-medium">IVA %</label>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {[0, 10, 22].map(v => (
                      <button key={v} onClick={() => setEditData(d => ({ ...d, iva_percentuale: v }))}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${editData.iva_percentuale === v ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-300 hover:border-gray-400'}`}>
                        {v === 0 ? 'Es.' : `${v}%`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-medium">Capacita</label>
                <EditableText value={editData.capacita} onChange={v => setEditData(d => ({ ...d, capacita: v }))} placeholder="es. 200 pax" />
              </div>
            </div>
          ) : (
            <>
              {mode === 'manager' ? (
                // Manager: vede costo interno + prezzo cliente
                <div className="space-y-1">
                  {costoInterno != null ? (
                    <>
                      <div className="text-xs text-gray-500">
                        Costo interno: <span className="font-semibold text-gray-900">{costoInterno.toLocaleString('it-IT')} EUR</span>
                        {proposta.costo_reale && proposta.prezzo_stimato && proposta.costo_reale !== proposta.prezzo_stimato && (
                          <span className="text-gray-400 line-through ml-2 text-[11px]">stima: {proposta.prezzo_stimato.toLocaleString('it-IT')}</span>
                        )}
                        {!proposta.costo_reale && <span className="text-gray-400 text-[11px] ml-1">(stima AI)</span>}
                      </div>
                      {markupEffettivo > 0 && prezzoCliente != null && (
                        <div className="text-xs text-blue-700 font-medium">
                          Cliente (+{markupEffettivo}%): {prezzoCliente.toLocaleString('it-IT')} EUR
                          {ivaEffettiva > 0 && prezzoConIva != null && (
                            <span className="text-gray-500 font-normal ml-1">→ {prezzoConIva.toLocaleString('it-IT')} EUR IVA {ivaEffettiva}%</span>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-400 text-sm">Prezzo da definire</span>
                  )}
                </div>
              ) : (
                // Cliente: vede solo prezzo con markup + IVA applicati
                <div>
                  {prezzoConIva != null && ivaEffettiva > 0 ? (
                    <span className="font-semibold text-gray-900">{prezzoConIva.toLocaleString('it-IT')} EUR <span className="text-xs text-gray-500">IVA incl.</span></span>
                  ) : prezzoCliente != null ? (
                    <span className="font-semibold text-gray-900">{prezzoCliente.toLocaleString('it-IT')} EUR</span>
                  ) : (
                    <span className="text-gray-400 text-sm">Prezzo da definire</span>
                  )}
                </div>
              )}
              {proposta.capacita && <p className="text-xs text-gray-500 mt-0.5">Capacita: {proposta.capacita}</p>}
            </>
          )}
        </div>

        {!editing && mode !== 'cliente' && proposta.sito_web && (
          <a href={proposta.sito_web} target="_blank" rel="noopener noreferrer" className="text-xs text-yeg-500 hover:underline flex-shrink-0">
            Sito
          </a>
        )}
      </div>

      {/* Contatto + sito + note */}
      {editing ? (
        <div className="mt-3 space-y-2">
          <div>
            <label className="text-[10px] text-gray-400 uppercase font-medium">Contatto (email/tel)</label>
            <EditableText value={editData.contatto} onChange={v => setEditData(d => ({ ...d, contatto: v }))} placeholder="email@esempio.it / +39 0..." />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 uppercase font-medium">Sito web</label>
            <EditableText value={editData.sito_web} onChange={v => setEditData(d => ({ ...d, sito_web: v }))} placeholder="https://..." />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 uppercase font-medium">Note interne</label>
            <EditableText value={editData.note} onChange={v => setEditData(d => ({ ...d, note: v }))} placeholder="Note private per il manager" multiline />
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editData.da_verificare}
                onChange={e => setEditData(d => ({ ...d, da_verificare: e.target.checked }))}
                className="rounded" />
              <span className="text-xs text-gray-600">Da verificare (es. disponibilità hotel)</span>
            </label>
          </div>
        </div>
      ) : (
        <>
          {mode !== 'cliente' && proposta.contatto && (
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 truncate" title={proposta.contatto}>
              <span className="truncate">{proposta.contatto}</span>
              {proposta.email_verified === true && (
                <span className="text-green-600 flex-shrink-0" title="Email verificata via MX" aria-label="Email verificata">✓</span>
              )}
              {proposta.email_verified === false && (
                <span
                  className="text-red-500 flex-shrink-0"
                  title={proposta.email_verification_error || 'Email non valida'}
                  aria-label="Email non valida"
                >✗</span>
              )}
            </p>
          )}
          {mode !== 'cliente' && proposta.note && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2">{proposta.note}</p>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t">
        {mode === 'manager' ? (
          <>
            <div className="flex gap-2 flex-wrap">
              {editing ? (
                <>
                  <button type="button" onClick={handleSave} className="text-xs btn-primary py-1 px-3">Salva</button>
                  <button type="button" onClick={handleCancel} className="text-xs btn-ghost py-1">Annulla</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { setEditing(true); setExpanded(true) }} className="text-xs btn-ghost py-1">Modifica</button>
                  <button type="button" onClick={() => onDelete?.(proposta.id)} className="text-xs text-red-500 hover:text-red-700 py-1 px-2">Rimuovi</button>
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(true)}
                    disabled={!hasEmail}
                    title={hasEmail ? 'Componi e invia email al fornitore' : 'Nessuna email nei contatti'}
                    className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed py-1 px-3 rounded-lg transition-colors font-medium"
                  >
                    Contatta
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => onToggleSelect(proposta.id, !isSelected)}
              className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${isSelected ? 'bg-yeg-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {isSelected ? 'Inclusa' : 'Includi'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onToggleSelect(proposta.id, !isSelected)}
            className={`w-full text-sm font-medium py-2.5 rounded-lg transition-colors ${isSelected ? 'bg-yeg-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {isSelected ? 'Selezionato' : 'Seleziona questa proposta'}
          </button>
        )}
      </div>

      {/* Email Modal (nuovo flusso con verifica MX e override) */}
      {showEmailModal && (
        <EmailSendModal
          proposta={proposta}
          progettoId={progettoId}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  )
}
