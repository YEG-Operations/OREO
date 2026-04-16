-- ============================================================
-- Email verification columns on `proposte`
-- ============================================================
-- Adds the columns needed for email-sending safety so we can
-- pre-check supplier email addresses (syntax + MX) before actually
-- firing outbound email. Safe to re-run.
-- ============================================================

ALTER TABLE proposte ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT NULL;
ALTER TABLE proposte ADD COLUMN IF NOT EXISTS email_verification_error TEXT;

-- Default NULL = not yet verified. TRUE = MX lookup OK. FALSE = invalid.
COMMENT ON COLUMN proposte.email_verified IS 'NULL=not checked, TRUE=MX valid, FALSE=MX failed or syntax invalid';
