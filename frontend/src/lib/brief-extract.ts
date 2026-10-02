/**
 * Estrazione dei campi del brief da un documento caricato (PDF / Word / testo).
 *
 * Flusso: file → testo → Qwen (JSON mode) → validazione Zod permissiva →
 * `Partial<BriefFormData>` da usare per precompilare il form.
 *
 * Principio guida: l'AI può sbagliare, quindi NIENTE invenzioni e niente hard
 * failure. Un campo non riconosciuto viene scartato (il form resta vuoto e
 * l'operatore lo compila a mano), non fa fallire tutta l'estrazione.
 */

import { z } from 'zod'
import {
  TIPOLOGIE_EVENTO,
  SETUP_SALA,
  AV_OPTIONS,
  TIPOLOGIE_LOCATION,
  TRASPORTI_TIPO,
  ENTERTAINMENT_TIPO,
} from './brief-options'
import type { BriefFormData } from './types'

/** Limite dimensione upload. Su Vercel il body di una request è comunque ~4.5MB. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** Oltre questa soglia il testo viene troncato prima di andare all'AI. */
export const MAX_TEXT_CHARS = 40_000

/** Sotto questa soglia il documento è considerato non leggibile (PDF scansionato). */
export const MIN_TEXT_CHARS = 80

export type DocumentKind = 'pdf' | 'docx' | 'text'

export class UnsupportedFileTypeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedFileTypeError'
  }
}

export class EmptyDocumentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmptyDocumentError'
  }
}

/**
 * Riconosce il tipo di documento da MIME type + estensione.
 * Il MIME dei browser è inaffidabile (spesso `application/octet-stream`),
 * quindi l'estensione fa da fallback.
 */
export function detectDocumentKind(filename: string, mimeType: string): DocumentKind {
  const name = filename.toLowerCase()
  const mime = (mimeType || '').toLowerCase()

  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    return 'docx'
  }
  if (mime === 'application/msword' || name.endsWith('.doc')) {
    throw new UnsupportedFileTypeError(
      'Il formato .doc (Word 97-2003) non è supportato. Salva il file come .docx o PDF e riprova.'
    )
  }
  if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) return 'text'

  throw new UnsupportedFileTypeError(
    `Formato non supportato (${filename}). Carica un file PDF, Word (.docx) o testo.`
  )
}

/** Normalizza il testo estratto: spazi e righe vuote multiple. Non tronca. */
export function normalizeExtractedText(raw: string): string {
  const cleaned = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleaned
}

/**
 * Estrae il testo dal documento. Gli import sono dinamici così `mammoth` e
 * `unpdf` restano fuori dal bundle client e vengono caricati solo quando serve.
 */
export async function extractDocumentText(
  bytes: Uint8Array,
  filename: string,
  mimeType: string
): Promise<{ text: string; kind: DocumentKind; truncated: boolean }> {
  const kind = detectDocumentKind(filename, mimeType)

  let raw = ''
  if (kind === 'pdf') {
    const { getDocumentProxy, extractText } = await import('unpdf')
    const pdf = await getDocumentProxy(bytes)
    const { text } = await extractText(pdf, { mergePages: true })
    raw = Array.isArray(text) ? text.join('\n') : text
  } else if (kind === 'docx') {
    const mammoth = (await import('mammoth')).default
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    raw = result.value
  } else {
    raw = new TextDecoder('utf-8').decode(bytes)
  }

  const normalized = normalizeExtractedText(raw)

  if (normalized.length < MIN_TEXT_CHARS) {
    throw new EmptyDocumentError(
      kind === 'pdf'
        ? 'Dal PDF non è stato estratto testo leggibile: probabilmente è una scansione (immagine). Carica un PDF con testo selezionabile o un file Word.'
        : 'Il documento non contiene testo sufficiente per estrarre il brief.'
    )
  }

  const truncated = normalized.length > MAX_TEXT_CHARS

  return {
    text: truncated ? normalized.slice(0, MAX_TEXT_CHARS) : normalized,
    kind,
    truncated,
  }
}

// ============================================================
// Schema AI (permissivo: l'AI non sempre rispetta i tipi)
// ============================================================

const looseString = z
  .union([z.string(), z.number(), z.boolean()])
  .transform((v) => String(v).trim())
  .nullish()

