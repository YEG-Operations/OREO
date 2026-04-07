import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { searchFornitori, formatFornitoriPerPrompt, type CategoriaDB } from '@/lib/fornitori-db'

const QWEN_API_KEY = process.env.QWEN_API_KEY || ''
const QWEN_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions'

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

  const prompt = `Sei un esperto di event management in Italia.
Trova 3 fornitori specifici per questa richiesta.

EVENTO: ${progetto.nome_evento} — ${progetto.azienda}
Città: ${progetto.citta}
Date: ${progetto.data_inizio} - ${progetto.data_fine}
Partecipanti: ${progetto.numero_partecipanti}
Budget totale: ${progetto.budget_totale || 'da definire'} EUR

CATEGORIA: ${categoria}
PARAMETRI AGGIUNTIVI: ${parametri_extra || 'nessuno'}

FORNITORI YEG NEL DATABASE (priorità se pertinenti):
${fornitoriText || 'Nessun fornitore YEG per questa categoria/città'}

Cerca su siti autorevoli italiani del settore e nella tua conoscenza.
Genera esattamente 3 proposte REALI per la categoria ${categoria} a ${progetto.citta}.

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
      "contatto": "info@fornitore.it / +39 02 1234567",
      "sito_web": "https://www.fornitore.it",
      "is_yeg_supplier": false,
      "fonte": "ai"
    }
  ]
}`

  try {
    const aiRes = await fetch(QWEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${QWEN_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 3000,
      }),
    })

    if (!aiRes.ok) {
      return NextResponse.json({ error: 'Errore AI' }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const content = aiData.choices?.[0]?.message?.content || ''
    let parsed: { proposte?: Record<string, unknown>[] } = {}

    try {
      parsed = JSON.parse(content)
    } catch {
      return NextResponse.json({ error: 'Risposta AI non valida' }, { status: 500 })
    }

    const proposteRaw = parsed.proposte || []
    const salvate: Record<string, unknown>[] = []

    for (const p of proposteRaw) {
      const { data } = await supabase.from('proposte').insert({
        progetto_id,
        categoria,
        nome: p.nome || 'Fornitore',
        descrizione: p.descrizione || null,
        motivo_match: p.motivo_match || null,
        pro: Array.isArray(p.pro) ? p.pro : [],
        contro: Array.isArray(p.contro) ? p.contro : [],
        punti_forza: Array.isArray(p.pro) ? p.pro : [],
        prezzo_stimato: typeof p.prezzo_stimato === 'number' ? p.prezzo_stimato : null,
        capacita: p.capacita || null,
        indirizzo: p.indirizzo || null,
        contatto: p.contatto || null,
        sito_web: p.sito_web || null,
        is_yeg_supplier: p.is_yeg_supplier === true,
        fonte: p.is_yeg_supplier ? 'yeg_db' : 'ai',
        selezionato_manager: false,
        selezionato_cliente: false,
        ordine: 99,
      }).select().single()

      if (data) salvate.push(data)
    }

    return NextResponse.json({ success: true, proposte: salvate })
  } catch (err) {
    console.error('cerca-proposta error:', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
