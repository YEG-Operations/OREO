import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { assertSameOrigin } from '@/lib/api-helpers'

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
  // Internal manager-only endpoint: enforce same-origin in production.
  const forbidden = assertSameOrigin(req)
  if (forbidden) return forbidden

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
      const { proposta_id, ...rest } = body
      const allowed = ['nome','descrizione','motivo_match','pro','contro','punti_forza',
        'prezzo_stimato','costo_reale','capacita','indirizzo','contatto','sito_web','note',
        'da_verificare','markup_percentuale','iva_percentuale','immagine_url','immagini']
      const updates: Record<string, unknown> = {}
      for (const k of allowed) {
        if (rest[k] !== undefined) updates[k] = rest[k]
      }

      // Manager editing contact info implicitly verifies it: if `contatto` or
      // `sito_web` is present in the payload and `da_verificare` was NOT
      // explicitly provided, force da_verificare = false.
      const touchesContact = rest.contatto !== undefined || rest.sito_web !== undefined
      const explicitVerify = Object.prototype.hasOwnProperty.call(rest, 'da_verificare')
      if (touchesContact && !explicitVerify) {
        updates.da_verificare = false
      }

      await supabase.from('proposte').update(updates).eq('id', proposta_id)
      return NextResponse.json({ success: true })
    }

    case 'delete_proposta': {
      await supabase.from('proposte').delete().eq('id', body.proposta_id)
      return NextResponse.json({ success: true })
    }

    case 'delete_all_proposte': {
      const { error: delErr, count } = await supabase
        .from('proposte')
        .delete()
        .eq('progetto_id', params.id)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
      return NextResponse.json({ success: true, deleted: count })
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

    case 'update_settings': {
      // Aggiornamento impostazioni progetto (costi, operatore, ecc.)
      const allowedSettings = [
        'email_operatore',
        'markup_percentuale',
        'iva_percentuale',
        'fee_agenzia_percentuale',
        'frasi_standard_costi',
        'nascondi_fornitori',
        'note_manager',
      ]
      const updates: Record<string, unknown> = {}
      for (const k of allowedSettings) {
        if (body[k] !== undefined) updates[k] = body[k]
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('progetti').update(updates).eq('id', params.id)
      }
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