const looseNumber = z.union([z.string(), z.number()]).nullish()

const looseBool = z.union([z.boolean(), z.string(), z.number()]).nullish()

const looseArray = z.union([z.array(z.union([z.string(), z.number()])), z.string()]).nullish()

export const BriefExtractSchema = z
  .object({
    nome_referente: looseString,
    cognome_referente: looseString,
    email: looseString,
    telefono: looseString,
    azienda: looseString,

    nome_evento: looseString,
    tipologia_evento: looseString,
    data_inizio: looseString,
    orario_inizio: looseString,
    data_fine: looseString,
    orario_fine: looseString,
    citta: looseString,
    sede_indicata: looseString,
    numero_partecipanti: looseNumber,
    budget_totale: looseNumber,
    budget_flessibile: looseBool,
    agenda: looseString,

    hotel_attivo: looseBool,
    hotel_checkin: looseString,
    hotel_checkout: looseString,
    camere_singole: looseNumber,
    camere_doppie: looseNumber,
    hotel_stelle_minime: looseNumber,
    hotel_note: looseString,

    location_attiva: looseBool,
    location_setup: looseString,
    location_av: looseArray,
    location_tipologia: looseString,
    location_note: looseString,

    catering_attivo: looseBool,
    coffee_break_num: looseNumber,
    coffee_station: looseBool,
    pranzo_num: looseNumber,
    pranzo_interno: looseBool,
    cena_num: looseNumber,
    cena_interna: looseBool,
    aperitivo_num: looseNumber,
    esigenze_alimentari: looseString,
    catering_note: looseString,

    trasporti_attivi: looseBool,
    trasporti_tipo: looseArray,
    trasporti_note: looseString,

    entertainment_attivo: looseBool,
    entertainment_tipo: looseString,
    entertainment_note: looseString,

    teambuilding_attivo: looseBool,
    teambuilding_note: looseString,

    segreteria: looseBool,
    app_evento: looseBool,
    note_generali: looseString,

    avvisi: z.union([z.array(z.string()), z.string()]).nullish(),
  })
  .strip()

export type BriefExtract = z.infer<typeof BriefExtractSchema>

// ============================================================
// Normalizzazione verso BriefFormData
// ============================================================

/** Confronto tollerante: ignora maiuscole, accenti e punteggiatura. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // segni diacritici combinanti
    .replace(/[^a-z0-9]/g, '')
}

/** Parole significative di un valore, per il match per token. */
function tokens(s: string): string[] {
  return s
    .split(/[^\p{L}\p{N}]+/u)
    .map(fold)
    .filter((t) => t.length >= 5)
}

/**
 * Riporta un valore AI su una delle opzioni ammesse dalla UI, o null.
 * Tre livelli, dal più stretto al più largo:
 *  1. match esatto;
 *  2. substring (da 3 caratteri: con meno, "a" matcherebbe qualsiasi opzione);
 *  3. parola significativa in comune — recupera i casi tipo
 *     "Speaker motivazionale" → "Speaker/Motivatore", che altrimenti
 *     perderebbero una richiesta scritta nel brief.
 */
function matchOption(value: unknown, options: string[]): string | null {
  if (typeof value !== 'string') return null
  const target = fold(value)
  if (!target) return null

  const exact = options.find((o) => fold(o) === target)
  if (exact) return exact
  if (target.length < 3) return null

  const bySubstring = options.find((o) => {
    const folded = fold(o)
    return folded.includes(target) || target.includes(folded)
  })
  if (bySubstring) return bySubstring

  const valueTokens = tokens(value)
  if (valueTokens.length === 0) return null

  return options.find((o) => tokens(o).some((t) => valueTokens.includes(t))) ?? null
}

/** "45.000 €" / "45k" / "€ 45,000" → 45000. Null se non interpretabile. */
function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  let s = value.toLowerCase().replace(/[€$£\s]/g, '').replace(/eur(o)?/g, '')
  if (!s) return null

  const hasK = /\d\s*k$/.test(s)
  if (hasK) s = s.replace(/k$/, '')

  // Separatori migliaia (1.234 / 1,234) → via; virgola decimale → punto.
  s = s.replace(/[.,](?=\d{3}\b)/g, '')
  s = s.replace(',', '.')
  s = s.replace(/[^0-9.]/g, '')

  const n = parseFloat(s)
  if (!Number.isFinite(n)) return null
  return hasK ? n * 1000 : n
}

function parseBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value !== 'string') return null
  const v = fold(value)
  if (['true', 'si', 'yes', 'y', '1', 'richiesto', 'attivo', 'interno', 'interna'].includes(v)) return true
  if (['false', 'no', 'n', '0', 'nonrichiesto', 'esterno', 'esterna'].includes(v)) return false
  return null
}

/** Accetta solo date ISO plausibili: 2026-06-12 (eventuale parte orario scartata). */
function parseDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const [, y, mo, d] = m
  const year = parseInt(y, 10)
  const month = parseInt(mo, 10)
  const day = parseInt(d, 10)
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${y}-${mo}-${d}`
}

function parseTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = value.trim().match(/^(\d{1,2})[:.](\d{2})/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function parseStringArray(value: unknown, options: string[]): string[] | null {
  const items: unknown[] = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,;\n]/)
      : []

  const matched = items
    .map((item) => matchOption(typeof item === 'string' ? item : String(item ?? ''), options))
    .filter((v): v is string => Boolean(v))

  const unique = Array.from(new Set(matched))
  return unique.length > 0 ? unique : null
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  if (!t) return null
  // L'AI a volte scrive esplicitamente l'assenza del dato invece di usare null.
  const placeholders = ['null', 'none', 'na', 'nonspecificato', 'nonpresente', 'nonindicato', 'nondisponibile', 'dadefinire']
  if (placeholders.includes(fold(t))) return null
  return t
}

export interface BriefExtractResult {
  /** Solo i campi effettivamente trovati nel documento. */
  patch: Partial<BriefFormData>
  /** Chiavi di `patch`, per mostrare all'operatore cosa è stato precompilato. */
  campi: string[]
  /** Ambiguità segnalate dall'AI (es. anno mancante nelle date). */
  avvisi: string[]
}

/**
 * Converte l'output AI validato in un patch per il form.
 * Scarta tutto ciò che non è coerente con le opzioni della UI.
 */
export function toFormPatch(raw: BriefExtract): BriefExtractResult {
  const patch: Partial<BriefFormData> = {}

  const setText = (key: keyof BriefFormData, value: unknown) => {
    const t = cleanText(value)
    if (t !== null) (patch as Record<string, unknown>)[key] = t
  }

  const setInt = (key: keyof BriefFormData, value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const n = parseNumber(value)
    if (n === null) return
    const rounded = Math.round(n)
    if (rounded < min || rounded > max) return
    ;(patch as Record<string, unknown>)[key] = rounded
  }

  const setDate = (key: keyof BriefFormData, value: unknown) => {
    const d = parseDate(value)
    if (d) (patch as Record<string, unknown>)[key] = d
  }

  const setTime = (key: keyof BriefFormData, value: unknown) => {
    const t = parseTime(value)
    if (t) (patch as Record<string, unknown>)[key] = t
  }

  /** I flag booleani si impostano solo quando positivi: il default del form è false. */
  const setTrueFlag = (key: keyof BriefFormData, value: unknown) => {
    if (parseBool(value) === true) (patch as Record<string, unknown>)[key] = true
  }

  /** Qui anche `false` è informazione (pranzo in ristorante esterno). */
  const setBool = (key: keyof BriefFormData, value: unknown) => {
    const b = parseBool(value)
    if (b !== null) (patch as Record<string, unknown>)[key] = b
  }

  // --- Referente
  setText('nome_referente', raw.nome_referente)
  setText('cognome_referente', raw.cognome_referente)
  setText('telefono', raw.telefono)
  setText('azienda', raw.azienda)
  const email = cleanText(raw.email)
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) patch.email = email.toLowerCase()

  // --- Evento
  setText('nome_evento', raw.nome_evento)
  const tipologia = cleanText(raw.tipologia_evento)
  if (tipologia) patch.tipologia_evento = matchOption(tipologia, TIPOLOGIE_EVENTO) ?? 'Altro'
  setDate('data_inizio', raw.data_inizio)
  setDate('data_fine', raw.data_fine)
  setTime('orario_inizio', raw.orario_inizio)
  setTime('orario_fine', raw.orario_fine)
  setText('citta', raw.citta)
  setText('sede_indicata', raw.sede_indicata)
  setInt('numero_partecipanti', raw.numero_partecipanti, 1, 100_000)
  setInt('budget_totale', raw.budget_totale, 0, 100_000_000)
  setTrueFlag('budget_flessibile', raw.budget_flessibile)
  setText('agenda', raw.agenda)

  // --- Hotel
  setDate('hotel_checkin', raw.hotel_checkin)
  setDate('hotel_checkout', raw.hotel_checkout)
  setInt('camere_singole', raw.camere_singole, 0, 10_000)
  setInt('camere_doppie', raw.camere_doppie, 0, 10_000)
  setInt('hotel_stelle_minime', raw.hotel_stelle_minime, 3, 5)
  setText('hotel_note', raw.hotel_note)
  setTrueFlag('hotel_attivo', raw.hotel_attivo)

  // --- Location
  const setup = matchOption(raw.location_setup, SETUP_SALA)
  if (setup) patch.location_setup = setup
  const tipologiaLocation = matchOption(raw.location_tipologia, TIPOLOGIE_LOCATION)
  if (tipologiaLocation) patch.location_tipologia = tipologiaLocation
  const av = parseStringArray(raw.location_av, AV_OPTIONS)
  if (av) patch.location_av = av
  setText('location_note', raw.location_note)
  setTrueFlag('location_attiva', raw.location_attiva)

  // --- Catering
  setInt('coffee_break_num', raw.coffee_break_num, 0, 100)
  setTrueFlag('coffee_station', raw.coffee_station)
  setInt('pranzo_num', raw.pranzo_num, 0, 100)
  setBool('pranzo_interno', raw.pranzo_interno)
  setInt('cena_num', raw.cena_num, 0, 100)
  setBool('cena_interna', raw.cena_interna)
  setInt('aperitivo_num', raw.aperitivo_num, 0, 100)
  setText('esigenze_alimentari', raw.esigenze_alimentari)
  setText('catering_note', raw.catering_note)
  setTrueFlag('catering_attivo', raw.catering_attivo)

  // --- Trasporti
  const trasporti = parseStringArray(raw.trasporti_tipo, TRASPORTI_TIPO)
  if (trasporti) patch.trasporti_tipo = trasporti
  setText('trasporti_note', raw.trasporti_note)
  setTrueFlag('trasporti_attivi', raw.trasporti_attivi)

  // --- Entertainment
  const entertainment = matchOption(raw.entertainment_tipo, ENTERTAINMENT_TIPO)
  if (entertainment) patch.entertainment_tipo = entertainment
  setText('entertainment_note', raw.entertainment_note)
  setTrueFlag('entertainment_attivo', raw.entertainment_attivo)

  // --- Team building
  setText('teambuilding_note', raw.teambuilding_note)
  setTrueFlag('teambuilding_attivo', raw.teambuilding_attivo)

  // --- Extra
  setTrueFlag('segreteria', raw.segreteria)
  setTrueFlag('app_evento', raw.app_evento)
  setText('note_generali', raw.note_generali)

  // Coerenza: se ci sono dettagli di una componente, la componente è richiesta.
  // Senza questo l'operatore vedrebbe i dettagli compilati ma lo step
  // "Componenti" vuoto, e il backend non genererebbe proposte per quella categoria.
  if ((patch.camere_singole || 0) > 0 || (patch.camere_doppie || 0) > 0 || patch.hotel_checkin || patch.hotel_note) {
    patch.hotel_attivo = true
  }
  if (patch.location_av?.length || patch.location_note || setup || tipologiaLocation) {
    patch.location_attiva = true
  }
  if (
    (patch.coffee_break_num || 0) > 0 ||
    (patch.pranzo_num || 0) > 0 ||
    (patch.cena_num || 0) > 0 ||
    (patch.aperitivo_num || 0) > 0 ||
    patch.coffee_station ||
    patch.catering_note ||
    patch.esigenze_alimentari
  ) {
    patch.catering_attivo = true
  }
  if (patch.trasporti_tipo?.length || patch.trasporti_note) patch.trasporti_attivi = true
  if (patch.entertainment_tipo || patch.entertainment_note) patch.entertainment_attivo = true
  if (patch.teambuilding_note) patch.teambuilding_attivo = true

  const avvisi = (
    Array.isArray(raw.avvisi) ? raw.avvisi : typeof raw.avvisi === 'string' ? [raw.avvisi] : []
  )
    .map((a) => String(a).trim())
    .filter((a) => a.length > 0)
    .slice(0, 10)

  return { patch, campi: Object.keys(patch), avvisi }
}

// ============================================================
// Prompt
// ============================================================

export const EXTRACT_SYSTEM_PROMPT = `Sei un assistente di un'agenzia MICE italiana. Il tuo compito è leggere un brief evento (documento Word/PDF inviato dal cliente) ed estrarre i dati strutturati per compilare il form interno.

