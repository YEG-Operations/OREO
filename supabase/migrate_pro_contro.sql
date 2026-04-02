-- Aggiunge colonne pro e contro alla tabella proposte
ALTER TABLE proposte ADD COLUMN IF NOT EXISTS pro TEXT[] DEFAULT '{}';
ALTER TABLE proposte ADD COLUMN IF NOT EXISTS contro TEXT[] DEFAULT '{}';
