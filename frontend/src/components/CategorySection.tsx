'use client'

import { useState } from 'react'
import type { Proposta, CategoriaServizio } from '@/lib/types'
import { CATEGORIE_LABELS } from '@/lib/types'
import ProposalCard from './ProposalCard'

interface CategorySectionProps {
  categoria: CategoriaServizio
  proposte: Proposta[]
  mode: 'manager' | 'cliente'
  progettoId: string
  markup?: number          // % markup sul costo interno
  iva?: number             // % IVA
  nascondiFornitore?: boolean  // true = mostra nome generico in cliente mode
  onToggleSelect: (id: number, selected: boolean) => void
  onUpdate?: (id: number, updates: Partial<Proposta>) => void
  onDelete?: (id: number) => void
  onAddManual?: (categoria: CategoriaServizio) => void
}

const CAT_COLORS: Record<string, string> = {
  location: 'border-l-purple-500',
  catering: 'border-l-orange-500',
  hotel: 'border-l-blue-500',
  trasporti: 'border-l-green-500',
  dmc: 'border-l-cyan-500',
  entertainment: 'border-l-pink-500',
  teambuilding: 'border-l-teal-500',
  allestimenti: 'border-l-amber-500',
  ristoranti: 'border-l-red-500',
  servizi_professionali: 'border-l-indigo-500',
}

export default function CategorySection({
  categoria, proposte, mode, progettoId,
  markup = 0, iva = 0, nascondiFornitore = false,
  onToggleSelect, onUpdate, onDelete, onAddManual
}: CategorySectionProps) {
  const [collapsed, setCollapsed] = useState(false)

  const selected = proposte.filter(p => mode === 'manager' ? p.selezionato_manager : p.selezionato_cliente)

  // Totali costo interno
  const totaleInternoSelected = selected.reduce((sum, p) => sum + (p.costo_reale || p.prezzo_stimato || 0), 0)
  // Totale con markup
  const totalePrezzoCliente = totaleInternoSelected * (1 + markup / 100)

  return (
    <div className={`border-l-4 ${CAT_COLORS[categoria] || 'border-l-gray-400'} bg-white rounded-r-xl shadow-sm mb-6`}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">{CATEGORIE_LABELS[categoria]}</h2>
          <span className="badge bg-gray-100 text-gray-600">{proposte.length} proposte</span>
          {selected.length > 0 && (
            <span className="badge bg-yeg-100 text-yeg-700">{selected.length} selezionate</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {mode === 'manager' && totaleInternoSelected > 0 && (
            <div className="text-right">
              <div className="text-sm font-medium text-gray-600">
                Interno: {totaleInternoSelected.toLocaleString('it-IT')} EUR
              </div>
              {markup > 0 && (
                <div className="text-xs text-blue-600 font-medium">
                  Cliente: {totalePrezzoCliente.toLocaleString('it-IT')} EUR
                </div>
              )}
            </div>
          )}
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="px-5 pb-5">
          {mode === 'manager' && (
            <div className="flex items-center justify-between mb-4 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
              <span>
                Stima tot. categoria: {proposte.reduce((s, p) => s + (p.prezzo_stimato || 0), 0).toLocaleString('it-IT')} EUR
                {markup > 0 && ` → cliente: ${(proposte.reduce((s, p) => s + (p.prezzo_stimato || 0), 0) * (1 + markup / 100)).toLocaleString('it-IT')} EUR`}
              </span>
              {onAddManual && (
                <button onClick={() => onAddManual(categoria)} className="text-yeg-500 font-medium hover:underline">
                  + Aggiungi proposta
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {proposte.map((p, idx) => (
              <ProposalCard
                key={p.id}
                proposta={p}
                mode={mode}
                progettoId={progettoId}
                markup={markup}
                iva={iva}
                nascondiFornitore={nascondiFornitore}
                displayIndex={idx}
                onToggleSelect={onToggleSelect}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </div>

          {proposte.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              Nessuna proposta per questa categoria.
              {mode === 'manager' && onAddManual && (
                <button onClick={() => onAddManual(categoria)} className="block mx-auto mt-2 text-yeg-500 font-medium hover:underline">
                  Aggiungi la prima proposta
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