REGOLE FERREE:
- NON inventare NULLA. Se un dato non è nel documento, usa null.
- Non dedurre budget, partecipanti o date da "esperienza": solo ciò che è scritto.
- Rispondi SEMPRE e SOLO con JSON valido, senza markdown, senza backtick, senza commenti.`

/** Prompt utente: testo del documento + schema dei campi attesi. */
export function buildExtractPrompt(text: string, today: string): string {
  return `Estrai i dati del brief dal documento qui sotto.

=== DOCUMENTO ===
${text}
=== FINE DOCUMENTO ===

Data odierna: ${today}

ISTRUZIONI SUI VALORI:
- Date: formato ISO "YYYY-MM-DD". Se nel documento manca l'anno, usa la prima occorrenza futura rispetto alla data odierna e aggiungi un avviso.
- Orari: formato "HH:MM" (24h).
- Numeri: interi puri, senza separatori né valuta (es. 45000, non "45.000 €").
- I campi "*_attivo/_attiva/_attivi" sono true SOLO se il documento richiede esplicitamente quel servizio (o ne dà i dettagli).
- pranzo_interno / cena_interna: true = in hotel/venue, false = ristorante esterno. null se non specificato.
- Campi "_note": riporta in modo sintetico ciò che dice il documento su quella componente, senza aggiungere.
- Usa SOLO questi valori ammessi (o null se nessuno è pertinente):
  tipologia_evento: ${TIPOLOGIE_EVENTO.join(' | ')}
  location_setup: ${SETUP_SALA.join(' | ')}
  location_tipologia: ${TIPOLOGIE_LOCATION.join(' | ')}
  location_av (array): ${AV_OPTIONS.join(' | ')}
  trasporti_tipo (array): ${TRASPORTI_TIPO.join(' | ')}
  entertainment_tipo: ${ENTERTAINMENT_TIPO.join(' | ')}
