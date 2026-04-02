// Template email per richiesta disponibilita/prezzi ai fornitori
// Personalizzati per categoria di servizio

interface EmailContext {
  nome_fornitore: string
  categoria: string
  nome_evento: string
  azienda: string
  citta: string
  data_inizio: string
  data_fine: string
  numero_partecipanti: number
  // Dettagli specifici dal brief
  brief: Record<string, unknown>
}

interface EmailTemplate {
  subject: string
  body: string
}

export function generateSupplierEmail(ctx: EmailContext): EmailTemplate {
  const base = `Gentile team ${ctx.nome_fornitore},

Vi contattiamo da YEG Events in merito all'organizzazione dell'evento "${ctx.nome_evento}" per conto di ${ctx.azienda}.

DETTAGLI EVENTO:
- Data: ${ctx.data_inizio || 'da definire'}${ctx.data_fine ? ` - ${ctx.data_fine}` : ''}
- Citta: ${ctx.citta || 'da definire'}
- Partecipanti: ${ctx.numero_partecipanti || 'da definire'}`

  const specific = getCategorySpecificText(ctx)
  const closing = `

Sareste disponibili nelle date indicate? Potreste inviarci un preventivo dettagliato?

Restiamo a disposizione per qualsiasi chiarimento.

Cordiali saluti,
YEG Events`

  return {
    subject: getSubject(ctx),
    body: base + specific + closing,
  }
}

function getSubject(ctx: EmailContext): string {
  const date = ctx.data_inizio ? ` - ${ctx.data_inizio}` : ''
  const subjects: Record<string, string> = {
    hotel: `Richiesta disponibilita camere - ${ctx.nome_evento}${date}`,
    location: `Richiesta disponibilita venue - ${ctx.nome_evento}${date}`,
    catering: `Richiesta preventivo catering - ${ctx.nome_evento}${date}`,
    trasporti: `Richiesta preventivo trasporti - ${ctx.nome_evento}${date}`,
    entertainment: `Richiesta disponibilita - ${ctx.nome_evento}${date}`,
    teambuilding: `Richiesta preventivo team building - ${ctx.nome_evento}${date}`,
    ristoranti: `Richiesta prenotazione evento - ${ctx.nome_evento}${date}`,
    allestimenti: `Richiesta preventivo allestimenti - ${ctx.nome_evento}${date}`,
    dmc: `Richiesta servizi DMC - ${ctx.nome_evento}${date}`,
  }
  return subjects[ctx.categoria] || `Richiesta informazioni - ${ctx.nome_evento}${date}`
}

function getCategorySpecificText(ctx: EmailContext): string {
  const b = ctx.brief

  switch (ctx.categoria) {
    case 'hotel':
      return `

RICHIESTA SPECIFICA - HOTEL:
- Check-in: ${b.hotel_checkin || 'da definire'}
- Check-out: ${b.hotel_checkout || 'da definire'}
- Camere singole: ${b.camere_singole || 'da definire'}
- Camere doppie: ${b.camere_doppie || 'da definire'}
- Categoria minima: ${b.hotel_stelle_minime || 4} stelle
- Note: ${b.hotel_note || 'nessuna'}

Vi chiediamo cortesemente:
1. Disponibilita nelle date indicate
2. Tariffe corporate per camera/notte (singola e doppia)
3. Eventuali sale meeting disponibili
4. Condizioni di cancellazione`

    case 'location':
      return `

RICHIESTA SPECIFICA - LOCATION/VENUE:
- Setup richiesto: ${b.location_setup || 'da definire'}
- Capienza necessaria: ${ctx.numero_partecipanti} persone
- Tipologia preferita: ${b.location_tipologia || 'flessibile'}
- Dotazione AV richiesta: ${Array.isArray(b.location_av) ? b.location_av.join(', ') : 'da definire'}
- Note: ${b.location_note || 'nessuna'}

Vi chiediamo cortesemente:
1. Disponibilita della sala nelle date indicate
2. Preventivo per affitto giornaliero/mezza giornata
3. Dotazione tecnica inclusa (microfoni, proiettore, etc.)
4. Possibilita catering interno o esterno
5. Planimetrie e foto degli spazi`

    case 'catering':
      return `

RICHIESTA SPECIFICA - CATERING:
- Coffee break: ${b.coffee_break_num || 0} servizi
- Pranzi: ${b.pranzo_num || 0} servizi
- Cene: ${b.cena_num || 0} servizi
- Aperitivi: ${b.aperitivo_num || 0} servizi
- Esigenze alimentari: ${b.esigenze_alimentari || 'nessuna particolare'}
- Note: ${b.catering_note || 'nessuna'}

Vi chiediamo cortesemente:
1. Menu proposti con relativi costi a persona
2. Eventuale servizio beverage incluso/escluso
3. Possibilita di personalizzazione menu
4. Costi di servizio e allestimento
5. Condizioni per allergeni e diete speciali`

    case 'trasporti':
      return `

RICHIESTA SPECIFICA - TRASPORTI:
- Tipologia: ${Array.isArray(b.trasporti_tipo) ? b.trasporti_tipo.join(', ') : 'da definire'}
- Persone da trasportare: ${ctx.numero_partecipanti}
- Note: ${b.trasporti_note || 'nessuna'}

Vi chiediamo cortesemente:
1. Disponibilita mezzi nelle date indicate
2. Preventivo per i servizi richiesti
3. Tipologia mezzi disponibili (bus, minibus, auto)
4. Eventuale servizio di accompagnamento/hostess`

    case 'entertainment':
      return `

RICHIESTA SPECIFICA - ENTERTAINMENT:
- Tipologia: ${b.entertainment_tipo || 'da definire'}
- Contesto: evento corporate per ${ctx.numero_partecipanti} persone
- Note: ${b.entertainment_note || 'nessuna'}

Vi chiediamo cortesemente:
1. Disponibilita nelle date indicate
2. Cachet e condizioni economiche
3. Rider tecnico (esigenze palco, audio, luci)
4. Durata della performance
5. Video/portfolio di eventi precedenti`

    case 'teambuilding':
      return `

RICHIESTA SPECIFICA - TEAM BUILDING:
- Partecipanti: ${ctx.numero_partecipanti}
- Note/preferenze: ${b.teambuilding_note || 'da definire'}

Vi chiediamo cortesemente:
1. Proposte di attivita adatte al nostro gruppo
2. Preventivo dettagliato per persona
3. Requisiti logistici (spazi, materiali)
4. Durata consigliata
5. Referenze di eventi simili`

    default:
      return `

Vi chiediamo cortesemente di inviarci un preventivo dettagliato per i servizi sopra indicati, comprensivo di tutte le voci di costo.`
  }
}
