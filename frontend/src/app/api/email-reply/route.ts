import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { verifySignature } from '@/lib/hmac'

export const dynamic = 'force-dynamic'

const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || ''

// Regex per estrarre il riferimento inserito nel subject: "[REF: <16hex>]".
const REF_SUBJECT_RE = /\[REF:\s*([a-f0-9]{16})\]/i
// Fallback: se il subject perde le parentesi, cerchiamo il footer del body.
const REF_BODY_RE = /Rif\.\s*richiesta:\s*([a-f0-9]{16})/i

/**
 * POST /api/email-reply
 * Webhook chiamato da n8n quando un fornitore risponde all'email.
 *
 * Autenticazione: richiede l'header `X-Webhook-Signature` con l'HMAC-SHA256
 * del body grezzo calcolato sul segreto `N8N_WEBHOOK_SECRET`.
 *
 * Payload atteso da n8n:
 * {
 *   "from_email": "fornitore@esempio.it",
 *   "to_email":   "operatore@yegevents.it",
 *   "subject":    "RE: [REF: 9f3a...] Richiesta disponibilità...",
 *   "body_text":  "Corpo della risposta...",
 *   "body_html":  "<html>...</html>",
 *   "received_at": "2025-01-15T10:30:00Z"
 * }
 */
export async function POST(req: NextRequest) {
  // 1) Verifica HMAC. Leggiamo il body come testo grezzo PRIMA del parse,
  //    perché la firma è calcolata sui byte esatti.
  if (!N8N_WEBHOOK_SECRET) {
    console.error('[email-reply] N8N_WEBHOOK_SECRET non configurato — rifiuto.')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  const signature =
    req.headers.get('x-webhook-signature') ||
    req.headers.get('X-Webhook-Signature') ||
    ''

  const rawBody = await req.text()

  if (!verifySignature(rawBody, signature, N8N_WEBHOOK_SECRET)) {
    console.warn('[email-reply] Firma HMAC non valida, richiesta rifiutata.')
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const from_email = (body.from_email as string) || ''
  const to_email = (body.to_email as string) || ''
  const subject = (body.subject as string) || ''
  const body_text = (body.body_text as string) || ''
  const body_html = (body.body_html as string) || ''
  const received_at = (body.received_at as string) || new Date().toISOString()

  if (!from_email || !subject) {
    return NextResponse.json({ error: 'from_email e subject richiesti' }, { status: 400 })
  }

  console.log(`[email-reply] Risposta ricevuta da ${from_email}: ${subject}`)

  const supabase = getServiceClient()

  // 2) Matching — strategia primaria: thread_token nel subject (o nel body).
  const tokenMatch = subject.match(REF_SUBJECT_RE) || body_text.match(REF_BODY_RE)
  const thread_token = tokenMatch ? tokenMatch[1].toLowerCase() : null

  let originalEmail: {
    id: string
    progetto_id: string | null
    proposta_id: string | null
  } | null = null
  let matchStrategy: 'thread_token' | 'heuristic' | 'none' = 'none'

  if (thread_token) {
    const { data } = await supabase
      .from('email_logs')
      .select('id, progetto_id, proposta_id')
      .eq('thread_token', thread_token)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      originalEmail = data
      matchStrategy = 'thread_token'
    }
  }

  if (!originalEmail) {
    // Fallback euristico: ultima email inviata a questo indirizzo.
    // Meno affidabile se al fornitore sono state inviate più richieste.
    console.warn(
      `[email-reply] Nessun thread_token valido per ${from_email}, uso match euristico.`
    )
    const { data } = await supabase
      .from('email_logs')
      .select('id, progetto_id, proposta_id')
      .eq('to_email', from_email)
      .eq('status', 'inviata')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      originalEmail = data
      matchStrategy = 'heuristic'
    }
  }

  // 3) Aggiorna l'email originale e logga lo storico.
  if (originalEmail) {
    await supabase
      .from('email_logs')
      .update({
        status: 'risposta_ricevuta',
        risposta_body: body_text || body_html || '',
        risposta_data: received_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', originalEmail.id)

    await supabase.from('storico').insert({
      progetto_id: originalEmail.progetto_id,
      azione: `Risposta ricevuta da ${from_email}`,
      utente: 'sistema',
      dettagli: {
        proposta_id: originalEmail.proposta_id,
        from_email,
        subject,
        body_preview: (body_text || '').slice(0, 200),
        match_strategy: matchStrategy,
        thread_token,
      },
    })
  } else {
    console.warn(`[email-reply] Nessuna email originale trovata per ${from_email}`)
  }

  // 4) Salva sempre un record per non perdere dati (anche senza match).
  const { error } = await supabase.from('email_logs').insert({
    progetto_id: originalEmail?.progetto_id || null,
    proposta_id: originalEmail?.proposta_id || null,
    from_email,
    to_email,
    subject,
    body: body_text || body_html || '',
    status: 'risposta_ricevuta',
    risposta_body: body_text || body_html || '',
    risposta_data: received_at,
    thread_token,
  })

  if (error) {
    console.error('[email-reply] Errore salvataggio:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    matched: !!originalEmail,
    match_strategy: matchStrategy,
    thread_token,
  })
}

// GET: recupera risposte per un progetto (consultazione interna, no HMAC).
export async function GET(req: NextRequest) {
  const supabase = getServiceClient()
  const { searchParams } = new URL(req.url)
  const progetto_id = searchParams.get('progetto_id')

  if (!progetto_id) {
    return NextResponse.json({ error: 'progetto_id richiesto' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('email_logs')
    .select('*')
    .eq('progetto_id', progetto_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ email_logs: data })
}