- avvisi: array di stringhe brevi in italiano su ciò che è ambiguo, contraddittorio o mancante e va verificato con il cliente. Array vuoto se tutto chiaro.

Rispondi SOLO con questo JSON (tutte le chiavi presenti, null dove il dato manca):
{
  "nome_referente": null, "cognome_referente": null, "email": null, "telefono": null, "azienda": null,
  "nome_evento": null, "tipologia_evento": null, "data_inizio": null, "orario_inizio": null,
  "data_fine": null, "orario_fine": null, "citta": null, "sede_indicata": null,
  "numero_partecipanti": null, "budget_totale": null, "budget_flessibile": null, "agenda": null,
  "hotel_attivo": null, "hotel_checkin": null, "hotel_checkout": null, "camere_singole": null,
  "camere_doppie": null, "hotel_stelle_minime": null, "hotel_note": null,
  "location_attiva": null, "location_setup": null, "location_av": [], "location_tipologia": null, "location_note": null,
  "catering_attivo": null, "coffee_break_num": null, "coffee_station": null, "pranzo_num": null,
  "pranzo_interno": null, "cena_num": null, "cena_interna": null, "aperitivo_num": null,
  "esigenze_alimentari": null, "catering_note": null,
  "trasporti_attivi": null, "trasporti_tipo": [], "trasporti_note": null,
  "entertainment_attivo": null, "entertainment_tipo": null, "entertainment_note": null,
  "teambuilding_attivo": null, "teambuilding_note": null,
  "segreteria": null, "app_evento": null, "note_generali": null,
  "avvisi": []
}`
}
