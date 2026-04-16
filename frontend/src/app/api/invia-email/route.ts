import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { generateSupplierEmail } from '@/lib/email-templates'
import { verifyEmailDomain } from '@/lib/email-verify'
import { generateThreadToken, signPayload } from '@/lib/hmac'

export const dynamic = 'force-dynamic'

// N8N webhook URL for sending emails (configure in .env)
const N8N_WEBHOOK_SEND = process.env.N8N_WEBHOOK_SEND_EMAIL || ''
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || ''

type InviaEmailBody = {
  action?: 'verify_only' | 'send'
  proposta_id?: string
  progetto_id?: string
  send_real?: boolean
  // Operator explicit override: proceed even if da_verificare/email_verified say no.
  force?: boolean
}

/**
 * Extracts the first email address found in a contact string (which may
 * contain "Nome <email@x.it>", phone numbers, etc).
 */
function extractEmail(contatto: string | null | undefined): string {
  if (!contatto) return ''
  const m = contatto.match(/[\w.+-]+@[\w.-]+\.\w+/)
  return m ? m[0] : ''
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient()
  const body = (await req.json()) as InviaEmailBody
  const { action, proposta_id, progetto_id, send_real = false, force = false } = body

  if (!proposta_id) {
    return NextResponse.json({ error: 'proposta_id richiesto' }, { status: 400 })
  }

  // Carica proposta (serve in tutti i rami, anche in verify_only).
  const { data: proposta } = await supabase
    .from('proposte')
    .select('*')
    .eq('id', proposta_id)
    .single()

  if (!proposta) {
    return NextResponse.json({ error: 'Proposta non trovata' }, { status: 404 })
  }

  const fornitoreEmail = extractEmail(proposta.contatto)

  // ─────────────────────────────────────────────────────────────────────────
  // Azione dedicata: verifica MX senza inviare nulla. Utile per la UI che
  // vuole mostrare lo stato prima di chiedere la conferma umana.
  // ─────────────────────────────────────────────────────────────────────────
  if (action === 'verify_only') {
    if (!fornitoreEmail) {
      // Segna comunque lo stato a false per evitare invii accidentali.
      await supabase
        .from('proposte')
        .update({ email_verified: false, email_verification_error: 'no_email' })
        .eq('id', proposta_id)
      return NextResponse.json(
        { ok: false, email: '', error: 'no_email' },
        { status: 400 }
      )
    }

    const result = await verifyEmailDomain(fornitoreEmail)
    await supabase
      .from('proposte')
      .update({
        email_verified: result.ok,
        email_verification_error: result.ok ? null : result.error || 'unknown',
      })
      .eq('id', proposta_id)

    return NextResponse.json({
      ok: result.ok,
      email: fornitoreEmail,
      error: result.error,
      verification_status: result.ok ? 'verified' : 'failed',
    })
  }

  // Da qui in poi serve il progetto per generare il body.
  if (!progetto_id) {
    return NextResponse.json({ error: 'progetto_id richiesto' }, { status: 400 })
  }

  const { data: progetto } = await supabase
    .from('progetti')
    .select('*')
    .eq('id', progetto_id)
    .single()

  if (!progetto) {
    return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 })
  }

  const brief = progetto.brief_raw || {}
  const emailOperatore = progetto.email_operatore || ''

  if (!emailOperatore) {
    return NextResponse.json(
      { error: "Configura prima l'email operatore nelle Impostazioni Costi" },
      { status: 400 }
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Invio reale: una serie di guardie prima di passare a n8n.
  // ─────────────────────────────────────────────────────────────────────────
  if (send_real) {
    if (!fornitoreEmail) {
      return NextResponse.json(
        { error: 'Email fornitore non valida o mancante nel campo contatto' },
        { status: 400 }
      )
    }

    if (!N8N_WEBHOOK_SEND) {
      return NextResponse.json(
        { error: 'N8N_WEBHOOK_SEND_EMAIL non configurato' },
        { status: 500 }
      )
    }

    // 1) MX lookup se non ancora eseguito o se l'ultima verifica è fallita.
    //    Se email_verified === null → mai verificata → verifica ora.
    //    Se email_verified === false → già segnata come non valida.
    let emailVerified: boolean | null = proposta.email_verified ?? null
    let verificationError: string | null = proposta.email_verification_error ?? null

    if (emailVerified === null) {
      const result = await verifyEmailDomain(fornitoreEmail)
      emailVerified = result.ok
      verificationError = result.ok ? null : result.error || 'unknown'
      await supabase
        .from('proposte')
        .update({
          email_verified: emailVerified,
          email_verification_error: verificationError,
        })
        .eq('id', proposta_id)
    }

    if (emailVerified === false) {
      // Hard-block: dominio non risolvibile. Nessun override può aggirare
      // un indirizzo che non esiste a livello DNS.
      return NextResponse.json(
        {
          error: 'email_mx_non_valida',
          detail: verificationError || 'no_mx',
          email: fornitoreEmail,
        },
        { status: 400 }
      )
    }

    // 2) Proposta AI non ancora revisionata dall'operatore? Richiede force=true.
    const daVerificare = proposta.da_verificare === true
    const needsConfirm = daVerificare || emailVerified !== true

    if (needsConfirm && !force) {
      // Genera preview per la UI di conferma.
      const preview = generateSupplierEmail({
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
      return NextResponse.json(
        {
          error: 'email_non_verificata',
          requires_verification: true,
          reasons: {
            da_verificare: daVerificare,
            email_verified: emailVerified,
          },
          email: {
            to: fornitoreEmail,
            from: emailOperatore,
            subject: preview.subject,
            body: preview.body,
          },
        },
        { status: 400 }
      )
    }

    // 3) Genera thread_token e costruisci l'email definitiva.
    const thread_token = generateThreadToken()
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
      thread_token,
    })

    const payload = {
      from: emailOperatore,
      to: fornitoreEmail,
      subject: email.subject,
      body: email.body,
      proposta_id,
      progetto_id,
      fornitore: proposta.nome,
      categoria: proposta.categoria,
      reply_to: emailOperatore,
      progetto_nome: progetto.nome_evento,
      thread_token,
    }

    try {
      const rawBody = JSON.stringify(payload)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (N8N_WEBHOOK_SECRET) {
        headers['X-Webhook-Signature'] = signPayload(rawBody, N8N_WEBHOOK_SECRET)
      }

      const webhookRes = await fetch(N8N_WEBHOOK_SEND, {
        method: 'POST',
        headers,
        body: rawBody,
      })

      const webhookData = (await webhookRes.json().catch(() => ({}))) as {
        message_id?: string
        messageId?: string
      }
      const messageId = webhookData.message_id || webhookData.messageId || null

      await supabase.from('email_logs').insert({
        progetto_id,
        proposta_id,
        from_email: emailOperatore,
        to_email: fornitoreEmail,
        subject: email.subject,
        body: email.body,
        status: webhookRes.ok ? 'inviata' : 'errore',
        n8n_response: webhookData,
        thread_token,
        message_id: messageId,
      })

      await supabase.from('storico').insert({
        progetto_id,
        azione: `Email inviata a ${proposta.nome} (${fornitoreEmail})`,
        utente: emailOperatore,
        dettagli: {
          proposta_id,
          to: fornitoreEmail,
          status: webhookRes.ok ? 'ok' : 'errore',
          thread_token,
        },
      })

      return NextResponse.json({
        success: true,
        sent: true,
        email: {
          to: fornitoreEmail,
          from: emailOperatore,
          subject: email.subject,
        },
        thread_token,
        message_id: messageId,
        webhook_status: webhookRes.status,
      })
    } catch (e) {
      console.error('[invia-email] Errore webhook n8n:', e)
      return NextResponse.json(
        {
          error: `Errore invio via n8n: ${e instanceof Error ? e.message : String(e)}`,
          email: {
            to: fornitoreEmail,
            from: emailOperatore,
            subject: email.subject,
            body: email.body,
          },
        },
        { status: 502 }
      )
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Preview mode (send_real=false): restituisce solo il draft + lo stato di
  // verifica corrente. Nessun side effect.
  // ─────────────────────────────────────────────────────────────────────────
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

  const emailVerified = proposta.email_verified ?? null
  const verification_status =
    emailVerified === true ? 'verified' : emailVerified === false ? 'failed' : 'unknown'

  return NextResponse.json({
    success: true,
    sent: false,
    email: {
      to: fornitoreEmail || proposta.contatto || '',
      from: emailOperatore,
      subject: email.subject,
      body: email.body,
    },
    verification_status,
    email_verified: emailVerified,
    email_verification_error: proposta.email_verification_error ?? null,
    da_verificare: proposta.da_verificare === true,
  })
}

/**
 * GET /api/invia-email?proposta_id=...&verify_only=1
 * Esegue una verifica MX on-demand senza inviare. Comodo per la UI quando
 * vuole mostrare "email valida?" prima del tasto Invia.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const proposta_id = searchParams.get('proposta_id')
  const verifyOnly = searchParams.get('verify_only')

  if (!proposta_id) {
    return NextResponse.json({ error: 'proposta_id richiesto' }, { status: 400 })
  }
  if (!verifyOnly) {
    return NextResponse.json({ error: 'usa ?verify_only=1' }, { status: 400 })
  }

  const supabase = getServiceClient()
  const { data: proposta } = await supabase
    .from('proposte')
    .select('id, contatto, email_verified, email_verification_error, da_verificare')
    .eq('id', proposta_id)
    .single()

  if (!proposta) {
    return NextResponse.json({ error: 'Proposta non trovata' }, { status: 404 })
  }

  const email = extractEmail(proposta.contatto)
  if (!email) {
    await supabase
      .from('proposte')
      .update({ email_verified: false, email_verification_error: 'no_email' })
      .eq('id', proposta_id)
    return NextResponse.json({ ok: false, email: '', error: 'no_email' })
  }

  const result = await verifyEmailDomain(email)
  await supabase
    .from('proposte')
    .update({
      email_verified: result.ok,
      email_verification_error: result.ok ? null : result.error || 'unknown',
    })
    .eq('id', proposta_id)

  return NextResponse.json({
    ok: result.ok,
    email,
    error: result.error,
    da_verificare: proposta.da_verificare === true,
  })
}
