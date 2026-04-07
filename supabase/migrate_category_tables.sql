-- ============================================================
-- Migrazione: tabelle categoria-specifiche per i fornitori
-- ============================================================

-- Rimuovi la vecchia tabella generica (o lasciala, non è più usata)
-- DROP TABLE IF EXISTS fornitori;

-- ── HOTEL ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fornitori_hotel (
  id              BIGSERIAL PRIMARY KEY,
  nome            TEXT NOT NULL,
  citta           TEXT,
  provincia       TEXT,
  stelle          TEXT,           -- '4', '5', '3*', ecc.
  tipologia       TEXT,           -- Hotel, Resort, Boutique, ecc.
  num_camere      INT,
  capienza_max    INT,            -- max pax sala/evento
  sale_meeting    TEXT,
  telefono        TEXT,
  email           TEXT,
  sito_web        TEXT,
  parcheggio      TEXT,
  ristorante      TEXT,
  wellness_spa    TEXT,
  voto            TEXT,
  prezzo_indicativo TEXT,
  servizi_offerti TEXT,
  spazi_disponibili TEXT,
  allestimento_base TEXT,
  catering_esterno TEXT,
  punti_di_forza  TEXT,
  criticita       TEXT,
  note_tecniche   TEXT,
  note            TEXT,
  fonte           TEXT,
  attivo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOCATION ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fornitori_location (
  id              BIGSERIAL PRIMARY KEY,
  nome            TEXT NOT NULL,
  citta           TEXT,
  tipologia       TEXT,           -- Museo, Palazzo storico, Teatro, ecc.
  capienza_max    INT,
  spazi_disponibili TEXT,
  servizi_offerti TEXT,
  prezzo          NUMERIC(12,2),
  unita_prezzo    TEXT,           -- 'rental fee', '/giornata', ecc.
  contatto_nome   TEXT,
  contatto_email  TEXT,
  contatto_tel    TEXT,
  sito_web        TEXT,
  prezzo_indicativo TEXT,
  allestimento_base TEXT,
  catering_esterno TEXT,
  punti_di_forza  TEXT,
  criticita       TEXT,
  note_tecniche   TEXT,
  note            TEXT,
  completezza_dati TEXT,
  fonte           TEXT,
  attivo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── CATERING ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fornitori_catering (
  id              BIGSERIAL PRIMARY KEY,
  nome            TEXT NOT NULL,
  citta           TEXT,
  indirizzo       TEXT,
  telefono        TEXT,
  email           TEXT,
  sito_web        TEXT,
  referente       TEXT,
  tipo_cucina     TEXT,
  adatto_a        TEXT[],         -- ['Aziendale','Cocktail',...]
  servizi         TEXT[],         -- cosa include
  extra_disponibili TEXT[],
  allestimento_incluso TEXT,
  prezzo_persona  NUMERIC(10,2),
  condizioni_pagamento TEXT,
  note            TEXT,
  is_yeg_supplier BOOLEAN DEFAULT false,
  fonte           TEXT,
  attivo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── DMC ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fornitori_dmc (
  id              BIGSERIAL PRIMARY KEY,
  nome            TEXT NOT NULL,
  paese_regione   TEXT,
  citta           TEXT,
  tipologia_servizi TEXT,
  specializzazioni TEXT,
  contatto_email  TEXT,
  contatto_tel    TEXT,
  sito_web        TEXT,
  network         TEXT,
  lingue          TEXT,
  note            TEXT,
  attivo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── TEAMBUILDING / EXPERIENCE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS fornitori_teambuilding (
  id              BIGSERIAL PRIMARY KEY,
  fornitore       TEXT NOT NULL,
  citta           TEXT,
  attivita        TEXT[],         -- lista attività offerte
  categoria_attivita TEXT,
  pax_min         INT,
  pax_max         INT,
  durata          TEXT,
  prezzo_min      NUMERIC(12,2),
  prezzo_max      NUMERIC(12,2),
  unita_prezzo    TEXT,
  contatto_email  TEXT,
  contatto_tel    TEXT,
  note            TEXT,
  attivo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── RISTORANTI (FOOD + RISTORANTI_ITALIA) ────────────────────
CREATE TABLE IF NOT EXISTS fornitori_ristoranti (
  id              BIGSERIAL PRIMARY KEY,
  nome            TEXT NOT NULL,
  citta           TEXT,
  tipo            TEXT,           -- Restaurant, Gala dinner, ecc.
  capienza_max    INT,
  prezzo_pax      NUMERIC(10,2),
  portate         TEXT,
  bevande_incluse TEXT,
  email           TEXT,
  telefono        TEXT,
  sito_web        TEXT,
  contatti        TEXT,           -- testo libero extra
  note            TEXT,
  fonte           TEXT,
  attivo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ALLESTIMENTI / SERVICE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS fornitori_allestimenti (
  id              BIGSERIAL PRIMARY KEY,
  fornitore       TEXT NOT NULL,
  categoria_servizio TEXT,        -- Allestimenti, Audio/Video, Luci, ecc.
  prodotto_servizio TEXT,
  descrizione     TEXT,
  unita           TEXT,
  prezzo          NUMERIC(12,2),
  iva_percentuale NUMERIC(5,2),
  citta           TEXT,
  telefono        TEXT,
  email           TEXT,
  sito_web        TEXT,
  note            TEXT,
  fonte           TEXT,
  attivo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ENTERTAINMENT / SPEAKER & GUEST ──────────────────────────
CREATE TABLE IF NOT EXISTS fornitori_entertainment (
  id              BIGSERIAL PRIMARY KEY,
  nome            TEXT NOT NULL,
  categoria_artista TEXT,
  agenzia         TEXT,
  citta           TEXT,
  prezzo_netto_min  NUMERIC(12,2),
  prezzo_netto_max  NUMERIC(12,2),
  iva_percentuale   NUMERIC(5,2),
  prezzo_totale_min NUMERIC(12,2),
  prezzo_totale_max NUMERIC(12,2),
  servizi_inclusi TEXT[],
  costi_extra     TEXT,
  durata_formato  TEXT,
  vantaggi_usp    TEXT,
  personalizzabile TEXT,
  contatto_email  TEXT,
  contatto_tel    TEXT,
  sito_web        TEXT,
  validita        TEXT,
  condizioni_pagamento TEXT,
  fonte           TEXT,
  attivo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRASPORTI / ASSISTENZE AEROPORTUALI ──────────────────────
CREATE TABLE IF NOT EXISTS fornitori_trasporti (
  id              BIGSERIAL PRIMARY KEY,
  fornitore       TEXT NOT NULL,
  tipo_servizio   TEXT,
  aeroporto       TEXT,
  codice_iata     TEXT,
  durata_base     TEXT,
  prezzo_base     NUMERIC(10,2),
  extra_ora       NUMERIC(10,2),
  sala_vip_pax    TEXT,
  fast_track_pax  TEXT,
  porter          TEXT,
  banchi_gruppi   TEXT,
  telefono        TEXT,
  email           TEXT,
  supplementi     TEXT,
  note            TEXT,
  anno            TEXT,
  fonte           TEXT,
  attivo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
