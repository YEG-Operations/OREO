'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Progetto, StatoProgetto } from '@/lib/types'
import { STATI_LABELS, STATI_COLORS } from '@/lib/types'

export default function DashboardPage() {
  const [progetti, setProgetti] = useState<Progetto[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStato, setFiltroStato] = useState<StatoProgetto | 'tutti'>('tutti')

  useEffect(() => {
    fetch('/api/progetti')
      .then(r => r.json())
      .then(data => setProgetti(data.progetti || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = filtroStato === 'tutti' ? progetti : progetti.filter(p => p.stato === filtroStato)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Progetti</h1>
          <p className="text-gray-600 mt-1">{progetti.length} progetti totali</p>
        </div>
        <Link href="/brief" className="btn-primary">+ Nuovo Brief</Link>
      </div>

      {/* Filtri */}
      <div className="flex gap-2 mb-6">
        {(['tutti', 'nuovo', 'in_lavorazione', 'inviato', 'confermato', 'archiviato'] as const).map(stato => (
          <button
            key={stato}
            onClick={() => setFiltroStato(stato)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtroStato === stato ? 'bg-yeg-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'
            }`}
          >
            {stato === 'tutti' ? 'Tutti' : STATI_LABELS[stato]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">Nessun progetto trovato</p>
          <Link href="/brief" className="btn-secondary">Crea il primo brief</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <Link key={p.id} href={`/dashboard/${p.id}`} className="card-hover flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-yeg-500 transition-colors">{p.nome_evento || 'Senza nome'}</h3>
                    <span className={`badge ${STATI_COLORS[p.stato]}`}>{STATI_LABELS[p.stato]}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{p.azienda || p.nome_referente}</span>
                    <span>{p.citta}</span>
                    <span>{p.numero_partecipanti} pax</span>
                    {p.budget_totale > 0 && <span>{p.budget_totale.toLocaleString('it-IT')} EUR</span>}
                  </div>
                </div>
              </div>
              <div className="text-right text-sm text-gray-400">
                <div>{p.data_inizio}</div>
                <div className="text-xs">{new Date(p.created_at).toLocaleDateString('it-IT')}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
