-- ============================================================
-- YEG Event Planner - Schema Supabase
-- ============================================================

-- FORNITORI: database completo con parametri per matching AI
CREATE TABLE fornitori (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'location', 'catering', 'hotel', 'trasporti', 'dmc',
    'entertainment', 'teambuilding', 'allestimenti', 'ristoranti', 'servizi_professionali'
  )),
  citta TEXT,
  regione TEXT,

  -- Parametri di matching
  capacita_min INT,
  capacita_max INT,
  prezzo_min NUMERIC(10,2),
  prezzo_max NUMERIC(10,2),
  prezzo_unita TEXT,           -- 'a persona', 'a giornata', 'forfait', 'a camera/notte'

  -- Parametri specifici per categoria (JSONB flessibile)
  specifiche JSONB DEFAULT '{}',
  -- Location: { "tipologia": "museo|loft|palazzo|teatro|rooftop|spazio_congressi|industriale",
  --             "setup": ["teatro","banquet","standing","classroom","cabaret"],
  --             "mq": 500, "av_incluso": true, "catering_interno": false, "parcheggio": true }
  -- Catering: { "tipo_servizio": ["galadinner","buffet","coffee_break","aperitivo","lunch"],
  --             "tipo_cucina": "italiana|fusion|internazionale", "certificazioni": ["bio","km0","halal"] }
  -- Hotel:    { "stelle": 5, "camere_totali": 200, "sale_meeting": 3, "cap_meeting_max": 500,
  --             "spa": true, "ristorante": true, "parcheggio": true, "distanza_centro_km": 2 }
  -- Trasporti: { "tipo_veicolo": ["bus50","bus30","minibus","auto_blu","van"],
  --              "aeroporti": ["MXP","LIN","FCO"], "servizio": "transfer|noleggio|assistenza" }
  -- DMC:      { "copertura": ["italia","europa","mondo"], "specializzazione": "incentive|congress|mice" }
  -- Entertainment: { "tipo": "dj|band|sportivo|motivatore|show|animazione",
  --                   "adatto_per": ["galadinner","party","convention","aperitivo"] }
  -- Teambuilding: { "attivita": ["escape_room","outdoor","cooking","rally","olimpiadi"],
  --                  "indoor_outdoor": "indoor|outdoor|entrambi", "durata_ore": 3 }
  -- Allestimenti: { "tipo_servizio": "arredi|stampa|fiori|luci|strutture|segnaletica|noleggio" }
  -- Ristoranti: { "stelle_michelin": 1, "tipo_cucina": "italiana|pesce|carne|fusion",
  --               "prenotazione_esclusiva": true, "sala_privata": true }

  contatti JSONB DEFAULT '{}',   -- { "telefono": "", "email": "", "referente": "" }
  servizi_inclusi TEXT[] DEFAULT '{}',
  adatto_per TEXT[] DEFAULT '{}',  -- 'convention','galadinner','meeting','party','incentive','lancio_prodotto'

  note TEXT,
  file_sorgente TEXT,            -- path relativo al file originale in /suppliers
  sito_web TEXT,
  immagine_url TEXT,
  is_yeg_supplier BOOLEAN DEFAULT true,
  attivo BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice full-text search
CREATE INDEX idx_fornitori_search ON fornitori USING GIN (to_tsvector('italian', coalesce(nome,'') || ' ' || coalesce(citta,'') || ' ' || coalesce(note,'')));
CREATE INDEX idx_fornitori_categoria ON fornitori (categoria);
CREATE INDEX idx_fornitori_citta ON fornitori (citta);
CREATE INDEX idx_fornitori_capacita ON fornitori (capacita_min, capacita_max);
CREATE INDEX idx_fornitori_prezzo ON fornitori (prezzo_min, prezzo_max);

-- PROGETTI: ogni brief genera un progetto
CREATE TABLE progetti (
  id TEXT PRIMARY KEY DEFAULT 'PRJ-' || extract(epoch from now())::bigint::text,
  stato TEXT DEFAULT 'nuovo' CHECK (stato IN ('nuovo','in_lavorazione','inviato','confermato','archiviato')),

  -- Brief originale (dati grezzi dal form)
  brief_raw JSONB NOT NULL,

  -- Brief interpretato dall'AI
  brief_interpretato JSONB,

  -- Dati strutturati dal brief
  nome_evento TEXT,
  tipologia_evento TEXT,
  nome_referente TEXT,
  email_referente TEXT,
  azienda TEXT,
  citta TEXT,
  data_inizio DATE,
  data_fine DATE,
  numero_partecipanti INT,
  budget_totale NUMERIC(12,2),
  agenda TEXT,
  componenti_richieste TEXT[] DEFAULT '{}', -- ['hotel','location','catering','trasporti','entertainment']

  note_manager TEXT,
  token_cliente TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_progetti_stato ON progetti (stato);
CREATE INDEX idx_progetti_token ON progetti (token_cliente);

-- PROPOSTE: le proposte AI/manager per ogni categoria di ogni progetto
CREATE TABLE proposte (
  id SERIAL PRIMARY KEY,
  progetto_id TEXT REFERENCES progetti(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,        -- 'hotel', 'location', 'catering', etc.

  -- Dati proposta
  nome TEXT NOT NULL,
  descrizione TEXT,
  motivo_match TEXT,              -- perche questa proposta e' adatta al brief
  prezzo_stimato NUMERIC(10,2),
  costo_reale NUMERIC(10,2),     -- compilato dal manager
  capacita TEXT,
  indirizzo TEXT,
  punti_forza TEXT[] DEFAULT '{}',
  adeguatezza_budget INT CHECK (adeguatezza_budget BETWEEN 0 AND 100),
  note TEXT,
  sito_web TEXT,
  contatto TEXT,
  immagine_url TEXT,

  -- Provenienza
  fonte TEXT DEFAULT 'ai' CHECK (fonte IN ('ai','yeg_db','web','manager')),
  fornitore_id INT REFERENCES fornitori(id),
  is_yeg_supplier BOOLEAN DEFAULT false,

  -- Stato selezione
  selezionato_manager BOOLEAN DEFAULT false,   -- il manager l'ha inclusa nella proposta al cliente
  selezionato_cliente BOOLEAN DEFAULT false,    -- il cliente l'ha scelta
  ordine INT DEFAULT 0,                         -- ordine di presentazione

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proposte_progetto ON proposte (progetto_id);
CREATE INDEX idx_proposte_categoria ON proposte (progetto_id, categoria);

-- STORICO: log azioni su ogni progetto
CREATE TABLE storico (
  id SERIAL PRIMARY KEY,
  progetto_id TEXT REFERENCES progetti(id) ON DELETE CASCADE,
  azione TEXT NOT NULL,
  utente TEXT DEFAULT 'sistema',
  dettagli JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_storico_progetto ON storico (progetto_id);

-- Funzione per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_fornitori_updated BEFORE UPDATE ON fornitori FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_progetti_updated BEFORE UPDATE ON progetti FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_proposte_updated BEFORE UPDATE ON proposte FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS (Row Level Security) - opzionale, da abilitare se serve auth
-- ALTER TABLE fornitori ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE progetti ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE proposte ENABLE ROW LEVEL SECURITY;
