/**
 * Helper per interrogare le tabelle categoria-specifiche dei fornitori.
 * Ogni categoria ha la propria tabella con le colonne originali dei file Excel.
 * Restituisce sempre un array di oggetti normalizzati per il prompt AI.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export type CategoriaDB =
  | 'hotel'
  | 'location'
  | 'catering'
  | 'dmc'
  | 'teambuilding'
  | 'ristoranti'
  | 'allestimenti'
  | 'entertainment'
  | 'trasporti'

/** Rappresentazione minimale comune usata nel prompt AI */
export interface FornitoreNormalizzato {
  nome: string
  citta: string | null
  prezzo_min: number | null
  prezzo_max: number | null
  prezzo_unita: string | null
  contatto_email: string | null
  contatto_tel: string | null
  sito_web: string | null
  note: string | null
  dettagli: Record<string, unknown>  // campi specifici della categoria
  is_yeg_supplier: boolean
}

// Mapping categoria → tabella Supabase
const TABLE: Record<CategoriaDB, string> = {
  hotel:          'fornitori_hotel',
  location:       'fornitori_location',
  catering:       'fornitori_catering',
  dmc:            'fornitori_dmc',
  teambuilding:   'fornitori_teambuilding',
  ristoranti:     'fornitori_ristoranti',
  allestimenti:   'fornitori_allestimenti',
  entertainment:  'fornitori_entertainment',
  trasporti:      'fornitori_trasporti',
}

