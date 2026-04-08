import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { generateSupplierEmail } from '@/lib/email-templates'

// N8N webhook URL for sending emails (configure in .env)
const N8N_WEBHOOK_SEND = process.env.N8N_WEBHOOK_SEND_EMAIL || ''

export async function POST(req: NextRequest) {
  const supabase = getServiceClient()
  const { proposta_id, progetto_id, send_real = false } = await req.json()

  if (!proposta_id || !progetto_id) {
    return NextResponse.json({ error: 'proposta_id e progetto_id richiesti' }, { status: 400 })
  }

  // Carica progetto
  const { data: progetto } = await supabase
    .from('progetti')
    .select('*')
    .eq('id', progetto_id)
    .single()

  if (!progetto) {
    return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 })
  }

  // Carica proposta
  const { data: proposta } = await supabase
    .from('proposte')
    .select('*')
    .eq('id', proposta_id)
    .single()

  if (!proposta) {
    return NextResponse.json({ error: 'Proposta non trovata' }, { status: 404 })
  }

  const brief = progetto.brief_raw || {}
  const emailOperatore = progetto.email_operatore || ''

  if (!emailOperatore) {
    return NextResponse.json({ error: 'Configura prima l\'email operatore nelle Impostazioni Costi' }, { status: 400 })
  }

  // Estrai email fornitore dal campo contatto
  const emailMatch = proposta.contatto?.match(/[\w.+-]+@[\w.-]+\.\w+/)
  const fornitoreEmail = emailMatch ? emailMatch[0] : ''

  const email = generateSupplierEmail({
    nome_fornitore: proposta.nome,
    categoria: proposta.categoria,
    nome_evento: progetto.nome_evento,
    azienda: progetto.azienda,
    citta: progetto.citta,
    data_inizio: progetto.data_inizio,
    data_fine: progetto.data_fine,
    numero_partecipanti: progetto.numero_partecipanti,
    brief,
    email_operatore: emailOperatore,
  })

  // Se send_real=true e abbiamo il webhook n8n, invia davvero
  if (send_real && N8N_WEBHOOK_SEND && fornitoreEmail) {
    try {
      const webhookRes = await fetch(N8N_WEBHOOK_SEND, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: emailOperatore,
          to: fornitoreEmail,
          subject: email.subject,
          body: email.body,
          proposta_id,
          progetto_id,
          fornitore: proposta.nome,
          categoria: proposta.categoria,
          // Campi per tracciare la risposta
          reply_to: emailOperatore,
          progetto_nome: progetto.nome_evento,
        }),
      })

      const webhookData = await webhookRes.json().catch(() => ({}))

      // Log in email_logs
      await supabase.from('email_logs').insert({
        progetto_id,
        proposta_id,
        from_email: emailOperatore,
        to_email: fornitoreEmail,
        subject: email.subject,
        body: email.body,
        status: webhookRes.ok ? 'inviata' : 'errore',
        n8n_response: webhookData,
      })

      // Log in storico
      await supabase.from('storico').insert({
        progetto_id,
        azione: `Email inviata a ${proposta.nome} (${fornitoreEmail})`,
        utente: emailOperatore,
        dettagli: { proposta_id, to: fornitoreEmail, status: webhookRes.ok ? 'ok' : 'errore' },
      })

      return NextResponse.json({
        success: true,
        sent: true,
        email: { to: fornitoreEmail, from: emailOperatore, subject: email.subject },
        webhook_status: webhookRes.status,
      })
    } catch (e) {
      console.error('[invia-email] Errore webhook n8n:', e)
      return NextResponse.json({
        error: `Errore invio via n8n: ${e instanceof Error ? e.message : String(e)}`,
        email: { to: fornitoreEmail, from: emailOperatore, subject: email.subject, body: email.body },
      }, { status: 502 })
    }
  }

  // Preview mode: restituisci solo il testo dell'email
  return NextResponse.json({
    success: true,
    sent: false,
    email: {
      to: fornitoreEmail || proposta.contatto || '',
      from: emailOperatore,
      subject: email.subject,
      body: email.body,
    },
  })
}