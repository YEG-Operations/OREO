import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

/**
 * POST /api/email-reply
 * Webhook chiamato da n8n quando un fornitore risponde all'email.
 * 
 * Payload atteso da n8n:
 * {
 *   "from_email": "fornitore@esempio.it",
 *   "to_email": "operatore@yegevents.it",
 *   "subject": "RE: Richiesta disponibilità...",
 *   "body_text": "Corpo della risposta...",
 *   "body_html": "<html>...</html>",
 *   "received_at": "2025-01-15T10:30:00Z"
 * }
 */
export async function POST(req: NextRequest) {
  const supabase = getServiceClient()
  const body = await req.json()

  const { from_email, to_email, subject, body_text, body_html, received_at } = body

  if (!from_email || !subject) {
    return NextResponse.json({ error: 'from_email e subject richiesti' }, { status: 400 })
  }

  console.log(`[email-reply] Risposta ricevuta da ${from_email}: ${subject}`)

  // Cerca l'email originale inviata a questo fornitore
  const { data: originalEmail } = await supabase
    .from('email_logs')
    .select('*')
    .eq('to_email', from_email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (originalEmail) {
    // Aggiorna il log esistente con la risposta
    await supabase.from('email_logs').update({
      status: 'risposta_ricevuta',
      risposta_body: body_text || body_html || '',
      risposta_data: received_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', originalEmail.id)

    // Log in storico
    await supabase.from('storico').insert({
      progetto_id: originalEmail.progetto_id,
      azione: `Risposta ricevuta da ${from_email}`,
      utente: 'sistema',
      dettagli: {
        proposta_id: originalEmail.proposta_id,
        from_email,
        subject,
        body_preview: (body_text || '').slice(0, 200),
      },
    })
  } else {
    // Nessuna email originale trovata - salva comunque
    console.warn(`[email-reply] Nessuna email originale trovata per ${from_email}`)
  }

  // Salva sempre nella tabella per non perdere dati
  const { error } = await supabase.from('email_logs').insert({
    progetto_id: originalEmail?.progetto_id || null,
    proposta_id: originalEmail?.proposta_id || null,
    from_email: from_email,
    to_email: to_email || '',
    subject: subject,
    body: body_text || body_html || '',
    status: 'risposta_ricevuta',
    risposta_body: body_text || body_html || '',
    risposta_data: received_at || new Date().toISOString(),
  })

  if (error) {
    console.error('[email-reply] Errore salvataggio:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, matched: !!originalEmail })
}

// GET: recupera risposte per un progetto
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