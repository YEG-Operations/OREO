import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/proposta/:token/conferma - cliente conferma selezioni
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceClient()
  const { selezioni } = await req.json() // array di proposta IDs

  // Validate: selezioni must be an array of numbers.
  if (!Array.isArray(selezioni) || !selezioni.every((x) => typeof x === 'number' && Number.isFinite(x))) {
    return NextResponse.json(
      { error: 'Payload non valido: selezioni deve essere un array di numeri' },
      { status: 400 }
    )
  }

  // Trova progetto per token
  const { data: progetto, error } = await supabase
    .from('progetti')
    .select('id')
    .eq('token_cliente', params.id)
    .single()

  if (error || !progetto) {
    return NextResponse.json({ error: 'Proposta non trovata' }, { status: 404 })
  }

  // Reset tutte le selezioni cliente per questo progetto
  await supabase
    .from('proposte')
    .update({ selezionato_cliente: false })
    .eq('progetto_id', progetto.id)

  // Segna le selezionate — scope explicitly to THIS project to prevent a
  // malicious client from toggling proposals belonging to other projects.
  if (selezioni.length > 0) {
    await supabase
      .from('proposte')
      .update({ selezionato_cliente: true })
      .eq('progetto_id', progetto.id)
      .in('id', selezioni)
  }

  // Aggiorna stato progetto
  await supabase
    .from('progetti')
    .update({ stato: 'confermato' })
    .eq('id', progetto.id)

  // Log
  await supabase.from('storico').insert({
    progetto_id: progetto.id,
    azione: `Cliente ha confermato ${selezioni.length} proposte`,
    utente: 'cliente',
    dettagli: { selezioni },
  })

  return NextResponse.json({ success: true })
}
