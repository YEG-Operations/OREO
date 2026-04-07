-- Aggiunge il campo immagini (array di URL) alla tabella proposte
-- Permette di associare multiple foto a hotel e location

ALTER TABLE proposte
ADD COLUMN IF NOT EXISTS immagini jsonb DEFAULT '[]'::jsonb;

-- Commento
COMMENT ON COLUMN proposte.immagini IS 'Array di URL immagini (per hotel/location, 3+ foto per proposta)';