/** Normalizza una riga grezza al formato comune per il prompt AI */
function normalize(categoria: CategoriaDB, row: Record<string, unknown>): FornitoreNormalizzato {
  const s = (v: unknown) => (v && String(v).trim() !== '' && String(v) !== '-' ? String(v) : null)
  const n = (v: unknown) => (v != null && !isNaN(Number(v)) ? Number(v) : null)
  // Flag YEG: letto da qualunque categoria. Se la colonna non esiste,
  // row.is_yeg_supplier è undefined e `=== true` restituisce false in modo sicuro.
  const yeg = row.is_yeg_supplier === true

  switch (categoria) {
    case 'hotel':
      return {
        nome: s(row.nome) ?? 'Hotel',
        citta: s(row.citta),
        prezzo_min: null,
        prezzo_max: null,
        prezzo_unita: 'notte',
        contatto_email: s(row.email),
        contatto_tel: s(row.telefono),
        sito_web: s(row.sito_web),
        note: s(row.note) ?? s(row.punti_di_forza),
        is_yeg_supplier: yeg,
        dettagli: {
          stelle: row.stelle,
          num_camere: row.num_camere,
          capienza_max: row.capienza_max,
          sale_meeting: row.sale_meeting,
          parcheggio: row.parcheggio,
          ristorante: row.ristorante,
          wellness_spa: row.wellness_spa,
          voto: row.voto,
          servizi_offerti: row.servizi_offerti,
          spazi_disponibili: row.spazi_disponibili,
          punti_di_forza: row.punti_di_forza,
          criticita: row.criticita,
          prezzo_indicativo: row.prezzo_indicativo,
        },
      }

    case 'location':
      return {
        nome: s(row.nome) ?? 'Location',
        citta: s(row.citta),
        prezzo_min: n(row.prezzo),
        prezzo_max: n(row.prezzo),
        prezzo_unita: s(row.unita_prezzo),
        contatto_email: s(row.contatto_email),
        contatto_tel: s(row.contatto_tel),
        sito_web: s(row.sito_web),
        note: s(row.note) ?? s(row.punti_di_forza),
        is_yeg_supplier: yeg,
        dettagli: {
          tipologia: row.tipologia,
          capienza_max: row.capienza_max,
          spazi_disponibili: row.spazi_disponibili,
          servizi_offerti: row.servizi_offerti,
          prezzo_indicativo: row.prezzo_indicativo,
          allestimento_base: row.allestimento_base,
          catering_esterno: row.catering_esterno,
          punti_di_forza: row.punti_di_forza,
          criticita: row.criticita,
          note_tecniche: row.note_tecniche,
        },
      }

    case 'catering':
      return {
        nome: s(row.nome) ?? 'Catering',
        citta: s(row.citta),
        prezzo_min: n(row.prezzo_persona),
        prezzo_max: n(row.prezzo_persona),
        prezzo_unita: 'persona',
        contatto_email: s(row.email),
        contatto_tel: s(row.telefono),
        sito_web: s(row.sito_web),
        note: s(row.note),
        is_yeg_supplier: yeg,
        dettagli: {
          tipo_cucina: row.tipo_cucina,
          adatto_a: row.adatto_a,
          servizi: row.servizi,
          extra_disponibili: row.extra_disponibili,
          allestimento_incluso: row.allestimento_incluso,
          condizioni_pagamento: row.condizioni_pagamento,
          referente: row.referente,
        },
      }

    case 'dmc':
      return {
        nome: s(row.nome) ?? 'DMC',
        citta: s(row.citta) ?? s(row.paese_regione),
        prezzo_min: null,
        prezzo_max: null,
        prezzo_unita: null,
        contatto_email: s(row.contatto_email),
        contatto_tel: s(row.contatto_tel),
        sito_web: s(row.sito_web),
        note: s(row.note),
        is_yeg_supplier: yeg,
        dettagli: {
          paese_regione: row.paese_regione,
          tipologia_servizi: row.tipologia_servizi,
          specializzazioni: row.specializzazioni,
          network: row.network,
          lingue: row.lingue,
        },
      }

    case 'teambuilding':
      return {
        nome: s(row.fornitore) ?? 'TeamBuilding',
        citta: s(row.citta),
        prezzo_min: n(row.prezzo_min),
        prezzo_max: n(row.prezzo_max),
        prezzo_unita: 'evento',
        contatto_email: s(row.contatto_email),
        contatto_tel: s(row.contatto_tel),
        sito_web: null,
        note: s(row.note),
        is_yeg_supplier: yeg,
        dettagli: {
          attivita: row.attivita,
          categoria_attivita: row.categoria_attivita,
          pax_min: row.pax_min,
          pax_max: row.pax_max,
          durata: row.durata,
        },
      }

    case 'ristoranti':
      return {
        nome: s(row.nome) ?? 'Ristorante',
        citta: s(row.citta),
        prezzo_min: n(row.prezzo_pax),
        prezzo_max: n(row.prezzo_pax),
        prezzo_unita: 'persona',
        contatto_email: s(row.email),
        contatto_tel: s(row.telefono),
        sito_web: s(row.sito_web),
        note: s(row.note),
        is_yeg_supplier: yeg,
        dettagli: {
          tipo: row.tipo,
          capienza_max: row.capienza_max,
          portate: row.portate,
          bevande_incluse: row.bevande_incluse,
        },
      }

    case 'allestimenti':
      return {
        nome: s(row.fornitore) ?? 'Service',
        citta: s(row.citta),
        prezzo_min: n(row.prezzo),
        prezzo_max: n(row.prezzo),
        prezzo_unita: s(row.unita),
        contatto_email: s(row.email),
        contatto_tel: s(row.telefono),
        sito_web: s(row.sito_web),
        note: s(row.note),
        is_yeg_supplier: yeg,
        dettagli: {
          categoria_servizio: row.categoria_servizio,
          prodotto_servizio: row.prodotto_servizio,
          descrizione: row.descrizione,
          iva_percentuale: row.iva_percentuale,
        },
      }

    case 'entertainment':
      return {
        nome: s(row.nome) ?? 'Artista',
        citta: s(row.citta),
        prezzo_min: n(row.prezzo_netto_min),
        prezzo_max: n(row.prezzo_netto_max),
        prezzo_unita: 'evento',
        contatto_email: s(row.contatto_email),
        contatto_tel: s(row.contatto_tel),
        sito_web: s(row.sito_web),
        note: s(row.vantaggi_usp) ?? s(row.durata_formato),
        is_yeg_supplier: yeg,
        dettagli: {
          categoria_artista: row.categoria_artista,
          agenzia: row.agenzia,
          prezzo_totale_min: row.prezzo_totale_min,
          prezzo_totale_max: row.prezzo_totale_max,
          iva_percentuale: row.iva_percentuale,
          servizi_inclusi: row.servizi_inclusi,
          costi_extra: row.costi_extra,
          durata_formato: row.durata_formato,
          personalizzabile: row.personalizzabile,
          validita: row.validita,
          condizioni_pagamento: row.condizioni_pagamento,
        },
      }

    case 'trasporti':
      return {
        nome: s(row.fornitore) ?? 'Trasporti',
        citta: s(row.aeroporto),
        prezzo_min: n(row.prezzo_base),
        prezzo_max: n(row.prezzo_base),
        prezzo_unita: 'servizio',
        contatto_email: s(row.email),
        contatto_tel: s(row.telefono),
        sito_web: null,
        note: s(row.note) ?? s(row.supplementi),
        is_yeg_supplier: yeg,
        dettagli: {
          tipo_servizio: row.tipo_servizio,
          aeroporto: row.aeroporto,
          durata_base: row.durata_base,
          extra_ora: row.extra_ora,
          sala_vip_pax: row.sala_vip_pax,
          fast_track_pax: row.fast_track_pax,
          supplementi: row.supplementi,
          anno: row.anno,
        },
      }
  }
}

/**
 * Esegue una SELECT * con limit, prima provando con `.eq('attivo', true)`.
 * Se la colonna non esiste (errore) o non ritorna nulla, rilancia senza filtro.
 * Centralizza il fallback-pattern usato in searchFornitori.
 */
