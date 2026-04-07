-- ============================================================
-- Migrazione: Gestione costi, markup, email operatore, trasporti
-- ============================================================

-- Nuovi campi su progetti
ALTER TABLE progetti ADD COLUMN IF NOT EXISTS email_operatore TEXT;
ALTER TABLE progetti ADD COLUMN IF NOT EXISTS markup_percentuale DECIMAL(5,2) DEFAULT 0;
ALTER TABLE progetti ADD COLUMN IF NOT EXISTS iva_percentuale DECIMAL(5,2) DEFAULT 22;
ALTER TABLE progetti ADD COLUMN IF NOT EXISTS fee_agenzia_percentuale DECIMAL(5,2) DEFAULT 0;
ALTER TABLE progetti ADD COLUMN IF NOT EXISTS frasi_standard_costi TEXT;
-- Nasconde nomi fornitori di default (tranne hotel/location che sono "strutture")
ALTER TABLE progetti ADD COLUMN IF NOT EXISTS nascondi_fornitori BOOLEAN DEFAULT true;

-- Nuovi campi su proposte (markup e IVA per singola card, sovrascrivono il default progetto)
ALTER TABLE proposte ADD COLUMN IF NOT EXISTS da_verificare BOOLEAN DEFAULT false;
ALTER TABLE proposte ADD COLUMN IF NOT EXISTS markup_percentuale DECIMAL(5,2) DEFAULT NULL;
ALTER TABLE proposte ADD COLUMN IF NOT EXISTS iva_percentuale DECIMAL(5,2) DEFAULT 22;
