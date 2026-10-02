/**
 * POST /api/brief/estrai
 *
 * Riceve un documento di brief (PDF / Word .docx / testo) in multipart,
 * ne estrae il testo e lo fa interpretare a Qwen per precompilare il form.
 *
 * Non scrive nulla sul database: restituisce solo un patch di campi che la UI
 * applica al form, lasciando all'operatore la revisione finale.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSameOrigin, logError } from '@/lib/api-helpers'
import { callQwen, QwenApiError, QwenParseError } from '@/lib/qwen'
import {
  BriefExtractSchema,
  EXTRACT_SYSTEM_PROMPT,
  EmptyDocumentError,
  MAX_UPLOAD_BYTES,
  UnsupportedFileTypeError,
  buildExtractPrompt,
  extractDocumentText,
  toFormPatch,
} from '@/lib/brief-extract'

// `mammoth` e `unpdf` richiedono le API Node (Buffer, stream): non edge.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req)
  if (forbidden) return forbidden

  // 1. File dalla request multipart
  let file: File
  try {
    const formData = await req.formData()
    const uploaded = formData.get('file')
    if (!(uploaded instanceof File)) {
      return NextResponse.json(
        { error: 'Nessun file ricevuto: allega il documento nel campo "file".' },
        { status: 400 }
      )
    }
    file = uploaded
  } catch (e) {
    logError('brief/estrai:formdata', e)
    return NextResponse.json({ error: 'Richiesta non valida (multipart atteso).' }, { status: 400 })
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'Il file è vuoto.' }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))
    return NextResponse.json(
      { error: `File troppo grande (max ${mb} MB).` },
      { status: 413 }
    )
  }

  // 2. Documento → testo
  let estratto: Awaited<ReturnType<typeof extractDocumentText>>
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    estratto = await extractDocumentText(bytes, file.name, file.type)
  } catch (e) {
    if (e instanceof UnsupportedFileTypeError) {
      return NextResponse.json({ error: e.message }, { status: 415 })
    }
    if (e instanceof EmptyDocumentError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    logError('brief/estrai:parse', e)
    return NextResponse.json(
      { error: 'Non è stato possibile leggere il documento. Verifica che non sia protetto da password o corrotto.' },
      { status: 422 }
    )
  }

  console.log(
    `[brief/estrai] file="${file.name}" tipo=${estratto.kind} caratteri=${estratto.text.length}${
      estratto.truncated ? ' (troncato)' : ''
    }`
  )

  // 3. Testo → JSON strutturato (temperature 0: è estrazione, non creatività)
  const today = new Date().toISOString().slice(0, 10)
  let rawResult: unknown
  try {
    rawResult = await callQwen<unknown>({
      system: EXTRACT_SYSTEM_PROMPT,
      user: buildExtractPrompt(estratto.text, today),
      maxTokens: 4000,
      temperature: 0,
    })
  } catch (e) {
    if (e instanceof QwenParseError) {
      logError('brief/estrai:qwen-parse', e.message)
      return NextResponse.json(
        { error: 'L\'AI ha restituito una risposta non valida. Riprova o compila il form manualmente.' },
        { status: 502 }
      )
    }
    if (e instanceof QwenApiError) {
      logError('brief/estrai:qwen-api', `status=${e.status} ${e.message}`)
      return NextResponse.json(
        { error: 'Servizio AI non raggiungibile. Riprova tra qualche istante o compila il form manualmente.' },
        { status: 502 }
      )
    }
    logError('brief/estrai:qwen', e)
    return NextResponse.json({ error: 'Errore durante l\'estrazione AI.' }, { status: 500 })
  }

  // 4. Validazione + normalizzazione verso i campi del form
  const parsed = BriefExtractSchema.safeParse(rawResult)
  if (!parsed.success) {
    logError(
      'brief/estrai:zod',
      JSON.stringify((parsed.error as z.ZodError).issues).slice(0, 800)
    )
    return NextResponse.json(
      { error: 'I dati estratti non sono nel formato atteso. Riprova o compila il form manualmente.' },
      { status: 502 }
    )
  }

  const { patch, campi, avvisi } = toFormPatch(parsed.data)

  console.log(`[brief/estrai] campi estratti (${campi.length}): ${campi.join(', ')}`)

  if (estratto.truncated) {
    avvisi.push('Il documento è molto lungo: sono state analizzate solo le prime pagine.')
  }
  if (campi.length === 0) {
    avvisi.push('Nessun campo riconosciuto nel documento: compila il form manualmente.')
  }

  return NextResponse.json({
    success: true,
    file: {
      nome: file.name,
      tipo: estratto.kind,
      caratteri: estratto.text.length,
      troncato: estratto.truncated,
    },
    dati: patch,
    campi,
    avvisi,
    // Il testo originale viaggia con il form e finisce in brief_raw:
    // serve all'AI che genera le proposte per cogliere sfumature non mappate.
    testo: estratto.text,
  })
}
