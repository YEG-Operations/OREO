-- ============================================================
-- Tabella per tracciare email inviate e risposte dei fornitori
-- ============================================================
--
-- IMPORTANT: If an earlier (incorrect) version of this migration
-- was already applied, the `email_logs` table may have been created
-- with the WRONG foreign-key types:
--   - progetto_id as UUID (wrong: progetti.id is TEXT — 'PRJ-<epoch>')
--   - proposta_id as BIGINT (wrong: proposte.id is SERIAL / INT)
--
-- In that case, Postgres will reject the FK or the types won't line up.
-- Before re-running this fixed migration, you MUST manually drop the
-- incorrectly-typed table (DESTRUCTIVE — will remove any existing rows):
--
--   DROP TABLE IF EXISTS email_logs CASCADE;
--
-- Do NOT run that DROP automatically here. This file is safe to re-run
-- on a clean DB or on a DB where the table was created with the correct
-- types, thanks to the IF NOT EXISTS guards below.
-- ============================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  progetto_id TEXT REFERENCES progetti(id) ON DELETE CASCADE,
  proposta_id INT REFERENCES proposte(id) ON DELETE SET NULL,

  -- Email
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,

  -- Stato
  status TEXT DEFAULT 'inviata' CHECK (status IN ('inviata', 'consegnata', 'risposta_ricevuta', 'errore')),

  -- Risposta fornitore (compilata dal webhook n8n)
  risposta_body TEXT,
  risposta_data TIMESTAMPTZ,
  risposta_riassunto TEXT,

  -- Metadata
  n8n_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_email_logs_progetto ON email_logs(progetto_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_proposta ON email_logs(proposta_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_to ON email_logs(to_email);

-- RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON email_logs;
CREATE POLICY "Service role full access" ON email_logs FOR ALL USING (true) WITH CHECK (true);
