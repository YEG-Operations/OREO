import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { searchFornitori, formatFornitoriPerPrompt, type CategoriaDB } from '@/lib/fornitori-db'
import { callQwen, QwenApiError, QwenParseError } from '@/lib/qwen'
import { SingleCategorySchema, normalizeProposal } from '@/lib/ai-schema'
import { z } from 'zod'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// POST /api/cerca-proposta
// Ricerca AI una singola categoria con parametri aggiuntivi
export async function POST(req: NextRequest) {
  const supabase = getServiceClient()
  const { progetto_id, categoria, parametri_extra } = await req.json()

  if (!progetto_id || !categoria) {
    return NextResponse.json({ error: 'progetto_id e categoria richiesti' }, { status: 400 })
  }

  const { data: progetto, error } = await supabase
    .from('progetti').select('*').eq('id', progetto_id).single()

  if (error || !progetto) {
    return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 })
  }

  // Cerca nel DB categoria-specifico
  const categoriaDB = categoria as CategoriaDB
  const fornitori = await searchFornitori(supabase, categoriaDB, progetto.citta, 30)
  const fornitoriText = formatFornitoriPerPrompt({ [categoria]: fornitori })

  const systemPrompt = `Sei un esperto event planner italiano senior nel settore MICE.
Rispondi SEMPRE e SOLO con JSON valido, senza markdown, senza backtick, senza commenti.`

  const prompt = `Trova 3 fornitori specifici per questa richiesta.

EVENTO: ${progetto.nome_evento} — ${progetto.azienda}
Città: ${progetto.citta}
Date: ${progetto.data_inizio} - ${progetto.data_fine}
Partecipanti: ${progetto.numero_partecipanti}
Budget totale: ${progetto.budget_totale || 'da definire'} EUR

CATEGORIA: ${categoria}
PARAMETRI AGGIUNTIVI: ${parametri_extra || 'nessuno'}

FORNITORI YEG NEL DATABASE (priorità se pertinenti):
${fornitoriText || 'Nessun fornitore YEG per questa categoria/città'}

ISTRUZIONI:
- Preferisci SEMPRE fornitori YEG se pertinenti (is_yeg_supplier:true, fonte:"yeg_db").
- IMPORTANTE (anti-allucinazione): NON hai accesso al web. Per i fornitori REALI italiani che conosci, inserisci sito_web e contatto SOLO se sei certo al 100% del dato. Altrimenti OMETTI il campo (usa null). NON inventare MAI email o numeri di telefono. L'agenzia invia email reali a questi contatti: meglio null che un dato inventato.
- Genera esattamente 3 proposte REALI per la categoria ${categoria} a ${progetto.citta}.

Rispondi SOLO con JSON:
{
  "proposte": [
    {
      "nome": "Nome Fornitore",
      "descrizione": "Descrizione dettagliata",
      "motivo_match": "Perché è adatto a questo brief",
      "pro": ["punto 1", "punto 2", "punto 3"],
      "contro": ["limite 1", "limite 2"],
      "prezzo_stimato": 5000,
      "capacita": "fino a 200 pax",
      "indirizzo": "Via Roma 1, Milano",
      "contatto": null,
      "sito_web": null,
      "is_yeg_supplier": false,
      "fonte": "ai"
    }
  ]
}`

  let rawResult: unknown
  try {
    rawResult = await callQwen<unknown>({
      system: systemPrompt,
      user: prompt,
      maxTokens: 2000,
      temperature: 0.7,
    })
  } catch (e) {
    if (e instanceof QwenParseError) {
      console.error('[cerca-proposta] Qwen parse error:', e.message)
      console.error('[cerca-proposta] Raw snippet:', e.rawSnippet.slice(0, 800))
      return NextResponse.json(
        { error: `AI response non era JSON valido: ${e.message}` },
        { status: 502 }
      )
    }
    if (e instanceof QwenApiError) {
      console.error(`[cerca-proposta] Qwen API error (status=${e.status}):`, e.message)
      return NextResponse.json(
        { error: `Qwen API error: ${e.message}` },
        { status: 502 }
      )
    }
    console.error('[cerca-proposta] error:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }

  // Validazione schema
  let parsed: z.infer<typeof SingleCategorySchema>
  try {
    parsed = SingleCategorySchema.parse(rawResult)
  } catch (e) {
    console.error(
      '[cerca-proposta] Validazione Zod fallita:',
      e instanceof z.ZodError ? JSON.stringify(e.issues).slice(0, 800) : String(e)
    )
    console.error('[cerca-proposta] Raw AI payload:', JSON.stringify(rawResult).slice(0, 1000))
    return NextResponse.json(
      {
        error: 'AI output non conforme allo schema atteso',
        details: e instanceof z.ZodError ? e.issues : String(e),
      },
      { status: 502 }
    )
  }

  const salvate: Record<string, unknown>[] = []

  try {
    for (const p of parsed.proposte) {
      const n = normalizeProposal({
        ...p,
        // per cerca-proposta la categoria arriva da URL/body, non dall'AI
        categoria: (p.categoria ?? (categoria as typeof p.categoria)) || undefined,
      })

      const row = {
        progetto_id,
        categoria,
        nome: n.nome || 'Fornitore',
        descrizione: n.descrizione ?? null,
        motivo_match: n.motivo_match ?? null,
        pro: n.pro,
        contro: n.contro,
        // TODO: remove punti_forza after UI audit — pro è il campo primario.
        punti_forza: n.pro,
        prezzo_stimato: typeof n.prezzo_stimato === 'number' ? n.prezzo_stimato : null,
        capacita: n.capacita ?? null,
        indirizzo: n.indirizzo ?? null,
        contatto: n.contatto ?? null,
        sito_web: n.sito_web ?? null,
        is_yeg_supplier: n.is_yeg_supplier === true,
        fonte: n.is_yeg_supplier ? 'yeg_db' : n.fonte,
        da_verificare: n.da_verificare,
        email_verified: n.email_verified,
        selezionato_manager: false,
        selezionato_cliente: false,
        ordine: 99,
      }

      const { data, error: errInsert } = await supabase
        .from('proposte')
        .insert(row)
        .select()
        .single()

      if (errInsert) {
        console.error(`[cerca-proposta] SKIP "${n.nome}": ${errInsert.message}`)
        continue
      }
      if (data) salvate.push(data)
    }
  } catch (err) {
    console.error('[cerca-proposta] insert exception:', err)
    return NextResponse.json(
      { error: 'Errore salvataggio proposte', proposte: salvate },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, proposte: salvate })
}
