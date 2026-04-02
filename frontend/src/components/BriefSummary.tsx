'use client'

import type { Progetto } from '@/lib/types'

interface BriefSummaryProps {
  progetto: Progetto
  showRaw?: boolean
}

export default function BriefSummary({ progetto, showRaw = false }: BriefSummaryProps) {
  const brief = progetto.brief_interpretato

  return (
    <div className="space-y-4">
      {/* Interpretazione AI */}
      {brief && (
        <div className="card bg-gradient-to-br from-yeg-50 to-white">
          <h3 className="font-semibold text-yeg-700 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Interpretazione AI
          </h3>
          <p className="text-sm text-gray-700 mb-3">{brief.sintesi}</p>

          {brief.priorita?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Priorita identificate:</p>
              <div className="flex flex-wrap gap-1">
                {brief.priorita.map((p, i) => (
                  <span key={i} className="text-xs bg-yeg-100 text-yeg-700 px-2 py-0.5 rounded-full">{p}</span>
                ))}
              </div>
            </div>
          )}

          {brief.suggerimenti_ai && (
            <div className="bg-white/60 rounded-lg p-3 mt-2">
              <p className="text-xs font-medium text-gray-500 mb-1">Suggerimenti:</p>
              <p className="text-sm text-gray-600">{brief.suggerimenti_ai}</p>
            </div>
          )}
        </div>
      )}

      {/* Dati strutturati */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">Dettagli Evento</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Evento:</span> <strong>{progetto.nome_evento}</strong></div>
          <div><span className="text-gray-500">Tipo:</span> {progetto.tipologia_evento}</div>
          <div><span className="text-gray-500">Referente:</span> {progetto.nome_referente}</div>
          <div><span className="text-gray-500">Azienda:</span> {progetto.azienda}</div>
          <div><span className="text-gray-500">Citta:</span> <strong>{progetto.citta}</strong></div>
          <div><span className="text-gray-500">Partecipanti:</span> <strong>{progetto.numero_partecipanti}</strong></div>
          <div><span className="text-gray-500">Date:</span> {progetto.data_inizio} - {progetto.data_fine}</div>
          <div><span className="text-gray-500">Budget:</span> <strong>{progetto.budget_totale ? `${progetto.budget_totale.toLocaleString('it-IT')} EUR` : 'Da definire'}</strong></div>
        </div>

        {progetto.componenti_richieste?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t">
            {progetto.componenti_richieste.map(c => (
              <span key={c} className="badge bg-gray-100 text-gray-700">{c}</span>
            ))}
          </div>
        )}

        {progetto.agenda && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs font-medium text-gray-500 mb-1">Agenda:</p>
            <pre className="text-xs bg-gray-50 p-2 rounded whitespace-pre-wrap">{progetto.agenda}</pre>
          </div>
        )}
      </div>

      {/* Brief Raw (toggle) */}
      {showRaw && progetto.brief_raw && (
        <details className="card">
          <summary className="font-semibold text-gray-500 cursor-pointer text-sm">Dati grezzi form (debug)</summary>
          <pre className="text-xs bg-gray-50 p-3 rounded-lg mt-3 overflow-auto max-h-60">
            {JSON.stringify(progetto.brief_raw, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
