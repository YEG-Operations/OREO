import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { assertSameOrigin, backgroundJob, logError } from '@/lib/api-helpers'
import type { BriefFormData } from '@/lib/types'

export const dynamic = 'force-dynamic'
// Il default di Vercel (10s) uccideva l'invocazione mentre il job in background
// stava ancora avviando la generazione proposte.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // Block cross-origin POSTs in production (dev is allowed).
  const forbidden = assertSameOrigin(req)
  if (forbidden) return forbidden

  try {
    return await creaProgetto(req)
  } catch (err) {
    // Qualsiasi errore inatteso (env Supabase mancanti, JSON malformato, ...):
    // meglio un messaggio leggibile che un 500 opaco su cui non si può indagare.
    logError('brief:unhandled', err)
    return NextResponse.json(
      { error: `Errore inatteso nella creazione del progetto: ${errMessage(err)}` },
      { status: 500 }
    )
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Lascia traccia nello storico del progetto quando la generazione proposte non
 * è nemmeno partita: senza questo il progetto resta in stato "nuovo" e in
 * dashboard sembra che l'AI stia ancora lavorando, per sempre.
 */
async function segnalaGenerazioneNonAvviata(
  supabase: ReturnType<typeof getServiceClient>,
  progettoId: string,
  motivo: string
): Promise<void> {
  const { error } = await supabase.from('storico').insert({
    progetto_id: progettoId,
    azione: `[ERRORE] Generazione proposte non avviata: ${motivo}`,
    utente: 'sistema',
  })
  if (error) logError('brief:segnala-generazione', error)
}

async function creaProgetto(req: NextRequest) {
  const supabase = getServiceClient()

  let form: BriefFormData
  try {
    form = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo della richiesta non valido (JSON)' }, { status: 400 })
  }

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
  const { data: progetto, error, status } = await supabase.from('progetti').insert({
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
    // Log completo (details/hint/code contengono la causa reale: ENOTFOUND,
    // ECONNREFUSED, certificato, ecc.), altrimenti il motivo resta invisibile.
    logError('brief:insert-progetto', error)

    // status 0 = la fetch verso Supabase non è nemmeno arrivata al server
    // (DNS, rete, progetto in pausa, URL errato): è infrastruttura, non il brief.
    const nonRaggiungibile = status === 0 || /fetch failed/i.test(error.message)
    return NextResponse.json(
      {
        error: nonRaggiungibile
          ? 'Database non raggiungibile: il brief non è stato salvato. Verifica che il progetto Supabase sia attivo e che NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY siano configurate correttamente.'
          : `Salvataggio non riuscito: ${error.message}`,
        dettaglio: error.code || undefined,
      },
      { status: nonRaggiungibile ? 503 : 500 }
    )
  }

  // Genera proposte AI in background — wrapped in backgroundJob so Vercel
  // keeps the serverless function alive until the fetch completes.
  // Senza NEXT_PUBLIC_APP_URL su Vercel la fetch finiva su localhost:3000 e
  // moriva con "TypeError: fetch failed": le proposte non venivano mai generate.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  backgroundJob(async () => {
    try {
      // La generazione dura minuti: non aspettiamo la risposta completa, ci
      // basta sapere se la richiesta è stata *accettata*. Dieci secondi senza
      // risposta significano che la route sta lavorando; un rifiuto immediato
      // (DNS, connessione, 401 di deployment protection) significa che non
      // partirà mai, e questo va scritto da qualche parte.
      const res = await fetch(`${baseUrl}/api/genera-proposte`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progetto_id: progetto.id }),
        signal: AbortSignal.timeout(10_000),
      })
      console.log(`[brief] genera-proposte ha risposto ${res.status} per ${progetto.id}`)
      if (!res.ok) {
        await segnalaGenerazioneNonAvviata(
          supabase,
          progetto.id,
          `${baseUrl}/api/genera-proposte ha risposto ${res.status}`
        )
      }
    } catch (err) {
      // AbortError = nessuna risposta entro il timeout: è il caso normale,
      // la generazione è in corso dentro la sua invocazione.
      if (err instanceof Error && err.name === 'TimeoutError') {
        console.log(`[brief] genera-proposte avviata per ${progetto.id} (in corso)`)
        return
      }
      logError('brief:genera-proposte', err)
      await segnalaGenerazioneNonAvviata(supabase, progetto.id, errMessage(err))
    }
  })

  // Log
  // Il progetto è già salvato: se il log fallisce lo segnaliamo nei log del
  // server, ma non trasformiamo un brief andato a buon fine in un errore.
  const { error: storicoError } = await supabase.from('storico').insert({
    progetto_id: progetto.id,
    azione: 'Brief ricevuto e progetto creato',
    utente: 'sistema',
  })
  if (storicoError) logError('brief:insert-storico', storicoError)

  return NextResponse.json({ success: true, progetto_id: progetto.id })
}
