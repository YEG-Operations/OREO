import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

const QWEN_API_KEY = process.env.QWEN_API_KEY || ''
const QWEN_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions'

// POST /api/genera-proposte - Genera proposte AI per un progetto
export async function POST(req: NextRequest) {
  const supabase = getServiceClient()
  const { progetto_id } = await req.json()

  if (!progetto_id) {
    return NextResponse.json({ error: 'progetto_id richiesto' }, { status: 400 })
  }

  // 1. Carica progetto
  const { data: progetto, error: errProgetto } = await supabase
    .from('progetti')
    .select('*')
    .eq('id', progetto_id)
    .single()

  if (errProgetto || !progetto) {
    return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 })
  }

  const brief = progetto.brief_raw
  const componenti: string[] = progetto.componenti_richieste || []

  // 2. Query fornitori matching da Supabase
  let fornitori: Record<string, unknown>[] = []
  try {
    const { data } = await supabase.rpc('search_fornitori', {
      p_citta: brief.citta || null,
      p_categorie: componenti.length > 0 ? componenti : null,
      p_pax: brief.numero_partecipanti || null,
    })
    fornitori = data || []
  } catch {
    // Se la RPC non esiste, fallback a query diretta
    const query = supabase.from('fornitori').select('*').eq('attivo', true)
    if (brief.citta) query.ilike('citta', `%${brief.citta}%`)
    if (componenti.length > 0) query.in('categoria', componenti)
    query.limit(100)
    const { data } = await query
    fornitori = data || []
  }

  // 3. Costruisci prompt per Qwen
  const prompt = buildPrompt(brief, componenti, fornitori)

  // 4. Chiama Qwen AI
  let aiResult: Record<string, unknown> | null = null
  try {
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
            content: `Sei un esperto event planner italiano senior con 15 anni di esperienza nel settore MICE (Meetings, Incentives, Conferences, Events).
Hai una conoscenza approfondita di:
- Location e venue in tutta Italia (conosci meetingecongressi.it, spazieventi.it, locationmatrimonio.it)
- Hotel per eventi corporate (booking.com/business, hrs.com, venere.com)
- Servizi di catering premium (cateringonline.it, banqueting.it)
- Trasporti e NCC (autoservizigranturismo.it, busforyou.it)
- Entertainment e team building (teamworking.it, teambuildingitalia.it)

Rispondi SEMPRE e SOLO con JSON valido, senza markdown, senza backtick, senza commenti.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 12000,
        response_format: { type: 'json_object' },
      }),
    })

    const aiData = await aiResponse.json()
    const content = aiData.choices?.[0]?.message?.content
    if (content) {
      aiResult = typeof content === 'string' ? JSON.parse(content) : content
    }
  } catch (e) {
    console.error('Errore Qwen AI:', e)
    // Aggiorna progetto con errore
    await supabase.from('progetti').update({ stato: 'in_lavorazione' }).eq('id', progetto_id)
    await supabase.from('storico').insert({
      progetto_id,
      azione: `Errore generazione AI: ${e instanceof Error ? e.message : 'unknown'}`,
      utente: 'sistema',
    })
    return NextResponse.json({ error: 'Errore generazione AI' }, { status: 500 })
  }

  if (!aiResult) {
    return NextResponse.json({ error: 'Nessuna risposta dalla AI' }, { status: 500 })
  }

  // 5. Parse e salva proposte (rimuovi vecchie proposte AI prima)
  await supabase.from('proposte').delete()
    .eq('progetto_id', progetto_id)
    .in('fonte', ['ai', 'yeg_db'])

  const proposte = parseProposte(aiResult, progetto_id)

  if (proposte.length > 0) {
    // Insert in batch da 10 per debug
    let inserted = 0
    for (let i = 0; i < proposte.length; i += 10) {
      const batch = proposte.slice(i, i + 10)
      const { error: errInsert } = await supabase.from('proposte').insert(batch)
      if (errInsert) {
        console.error(`Errore inserimento batch ${i}:`, errInsert.message, errInsert.details)
        // Prova uno per uno per capire quale fallisce
        for (const p of batch) {
          const { error: errSingle } = await supabase.from('proposte').insert(p)
          if (errSingle) {
            console.error(`Errore proposta "${p.nome}":`, errSingle.message, JSON.stringify(p).substring(0, 200))
          } else {
            inserted++
          }
        }
      } else {
        inserted += batch.length
      }
    }
    console.log(`Proposte inserite: ${inserted}/${proposte.length}`)
  }

  // 6. Aggiorna progetto con brief_interpretato e stato
  const briefInterpretato = (aiResult as Record<string, unknown>).brief_interpretato || null
  await supabase.from('progetti').update({
    stato: 'in_lavorazione',
    brief_interpretato: briefInterpretato,
  }).eq('id', progetto_id)

  // 7. Log
  await supabase.from('storico').insert({
    progetto_id,
    azione: `AI ha generato ${proposte.length} proposte per ${componenti.length} categorie`,
    utente: 'sistema',
    dettagli: { categorie: componenti, totale_proposte: proposte.length },
  })

  return NextResponse.json({
    success: true,
    progetto_id,
    totale_proposte: proposte.length,
    brief_interpretato: briefInterpretato,
  })
}


function buildPrompt(
  brief: Record<string, unknown>,
  componenti: string[],
  fornitori: Record<string, unknown>[]
): string {
  // Formatta fornitori YEG trovati nel DB
  let fornitoriText = ''
  if (fornitori.length > 0) {
    fornitoriText = '\n\n--- FORNITORI DATABASE YEG (da preferire se adatti) ---'
    for (const f of fornitori) {
      const det: string[] = []
      if (f.capacita_max) det.push(`Max ${f.capacita_max} pax`)
      if (f.prezzo_min || f.prezzo_max) det.push(`${f.prezzo_min || '?'}-${f.prezzo_max || '?'} EUR ${f.prezzo_unita || ''}`)
      if (f.note) det.push(String(f.note).substring(0, 100))
      if (f.sito_web) det.push(String(f.sito_web))
      const contatti = f.contatti as Record<string, string> | null
      if (contatti?.email) det.push(`Email: ${contatti.email}`)
      if (contatti?.telefono) det.push(`Tel: ${contatti.telefono}`)
      fornitoriText += `\n[${f.categoria}] ${f.nome} (${f.citta || 'N/A'}) | ${det.join(' | ')}`
    }
    fornitoriText += '\n--- FINE FORNITORI YEG ---'
  }

  // Dettagli componenti dal brief
  let dettagli = ''
  if (brief.hotel_attivo) {
    dettagli += `\n\nHOTEL: check-in ${brief.hotel_checkin}, check-out ${brief.hotel_checkout}, ${brief.camere_singole || 0} singole + ${brief.camere_doppie || 0} doppie, min ${brief.hotel_stelle_minime || 4} stelle. ${brief.hotel_note || ''}`
  }
  if (brief.location_attiva) {
    const av = Array.isArray(brief.location_av) ? brief.location_av.join(', ') : ''
    dettagli += `\n\nLOCATION: setup ${brief.location_setup}, AV: ${av}, tipologia: ${brief.location_tipologia || 'qualsiasi'}. ${brief.location_note || ''}`
  }
  if (brief.catering_attivo) {
    dettagli += `\n\nCATERING: ${brief.coffee_break_num || 0} coffee break, ${brief.pranzo_num || 0} pranzi, ${brief.cena_num || 0} cene, ${brief.aperitivo_num || 0} aperitivi. Esigenze: ${brief.esigenze_alimentari || 'nessuna'}. ${brief.catering_note || ''}`
  }
  if (brief.trasporti_attivi) {
    const tipi = Array.isArray(brief.trasporti_tipo) ? brief.trasporti_tipo.join(', ') : ''
    dettagli += `\n\nTRASPORTI: ${tipi}. ${brief.trasporti_note || ''}`
  }
  if (brief.entertainment_attivo) {
    dettagli += `\n\nENTERTAINMENT: ${brief.entertainment_tipo || 'da definire'}. ${brief.entertainment_note || ''}`
  }
  if (brief.teambuilding_attivo) {
    dettagli += `\n\nTEAM BUILDING: ${brief.teambuilding_note || 'da definire'}`
  }

  return `Analizza questo brief evento e genera proposte CONCRETE con fornitori REALI.

--- BRIEF ---
Evento: ${brief.nome_evento} (${brief.tipologia_evento})
Azienda: ${brief.azienda}
Citta: ${brief.citta}
Date: ${brief.data_inizio} ${brief.orario_inizio || ''} - ${brief.data_fine} ${brief.orario_fine || ''}
Partecipanti: ${brief.numero_partecipanti}
Budget totale: ${brief.budget_totale || 'da definire'} EUR
Agenda: ${brief.agenda || 'non specificata'}
${dettagli}
--- FINE BRIEF ---
${fornitoriText}

ISTRUZIONI CRITICHE:
1. Per OGNI componente richiesta (${componenti.join(', ')}), genera esattamente 5 proposte.
2. PRIORITA FORNITORI YEG: se ci sono fornitori YEG adatti nella lista sopra, inseriscili nelle prime posizioni con is_yeg_supplier:true e fonte:"yeg_db".
3. COMPLETA con fornitori REALI che conosci da siti autorevoli del settore eventi italiano:
   - Location/Venue: cerca su meetingecongressi.it, spazieventi.it, eventiatmilano.it (se Milano)
   - Hotel: catene come NH, Hilton, Marriott, Starhotels, Atahotels adatte alla citta
   - Catering: aziende reali di catering per eventi corporate della zona
   - Trasporti: NCC e bus reali della zona (es. Autoservizi Giachino a Torino, SIT Bus per Roma, etc.)
   - Entertainment: agenzie reali di entertainment/artisti per eventi corporate
   - Team Building: provider reali di team building corporate in Italia
4. Per ogni proposta includi PRO (vantaggi) e CONTRO (svantaggi/limiti) specifici e onesti.
5. Includi SEMPRE sito web reale, email e telefono del fornitore quando possibile.
6. I prezzi devono essere realistici per il mercato italiano degli eventi corporate.

RISPONDI SOLO JSON con questa struttura:
{
  "brief_interpretato": {
    "sintesi": "riepilogo in 2-3 frasi",
    "obiettivi_evento": "cosa vuole ottenere il cliente",
    "tono_evento": "formale|informale|lusso|dinamico",
    "priorita": ["lista priorita"],
    "suggerimenti_ai": "consigli strategici per l'event manager"
  },
  "categorie": {
    "nome_categoria": {
      "proposte": [
        {
          "nome": "Nome REALE del fornitore",
          "categoria": "location|catering|hotel|trasporti|entertainment|teambuilding",
          "descrizione": "descrizione dettagliata del servizio offerto, max 100 parole",
          "motivo_match": "perche risolve QUESTA esigenza specifica del brief",
          "prezzo_stimato": 0,
          "capacita": "capienza/disponibilita",
          "indirizzo": "indirizzo completo o zona",
          "pro": ["vantaggio 1", "vantaggio 2", "vantaggio 3"],
          "contro": ["svantaggio 1", "svantaggio 2"],
          "adeguatezza_budget": 0,
          "note": "info extra, criticita, tempi di risposta",
          "sito_web": "URL reale del fornitore",
          "contatto": "email e/o telefono reale",
          "is_yeg_supplier": false,
          "fonte": "ai"
        }
      ]
    }
  }
}`
}


function parseProposte(
  aiResult: Record<string, unknown>,
  progettoId: string
): Record<string, unknown>[] {
  const proposte: Record<string, unknown>[] = []
  const categorie = (aiResult as { categorie?: Record<string, { proposte?: Record<string, unknown>[] }> }).categorie

  if (!categorie) return proposte

  for (const [catKey, catData] of Object.entries(categorie)) {
    const prps = catData.proposte || []
    prps.forEach((p: Record<string, unknown>, idx: number) => {
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
