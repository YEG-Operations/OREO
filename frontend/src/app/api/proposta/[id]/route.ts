import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/proposta/:token - vista cliente
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceClient()

  // Cerca progetto per token_cliente
  const { data: progetto, error } = await supabase
    .from('progetti')
    .select('id, nome_evento, tipologia_evento, citta, data_inizio, data_fine, numero_partecipanti, budget_totale, stato, token_cliente, markup_percentuale, iva_percentuale, nascondi_fornitori, frasi_standard_costi')
    .eq('token_cliente', params.id)
    .single()

  if (error || !progetto) {
    return NextResponse.json({ error: 'Proposta non trovata' }, { status: 404 })
  }

  // Solo proposte selezionate dal manager
  const { data: proposte } = await supabase
    .from('proposte')
    .select('*')
    .eq('progetto_id', progetto.id)
    .eq('selezionato_manager', true)
    .order('categoria')
    .order('ordine')

  return NextResponse.json({ progetto, proposte: proposte || [] })
}
