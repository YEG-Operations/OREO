'use client'

/**
 * Upload del brief cliente (PDF / Word) con estrazione automatica dei campi.
 *
 * Il componente non compila il form da sé: passa il patch al parent, che decide
 * come applicarlo. I campi riconosciuti vengono mostrati esplicitamente perché
 * l'operatore sappia cosa è stato scritto dall'AI e debba comunque rivederlo.
 */

import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react'
import { BRIEF_FIELD_LABELS } from '@/lib/brief-options'
import type { BriefFormData } from '@/lib/types'

const ACCEPT = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

export interface BriefUploadResult {
  nome: string
  campi: string[]
  avvisi: string[]
}

interface BriefUploadProps {
  onExtracted: (
    patch: Partial<BriefFormData>,
    meta: { nome: string; testo: string; campi: string[] }
  ) => void
  disabled?: boolean
}

interface EstraiResponse {
  success?: boolean
  error?: string
  file?: { nome: string; tipo: string; caratteri: number; troncato: boolean }
  dati?: Partial<BriefFormData>
  campi?: string[]
  avvisi?: string[]
  testo?: string
}

export default function BriefUpload({ onExtracted, disabled }: BriefUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BriefUploadResult | null>(null)

  const upload = async (file: File) => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const body = new FormData()
      body.append('file', file)

      const res = await fetch('/api/brief/estrai', { method: 'POST', body })
      const data: EstraiResponse = await res.json().catch(() => ({}))

      if (!res.ok || !data.success) {
        setError(data.error || 'Estrazione non riuscita. Compila il form manualmente.')
        return
      }

      const campi = data.campi ?? []
      setResult({ nome: data.file?.nome ?? file.name, campi, avvisi: data.avvisi ?? [] })
      onExtracted(data.dati ?? {}, {
        nome: data.file?.nome ?? file.name,
        testo: data.testo ?? '',
        campi,
      })
    } catch {
      setError('Errore di connessione durante il caricamento del documento.')
    } finally {
      setLoading(false)
      // Permette di ricaricare lo stesso file dopo una correzione.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled || loading) return
    const file = e.dataTransfer.files?.[0]
    if (file) void upload(file)
  }

  // --- Esito estrazione
  if (result) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-green-900 flex items-center gap-2">
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate">{result.nome}</span>
            </p>
            <p className="text-sm text-green-800 mt-0.5">
              {result.campi.length > 0
                ? `${result.campi.length} campi precompilati dal documento — verificali prima di inviare.`
                : 'Nessun campo riconosciuto: compila il form manualmente.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setResult(null); setError('') }}
            className="text-green-700 hover:text-green-900 p-1 rounded"
            title="Carica un altro documento"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {result.campi.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {result.campi.slice(0, 14).map((c) => (
              <span key={c} className="badge bg-white text-green-800 border border-green-200">
                {BRIEF_FIELD_LABELS[c] ?? c}
              </span>
            ))}
            {result.campi.length > 14 && (
              <span className="badge bg-white text-green-700 border border-green-200">
                +{result.campi.length - 14} altri
              </span>
            )}
          </div>
        )}

        {result.avvisi.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm font-medium text-amber-900 flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-4 h-4" /> Da verificare
            </p>
            <ul className="text-sm text-amber-800 list-disc list-inside space-y-0.5">
              {result.avvisi.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // --- Dropzone
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled && !loading) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => { if (!disabled && !loading) inputRef.current?.click() }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          loading || disabled
            ? 'border-gray-200 bg-gray-50 cursor-wait'
            : dragging
              ? 'border-yeg-500 bg-yeg-50 cursor-pointer'
              : 'border-gray-300 hover:border-yeg-500 hover:bg-yeg-50 cursor-pointer'
        }`}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-gray-600">
            <Loader2 className="w-6 h-6 animate-spin text-yeg-500" />
            <p className="font-medium">Lettura del documento e estrazione dati…</p>
            <p className="text-sm text-gray-500">Possono servire alcuni secondi.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Upload className="w-6 h-6 text-yeg-500" />
            <p className="font-medium text-gray-900">
              Hai già il brief del cliente? Caricalo e lo compiliamo noi
            </p>
            <p className="text-sm text-gray-500">
              Trascina qui il file o clicca per selezionarlo — PDF, Word (.docx) o testo, max 10 MB
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={disabled || loading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void upload(file)
          }}
        />
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
