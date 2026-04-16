-- ============================================================
-- Enable Row Level Security (RLS) on ALL application tables
-- ============================================================
--
-- The anon/public key is exposed to the browser. Without RLS enabled,
-- anyone with that key can read/write every table from the client-side.
--
-- All API routes in this project use the SERVICE client (server-side
-- only) — see frontend/src/lib/supabase.ts and frontend/src/app/api/**.
-- So we can safely lock everything down to service_role only.
--
-- This migration is idempotent and safe to re-run.
-- ============================================================

-- ── FORNITORI (category-specific tables) ─────────────────────
ALTER TABLE fornitori_hotel         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornitori_location      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornitori_catering      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornitori_dmc           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornitori_teambuilding  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornitori_ristoranti    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornitori_allestimenti  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornitori_entertainment ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornitori_trasporti     ENABLE ROW LEVEL SECURITY;

-- ── CORE ─────────────────────────────────────────────────────
ALTER TABLE progetti   ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposte   ENABLE ROW LEVEL SECURITY;
ALTER TABLE storico    ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- ── Policies: service_role-only full access ──────────────────
-- Drop-then-create pattern keeps this file safe to re-run.

DROP POLICY IF EXISTS "service_role_all" ON fornitori_hotel;
CREATE POLICY "service_role_all" ON fornitori_hotel
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON fornitori_location;
CREATE POLICY "service_role_all" ON fornitori_location
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON fornitori_catering;
CREATE POLICY "service_role_all" ON fornitori_catering
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON fornitori_dmc;
CREATE POLICY "service_role_all" ON fornitori_dmc
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON fornitori_teambuilding;
CREATE POLICY "service_role_all" ON fornitori_teambuilding
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON fornitori_ristoranti;
CREATE POLICY "service_role_all" ON fornitori_ristoranti
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON fornitori_allestimenti;
CREATE POLICY "service_role_all" ON fornitori_allestimenti
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON fornitori_entertainment;
CREATE POLICY "service_role_all" ON fornitori_entertainment
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON fornitori_trasporti;
CREATE POLICY "service_role_all" ON fornitori_trasporti
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON progetti;
CREATE POLICY "service_role_all" ON progetti
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON proposte;
CREATE POLICY "service_role_all" ON proposte
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON storico;
CREATE POLICY "service_role_all" ON storico
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON email_logs;
CREATE POLICY "service_role_all" ON email_logs
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
