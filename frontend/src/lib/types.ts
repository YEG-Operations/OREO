// ============================================================
// YEG Event Planner - Tipi TypeScript
// ============================================================

export interface Fornitore {
  id: number
  nome: string
  categoria: CategoriaServizio
  citta: string | null
  regione: string | null
  capacita_min: number | null
  capacita_max: number | null
  prezzo_min: number | null
  prezzo_max: number | null
  prezzo_unita: string | null
  specifiche: Record<string, unknown>
  contatti: { telefono?: string; email?: string; referente?: string }
  servizi_inclusi: string[]
  adatto_per: TipoEvento[]
  note: string | null
  file_sorgente: string | null
  sito_web: string | null
  immagine_url: string | null
  is_yeg_supplier: boolean
  attivo: boolean
}

export type CategoriaServizio =
  | 'location'
  | 'catering'
  | 'hotel'
  | 'trasporti'
  | 'dmc'
  | 'entertainment'
  | 'teambuilding'
  | 'allestimenti'
  | 'ristoranti'
  | 'servizi_professionali'

export type TipoEvento =
  | 'convention'
  | 'galadinner'
  | 'meeting'
  | 'party'
  | 'incentive'
  | 'lancio_prodotto'
  | 'teambuilding'
  | 'conferenza'
  | 'workshop'

export type StatoProgetto = 'nuovo' | 'in_lavorazione' | 'inviato' | 'confermato' | 'archiviato'

export interface Progetto {
  id: string
  stato: StatoProgetto
  brief_raw: BriefRaw
  brief_interpretato: BriefInterpretato | null
  nome_evento: string
  tipologia_evento: string
  nome_referente: string
  email_referente: string
  azienda: string
  citta: string
  data_inizio: string
  data_fine: string
  numero_partecipanti: number
  budget_totale: number
  agenda: string
  componenti_richieste: string[]
  note_manager: string | null
  token_cliente: string
  // Operatore YEG che gestisce la richiesta
  email_operatore: string | null
  // Impostazioni costi
  markup_percentuale: number | null      // % markup sul costo interno → prezzo cliente
  iva_percentuale: number | null         // % IVA da applicare
  fee_agenzia_percentuale: number | null // % fee agenzia sul totale
  frasi_standard_costi: string | null    // Testo standard sezione costi nell'output
  nascondi_fornitori: boolean            // Nasconde nomi fornitori nella vista cliente
  proposte?: Proposta[]
  created_at: string
  updated_at: string
}

export interface BriefRaw {
  // Dati grezzi dal form
  [key: string]: unknown
}

export interface BriefInterpretato {
  sintesi: string
  obiettivi_evento: string
  tono_evento: string // 'formale' | 'informale' | 'lusso' | 'dinamico'
  priorita: string[]
  suggerimenti_ai: string
  componenti: {
    hotel?: ComponenteHotel
    location?: ComponenteLocation
    catering?: ComponenteCatering
    trasporti?: ComponenteTrasporti
    entertainment?: ComponenteEntertainment
    [key: string]: unknown
  }
}

export interface ComponenteHotel {
  attivo: boolean
  checkin: string
  checkout: string
  notti: number
  camere_singole: number
  camere_doppie: number
  totale_camere: number
  stelle_minime: number
  note: string
}

export interface ComponenteLocation {
  attivo: boolean
  setup_sala: string
  setup_av: string
  capienza_richiesta: number
  tipologia_preferita: string
  note: string
}

export interface ComponenteCatering {
  attivo: boolean
  servizi: {
    coffee_break?: { quantita: number; note: string }
    coffee_station?: { attivo: boolean; note: string }
    pranzo?: { quantita: number; interno: boolean; note: string }
    cena?: { quantita: number; interna: boolean; note: string }
    aperitivo?: { quantita: number; note: string }
  }
  esigenze_alimentari: string
  note: string
}

export interface ComponenteTrasporti {
  attivo: boolean
  tipo: string[]
  tratte: string[]
  note: string
}

export interface ComponenteEntertainment {
  attivo: boolean
  tipo: string
  note: string
}