async function fetchRows(
  sb: SupabaseClient,
  table: string,
  limit: number,
  citta?: string | null
): Promise<Record<string, unknown>[]> {
  const runQuery = async (withAttivo: boolean) => {
    let q = sb.from(table).select('*').limit(limit)
    if (withAttivo) q = q.eq('attivo', true)
    if (citta) q = q.ilike('citta', `%${citta}%`)
    return q
  }

  // Tentativo 1: con filtro attivo
  const first = await runQuery(true)
  if (!first.error && first.data && first.data.length > 0) {
    return first.data as Record<string, unknown>[]
  }

  // Fallback: senza filtro attivo (la colonna potrebbe non esistere o la tabella è vuota di attivi)
  if (first.error) {
    console.warn(`[fornitori-db] Fallback senza 'attivo' per ${table}:`, first.error.message)
  }
  const second = await runQuery(false)
  if (second.error) {
    console.error(`[fornitori-db] Errore fetchRows(${table}):`, second.error)
    return []
  }
  return (second.data as Record<string, unknown>[]) ?? []
}

/**
 * Cerca fornitori in una categoria specifica.
 * Filtra per città se disponibile: i risultati city-first vengono MERGATI
 * con quelli senza filtro città (dedup per id) fino a raggiungere `limit`.
 * Così un ottimo fornitore in Milano viene sempre mantenuto anche se sono solo 1-2.
 */
export async function searchFornitori(
  sb: SupabaseClient,
  categoria: CategoriaDB,
  citta?: string | null,
  limit = 30
): Promise<FornitoreNormalizzato[]> {
  const table = TABLE[categoria]
  if (!table) return []

  try {
    // Caso semplice: niente città → una sola query.
    if (!citta) {
      const rows = await fetchRows(sb, table, limit)
      return rows.map(r => normalize(categoria, r))
    }

    // Step 1: risultati filtrati per città (prioritari).
    const cityRows = await fetchRows(sb, table, limit, citta)
    if (cityRows.length === 0) {
      console.warn(`[fornitori-db] Nessun fornitore trovato in città "${citta}" per ${table}`)
    }

    // Se ho già saturato il limite solo con la città, niente da mergiare.
    if (cityRows.length >= limit) {
      return cityRows.slice(0, limit).map(r => normalize(categoria, r))
    }

    // Step 2: pad con risultati senza filtro città, dedup per id.
    const allRows = await fetchRows(sb, table, limit)
    const seen = new Set<unknown>()
    const merged: Record<string, unknown>[] = []

    for (const r of cityRows) {
      const id = r.id
      if (id != null) seen.add(id)
      merged.push(r)
      if (merged.length >= limit) break
    }
    for (const r of allRows) {
      if (merged.length >= limit) break
      const id = r.id
      if (id != null && seen.has(id)) continue
      if (id != null) seen.add(id)
      merged.push(r)
    }

    return merged.map(r => normalize(categoria, r))
  } catch (e) {
    console.error(`[fornitori-db] Errore searchFornitori(${table}):`, e)
    return []
  }
}

/**
 * Cerca fornitori per più categorie in parallelo.
 */
export async function searchFornitoriMulti(
  sb: SupabaseClient,
  categorie: CategoriaDB[],
  citta?: string | null,
  limitPerCat = 20
): Promise<Record<string, FornitoreNormalizzato[]>> {
  const results = await Promise.all(
    categorie.map(cat => searchFornitori(sb, cat, citta, limitPerCat).then(r => [cat, r] as const))
  )
  return Object.fromEntries(results)
}

/** Formatta i fornitori trovati come testo per il prompt AI */
export function formatFornitoriPerPrompt(
  fornitori: Record<string, FornitoreNormalizzato[]>
): string {
  const lines: string[] = []
  for (const [cat, list] of Object.entries(fornitori)) {
    if (!list.length) continue
    lines.push(`\n[${cat.toUpperCase()}] (${list.length} nel DB YEG)`)
    for (const f of list) {
      const prezzo = f.prezzo_min != null
        ? `€${f.prezzo_min}${f.prezzo_max && f.prezzo_max !== f.prezzo_min ? `-${f.prezzo_max}` : ''}/${f.prezzo_unita ?? '...'}`
        : 'prezzo n.d.'
      const city = f.citta ? ` (${f.citta})` : ''
      const yeg = f.is_yeg_supplier ? ' ★YEG' : ''
      const email = f.contatto_email ? ` | ${f.contatto_email}` : ''
      const det = Object.entries(f.dettagli)
        .filter(([, v]) => v != null && v !== '' && !Array.isArray(v))
        .slice(0, 4)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ')
      lines.push(`  • ${f.nome}${city}${yeg} — ${prezzo}${email}${det ? ' | ' + det : ''}`)
    }
  }
  return lines.join('\n')
}
