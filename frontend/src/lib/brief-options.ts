/**
 * Opzioni e label condivise del form brief.
 *
 * Stanno qui (e non dentro la pagina) perché le stesse liste servono sia alla UI
 * sia al prompt di estrazione AI da documento (`brief-extract.ts`): se divergono,
 * l'AI restituisce valori che le <select> non sanno mostrare.
 */

export const TIPOLOGIE_EVENTO = [
  'Convention', 'Riunione', 'Incentive', 'Lancio Prodotto', 'Gala Dinner',
  'Team Building', 'Conferenza', 'Workshop', 'Evento Ibrido', 'Altro',
]

export const SETUP_SALA = ['Teatro', 'Banquet', 'Classroom', 'Cabaret', 'Standing', 'Boardroom', 'U-Shape']

export const AV_OPTIONS = ['Proiettore', 'LED Wall', 'Audio', 'Microfoni', 'Regia video', 'Streaming', 'Traduzione simultanea']

export const TIPOLOGIE_LOCATION = ['Qualsiasi', 'Hotel con sale', 'Museo', 'Teatro', 'Loft/Industriale', 'Palazzo storico', 'Rooftop', 'Spazio congressi', 'Ristorante con sala privata', 'Esterno/Giardino']

export const TRASPORTI_TIPO = ['Transfer Aeroporto/Stazione', 'Trasferimenti infra-evento']

export const ENTERTAINMENT_TIPO = ['DJ', 'Band/Musica live', 'Speaker/Motivatore', 'Sportivo/Testimonial', 'Show/Spettacolo', 'Animazione', 'Team building ludico']

/** Label leggibili dei campi del brief — usate per mostrare cosa l'AI ha compilato. */
export const BRIEF_FIELD_LABELS: Record<string, string> = {
  nome_referente: 'Nome referente',
  cognome_referente: 'Cognome referente',
  email: 'Email referente',
  telefono: 'Telefono',
  azienda: 'Azienda',

  nome_evento: 'Nome evento',
  tipologia_evento: 'Tipologia evento',
  data_inizio: 'Data inizio',
  orario_inizio: 'Orario inizio',
  data_fine: 'Data fine',
  orario_fine: 'Orario fine',
  citta: 'Città',
  sede_indicata: 'Sede indicata',
  numero_partecipanti: 'Numero partecipanti',
  budget_totale: 'Budget totale',
  budget_flessibile: 'Budget flessibile',
  agenda: 'Agenda',

  hotel_attivo: 'Hotel richiesto',
  hotel_checkin: 'Check-in hotel',
  hotel_checkout: 'Check-out hotel',
  camere_singole: 'Camere singole',
  camere_doppie: 'Camere doppie',
  hotel_stelle_minime: 'Stelle minime hotel',
  hotel_note: 'Note hotel',

  location_attiva: 'Location richiesta',
  location_setup: 'Setup sala',
  location_av: 'Dotazioni AV',
  location_tipologia: 'Tipologia location',
  location_note: 'Note location',

  catering_attivo: 'Catering richiesto',
  coffee_break_num: 'Coffee break',
  coffee_station: 'Coffee station',
  pranzo_num: 'Pranzi',
  pranzo_interno: 'Modalità pranzo',
  cena_num: 'Cene',
  cena_interna: 'Modalità cena',
  aperitivo_num: 'Aperitivi',
  esigenze_alimentari: 'Esigenze alimentari',
  catering_note: 'Note catering',

  trasporti_attivi: 'Trasporti richiesti',
  trasporti_tipo: 'Tipo trasporti',
  trasporti_note: 'Note trasporti',

  entertainment_attivo: 'Entertainment richiesto',
  entertainment_tipo: 'Tipo entertainment',
  entertainment_note: 'Note entertainment',

  teambuilding_attivo: 'Team building richiesto',
  teambuilding_note: 'Note team building',

  segreteria: 'Segreteria organizzativa',
  app_evento: 'App evento',
  note_generali: 'Note generali',
}
