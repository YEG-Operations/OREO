-- Tabella per tracciare email inviate e risposte dei fornitori
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  progetto_id UUID REFERENCES progetti(id) ON DELETE CASCADE,
  proposta_id BIGINT REFERENCES proposte(id) ON DELETE SET NULL,
  
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
CREATE POLICY "Service role full access" ON email_logs FOR ALL USING (true) WITH CHECK (true);