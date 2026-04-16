import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { assertSameOrigin, backgroundJob, logError } from '@/lib/api-helpers'
import type { BriefFormData } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Block cross-origin POSTs in production (dev is allowed).
  const forbidden = assertSameOrigin(req)
  if (forbidden) return forbidden

  const supabase = getServiceClient()
  const form: BriefFormData = await req.json()

  // Basic validation — required fields before we even touch the DB.
  if (!form?.email || !form?.nome_evento || !form?.citta || !form?.numero_partecipanti) {
    return NextResponse.json(
      { error: 'Campi obbligatori mancanti: email, nome_evento, citta, numero_partecipanti' },
      { status: 400 }
    )
  }

  // Costruisci componenti richieste
  const componenti: string[] = []
  if (form.hotel_attivo) componenti.push('hotel')
  if (form.location_attiva) componenti.push('location')
  if (form.catering_attivo) componenti.push('catering')
  if (form.trasporti_attivi) componenti.push('trasporti')
  if (form.entertainment_attivo) componenti.push('entertainment')
  if (form.teambuilding_attivo) componenti.push('teambuilding')

  // Crea progetto in Supabase
  const { data: progetto, error } = await supabase.from('progetti').insert({
    brief_raw: form,
    nome_evento: form.nome_evento,
    tipologia_evento: form.tipologia_evento,
    nome_referente: `${form.nome_referente} ${form.cognome_referente}`.trim(),
    email_referente: form.email,
    azienda: form.azienda,
    citta: form.citta,
    data_inizio: form.data_inizio || null,
    data_fine: form.data_fine || null,
    numero_partecipanti: form.numero_partecipanti,
    budget_totale: form.budget_totale || null,
    agenda: form.agenda,
    componenti_richieste: componenti,
    stato: 'nuovo',
    email_operatore: form.email_operatore || null,
  }).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Genera proposte AI in background — wrapped in backgroundJob so Vercel
  // keeps the serverless function alive until the fetch completes.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  backgroundJob(async () => {
    try {
      await fetch(`${baseUrl}/api/genera-proposte`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progetto_id: progetto.id }),
      })
    } catch (err) {
      logError('brief:genera-proposte', err)
    }
  })

  // Log
  await supabase.from('storico').insert({
    progetto_id: progetto.id,
    azione: 'Brief ricevuto e progetto creato',
    utente: 'sistema',
  })

  return NextResponse.json({ success: true, progetto_id: progetto.id })
}
