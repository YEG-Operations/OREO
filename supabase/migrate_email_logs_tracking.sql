-- ============================================================
-- Extend `email_logs` for robust reply matching
-- ============================================================
-- Adds columns + indexes that let the reply webhook (n8n) reliably
-- correlate an inbound message with the original outbound one.
-- Safe to re-run.
-- ============================================================

ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS message_id TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS thread_token TEXT;

CREATE INDEX IF NOT EXISTS idx_email_logs_message_id ON email_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_thread_token ON email_logs(thread_token);

COMMENT ON COLUMN email_logs.message_id IS 'SMTP Message-ID header for reply-matching';
COMMENT ON COLUMN email_logs.thread_token IS 'Unique token included in subject for reliable reply correlation';
