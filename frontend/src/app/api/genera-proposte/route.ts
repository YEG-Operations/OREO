import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { searchFornitoriMulti, formatFornitoriPerPrompt, type CategoriaDB } from '@/lib/fornitori-db'
import { callQwen, QwenApiError, QwenParseError } from '@/lib/qwen'
import {
  GenerateProposalsSchema,
  normalizeProposal,
  type GenerateProposalsPayload,
  type Proposal,
} from '@/lib/ai-schema'
import { z } from 'zod'

export const maxDuration = 300 // 5 minutes timeout (Vercel Pro)
export const dynamic = 'force-dynamic'

// Mappa categoria stringa → CategoriaDB per le tabelle specifiche
const CAT_MAP: Record<string, CategoriaDB> = {
  hotel:         'hotel',
  location:      'location',
  catering:      'catering',
  dmc:           'dmc',
  teambuilding:  'teambuilding',
  ristoranti:    'ristoranti',
  allestimenti:  'allestimenti',
  entertainment: 'entertainment',
  trasporti:     'trasporti',
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient()
  const { progetto_id } = await req.json()

  if (!progetto_id) {
    return NextResponse.json({ error: 'progetto_id richiesto' }, { status: 400 })
  }

  // 1. Carica progetto
  const { data: progetto, error: errProgetto } = await supabase
    .from('progetti').select('*').eq('id', progetto_id).single()

  if (errProgetto || !progetto) {
    return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 })
  }

  const brief = progetto.brief_raw
  const componenti: string[] = progetto.componenti_richieste || []
  const citta: string | null = brief.citta || null

  // 2. Cerca nelle tabelle categoria-specifiche
  const categorieDB = componenti
    .map(c => CAT_MAP[c])
    .filter(Boolean) as CategoriaDB[]

  const fornitoriDB = categorieDB.length > 0
    ? await searchFornitoriMulti(supabase, categorieDB, citta, 20)
    : {}

  const fornitoriText = formatFornitoriPerPrompt(fornitoriDB)

  // 3. Costruisci prompt
  const prompt = buildPrompt(brief, componenti, fornitoriText)

  // 4. Chiama Qwen (con retry e validazione)
  console.log(`[genera-proposte] Inizio generazione per progetto ${progetto_id}, componenti: ${componenti.join(', ')}`)
  console.log(`[genera-proposte] Fornitori DB trovati: ${Object.entries(fornitoriDB).map(([k,v]) => `${k}: ${(v as unknown[]).length}`).join(', ')}`)

  const systemPrompt = `Sei un esperto event planner italiano senior con 15 anni di esperienza nel settore MICE.
Conosci a fondo fornitori, venue, hotel e servizi per eventi corporate in tutta Italia.
Rispondi SEMPRE e SOLO con JSON valido, senza markdown, senza backtick, senza commenti.`

  let rawResult: unknown
  try {
    console.log('[genera-proposte] Chiamata Qwen in corso...')
    rawResult = await callQwen<unknown>({
      system: systemPrompt,
      user: prompt,
      maxTokens: 8000,
      temperature: 0.7,
    })
    console.log(
      `[genera-proposte] AI raw keys: ${
        rawResult && typeof rawResult === 'object'
          ? Object.keys(rawResult as Record<string, unknown>).join(', ')
          : typeof rawResult
      }`
    )
  } catch (e) {
    if (e instanceof QwenParseError) {
      console.error('[genera-proposte] Qwen parse error:', e.message)
      console.error('[genera-proposte] Raw snippet:', e.rawSnippet.slice(0, 800))
      return NextResponse.json(
        { error: `AI response non era JSON valido: ${e.message}` },
        { status: 502 }
      )
    }
    if (e instanceof QwenApiError) {
      console.error(`[genera-proposte] Qwen API error (status=${e.status}):`, e.message)
      return NextResponse.json(
        { error: `Qwen API error: ${e.message}` },
        { status: 502 }
      )
    }
    console.error('[genera-proposte] Errore Qwen catch:', e)
    return NextResponse.json(
      { error: `Errore generazione AI: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    )
  }

  // 5. Validazione schema
  let aiResult: GenerateProposalsPayload
  try {
    aiResult = GenerateProposalsSchema.parse(rawResult)
  } catch (e) {
    const rawSnippet = JSON.stringify(rawResult).slice(0, 1500)
    if (e instanceof z.ZodError) {
      console.error('[genera-proposte] Validazione Zod fallita:', JSON.stringify(e.issues).slice(0, 1000))
    } else {
      console.error('[genera-proposte] Errore validazione:', e)
    }
    console.error('[genera-proposte] Raw AI payload (truncated):', rawSnippet)

    // NON eliminiamo proposte esistenti in caso di validation error.
    return NextResponse.json(
      {
        error: 'AI output non conforme allo schema atteso',
        details: e instanceof z.ZodError ? e.issues : String(e),
      },
      { status: 502 }
    )
  }

  // 6. Costruisci rows per DB
  const proposte = buildRows(aiResult, progetto_id)
  const expectedCount = proposte.length

  if (expectedCount === 0) {
    console.warn('[genera-proposte] Nessuna proposta valida generata')
    return NextResponse.json(
      { error: 'AI non ha prodotto proposte valide' },
      { status: 502 }
    )
  }

  // 7. Elimina vecchie proposte AI/yeg_db e inserisci le nuove.
  //    Ordine: generate → validate → delete → insert.
  //    Supabase JS client non supporta transazioni; se l'insert fallisce
  //    pesantemente, lo flagghiamo nello storico come warning.
  let deleteFailed = false
  try {
    const { error: errDel } = await supabase.from('proposte').delete()
      .eq('progetto_id', progetto_id)
      .in('fonte', ['ai', 'yeg_db'])
    if (errDel) {
      deleteFailed = true
      console.error('[genera-proposte] Errore delete proposte vecchie:', errDel.message)
    }
  } catch (e) {
    deleteFailed = true
    console.error('[genera-proposte] Exception delete proposte vecchie:', e)
  }

  let inserted = 0
  try {
    for (let i = 0; i < proposte.length; i += 10) {
      const batch = proposte.slice(i, i + 10)
      const { error: errInsert } = await supabase.from('proposte').insert(batch)
      if (errInsert) {
        console.error(`[genera-proposte] Batch insert fallito: ${errInsert.message} — retry singolo`)
        for (const p of batch) {
          const { error: e2 } = await supabase.from('proposte').insert(p)
          if (!e2) inserted++
          else console.error(`[genera-proposte] SKIP "${p.nome}": ${e2.message}`)
        }
      } else {
        inserted += batch.length
      }
    }
  } catch (e) {
    console.error('[genera-proposte] Exception durante insert:', e)
  }

  const failureRatio = 1 - inserted / expectedCount
  const majorityFailed = failureRatio > 0.5

  // 8. Aggiorna progetto
  try {
    await supabase.from('progetti').update({
      stato: 'in_lavorazione',
      brief_interpretato: aiResult.brief_interpretato ?? null,
    }).eq('id', progetto_id)
  } catch (e) {
    console.error('[genera-proposte] Errore update progetto:', e)
  }

  // 9. Storico
  try {
    if (majorityFailed || deleteFailed) {
      await supabase.from('storico').insert({
        progetto_id,
        azione: `[WARNING] AI generation inconsistente: inserite ${inserted}/${expectedCount} proposte${deleteFailed ? ' (delete pre-existing fallita)' : ''} — stato DB possibilmente inconsistente`,
        utente: 'sistema',
      })
    } else {
      await supabase.from('storico').insert({
        progetto_id,
        azione: `AI ha generato ${inserted} proposte per: ${componenti.join(', ')}`,
        utente: 'sistema',
      })
    }
  } catch (e) {
    console.error('[genera-proposte] Errore insert storico:', e)
  }

  return NextResponse.json({
    success: true,
    progetto_id,
    totale_proposte: inserted,
    attese: expectedCount,
    warning: majorityFailed ? 'maggioranza batch fallita' : undefined,
  })
}


function buildPrompt(
  brief: Record<string, unknown>,
  componenti: string[],
  fornitoriDB: string
): string {
  let dettagli = ''

  if (brief.hotel_attivo) {
    dettagli += `\nHOTEL: check-in ${brief.hotel_checkin}, check-out ${brief.hotel_checkout}, ${brief.camere_singole || 0} singole + ${brief.camere_doppie || 0} doppie, min ${brief.hotel_stelle_minime || 4} stelle. ${brief.hotel_note || ''}`
  }
  if (brief.location_attiva) {
    const av = Array.isArray(brief.location_av) ? brief.location_av.join(', ') : ''
    dettagli += `\nLOCATION: setup ${brief.location_setup}, AV: ${av}, tipologia: ${brief.location_tipologia || 'qualsiasi'}. ${brief.location_note || ''}`
  }
  if (brief.catering_attivo) {
    const pranzoMod = brief.pranzo_interno ? 'interno' : 'ristorante esterno'
    const cenaMod = brief.cena_interna ? 'interna' : 'ristorante esterno'
    const coffeeStation = brief.coffee_station ? ' + Coffee Station permanente' : ''
    dettagli += `\nCATERING: ${brief.coffee_break_num || 0} coffee break${coffeeStation}, ${brief.pranzo_num || 0} pranzi (${pranzoMod}), ${brief.cena_num || 0} cene (${cenaMod}), ${brief.aperitivo_num || 0} aperitivi. Esigenze: ${brief.esigenze_alimentari || 'nessuna'}. ${brief.catering_note || ''}`
  }
  if (brief.trasporti_attivi) {
    const tipi = Array.isArray(brief.trasporti_tipo) ? brief.trasporti_tipo.join(', ') : ''
    dettagli += `\nTRASPORTI: ${tipi || 'da definire'}. ${brief.trasporti_note || ''}`
  }
  if (brief.entertainment_attivo) {
    dettagli += `\nENTERTAINMENT: ${brief.entertainment_tipo || 'da definire'}. ${brief.entertainment_note || ''}`
  }
  if (brief.teambuilding_attivo) {
    dettagli += `\nTEAM BUILDING: ${brief.teambuilding_note || 'da definire'}`
  }

  return `Analizza questo brief evento e genera proposte CONCRETE con fornitori REALI italiani.

=== BRIEF ===
Evento: ${brief.nome_evento} (${brief.tipologia_evento})
Azienda: ${brief.azienda}
Città: ${brief.citta}
Date: ${brief.data_inizio} - ${brief.data_fine}
Partecipanti: ${brief.numero_partecipanti}
Budget totale: ${brief.budget_totale || 'da definire'} EUR
Agenda: ${brief.agenda || 'non specificata'}
${dettagli}
=== FINE BRIEF ===

=== FORNITORI DATABASE YEG (PRIORITÀ - inserisci questi se pertinenti) ===
${fornitoriDB || 'Nessun fornitore YEG nel DB per queste categorie/città'}
=== FINE DB YEG ===

ISTRUZIONI:
1. Per OGNI componente richiesta (${componenti.join(', ')}), genera esattamente 4 proposte.
2. I fornitori YEG listati sopra devono essere nelle prime posizioni se adatti (is_yeg_supplier:true, fonte:"yeg_db"). Preferisci SEMPRE fornitori YEG quando possibile.
3. Completa con fornitori REALI italiani che conosci (catene note, venue famosi).
4. IMPORTANTE (anti-allucinazione): NON hai accesso al web. Per i fornitori REALI italiani che conosci, inserisci sito_web e contatto SOLO se sei certo al 100% del dato. Altrimenti OMETTI il campo (usa null). NON inventare MAI email o numeri di telefono. È molto meglio lasciare null che scrivere un dato inventato: l'agenzia invia email reali a questi contatti.
5. IMPORTANTE: NON inserire lo stesso fornitore/piattaforma più volte nella stessa categoria. Ogni proposta deve essere un fornitore DISTINTO. Se un gruppo alberghiero ha più hotel nella stessa città, scegline solo uno.
6. Per ogni proposta: pro[] e contro[] specifici e onesti (almeno 2 ciascuno).
7. Prezzi realistici per il mercato eventi corporate italiano.

Rispondi SOLO con questo JSON:
{
  "brief_interpretato": {
    "sintesi": "2-3 frasi",
    "obiettivi_evento": "cosa vuole ottenere il cliente",
    "tono_evento": "formale|informale|lusso|dinamico",
    "priorita": ["..."],
    "suggerimenti_ai": "consigli strategici"
  },
  "categorie": {
    "NOME_CATEGORIA": {
      "proposte": [
        {
          "nome": "Nome reale fornitore",
          "categoria": "hotel|location|catering|trasporti|entertainment|teambuilding",
          "descrizione": "descrizione servizio, max 100 parole",
          "motivo_match": "perché risolve questa specifica esigenza del brief",
          "prezzo_stimato": 0,
          "capacita": "capienza/disponibilità",
          "indirizzo": "indirizzo o zona",
          "pro": ["vantaggio 1", "vantaggio 2", "vantaggio 3"],
          "contro": ["limite 1", "limite 2"],
          "adeguatezza_budget": 75,
          "note": "info extra o criticità",
          "sito_web": null,
          "contatto": null,
          "is_yeg_supplier": false,
          "fonte": "ai"
        }
      ]
    }
  }
}`
}


/**
 * Build DB rows from validated AI payload, applying normalizeProposal to each.
 */
function buildRows(aiResult: GenerateProposalsPayload, progettoId: string) {
  const rows: Record<string, unknown>[] = []

  for (const [catKey, catData] of Object.entries(aiResult.categorie)) {
    const prps: Proposal[] = catData.proposte || []
    prps.forEach((p, idx) => {
      const n = normalizeProposal(p)

      rows.push({
        progetto_id: progettoId,
        categoria: n.categoria || catKey,
        nome: n.nome,
        descrizione: n.descrizione ?? null,
        motivo_match: n.motivo_match ?? null,
        prezzo_stimato: n.prezzo_stimato ?? null,
        capacita: n.capacita ?? null,
        indirizzo: n.indirizzo ?? null,
        // TODO: remove punti_forza after UI audit — pro è il campo primario.
        punti_forza: n.pro,
        pro: n.pro,
        contro: n.contro,
        adeguatezza_budget: n.adeguatezza_budget ?? null,
        note: n.note ?? null,
        sito_web: n.sito_web ?? null,
        contatto: n.contatto ?? null,
        immagine_url: null,
        fonte: n.fonte || (n.is_yeg_supplier ? 'yeg_db' : 'ai'),
        is_yeg_supplier: n.is_yeg_supplier,
        da_verificare: n.da_verificare,
        email_verified: n.email_verified,
        selezionato_manager: false,
        selezionato_cliente: false,
        ordine: idx,
      })
    })
  }

  return rows
}
