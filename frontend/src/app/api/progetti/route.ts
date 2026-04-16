import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('progetti')
    .select('id, stato, nome_evento, tipologia_evento, nome_referente, email_referente, azienda, citta, data_inizio, data_fine, numero_partecipanti, budget_totale, componenti_richieste, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ progetti: data })
}