export type FonteProposta = 'ai' | 'yeg_db' | 'web' | 'manager'

export interface Proposta {
  id: number
  progetto_id: string
  categoria: CategoriaServizio
  nome: string
  descrizione: string | null
  motivo_match: string | null
  prezzo_stimato: number | null
  costo_reale: number | null
  capacita: string | null
  indirizzo: string | null
  punti_forza: string[]
  pro: string[]
  contro: string[]
  adeguatezza_budget: number | null
  note: string | null
  sito_web: string | null
  contatto: string | null
  immagine_url: string | null
  immagini: string[]           // Array di URL immagini (per hotel/location)
  fonte: FonteProposta
  fornitore_id: number | null
  is_yeg_supplier: boolean
  selezionato_manager: boolean
  selezionato_cliente: boolean
  ordine: number
  da_verificare: boolean
  markup_percentuale: number | null  // null = usa il default del progetto
  iva_percentuale: number | null     // null = usa 22% di default
}

// Form brief - campi del form
export interface BriefFormData {
  // Operatore YEG che gestisce la richiesta
  email_operatore: string

  // Referente cliente
  nome_referente: string
  cognome_referente: string
  email: string
  telefono: string
  azienda: string

  // Evento
  nome_evento: string
  tipologia_evento: string
  data_inizio: string
  orario_inizio: string
  data_fine: string
  orario_fine: string
  citta: string
  sede_indicata: string
  numero_partecipanti: number
  budget_totale: number
  budget_flessibile: boolean
  agenda: string

  // Hotel
  hotel_attivo: boolean
  hotel_checkin: string
  hotel_checkout: string
  camere_singole: number
  camere_doppie: number
  hotel_stelle_minime: number
  hotel_note: string

  // Location
  location_attiva: boolean
  location_setup: string
  location_av: string[]
  location_tipologia: string
  location_note: string

  // Catering
  catering_attivo: boolean
  coffee_break_num: number
  coffee_station: boolean           // Postazione caffè sempre disponibile
  pranzo_num: number
  pranzo_interno: boolean           // true = in hotel/venue, false = ristorante esterno
  cena_num: number
  cena_interna: boolean             // true = in hotel/venue, false = ristorante esterno
  aperitivo_num: number
  esigenze_alimentari: string
  catering_note: string

  // Trasporti (semplificati)
  trasporti_attivi: boolean
  trasporti_tipo: string[]          // ['Transfer Aeroporto/Stazione', 'Trasferimenti infra-evento']
  trasporti_note: string

  // Entertainment
  entertainment_attivo: boolean
  entertainment_tipo: string
  entertainment_note: string

  // Team Building
  teambuilding_attivo: boolean
  teambuilding_note: string

  segreteria: boolean
  app_evento: boolean
  note_generali: string
}

// Labels per le categorie
export const CATEGORIE_LABELS: Record<CategoriaServizio, string> = {
  location: 'Location & Venue',
  catering: 'Catering & F&B',
  hotel: 'Hotel & Alloggio',
  trasporti: 'Trasporti',
  dmc: 'DMC',
  entertainment: 'Entertainment & Guest',
  teambuilding: 'Team Building',
  allestimenti: 'Allestimenti & Service',
  ristoranti: 'Ristoranti',
  servizi_professionali: 'Servizi Professionali',
}

export const STATI_LABELS: Record<StatoProgetto, string> = {
  nuovo: 'Nuovo',
  in_lavorazione: 'In Lavorazione',
  inviato: 'Inviato al Cliente',
  confermato: 'Confermato',
  archiviato: 'Archiviato',
}

export const STATI_COLORS: Record<StatoProgetto, string> = {
  nuovo: 'bg-blue-100 text-blue-800',
  in_lavorazione: 'bg-yellow-100 text-yellow-800',
  inviato: 'bg-purple-100 text-purple-800',
  confermato: 'bg-green-100 text-green-800',
  archiviato: 'bg-gray-100 text-gray-800',
}

// Opzioni markup standard
export const MARKUP_STANDARD = [5, 10, 15, 20, 25, 30]
