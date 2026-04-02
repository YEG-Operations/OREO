import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/progetti/:id - dettaglio progetto + proposte
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceClient()

  const [progettoRes, proposteRes] = await Promise.all([
    supabase.from('progetti').select('*').eq('id', params.id).single(),
    supabase.from('proposte').select('*').eq('progetto_id', params.id).order('categoria').order('ordine'),
  ])

  if (progettoRes.error) return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 })

  return NextResponse.json({
    progetto: progettoRes.data,
    proposte: proposteRes.data || [],
  })
}

// PUT /api/progetti/:id - azioni sul progetto
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceClient()
  const body = await req.json()
  const { azione } = body

  switch (azione) {
    case 'toggle_proposta': {
      const { proposta_id, selezionato_manager } = body
      await supabase.from('proposte').update({ selezionato_manager }).eq('id', proposta_id)
      return NextResponse.json({ success: true })
    }

    case 'update_proposta': {
      const { proposta_id, costo_reale, note } = body
      const updates: Record<string, unknown> = {}
      if (costo_reale !== undefined) updates.costo_reale = costo_reale
      if (note !== undefined) updates.note = note
      await supabase.from('proposte').update(updates).eq('id', proposta_id)
      return NextResponse.json({ success: true })
    }

    case 'delete_proposta': {
      await supabase.from('proposte').delete().eq('id', body.proposta_id)
      return NextResponse.json({ success: true })
    }

    case 'add_proposta': {
      const { data } = await supabase.from('proposte').insert({
        progetto_id: params.id,
        ...body.proposta,
      }).select().single()
      return NextResponse.json({ success: true, proposta: data })
    }

    case 'invia_al_cliente': {
      await supabase.from('progetti').update({ stato: 'inviato' }).eq('id', params.id)
      await supabase.from('storico').insert({
        progetto_id: params.id,
        azione: 'Proposta inviata al cliente',
        utente: 'event_manager',
      })
      return NextResponse.json({ success: true })
    }

    default: {
      // Aggiornamento generico progetto
      const { note_manager, stato } = body
      const updates: Record<string, unknown> = {}
      if (note_manager !== undefined) updates.note_manager = note_manager
      if (stato) updates.stato = stato
      if (Object.keys(updates).length > 0) {
        await supabase.from('progetti').update(updates).eq('id', params.id)
      }
      return NextResponse.json({ success: true })
    }
  }
}
