'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Proposta } from '@/lib/types'

interface EmailSendModalProps {
  proposta: Proposta
  progettoId: string
  onClose: () => void
  onSent?: () => void
}

interface EmailPreview {
  to: string
  from: string
  subject: string
  body: string
}

interface PreviewResponse {
  email?: EmailPreview
  verification_status?: string
  email_verified?: boolean | null
  email_verification_error?: string | null
  da_verificare?: boolean
  error?: string
}

type VerificationState = 'unknown' | 'valid' | 'invalid'

function verificationFromBool(v: boolean | null | undefined): VerificationState {
  if (v === true) return 'valid'
  if (v === false) return 'invalid'
  return 'unknown'
}

export default function EmailSendModal({
  proposta,
  progettoId,
  onClose,
  onSent,
}: EmailSendModalProps) {
  // Preview / loading state
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Editable email fields
  const [to, setTo] = useState('')
  const [from, setFrom] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  // Verification & AI-generated flags
  const [daVerificare, setDaVerificare] = useState<boolean>(!!proposta.da_verificare)
  const [emailVerified, setEmailVerified] = useState<VerificationState>(
    verificationFromBool(proposta.email_verified)
  )
  const [verificationError, setVerificationError] = useState<string | null>(
    proposta.email_verification_error ?? null
  )

  // Override + send UX
  const [overrideConfirmed, setOverrideConfirmed] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [requiresVerification, setRequiresVerification] = useState(false)

  // Fetch preview on mount
  const loadPreview = useCallback(async () => {
    setLoadingPreview(true)
    setPreviewError(null)
    try {
      const res = await fetch('/api/invia-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposta_id: proposta.id,
          progetto_id: progettoId,
          send_real: false,
        }),
      })
      const data: PreviewResponse = await res.json()
      if (!res.ok) {
        setPreviewError(data.error || 'Errore nella generazione della preview email')
        setLoadingPreview(false)
        return
      }
      if (data.email) {
        setTo(data.email.to ?? '')
        setFrom(data.email.from ?? '')
        setSubject(data.email.subject ?? '')
        setBody(data.email.body ?? '')
      }
      if (typeof data.da_verificare === 'boolean') setDaVerificare(data.da_verificare)
      if (data.email_verified !== undefined) {
        setEmailVerified(verificationFromBool(data.email_verified))
      }
      if (data.email_verification_error !== undefined) {
        setVerificationError(data.email_verification_error ?? null)
      }
    } catch {
      setPreviewError('Errore di rete nella generazione della preview email')
    }
    setLoadingPreview(false)
  }, [proposta.id, progettoId])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  const handleVerify = async () => {
    setVerifying(true)
    setSendError(null)
    try {
      const res = await fetch('/api/invia-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposta_id: proposta.id,
          progetto_id: progettoId,
          action: 'verify_only',
        }),
      })
      const data: PreviewResponse = await res.json()
      if (!res.ok) {
        setSendError(data.error || 'Errore durante la verifica email')
      } else {
        if (data.email_verified !== undefined) {
          setEmailVerified(verificationFromBool(data.email_verified))
        }
        if (data.email_verification_error !== undefined) {
          setVerificationError(data.email_verification_error ?? null)
        }
        setOverrideConfirmed(false)
        onSent?.()
      }
    } catch {
      setSendError('Errore di rete durante la verifica email')
    }
    setVerifying(false)
  }

  const canSendWithoutOverride = emailVerified === 'valid' && !daVerificare
  const canSend = canSendWithoutOverride || overrideConfirmed

  const handleSend = async () => {
    if (!canSend || sending) return
    setSending(true)
    setSendError(null)
    setRequiresVerification(false)
    try {
      const res = await fetch('/api/invia-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposta_id: proposta.id,
          progetto_id: progettoId,
          send_real: true,
          force: overrideConfirmed && !canSendWithoutOverride ? true : undefined,
          // Pass the possibly-edited content so the backend can use it
          email: { to, from, subject, body },
        }),
      })
      const data: PreviewResponse & { requires_verification?: boolean } = await res.json()
      if (!res.ok) {
        setSendError(data.error || 'Errore durante l\'invio email')
        if (data.requires_verification) setRequiresVerification(true)
        setSending(false)
        return
      }
      onSent?.()
      onClose()
    } catch {
      setSendError('Errore di rete durante l\'invio email')
      setSending(false)
    }
  }

  // Badges for status
  const verifiedBadge = (() => {
    if (emailVerified === 'valid') {
      return (
        <span className="badge bg-green-100 text-green-800 text-[11px]">
          ✓ Email verificata via MX
        </span>
      )
    }
    if (emailVerified === 'invalid') {
      return (
        <span className="badge bg-red-100 text-red-800 text-[11px]">
          ✗ Email non valida
        </span>
      )
    }
    return (
      <span className="badge bg-gray-100 text-gray-700 text-[11px]">
        ◯ Non ancora verificata
      </span>
    )
  })()

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Invia email a {proposta.nome}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Verifica i contatti e il contenuto prima di inviare
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Chiudi"
          >
            &times;
          </button>
        </div>

        {/* Scrollable body */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {/* Status header */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {daVerificare && (
              <span className="badge bg-yellow-100 text-yellow-800 text-[11px]">
                ⚠ Proposta AI — da verificare
              </span>
            )}
            {verifiedBadge}
          </div>

          {verificationError && emailVerified === 'invalid' && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <span className="font-semibold">Errore verifica MX:</span> {verificationError}
            </div>
          )}

          {/* Preview / editable fields */}
          {loadingPreview ? (
            <div className="py-10 text-center text-sm text-gray-400">
              Generazione preview email in corso...
            </div>
          ) : previewError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {previewError}
              <div className="mt-2">
                <button
                  type="button"
                  onClick={loadPreview}
                  className="btn-ghost text-xs"
                >
                  Riprova
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                  Destinatario
                </label>
                <input
                  type="text"
                  className="input w-full mt-1 text-sm"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  placeholder="email@fornitore.it"
                />
              </div>
              {from && (
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                    Mittente
                  </label>
                  <input
                    type="text"
                    className="input w-full mt-1 text-sm bg-gray-50"
                    value={from}
                    onChange={e => setFrom(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                  Oggetto
                </label>
                <input
                  type="text"
                  className="input w-full mt-1 text-sm"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Oggetto email"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                  Corpo email (modificabile)
                </label>
                <textarea
                  className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                  rows={12}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Correggi eventuali errori AI prima di inviare.
                </p>
              </div>
            </div>
          )}

          {/* Inline error from send attempt */}
          {sendError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {sendError}
              {requiresVerification && (
                <div className="mt-1 text-xs">
                  L&apos;email non è verificata. Esegui la verifica MX o spunta
                  &quot;Ignora avviso e invia comunque&quot; per forzare l&apos;invio.
                </div>
              )}
            </div>
          )}

          {/* Override checkbox when verification failed / missing */}
          {!loadingPreview && !canSendWithoutOverride && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideConfirmed}
                  onChange={e => setOverrideConfirmed(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <span className="text-xs text-amber-900">
                  <span className="font-semibold">Ignora avviso e invia comunque</span>
                  <br />
                  Confermo di aver controllato manualmente i contatti di questa
                  proposta AI e di voler inviare l&apos;email anche senza verifica MX.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="p-5 border-t bg-gray-50 flex flex-wrap items-center gap-2 justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost text-sm"
            disabled={sending}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || sending || loadingPreview || !to}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {verifying ? 'Verifica...' : 'Verifica Email'}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || sending || loadingPreview}
            className="btn-primary text-sm disabled:opacity-50 inline-flex items-center gap-2"
            title={
              canSendWithoutOverride
                ? 'Invia email reale al fornitore'
                : overrideConfirmed
                  ? 'Invio forzato (override manuale)'
                  : 'Verifica l\'email o spunta l\'override per abilitare l\'invio'
            }
          >
            {sending && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {sending ? 'Invio in corso...' : 'Confermo l\'invio'}
          </button>
        </div>
      </div>
    </div>
  )
}
