-- ============================================================
-- Funzione di ricerca fornitori per il workflow n8n
-- Cerca fornitori per citta, categoria e capienza
-- ============================================================

CREATE OR REPLACE FUNCTION search_fornitori(
  p_citta TEXT DEFAULT NULL,
  p_categorie TEXT[] DEFAULT NULL,
  p_pax INT DEFAULT NULL
)
RETURNS SETOF fornitori
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM fornitori
  WHERE attivo = true
    AND (p_citta IS NULL OR LOWER(citta) LIKE '%' || LOWER(p_citta) || '%')
    AND (p_categorie IS NULL OR categoria = ANY(p_categorie))
    AND (p_pax IS NULL OR capacita_max IS NULL OR capacita_max >= p_pax)
  ORDER BY
    -- Priorita: match citta esatto > parziale
    CASE WHEN LOWER(citta) = LOWER(p_citta) THEN 0 ELSE 1 END,
    categoria,
    nome
  LIMIT 100;
$$;
