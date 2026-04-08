import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { searchFornitoriMulti, formatFornitoriPerPrompt, type CategoriaDB } from '@/lib/fornitori-db'

export const maxDuration = 300 // 5 minutes timeout (Vercel Pro)

const QWEN_API_KEY = process.env.QWEN_API_KEY || ''
const QWEN_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions'

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

  // 4. Chiama Qwen
  console.log(`[genera-proposte] Inizio generazione per progetto ${progetto_id}, componenti: ${componenti.join(', ')}`)
  console.log(`[genera-proposte] Fornitori DB trovati: ${Object.entries(fornitoriDB).map(([k,v]) => `${k}: ${(v as unknown[]).length}`).join(', ')}`)
  console.log(`[genera-proposte] QWEN_API_KEY presente: ${!!QWEN_API_KEY}, primi 8 char: ${QWEN_API_KEY?.slice(0,8)}...`)
  
  if (!QWEN_API_KEY) {
    console.error('[genera-proposte] QWEN_API_KEY mancante!')
    return NextResponse.json({ error: 'QWEN_API_KEY non configurata nelle environment variables' }, { status: 500 })
  }

  let aiResult: Record<string, unknown> | null = null
  try {
    console.log('[genera-proposte] Chiamata Qwen in corso...')
    const aiResponse = await fetch(QWEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${QWEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          {
            role: 'system',
            content: `Sei un esperto event planner italiano senior con 15 anni di esperienza nel settore MICE.
Conosci a fondo fornitori, venue, hotel e servizi per eventi corporate in tutta Italia.
Rispondi SEMPRE e SOLO con JSON valido, senza markdown, senza backtick, senza commenti.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 12000,
        response_format: { type: 'json_object' },
      }),
    })

    console.log(`[genera-proposte] Qwen response status: ${aiResponse.status}`)
    
    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error(`[genera-proposte] Qwen HTTP error ${aiResponse.status}: ${errText.slice(0, 500)}`)
      await supabase.from('progetti').update({ stato: 'in_lavorazione' }).eq('id', progetto_id)
      return NextResponse.json({ error: `Qwen API error ${aiResponse.status}: ${errText.slice(0, 200)}` }, { status: 500 })
    }

    const aiData = await aiResponse.json()
    console.log(`[genera-proposte] Qwen response model: ${aiData.model}, usage: ${JSON.stringify(aiData.usage)}`)
    
    const content = aiData.choices?.[0]?.message?.content
    if (content) {
      aiResult = typeof content === 'string' ? JSON.parse(content) : content
      console.log(`[genera-proposte] AI result keys: ${Object.keys(aiResult as Record<string, unknown>).join(', ')}`)
    } else {
      console.error('[genera-proposte] Nessun content nella risposta Qwen:', JSON.stringify(aiData).slice(0, 500))
    }
  } catch (e) {
    console.error('[genera-proposte] Errore Qwen catch:', e)
    await supabase.from('progetti').update({ stato: 'in_lavorazione' }).eq('id', progetto_id)
    return NextResponse.json({ error: `Errore generazione AI: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }

  if (!aiResult) {
    return NextResponse.json({ error: 'Nessuna risposta dalla AI' }, { status: 500 })
  }

  // 5. Rimuovi proposte AI precedenti e salva le nuove
  await supabase.from('proposte').delete()
    .eq('progetto_id', progetto_id)
    .in('fonte', ['ai', 'yeg_db'])

  const proposte = parseProposte(aiResult, progetto_id)

  let inserted = 0
  for (let i = 0; i < proposte.length; i += 10) {
    const batch = proposte.slice(i, i + 10)
    const { error: errInsert } = await supabase.from('proposte').insert(batch)
    if (errInsert) {
      for (const p of batch) {
        const { error: e2 } = await supabase.from('proposte').insert(p)
        if (!e2) inserted++
        else console.error(`SKIP "${p.nome}": ${e2.message}`)
      }
    } else {
      inserted += batch.length
    }
  }

  // 6. Aggiorna progetto
  await supabase.from('progetti').update({
    stato: 'in_lavorazione',
    brief_interpretato: (aiResult as Record<string, unknown>).brief_interpretato || null,
  }).eq('id', progetto_id)

  await supabase.from('storico').insert({
    progetto_id,
    azione: `AI ha generato ${inserted} proposte per: ${componenti.join(', ')}`,
    utente: 'sistema',
  })

  return NextResponse.json({ success: true, progetto_id, totale_proposte: inserted })
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
1. Per OGNI componente richiesta (${componenti.join(', ')}), genera esattamente 5 proposte.
2. I fornitori YEG listati sopra devono essere nelle prime posizioni se adatti (is_yeg_supplier:true, fonte:"yeg_db").
3. Completa con fornitori REALI italiani da siti del settore (meetingecongressi.it, spazieventi.it, hotel chains NH/Hilton/Marriott/Starhotels, ecc.)
4. IMPORTANTE: NON inserire lo stesso fornitore/piattaforma più volte nella stessa categoria. Ogni proposta deve essere un fornitore DISTINTO. Se un gruppo alberghiero ha più hotel nella stessa città, scegline solo uno.
5. Per ogni proposta: pro[] e contro[] specifici e onesti (almeno 2 ciascuno).
6. Prezzi realistici per il mercato eventi corporate italiano.
7. Includi sito_web, email e telefono reali quando possibile.

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
          "sito_web": "https://...",
          "contatto": "email e/o telefono",
          "is_yeg_supplier": false,
          "fonte": "ai"
        }
      ]
    }
  }
}`
}


function parseProposte(aiResult: Record<string, unknown>, progettoId: string) {
  const proposte: Record<string, unknown>[] = []
  const categorie = (aiResult as { categorie?: Record<string, { proposte?: Record<string, unknown>[] }> }).categorie
  if (!categorie) return proposte

  for (const [catKey, catData] of Object.entries(categorie)) {
    const prps = catData.proposte || []
    prps.forEach((p, idx) => {
      proposte.push({
        progetto_id: progettoId,
        categoria: p.categoria || catKey,
        nome: p.nome,
        descrizione: p.descrizione || null,
        motivo_match: p.motivo_match || null,
        prezzo_stimato: p.prezzo_stimato || null,
        capacita: p.capacita || null,
        indirizzo: p.indirizzo || null,
        punti_forza: p.pro || p.punti_forza || [],
        pro: p.pro || [],
        contro: p.contro || [],
        adeguatezza_budget: p.adeguatezza_budget || null,
        note: p.note || null,
        sito_web: p.sito_web || null,
        contatto: p.contatto || null,
        immagine_url: null,
        fonte: p.fonte || (p.is_yeg_supplier ? 'yeg_db' : 'ai'),
        is_yeg_supplier: p.is_yeg_supplier || false,
        selezionato_manager: false,
        selezionato_cliente: false,
        ordine: idx,
      })
    })
  }

  return proposte
}
