import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Fields safe to expose to the client-facing proposta page. Explicitly
// excludes internal pricing/verification fields: costo_reale,
// markup_percentuale, iva_percentuale, da_verificare, email_verified,
// email_verification_error, fonte, selezionato_manager.
const CLIENT_PROPOSTA_FIELDS = [
  'id',
  'progetto_id',
  'categoria',
  'nome',
  'descrizione',
  'motivo_match',
  'prezzo_stimato',
  'capacita',
  'indirizzo',
  'pro',
  'contro',
  'punti_forza',
  'adeguatezza_budget',
  'note',
  'sito_web',
  'contatto',
  'immagine_url',
  'immagini',
  'is_yeg_supplier',
  'ordine',
  // Client-selection state must be readable so the UI can reflect it.
  'selezionato_cliente',
].join(', ')

// Project fields the client page actually needs. markup_percentuale,
// iva_percentuale, and budget_totale are intentionally omitted — they are
// business-internal and the client already knows their own budget.
const CLIENT_PROGETTO_FIELDS = [
  'id',
  'nome_evento',
  'tipologia_evento',
  'citta',
  'data_inizio',
  'data_fine',
  'numero_partecipanti',
  'stato',
  'token_cliente',
  'nascondi_fornitori',
  'frasi_standard_costi',
].join(', ')

// GET /api/proposta/:token - vista cliente
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceClient()

  // Observability: log IP + token for future abuse monitoring. No rate limit yet.
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  console.log(`[proposta:get] token=${params.id} ip=${ip}`)

  // Cerca progetto per token_cliente (whitelist: no internal pricing fields)
  const { data: progetto, error } = await supabase
    .from('progetti')
    .select(CLIENT_PROGETTO_FIELDS)
    .eq('token_cliente', params.id)
    .single()

  if (error || !progetto) {
    return NextResponse.json({ error: 'Proposta non trovata' }, { status: 404 })
  }

  // Solo proposte selezionate dal manager (whitelist: no internal costs/verification)
  const { data: proposte } = await supabase
    .from('proposte')
    .select(CLIENT_PROPOSTA_FIELDS)
    .eq('progetto_id', (progetto as unknown as { id: string }).id)
    .eq('selezionato_manager', true)
    .order('categoria')
    .order('ordine')

  return NextResponse.json({ progetto, proposte: proposte || [] })
}
