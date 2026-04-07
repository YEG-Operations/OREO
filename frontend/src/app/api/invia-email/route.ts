import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { generateSupplierEmail } from '@/lib/email-templates'

// POST /api/invia-email - Genera email per un fornitore
export async function POST(req: NextRequest) {
  const supabase = getServiceClient()
  const { proposta_id, progetto_id } = await req.json()

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
    email_operatore: progetto.email_operatore || '',
  })

  // Log l'azione
  await supabase.from('storico').insert({
    progetto_id,
    azione: `Email generata per ${proposta.nome} (${proposta.categoria})`,
    utente: 'manager',
    dettagli: { proposta_id, contatto: proposta.contatto },
  })

  return NextResponse.json({
    success: true,
    email: {
      to: proposta.contatto || '',
      from: progetto.email_operatore || '',
      subject: email.subject,
      body: email.body,
    },
  })
}
